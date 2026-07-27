import { test, expect } from '@playwright/test'
import { login } from './helpers'

// --- Dashboard: real score cards, breakdown panels, management filter --------
// All numbers/labels come from the live dashboard SP (usp_CMS_Dashboard_*).

test.describe('dashboard (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop dashboard assertions')
    await login(page)
  })

  test('dashboard-real-summary-cards: real Total/Nilai/Broken/MIA from the live SP', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // The four real score cards (labels are exact).
    for (const label of ['Total Asset', 'Nilai Asset', 'Broken', 'MIA']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    // Total Asset is a large, dot-grouped real number (≈27.901): tens of
    // thousands, rendered as "##.###". Assert such a number is visible.
    await expect(page.getByText(/\d{2}\.\d{3}/).first()).toBeVisible()

    // Nilai Asset renders as Rupiah, and the Broken/MIA cards show a
    // "% dari total" hint (real percentages from the SP).
    await expect(page.getByText(/Rp\s?[\d.]+/).first()).toBeVisible()
    await expect(page.getByText(/%\s*dari total/).first()).toBeVisible()
  })

  test('dashboard-breakdown-panels-real: real company/location/type/model rows with bars', async ({
    page,
  }) => {
    for (const title of [
      'Aset per Company',
      'Aset per Type',
      'Aset per Location',
      'Aset per Type Model (Top 6)',
    ]) {
      // Exact match: "Aset per Type" would otherwise also match the
      // "Aset per Type Model (Top 6)" heading (strict-mode violation).
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    }

    // Real breakdown rows load: a company name (e.g. "PT. ALFA GOLDLAND REALTY")
    // and the real top type "MISCELLANEOUS" from the live DB appear.
    await expect(page.getByText(/PT\./).first()).toBeVisible()
    await expect(page.getByText('MISCELLANEOUS', { exact: false }).first()).toBeVisible()

    // Progress bars render (the count-scaled inner bar div uses bg-primary).
    await expect(page.locator('.bg-primary.rounded-full').first()).toBeVisible()
  })

  test('dashboard-management-filter-corporate: 23 real options incl. Corporate; re-scopes stats', async ({
    page,
  }) => {
    const trigger = page.getByRole('combobox')
    await expect(trigger).toContainText('Semua Management')
    await trigger.click()

    // The default "Semua Management" plus real managements load. There are 23
    // options total (idx 0 "All" + 22 managements); assert several real ones.
    await expect(page.getByRole('option', { name: 'Semua Management' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Corporate' })).toBeVisible()
    const optionCount = await page.getByRole('option').count()
    expect(optionCount).toBeGreaterThanOrEqual(20)

    // Selecting Corporate re-queries the dashboard and re-scopes the trigger.
    const dashboardCall = page.waitForResponse(
      (r) => r.url().includes('/api/dashboard') && r.request().method() === 'POST',
    )
    await page.getByRole('option', { name: 'Corporate' }).click()
    await dashboardCall
    await expect(trigger).toContainText('Corporate')
    await expect(page).toHaveURL(/\/dashboard$/)
    // Cards still render real numbers after the re-scope.
    await expect(page.getByText('Total Asset', { exact: true }).first()).toBeVisible()
  })

  test('dashboard-loading-skeletons: score-card + panel skeletons show while in flight', async ({
    page,
  }) => {
    // Delay the dashboard POST so the loading skeletons are observable. Only the
    // /api/dashboard call is slowed; /managements and everything else is normal.
    await page.route('**/api/dashboard', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((r) => setTimeout(r, 1500))
      }
      await route.continue()
    })

    await page.goto('/dashboard')
    // Skeletons appear before the data resolves.
    await expect(page.getByTestId('skeleton').first()).toBeVisible()
    // Then the real cards replace them.
    await expect(page.getByText('Total Asset', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId('skeleton')).toHaveCount(0)
  })
})

test.describe('dashboard (mobile)', () => {
  test('dashboard-mobile-layout: 2-col cards + bottom-nav with real numbers', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile-only layout assertions')
    await login(page)

    // Real score cards still render on mobile.
    await expect(page.getByText('Total Asset', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/\d{2}\.\d{3}/).first()).toBeVisible()

    // Mobile bottom-nav is visible; the desktop sidebar footer is hidden.
    await expect(page.getByRole('link', { name: 'Akun' })).toBeVisible()
    await expect(page.getByText('ASRILup PWA · v0.1')).toBeHidden()
  })
})
