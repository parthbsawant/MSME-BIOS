import { test, expect } from '@playwright/test'

test('login page loads successfully', async ({ page }) => {
  await page.goto('/login')

  await expect(page).toHaveURL(/\/login$/)
})

test('login page displays authentication form', async ({ page }) => {
  await page.goto('/login')

  await expect(
    page.getByPlaceholder('you@example.com')
  ).toBeVisible()

  await expect(
    page.getByPlaceholder('Enter your password')
  ).toBeVisible()

  await expect(
    page.locator('button[type="submit"]')
  ).toBeVisible()
})

test('user can log in with valid Firebase credentials', async ({ page }) => {
  await page.goto('/login')

  await page
    .getByPlaceholder('you@example.com')
    .fill(process.env.PLAYWRIGHT_TEST_EMAIL)

  await page
    .getByPlaceholder('Enter your password')
    .fill(process.env.PLAYWRIGHT_TEST_PASSWORD)

  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/business-setup$/)
})

test('authenticated user can log out', async ({ page }) => {
  await page.goto('/login')

  await page
    .getByPlaceholder('you@example.com')
    .fill(process.env.PLAYWRIGHT_TEST_EMAIL)

  await page
    .getByPlaceholder('Enter your password')
    .fill(process.env.PLAYWRIGHT_TEST_PASSWORD)

  await page.locator('button[type="submit"]').click()

  await expect(page).toHaveURL(/\/business-setup$/)

  const userMenuButton = page.getByRole('button', {
    name: process.env.PLAYWRIGHT_TEST_EMAIL,
  })

  await userMenuButton.click()

  await page.getByRole('button', { name: 'Log out' }).click()

  await expect(page).toHaveURL(/\/login$/)
})