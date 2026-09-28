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