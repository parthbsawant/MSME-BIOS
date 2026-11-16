"""
Score the categorizer on split == 'test' rows against label_stage1.

    python -m categorizer.evaluate                   (from backend/parser-backend)

Prints accuracy per category, clean vs messy accuracy, where the answers
came from (rule / model / other), and the worst confusion pairs.
"""

import argparse
from collections import Counter, defaultdict

from .categorize import categorize, get_model
from .taxonomy import side_of
from .train import DEFAULT_CSV, load_rows


def score(csv_path: str = DEFAULT_CSV):
    """Returns a list of (row, CategoryResult) for the test split."""
    return [(r, categorize(r["narration"], r["debit"], r["credit"])) for r in load_rows(csv_path, "test")]


def accuracy(pairs) -> float:
    return sum(1 for r, res in pairs if res.category == r["label_stage1"]) / len(pairs) if pairs else 0.0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=DEFAULT_CSV)
    args = ap.parse_args()

    pairs = score(args.csv)

    per = defaultdict(lambda: [0, 0, 0, 0])  # clean_ok, clean_n, messy_ok, messy_n
    for r, res in pairs:
        i = 0 if r["variant"] == "clean" else 2
        per[r["label_stage1"]][i + 1] += 1
        per[r["label_stage1"]][i] += int(res.category == r["label_stage1"])

    def pct(ok, n):
        return f"{100 * ok / n:6.1f}%" if n else "     - "

    print(f"{'category':18} {'clean n':>7} {'clean':>7} {'messy n':>7} {'messy':>7}")
    print("-" * 52)
    for cat in sorted(per):
        co, cn, mo, mn = per[cat]
        print(f"{cat:18} {cn:7} {pct(co, cn)} {mn:7} {pct(mo, mn)}")
    print("-" * 52)
    clean = [p for p in pairs if p[0]["variant"] == "clean"]
    messy = [p for p in pairs if p[0]["variant"] == "messy"]
    print(f"{'ALL':18} {len(clean):7} {pct(accuracy(clean) * len(clean), len(clean))} "
          f"{len(messy):7} {pct(accuracy(messy) * len(messy), len(messy))}")
    print(f"overall test accuracy: {100 * accuracy(pairs):.1f}% on {len(pairs)} rows")

    # How good is the Naive Bayes backup on its own (rules switched off)?
    model = get_model()
    if model is not None:
        known = [r for r, _ in pairs if r["label_stage1"] != "other"]
        for variant in ("clean", "messy"):
            rs = [r for r in known if r["variant"] == variant]
            ok = sum(1 for r in rs if model.predict(r["narration"], side_of(r["debit"], r["credit"]))[0] == r["label_stage1"])
            print(f"model alone (no rules), {variant}: {pct(ok, len(rs)).strip()} of {len(rs)} rows")

    src = Counter(res.source or "other/needs_review" for _, res in pairs)
    print("answer source: " + ", ".join(f"{k} {v}" for k, v in src.most_common()))

    conf = Counter((r["label_stage1"], res.category) for r, res in pairs if res.category != r["label_stage1"])
    print("worst confusions (true -> predicted):")
    if not conf:
        print("  none")
    for (t, p), n in conf.most_common(10):
        print(f"  {n:4}  {t} -> {p}")


if __name__ == "__main__":
    main()
