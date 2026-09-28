import { test, expect } from '@playwright/test'

async function login(page, email, password) {
  await page.goto('/login')

  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('Enter your password').fill(password)

  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/business-setup$/)
}

async function setupBusiness(page, business) {
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

  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/choose-plan$/)
}

async function selectPlan(page, tierName) {

  const tierNameText = page.getByText(tierName, { exact: true })

  await expect(tierNameText).toBeVisible()

  const tierCard = tierNameText.locator('..')

  await tierCard
    .getByRole('button', { name: 'Review plan' })
    .click()

  await expect(page).toHaveURL(
    new RegExp(`/plan-summary/[^/]+$`),
  )

  await page
    .getByRole('button', { name: 'Confirm and continue' })
    .click()

  await expect(page).toHaveURL(/\/dashboard$/)
}

test.describe('Plan user isolation', () => {
  test('User A and User B have isolated plans', async ({
    browser,
  }) => {
    const userAContext = await browser.newContext()
    const userBContext = await browser.newContext()

    const userAPage = await userAContext.newPage()
    const userBPage = await userBContext.newPage()

    try {
      // --------------------------------------------------
      // USER A
      // --------------------------------------------------

      await login(
        userAPage,
        process.env.PLAYWRIGHT_USER_A_EMAIL,
        process.env.PLAYWRIGHT_USER_A_PASSWORD,
      )

      await setupBusiness(userAPage, {
        businessName: 'MSME Plan Test Business A',
        ownerName: 'Plan Test Owner A',
        city: 'Pune',
        gstin: '27AAAAA1111A1Z5',
      })

      // Select a plan for User A.
      await selectPlan(userAPage, 'Starter')

      // Read User A's plan storage.
      const userAPlan = await userAPage.evaluate(() => {
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-plan-'),
        )

        return keys.map((key) => ({
          key,
          value: JSON.parse(localStorage.getItem(key)),
        }))
      })

      expect(userAPlan).toHaveLength(1)

      expect(userAPlan[0].value).toBeTruthy()
      expect(userAPlan[0].value.type).toBe('tier')
      expect(userAPlan[0].value.tierId).toBeTruthy()
      expect(userAPlan[0].value.featureIds).toBeTruthy()

      const userAPlanKey = userAPlan[0].key

      const userAUid = userAPlanKey.replace(
        'msme-plan-',
        '',
      )

      expect(userAUid).toBeTruthy()

      expect(userAPlanKey).toBe(
        `msme-plan-${userAUid}`,
      )

      // --------------------------------------------------
      // USER B
      // --------------------------------------------------

      await login(
        userBPage,
        process.env.PLAYWRIGHT_USER_B_EMAIL,
        process.env.PLAYWRIGHT_USER_B_PASSWORD,
      )

      // User B should not have User A's plan.
      const userBPlanBeforeSelection = await userBPage.evaluate(() => {
        return Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-plan-'),
        )
      })

      expect(userBPlanBeforeSelection).toHaveLength(0)

      await setupBusiness(userBPage, {
        businessName: 'MSME Plan Test Business B',
        ownerName: 'Plan Test Owner B',
        city: 'Mumbai',
        gstin: '27BBBBB2222B1Z6',
      })

      // Select a plan for User B.
      await selectPlan(userBPage, 'Growth')

      // Read User B's plan storage.
      const userBPlan = await userBPage.evaluate(() => {
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-plan-'),
        )

        return keys.map((key) => ({
          key,
          value: JSON.parse(localStorage.getItem(key)),
        }))
      })

      expect(userBPlan).toHaveLength(1)

      expect(userBPlan[0].value).toBeTruthy()
      expect(userBPlan[0].value.type).toBe('tier')
      expect(userBPlan[0].value.tierId).toBeTruthy()
      expect(userBPlan[0].value.featureIds).toBeTruthy()

      const userBUid = userBPlan[0].key.replace(
        'msme-plan-',
        '',
      )

      expect(userBUid).toBeTruthy()

      expect(userBUid).not.toBe(userAUid)

      expect(userBPlan[0].key).toBe(
        `msme-plan-${userBUid}`,
      )

      // --------------------------------------------------
      // CROSS-USER PLAN ISOLATION
      // --------------------------------------------------

      expect(userBPlan[0].value.tierId).not.toBe(
        userAPlan[0].value.tierId,
      )

      // User A still has only User A's plan.
      const userAPlanAfterUserB = await userAPage.evaluate(() => {
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-plan-'),
        )

        return keys.map((key) => ({
          key,
          value: JSON.parse(localStorage.getItem(key)),
        }))
      })

      expect(userAPlanAfterUserB).toHaveLength(1)

      expect(userAPlanAfterUserB[0].key).toBe(
        `msme-plan-${userAUid}`,
      )

      expect(
        userAPlanAfterUserB[0].value.tierId,
      ).toBe(userAPlan[0].value.tierId)

      // User B still has only User B's plan.
      expect(userBPlan).toHaveLength(1)

      expect(userBPlan[0].key).toBe(
        `msme-plan-${userBUid}`,
      )
    } finally {
      await userAContext.close()
      await userBContext.close()
    }
  })
})