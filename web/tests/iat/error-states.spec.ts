import { test, expect } from '@playwright/test'
import { login, ASSET_ID_RE } from './helpers'

// --- Error states: forced fetch failure → error card → working "Coba lagi" ----
// The failure is injected by aborting the relevant /api call; the retry is
// verified by removing the abort and clicking "Coba lagi", which recovers.

test.describe('error states (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop error-card assertions')
    await login(page)
  })

  test('error-dashboard-retry: fetch failure shows error card with working Coba lagi', async ({
    page,
  }) => {
    // Fail the dashboard POST.
    await page.route('**/api/dashboard', async (route) => {
      if (route.request().method() === 'POST') return route.abort()
      return route.continue()
    })
    await page.goto('/dashboard')

    // Error card renders with a retry button.
    await expect(page.getByText('Gagal memuat dashboard')).toBeVisible({ timeout: 15_000 })
    const retry = page.getByRole('button', { name: 'Coba lagi' })
    await expect(retry).toBeVisible()

    // Remove the failure, then retry → real data recovers.
    await page.unroute('**/api/dashboard')
    await retry.click()
    await expect(page.getByText('Gagal memuat dashboard')).toBeHidden({ timeout: 15_000 })
    await expect(page.getByText('Total Asset', { exact: true }).first()).toBeVisible()
  })

  test('error-assets-retry: search failure shows error card with working Coba lagi', async ({
    page,
  }) => {
    await page.route('**/api/assets/search', (route) => route.abort())
    await page.goto('/assets')

    await expect(page.getByText('Gagal memuat daftar aset')).toBeVisible({ timeout: 15_000 })
    const retry = page.getByRole('button', { name: 'Coba lagi' })
    await expect(retry).toBeVisible()

    await page.unroute('**/api/assets/search')
    await retry.click()
    await expect(page.getByText('Gagal memuat daftar aset')).toBeHidden({ timeout: 15_000 })
    // Real rows load after recovery.
    await expect(page.getByRole('link', { name: ASSET_ID_RE }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('error-master-retry: master search failure shows error card with working Coba lagi', async ({
    page,
  }) => {
    await page.route('**/api/master/brand/search', (route) => route.abort())
    await page.goto('/master/brand')

    await expect(page.getByText('Gagal memuat data')).toBeVisible({ timeout: 15_000 })
    const retry = page.getByRole('button', { name: 'Coba lagi' })
    await expect(retry).toBeVisible()

    await page.unroute('**/api/master/brand/search')
    await retry.click()
    await expect(page.getByText('Gagal memuat data')).toBeHidden({ timeout: 15_000 })
    // Real brand rows load after recovery (hundreds of items).
    await expect(page.getByText(/\d{3} item/)).toBeVisible({ timeout: 15_000 })
  })
})
