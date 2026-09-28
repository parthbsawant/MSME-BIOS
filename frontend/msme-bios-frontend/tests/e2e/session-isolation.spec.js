import { test, expect } from '@playwright/test'

const USER_A_EMAIL = process.env.PLAYWRIGHT_USER_A_EMAIL
const USER_A_PASSWORD = process.env.PLAYWRIGHT_USER_A_PASSWORD

const USER_B_EMAIL = process.env.PLAYWRIGHT_USER_B_EMAIL
const USER_B_PASSWORD = process.env.PLAYWRIGHT_USER_B_PASSWORD

async function login(page, email, password) {
  await page.goto('/login')

  await page
    .getByPlaceholder('you@example.com')
    .fill(email)

  await page
    .getByPlaceholder('Enter your password')
    .fill(password)

  await page
    .locator('button[type="submit"]')
    .click()

  // Wait for authentication to complete and
  // for the login page to redirect.
  await expect(page).not.toHaveURL(/\/login$/)
}

async function saveBusiness(page, business) {
  await expect(page).toHaveURL(/\/business-setup$/)

  await page
    .getByPlaceholder('e.g. Shree Ganesh Stores')
    .fill(business.businessName)

  await page
    .getByPlaceholder('e.g. Ramesh Patil')
    .fill(business.ownerName)

  await page
    .getByPlaceholder('e.g. Pune')
    .fill(business.city)

  await page
    .getByPlaceholder('e.g. 27ABCDE1234F1Z5')
    .fill(business.gstin)

  await page
    .getByRole('button', {
      name: 'Continue to plans',
    })
    .click()

  await expect(page).toHaveURL(/\/choose-plan$/)
}

async function selectPlan(page, tierName) {
  const tierNameText = page.getByText(tierName, {
    exact: true,
  })

  await expect(tierNameText).toBeVisible()

  const tierCard = tierNameText.locator('..')

  await tierCard
    .getByRole('button', {
      name: 'Review plan',
    })
    .click()

  await expect(page).toHaveURL(
    new RegExp('/plan-summary/[^/]+$'),
  )

  await page
    .getByRole('button', {
      name: 'Confirm and continue',
    })
    .click()

  await expect(page).toHaveURL(/\/dashboard$/)
}

async function logout(page) {
  const userMenuButton = page.getByRole('button', {
    name: /@/,
  })

  await userMenuButton.click()

  await page
    .getByRole('button', {
      name: 'Log out',
    })
    .click()

  await expect(page).toHaveURL(/\/login$/)
}

test.describe('Session isolation', () => {
  test('User A and User B remain isolated after logout and login in the same browser session', async ({
    page,
  }) => {
    // --------------------------------------------------
    // USER A LOGIN
    // --------------------------------------------------

    await login(
      page,
      USER_A_EMAIL,
      USER_A_PASSWORD,
    )

    await expect(page).toHaveURL(
      /\/business-setup$/,
    )

    // --------------------------------------------------
    // USER A BUSINESS SETUP
    // --------------------------------------------------

    await saveBusiness(page, {
      businessName: 'MSME Session Test Business A',
      ownerName: 'Session Test Owner A',
      city: 'Pune',
      gstin: '27AAAAA1111A1Z5',
    })

    // --------------------------------------------------
    // USER A PLAN
    // --------------------------------------------------

    await selectPlan(page, 'Starter')

    // --------------------------------------------------
    // GET USER A UID AND VERIFY USER A STORAGE
    // --------------------------------------------------

    const userAState = await page.evaluate(() => {
      const businessEntry = Object.entries(
        localStorage,
      ).find(([key]) =>
        key.startsWith('msme-business-'),
      )

      const planEntry = Object.entries(
        localStorage,
      ).find(([key]) =>
        key.startsWith('msme-plan-'),
      )

      const onboardedEntry = Object.entries(
        localStorage,
      ).find(([key]) =>
        key.startsWith('msme-onboarded-'),
      )

      return {
        business: businessEntry
          ? {
              key: businessEntry[0],
              value: JSON.parse(
                businessEntry[1],
              ),
            }
          : null,

        plan: planEntry
          ? {
              key: planEntry[0],
              value: JSON.parse(planEntry[1]),
            }
          : null,

        onboarded: onboardedEntry
          ? {
              key: onboardedEntry[0],
              value: onboardedEntry[1],
            }
          : null,
      }
    })

    expect(userAState.business).toBeTruthy()
    expect(userAState.plan).toBeTruthy()
    expect(userAState.onboarded).toBeTruthy()

    const userAUid =
      userAState.business.value.ownerUid

    expect(userAUid).toBeTruthy()

    expect(userAState.business.key).toBe(
      `msme-business-${userAUid}`,
    )

    expect(
      userAState.business.value.businessName,
    ).toBe('MSME Session Test Business A')

    expect(userAState.plan.key).toBe(
      `msme-plan-${userAUid}`,
    )

    expect(userAState.plan.value.type).toBe(
      'tier',
    )

    expect(userAState.plan.value.tierId).toBe(
      'starter',
    )

    expect(userAState.onboarded.key).toBe(
      `msme-onboarded-${userAUid}`,
    )

    expect(userAState.onboarded.value).toBe(
      'true',
    )

    // --------------------------------------------------
    // LOGOUT USER A
    // --------------------------------------------------

    await logout(page)

    // --------------------------------------------------
    // USER B LOGIN
    // --------------------------------------------------

    await login(
      page,
      USER_B_EMAIL,
      USER_B_PASSWORD,
    )

    // The login helper already verifies that
    // User B is no longer on /login.
    //
    // Do not inspect window.firebase here because
    // the Firebase instance is not exposed globally.
    await expect(page).not.toHaveURL(
      /\/login$/,
    )

    // --------------------------------------------------
    // VERIFY USER B DOES NOT INHERIT USER A STATE
    // --------------------------------------------------

    const userBStateBeforeSetup =
      await page.evaluate(
        (userAUid) => {
          return {
            userABusiness:
              localStorage.getItem(
                `msme-business-${userAUid}`,
              ),

            userAPlan:
              localStorage.getItem(
                `msme-plan-${userAUid}`,
              ),

            userAOnboarded:
              localStorage.getItem(
                `msme-onboarded-${userAUid}`,
              ),

            businessKeys:
              Object.keys(localStorage).filter(
                (key) =>
                  key.startsWith(
                    'msme-business-',
                  ),
              ),

            planKeys:
              Object.keys(localStorage).filter(
                (key) =>
                  key.startsWith(
                    'msme-plan-',
                  ),
              ),

            onboardedKeys:
              Object.keys(localStorage).filter(
                (key) =>
                  key.startsWith(
                    'msme-onboarded-',
                  ),
              ),
          }
        },
        userAUid,
      )

    // User A's UID-scoped data is allowed to
    // remain in browser storage after logout.
    expect(
      userBStateBeforeSetup.userABusiness,
    ).toBeTruthy()

    expect(
      userBStateBeforeSetup.userAPlan,
    ).toBeTruthy()

    expect(
      userBStateBeforeSetup.userAOnboarded,
    ).toBe('true')

    // At this point only User A has
    // onboarding data.
    expect(
      userBStateBeforeSetup.businessKeys,
    ).toHaveLength(1)

    expect(
      userBStateBeforeSetup.planKeys,
    ).toHaveLength(1)

    expect(
      userBStateBeforeSetup.onboardedKeys,
    ).toHaveLength(1)

    expect(
      userBStateBeforeSetup.businessKeys[0],
    ).toBe(
      `msme-business-${userAUid}`,
    )

    expect(
      userBStateBeforeSetup.planKeys[0],
    ).toBe(
      `msme-plan-${userAUid}`,
    )

    expect(
      userBStateBeforeSetup.onboardedKeys[0],
    ).toBe(
      `msme-onboarded-${userAUid}`,
    )

    // --------------------------------------------------
    // MOST IMPORTANT SESSION ISOLATION CHECK
    // --------------------------------------------------
    //
    // User B is authenticated, but User B does
    // not have a business profile or plan yet.
    //
    // Therefore /dashboard must redirect to
    // /business-setup.
    // --------------------------------------------------

    await page.goto('/dashboard')

    await expect(page).toHaveURL(
      /\/business-setup$/,
    )

    // --------------------------------------------------
    // USER B BUSINESS SETUP
    // --------------------------------------------------

    await saveBusiness(page, {
      businessName: 'MSME Session Test Business B',
      ownerName: 'Session Test Owner B',
      city: 'Mumbai',
      gstin: '27BBBBB2222B1Z6',
    })

    // --------------------------------------------------
    // USER B PLAN
    // --------------------------------------------------

    await selectPlan(page, 'Growth')

    // --------------------------------------------------
    // FINAL STORAGE ISOLATION CHECK
    // --------------------------------------------------

    const userBState = await page.evaluate(() => {
      return {
        business: Object.entries(
          localStorage,
        )
          .filter(([key]) =>
            key.startsWith(
              'msme-business-',
            ),
          )
          .map(([key, value]) => ({
            key,
            value: JSON.parse(value),
          })),

        plans: Object.entries(
          localStorage,
        )
          .filter(([key]) =>
            key.startsWith(
              'msme-plan-',
            ),
          )
          .map(([key, value]) => ({
            key,
            value: JSON.parse(value),
          })),

        onboarded: Object.entries(
          localStorage,
        )
          .filter(([key]) =>
            key.startsWith(
              'msme-onboarded-',
            ),
          )
          .map(([key, value]) => ({
            key,
            value,
          })),
      }
    })

    // Both users now have their own
    // UID-scoped data.
    expect(
      userBState.business,
    ).toHaveLength(2)

    expect(
      userBState.plans,
    ).toHaveLength(2)

    expect(
      userBState.onboarded,
    ).toHaveLength(2)

    // --------------------------------------------------
    // VERIFY USER B BUSINESS
    // --------------------------------------------------

    const userBBusiness =
      userBState.business.find(
        (entry) =>
          entry.value.businessName ===
          'MSME Session Test Business B',
      )

    expect(userBBusiness).toBeTruthy()

    const userBUid =
      userBBusiness.value.ownerUid

    expect(userBUid).toBeTruthy()

    expect(userBUid).not.toBe(userAUid)

    expect(userBBusiness.key).toBe(
      `msme-business-${userBUid}`,
    )

    expect(
      userBBusiness.value.businessName,
    ).toBe(
      'MSME Session Test Business B',
    )

    expect(
      userBBusiness.value.ownerName,
    ).toBe(
      'Session Test Owner B',
    )

    expect(
      userBBusiness.value.city,
    ).toBe('Mumbai')

    expect(
      userBBusiness.value.ownerUid,
    ).toBe(userBUid)

    // --------------------------------------------------
    // VERIFY USER A BUSINESS IS STILL USER A'S
    // --------------------------------------------------

    const userABusiness =
      userBState.business.find(
        (entry) =>
          entry.value.ownerUid ===
          userAUid,
      )

    expect(userABusiness).toBeTruthy()

    expect(userABusiness.key).toBe(
      `msme-business-${userAUid}`,
    )

    expect(
      userABusiness.value.businessName,
    ).toBe(
      'MSME Session Test Business A',
    )

    expect(
      userABusiness.value.ownerName,
    ).toBe(
      'Session Test Owner A',
    )

    expect(
      userABusiness.value.city,
    ).toBe('Pune')

    expect(
      userABusiness.value.ownerUid,
    ).toBe(userAUid)

    // --------------------------------------------------
    // VERIFY USER B PLAN
    // --------------------------------------------------

    const userBPlan =
      userBState.plans.find(
        (entry) =>
          entry.key ===
          `msme-plan-${userBUid}`,
      )

    expect(userBPlan).toBeTruthy()

    expect(
      userBPlan.value.type,
    ).toBe('tier')

    expect(
      userBPlan.value.tierId,
    ).toBe('growth')

    // --------------------------------------------------
    // VERIFY USER A PLAN REMAINS USER A'S
    // --------------------------------------------------

    const userAPlan =
      userBState.plans.find(
        (entry) =>
          entry.key ===
          `msme-plan-${userAUid}`,
      )

    expect(userAPlan).toBeTruthy()

    expect(
      userAPlan.value.type,
    ).toBe('tier')

    expect(
      userAPlan.value.tierId,
    ).toBe('starter')

    // --------------------------------------------------
    // VERIFY USER B ONBOARDING STATE
    // --------------------------------------------------

    const userBOnboarded =
      userBState.onboarded.find(
        (entry) =>
          entry.key ===
          `msme-onboarded-${userBUid}`,
      )

    expect(userBOnboarded).toBeTruthy()

    expect(
      userBOnboarded.value,
    ).toBe('true')

    // --------------------------------------------------
    // VERIFY USER A ONBOARDING STATE
    // --------------------------------------------------

    const userAOnboarded =
      userBState.onboarded.find(
        (entry) =>
          entry.key ===
          `msme-onboarded-${userAUid}`,
      )

    expect(userAOnboarded).toBeTruthy()

    expect(
      userAOnboarded.value,
    ).toBe('true')
  })
})