import { test, expect, type Page } from '@playwright/test'
import { login, REAL_ASSET_ID } from './helpers'

// --- Assets: self-generated PDF report ("Cetak Laporan") ---------------------
// Replaces the legacy SSRS/ASP report (CsReport → apps.alam-sutera.com/AsriReport
// 'PrintOut_LaporanAsset'). The button on the asset list header lazily loads
// src/lib/assetReport.ts, pages the real POST /api/assets/search for the CURRENT
// filtered set, builds a landscape A4 PDF with jsPDF/autotable and downloads it
// as "Laporan-Aset-<date>.pdf". It only READS — no mutations are sent.
//
// Tests narrow to a tiny result set first (one real asset) so the report's
// "fetch all matching rows" step is a single fast request.

const REPORT_BTN = { name: 'Cetak laporan PDF' }
const SEARCH = '/api/assets/search'

// Fill the debounced list search and wait until exactly the one real asset shows.
async function narrowToOneAsset(page: Page): Promise<void> {
  await page.getByPlaceholder('Cari AssetID, model, user…').fill(REAL_ASSET_ID)
  await expect(page.getByRole('link', { name: REAL_ASSET_ID, exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText('1 aset')).toBeVisible()
}

test.describe('assets PDF report (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop report-button assertions')
    await login(page)
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: 'Manage Asset' })).toBeVisible()
  })

  test('assets-report-button-present: Cetak Laporan action shows next to Print QR', async ({
    page,
  }) => {
    const report = page.getByRole('button', REPORT_BTN)
    await expect(report).toBeVisible()
    await expect(report).toContainText('Cetak Laporan')
    // It sits alongside the existing Print QR link (which we must not have broken).
    // Scope to <main>: a same-named "Print QR" nav link also lives in the sidebar,
    // so assert the header action link specifically.
    await expect(page.getByRole('main').getByRole('link', { name: 'Print QR' })).toBeVisible()
  })

  test('assets-report-downloads-pdf: clicking Cetak Laporan downloads a .pdf', async ({ page }) => {
    // Narrow to one real asset so the report gathers a single small page of rows.
    await narrowToOneAsset(page)

    // Guard: the report must be client-side only — no SSRS/ASP report fetch.
    let ssrsHit = false
    page.on('request', (req) => {
      if (/AsriReport|PrintOut_LaporanAsset|ReportServer|\.aspx/i.test(req.url())) {
        ssrsHit = true
      }
    })

    // The report pages the search SP with a large PageSize (≠ the 12-row grid).
    const reportFetch = page.waitForRequest(
      (req) => req.url().includes(SEARCH) && req.method() === 'POST',
    )

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', REPORT_BTN).click()

    // Button enters its loading state (spinner) while generating.
    await reportFetch

    // A real file download fires, named "Laporan-Aset-<date>.pdf".
    const download = await downloadPromise
    const filename = download.suggestedFilename()
    expect(filename.toLowerCase()).toMatch(/\.pdf$/)
    expect(filename).toMatch(/^Laporan-Aset-\d{4}-\d{2}-\d{2}\.pdf$/)

    // Success toast reports the exported count; no legacy report endpoint was hit.
    await expect(page.getByText(/Laporan diunduh/)).toBeVisible({ timeout: 15_000 })
    expect(ssrsHit).toBe(false)

    // No SSRS iframe / embedded report viewer was injected into the page.
    await expect(page.locator('iframe')).toHaveCount(0)
  })

  test('assets-report-uses-large-pagesize: report request pulls more than the 12-row grid page', async ({
    page,
  }) => {
    await narrowToOneAsset(page)

    // Capture the PageSize the report requests — it must exceed the grid's 12 so a
    // single fetch covers the whole (small) filtered set, unlike the paged grid.
    const reportReq = page.waitForRequest((req) => {
      if (!req.url().includes(SEARCH) || req.method() !== 'POST') return false
      const body = req.postDataJSON() as { PageSize?: number } | null
      return !!body && typeof body.PageSize === 'number' && body.PageSize > 12
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', REPORT_BTN).click()

    await reportReq
    const download = await downloadPromise
    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/)
  })

  test('assets-report-respects-filters: report request carries the active keyword filter', async ({
    page,
  }) => {
    // Apply the keyword filter, then assert the report's fetch echoes it — the PDF
    // reflects the CURRENT filtered result set, not the full table.
    await narrowToOneAsset(page)

    const reportReq = page.waitForRequest((req) => {
      if (!req.url().includes(SEARCH) || req.method() !== 'POST') return false
      const body = req.postDataJSON() as { Keyword?: string; PageSize?: number } | null
      return !!body && body.Keyword === REAL_ASSET_ID && (body.PageSize ?? 0) > 12
    })

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', REPORT_BTN).click()

    await reportReq
    await downloadPromise
  })
})
