import { test, expect } from '@playwright/test'

test('landing page loads successfully', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/MSME-BIOS/i)
})