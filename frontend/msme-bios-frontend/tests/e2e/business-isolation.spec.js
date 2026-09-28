import { test, expect } from '@playwright/test'

async function login(page, email, password) {
  await page.goto('/login')

  await page.getByPlaceholder('you@example.com').fill(email)
  await page.getByPlaceholder('Enter your password').fill(password)

  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/business-setup$/)
}

async function saveBusiness(page, business) {
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

test.describe('Business user isolation', () => {
  test('User A and User B have isolated business profiles', async ({
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

      await saveBusiness(userAPage, {
        businessName: 'MSME Test Business A',
        ownerName: 'Test Owner A',
        city: 'Pune',
        gstin: '27AAAAA1111A1Z5',
      })

      const userABusiness = await userAPage.evaluate(() => {
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-business-'),
        )

        return keys.map((key) => ({
          key,
          value: JSON.parse(localStorage.getItem(key)),
        }))
      })

      expect(userABusiness).toHaveLength(1)

      expect(userABusiness[0].value.businessName).toBe(
        'MSME Test Business A',
      )

      expect(userABusiness[0].value.ownerName).toBe(
        'Test Owner A',
      )

      expect(userABusiness[0].value.ownerUid).toBeTruthy()

      const userAUid = userABusiness[0].value.ownerUid

      expect(userABusiness[0].key).toBe(
        `msme-business-${userAUid}`,
      )

      // --------------------------------------------------
      // USER B
      // --------------------------------------------------

      await login(
        userBPage,
        process.env.PLAYWRIGHT_USER_B_EMAIL,
        process.env.PLAYWRIGHT_USER_B_PASSWORD,
      )

      // User B should start with no business data.
      await expect(userBPage).toHaveURL(/\/business-setup$/)

      const userBBusinessBeforeSave = await userBPage.evaluate(() => {
        return Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-business-'),
        )
      })

      expect(userBBusinessBeforeSave).toHaveLength(0)

      await saveBusiness(userBPage, {
        businessName: 'MSME Test Business B',
        ownerName: 'Test Owner B',
        city: 'Mumbai',
        gstin: '27BBBBB2222B1Z6',
      })

      const userBBusiness = await userBPage.evaluate(() => {
        const keys = Object.keys(localStorage).filter(
          (key) => key.startsWith('msme-business-'),
        )

        return keys.map((key) => ({
          key,
          value: JSON.parse(localStorage.getItem(key)),
        }))
      })

      expect(userBBusiness).toHaveLength(1)

      expect(userBBusiness[0].value.businessName).toBe(
        'MSME Test Business B',
      )

      expect(userBBusiness[0].value.ownerName).toBe(
        'Test Owner B',
      )

      expect(userBBusiness[0].value.ownerUid).toBeTruthy()

      const userBUid = userBBusiness[0].value.ownerUid

      expect(userBBusiness[0].key).toBe(
        `msme-business-${userBUid}`,
      )

      // User A and User B must have different Firebase UIDs.
      expect(userBUid).not.toBe(userAUid)

      // --------------------------------------------------
      // CROSS-USER ISOLATION
      // --------------------------------------------------

      expect(
        userBBusiness[0].value.businessName,
      ).not.toBe('MSME Test Business A')

      expect(
        userABusiness[0].value.businessName,
      ).not.toBe('MSME Test Business B')
    } finally {
      await userAContext.close()
      await userBContext.close()
    }
  })
})