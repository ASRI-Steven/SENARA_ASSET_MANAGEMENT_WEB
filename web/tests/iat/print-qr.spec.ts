import { test, expect } from '@playwright/test'
import { login, REAL_ASSET_ID } from './helpers'

// --- Print QR: real asset list, select→preview, search + select-all + clear ---
// Printing is client-side only (window.print), so nothing is written to the DB.
// The selection list is fed by the real POST /api/assets/search (30 real rows).

test.describe('print qr (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop print-qr assertions')
    await login(page)
    await page.goto('/print-qr')
    await expect(page.getByRole('heading', { name: 'Print QR' })).toBeVisible()
  })

  test('print-qr-real-list-select-preview: real assets, preview grid, Cetak count updates', async ({
    page,
  }) => {
    // Real assets load into the checkbox list.
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 15_000 })

    // Initially nothing selected → print disabled with count 0.
    const printBtn = page.getByRole('button', { name: /^Cetak \(\d+\)$/ })
    await expect(printBtn).toHaveText('Cetak (0)')
    await expect(printBtn).toBeDisabled()

    // Select one real asset → count updates and a QR preview (svg) renders.
    await page.getByRole('checkbox').first().check()
    await expect(page.getByRole('button', { name: 'Cetak (1)' })).toBeEnabled()
    await expect(page.locator('.print-area svg').first()).toBeVisible()
  })

  test('print-qr-search-selectall-clear: search filters, Pilih semua selects, Kosongkan clears', async ({
    page,
  }) => {
    // Narrow the list to a single real asset via the debounced, server-side search.
    await page.getByPlaceholder('Cari AssetID / model / user…').fill(REAL_ASSET_ID)
    await expect(page.getByRole('checkbox')).toHaveCount(1, { timeout: 15_000 })
    await expect(page.getByText(REAL_ASSET_ID).first()).toBeVisible()

    // Pilih semua selects the visible (filtered) asset → print enabled with count 1.
    await page.getByRole('button', { name: 'Pilih semua' }).click()
    await expect(page.getByRole('button', { name: 'Cetak (1)' })).toBeEnabled()

    // Kosongkan clears the selection → print disabled again.
    await page.getByRole('button', { name: 'Kosongkan' }).click()
    await expect(page.getByRole('button', { name: 'Cetak (0)' })).toBeDisabled()
  })

  test('print-qr-empty-hint: nothing selected shows the empty selection hint', async ({ page }) => {
    // Wait for the list to finish loading, then assert the empty-selection hint.
    await expect(page.getByRole('checkbox').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Belum ada aset dipilih/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cetak (0)' })).toBeDisabled()
  })

  test('print-qr-from-assets: header action from /assets navigates to /print-qr', async ({
    page,
  }) => {
    await page.goto('/assets')
    await page.getByRole('link', { name: 'Print QR' }).click()
    await expect(page).toHaveURL(/\/print-qr$/)
    await expect(page.getByRole('heading', { name: 'Print QR' })).toBeVisible()
  })
})
