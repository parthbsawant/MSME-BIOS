"""
Step 4 (4e-4g): invitations, seats, members, audit log (SPEC.md sections
4, 6 and 9). Every member here joins through the real invite flow.
"""

import hashlib
import uuid

import pytest
from fastapi.testclient import TestClient

from api import app
from firebase_auth import verify_firebase_token
from db_pool import get_connection
from checkout_helpers import buy_plan

pytestmark = pytest.mark.db  # uses the test database - see conftest.py

BANK_PDF = "tests/sample_statements/test_statement.pdf"


@pytest.fixture(autouse=True)
def clean_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _identity(prefix):
    n = uuid.uuid4().hex[:10]
    return f"uid_{prefix}_{n}", f"{prefix}_{n}@test.com"


def _as(person):
    uid, email = person
    app.dependency_overrides[verify_firebase_token] = lambda: {"uid": uid, "email": email, "name": "T"}


def _sql(sql, params=(), fetch=None):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            result = cur.fetchall() if fetch == "all" else cur.fetchone() if fetch == "one" else None
        conn.commit()
        return result
    finally:
        conn.close()


def _owner(client, tier_id="growth", extra_seats=0, business_name="Team Test Traders"):
    """A paid business with details. Returns (owner identity, tenant_id)."""
    owner = _identity("own")
    _as(owner)
    tenant_id = client.get("/api/me").json()["tenant_id"]
    client.post("/api/business", data={"business_name": business_name, "owner_name": "Owner"})
    assert buy_plan(client, tier_id=tier_id, extra_seats=extra_seats)[1].json()["status"] == "active"
    return owner, tenant_id


def _invite(client, email, role="finance"):
    return client.post("/api/team/invites", data={"email": email, "role": role})


def _join(client, owner, role="finance"):
    """Owner invites a new person, who accepts. Returns their identity."""
    person = _identity(role)
    _as(owner)
    r = _invite(client, person[1], role)
    assert r.status_code == 200, r.text
    _as(person)
    assert client.post("/api/invites/accept", data={"token": r.json()["token"]}).status_code == 200
    return person


def _upload(client, **extra):
    with open(BANK_PDF, "rb") as f:
        return client.post("/api/parse", files={"file": ("s.pdf", f, "application/pdf")},
                           data={"document_type": "bank_statement", **extra})


# ---- the full invite flow ----

def test_invite_accept_joins_with_role_and_department(client):
    owner, tenant_id = _owner(client)
    invitee = _identity("fin")
    _as(owner)
    r = _invite(client, invitee[1].upper(), "finance")  # email case does not matter
    assert r.status_code == 200
    invite = r.json()
    assert invite["email"] == invitee[1] and invite["role"] == "finance"
    assert invite["invite_path"] == f"/invite/{invite['token']}"

    _as(invitee)
    assert client.get("/api/me").json()["invite_pending"] is True  # no business of their own
    accepted = client.post("/api/invites/accept", data={"token": invite["token"]})
    assert accepted.status_code == 200
    assert accepted.json() == {"status": "joined", "tenant_id": tenant_id, "role": "finance", "department": "finance"}

    me = client.get("/api/me").json()
    assert me["tenant_id"] == tenant_id and me["role"] == "finance" and me["invite_pending"] is False

    _as(owner)
    members = client.get("/api/team/members").json()["members"]
    assert [m["role"] for m in members] == ["owner", "finance"]
    assert members[1]["email"] == invitee[1]


def test_only_a_hash_of_the_token_is_stored(client):
    owner, tenant_id = _owner(client)
    token = _invite(client, _identity("x")[1]).json()["token"]
    row = _sql("SELECT token_hash FROM invitations WHERE tenant_id = %s", (tenant_id,), "one")
    assert row["token_hash"] == hashlib.sha256(token.encode()).hexdigest()
    assert token not in str(_sql("SELECT * FROM invitations WHERE tenant_id = %s", (tenant_id,), "all"))


def test_preview_shows_business_and_role(client):
    owner, _ = _owner(client, business_name="Preview Traders")
    invite = _invite(client, _identity("p")[1], "hr").json()
    app.dependency_overrides.clear()  # public endpoint
    preview = client.get(f"/api/invites/{invite['token']}").json()
    assert preview == {"business_name": "Preview Traders", "role": "hr", "email": invite["email"], "status": "pending"}
    assert client.get("/api/invites/not-a-real-token").status_code == 404


# ---- seats ----

def test_seat_limit_counts_members_and_pending_invites(client):
    owner, _ = _owner(client, tier_id="starter")  # 2 seats: owner + 1
    first = _invite(client, _identity("a")[1])
    assert first.status_code == 200
    second = _invite(client, _identity("b")[1])
    assert second.status_code == 409
    assert second.json()["error"] == "seat_limit"

    client.post(f"/api/team/invites/{first.json()['invite_id']}/revoke")
    assert _invite(client, _identity("c")[1]).status_code == 200  # the seat is free again

    seats = client.get("/api/team/members").json()["seats"]
    assert seats == {"purchased": 2, "active_members": 1, "pending_invites": 1, "in_use": 2}


def test_extra_seats_allow_more_invites(client):
    owner, _ = _owner(client, tier_id="starter", extra_seats=1)  # 3 seats
    assert _invite(client, _identity("a")[1]).status_code == 200
    assert _invite(client, _identity("b")[1]).status_code == 200
    assert _invite(client, _identity("c")[1]).json()["error"] == "seat_limit"


def test_expired_invite_frees_its_seat_and_can_be_resent(client):
    owner, tenant_id = _owner(client, tier_id="starter")
    email = _identity("late")[1]
    _invite(client, email)
    _sql("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE tenant_id = %s", (tenant_id,))
    again = _invite(client, email)
    assert again.status_code == 200
    statuses = [i["status"] for i in client.get("/api/team/invites").json()["invites"]]
    assert sorted(statuses) == ["pending", "revoked"]


# ---- accepting: every invalid link fails ----

def test_wrong_email_cannot_accept(client):
    owner, _ = _owner(client)
    token = _invite(client, _identity("right")[1]).json()["token"]
    _as(_identity("wrong"))
    r = client.post("/api/invites/accept", data={"token": token})
    assert r.status_code == 403 and r.json()["error"] == "invite_wrong_email"


def test_expired_invite_cannot_be_accepted(client):
    owner, tenant_id = _owner(client)
    invitee = _identity("exp")
    token = _invite(client, invitee[1]).json()["token"]
    _sql("UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE tenant_id = %s", (tenant_id,))
    _as(invitee)
    r = client.post("/api/invites/accept", data={"token": token})
    assert r.status_code == 410 and r.json()["error"] == "invite_expired"


def test_revoked_invite_cannot_be_accepted(client):
    owner, _ = _owner(client)
    invitee = _identity("rev")
    invite = _invite(client, invitee[1]).json()
    client.post(f"/api/team/invites/{invite['invite_id']}/revoke")
    _as(invitee)
    r = client.post("/api/invites/accept", data={"token": invite["token"]})
    assert r.status_code == 410 and r.json()["error"] == "invite_revoked"


def test_invite_can_be_used_only_once(client):
    owner, _ = _owner(client)
    invitee = _identity("once")
    token = _invite(client, invitee[1]).json()["token"]
    _as(invitee)
    assert client.post("/api/invites/accept", data={"token": token}).status_code == 200
    r = client.post("/api/invites/accept", data={"token": token})
    assert r.status_code == 409 and r.json()["error"] == "invite_used"


def test_unknown_token_cannot_be_accepted(client):
    _as(_identity("nobody"))
    r = client.post("/api/invites/accept", data={"token": "made-up"})
    assert r.status_code == 404 and r.json()["error"] == "invite_invalid"


# ---- invitee who already has a business ----

def test_invitee_with_empty_own_business_joins_and_it_is_deleted(client):
    owner, tenant_id = _owner(client)
    invitee = _identity("early")
    _as(invitee)
    own_tenant = client.get("/api/me").json()["tenant_id"]  # signed up before being invited: empty business
    _as(owner)
    token = _invite(client, invitee[1]).json()["token"]
    _as(invitee)
    assert client.post("/api/invites/accept", data={"token": token}).status_code == 200
    assert client.get("/api/me").json()["tenant_id"] == tenant_id
    assert _sql("SELECT count(*) AS n FROM tenants WHERE id = %s", (own_tenant,), "one")["n"] == 0


def test_invitee_with_a_real_business_is_refused(client):
    owner, _ = _owner(client)
    invitee = _identity("busy")
    _as(invitee)
    own_tenant = client.get("/api/me").json()["tenant_id"]
    client.post("/api/business", data={"business_name": "Their Own Shop", "owner_name": "Them"})
    _as(owner)
    token = _invite(client, invitee[1]).json()["token"]
    _as(invitee)
    r = client.post("/api/invites/accept", data={"token": token})
    assert r.status_code == 409 and r.json()["error"] == "has_business"
    assert client.get("/api/me").json()["tenant_id"] == own_tenant  # nothing changed, nothing deleted


# ---- owner manages members ----

def test_role_change_changes_what_the_member_sees(client):
    owner, _ = _owner(client)
    finance_doc = _upload(client, department="finance").json()["document_id"]
    hr_doc = _upload(client, department="hr").json()["document_id"]
    member = _join(client, owner, "finance")

    _as(member)
    assert {d["document_id"] for d in client.get("/api/documents").json()["documents"]} == {finance_doc}

    _as(owner)
    member_id = client.get("/api/team/members").json()["members"][1]["user_id"]
    r = client.post(f"/api/team/members/{member_id}/role", data={"role": "hr"})
    assert r.json() == {"status": "ok", "role": "hr", "department": "hr"}

    _as(member)
    assert client.get("/api/me").json()["role"] == "hr"
    assert {d["document_id"] for d in client.get("/api/documents").json()["documents"]} == {hr_doc}


def test_owner_cannot_be_re_roled_or_deactivated(client):
    owner, _ = _owner(client)
    owner_id = client.get("/api/team/members").json()["members"][0]["user_id"]
    for r in (client.post(f"/api/team/members/{owner_id}/role", data={"role": "finance"}),
              client.post(f"/api/team/members/{owner_id}/deactivate")):
        assert r.status_code == 403 and r.json()["error"] == "owner_protected"
    assert _invite(client, _identity("o")[1], role="owner").status_code == 400


def test_deactivate_locks_member_out_and_frees_the_seat(client):
    owner, _ = _owner(client, tier_id="starter")  # 2 seats
    member = _join(client, owner, "finance")
    _as(owner)
    member_id = client.get("/api/team/members").json()["members"][1]["user_id"]
    assert _invite(client, _identity("full")[1]).json()["error"] == "seat_limit"

    client.post(f"/api/team/members/{member_id}/deactivate")
    _as(member)
    assert client.get("/api/documents").json()["error"] == "deactivated"

    _as(owner)
    replacement = _invite(client, _identity("new")[1])
    assert replacement.status_code == 200  # seat freed
    r = client.post(f"/api/team/members/{member_id}/reactivate")
    assert r.status_code == 409 and r.json()["error"] == "seat_limit"  # no seat to come back to

    client.post(f"/api/team/invites/{replacement.json()['invite_id']}/revoke")
    assert client.post(f"/api/team/members/{member_id}/reactivate").status_code == 200
    _as(member)
    assert client.get("/api/documents").status_code == 200


@pytest.mark.parametrize("bad", [
    {"email": "not-an-email", "role": "finance"},
    {"email": "x@test.com", "role": "admin"},
])
def test_invalid_invites_rejected(client, bad):
    _owner(client)
    assert client.post("/api/team/invites", data=bad).status_code == 400


def test_duplicate_invites_and_existing_members_rejected(client):
    owner, _ = _owner(client)
    email = _identity("dup")[1]
    _invite(client, email)
    assert _invite(client, email).json()["error"] == "invite_exists"
    member = _join(client, owner, "hr")
    _as(owner)
    assert _invite(client, member[1]).json()["error"] == "already_member"


# ---- who may manage the team ----

@pytest.mark.parametrize("role", ["finance", "sales", "hr", "marketing"])
def test_members_cannot_use_team_endpoints(client, role):
    owner, _ = _owner(client, tier_id="full_suite")
    member = _join(client, owner, role)
    _as(member)
    some_id = str(uuid.uuid4())
    for r in (client.post("/api/team/invites", data={"email": "z@test.com", "role": "finance"}),
              client.get("/api/team/invites"),
              client.get("/api/team/members"),
              client.get("/api/team/audit"),
              client.post(f"/api/team/invites/{some_id}/revoke"),
              client.post(f"/api/team/members/{some_id}/role", data={"role": "hr"}),
              client.post(f"/api/team/members/{some_id}/deactivate")):
        assert r.status_code == 403 and r.json()["error"] == "owner_only", r.text


def test_unpaid_owner_cannot_invite(client):
    _as(_identity("unpaid"))
    client.get("/api/me")
    r = _invite(client, "someone@test.com")
    assert r.status_code == 402


def test_one_business_cannot_touch_another_business_team(client):
    owner_a, _ = _owner(client)
    invite_a = _invite(client, _identity("a")[1]).json()
    member_a = _join(client, owner_a, "finance")
    _as(owner_a)
    member_a_id = client.get("/api/team/members").json()["members"][1]["user_id"]

    owner_b, _ = _owner(client)
    assert client.post(f"/api/team/invites/{invite_a['invite_id']}/revoke").status_code == 404
    assert client.post(f"/api/team/members/{member_a_id}/deactivate").status_code == 404
    assert client.post(f"/api/team/members/{member_a_id}/role", data={"role": "hr"}).status_code == 404
    assert all(m["email"] != member_a[1] for m in client.get("/api/team/members").json()["members"])

    _as(member_a)
    assert client.get("/api/me").json()["role"] == "finance"  # untouched


# ---- audit log ----

def test_team_actions_are_audited(client):
    owner, _ = _owner(client)
    revoked = _invite(client, _identity("r")[1]).json()
    client.post(f"/api/team/invites/{revoked['invite_id']}/revoke")
    member = _join(client, owner, "finance")
    _as(owner)
    member_id = client.get("/api/team/members").json()["members"][1]["user_id"]
    client.post(f"/api/team/members/{member_id}/role", data={"role": "sales"})
    client.post(f"/api/team/members/{member_id}/deactivate")
    client.post(f"/api/team/members/{member_id}/reactivate")

    entries = client.get("/api/team/audit").json()["entries"]
    assert [e["action"] for e in reversed(entries)] == [
        "invite.created", "invite.revoked", "invite.created", "member.joined",
        "member.role_changed", "member.deactivated", "member.reactivated",
    ]
    role_change = next(e for e in entries if e["action"] == "member.role_changed")
    assert role_change["details"] == {"from": "finance", "to": "sales"}
    assert role_change["actor_email"] == owner[1]
    joined = next(e for e in entries if e["action"] == "member.joined")
    assert joined["actor_email"] == member[1]
