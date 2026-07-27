import { test, expect } from '@playwright/test'

// E2E smoke: real login (NIK/pass 2403077) → BFF → GeneralAffairDB. Confirms the
// full stack + auth wiring before the IAT loop authors the suite.
const NIK = '2403077'
const PASSWORD = '2403077'

test('real login redirects to dashboard', async ({ page }) => {
  await page.goto('/login')

  await page.getByLabel('NIK').fill(NIK)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Masuk' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // The real user identity from the login SP appears in the top bar.
  await expect(page.getByText('STEVEN ALEXANDER', { exact: false })).toBeVisible()
})
