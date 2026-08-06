import { test, expect, type Page } from '@playwright/test'
import { login, REAL_ASSET_ID, ASSET_ID_RE } from './helpers'

// AssetID links live in the page's <main> content. Scoping to the main region
// avoids matching same-named nav links (e.g. the "Dashboard" sidebar/bottom-nav
// link, which the AssetID pattern would otherwise also match).
const assetIdLink = (page: Page) =>
  page.getByRole('main').getByRole('link', { name: ASSET_ID_RE })

// --- Assets: real grid, server pagination, search, filter, detail routing ----
// The grid is server-side (POST /api/assets/search): ~27,905 real assets, real
// AssetIDs like "GAIN-2020-05-25-00062". Search is debounced into the request.

test.describe('assets list (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop table assertions')
    await login(page)
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: 'Manage Asset' })).toBeVisible()
  })

  test('assets-list-real-ids: real AssetIDs and a large total count', async ({ page }) => {
    await expect(page.getByRole('columnheader', { name: 'Asset ID' })).toBeVisible()

    // At least one real AssetID link (not a synthetic AST-#### id).
    const firstLink = assetIdLink(page).first()
    await expect(firstLink).toBeVisible()

    // The header description reports the real total (tens of thousands, dot-grouped).
    await expect(page.getByText(/\d{2}\.\d{3} aset/)).toBeVisible()
  })

  test('assets-server-pagination: advances/returns pages; large real MaxPage', async ({ page }) => {
    // Page 1 with a large MaxPage (≈2791). Prev is disabled on page 1.
    await expect(page.getByText(/Halaman 1 \/ [\d.]{3,}/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()

    // Advancing re-queries the server for page 2.
    const idBefore = await assetIdLink(page).first().textContent()

    const call2 = page.waitForResponse((r) => r.url().includes('/api/assets/search'))
    await page.getByRole('button', { name: 'Berikutnya' }).click()
    await call2
    await expect(page.getByText(/Halaman 2 \/ [\d.]{3,}/)).toBeVisible()

    // Different data on page 2.
    const idAfter = await assetIdLink(page).first().textContent()
    expect(idAfter).not.toBe(idBefore)

    // Returning to page 1 works and re-disables Prev.
    await page.getByRole('button', { name: 'Sebelumnya' }).click()
    await expect(page.getByText(/Halaman 1 \/ [\d.]{3,}/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled()
  })

  test('assets-keyword-search-real: re-queries the BFF and narrows to real matches', async ({
    page,
  }) => {
    const search = page.getByPlaceholder('Cari AssetID, model, user…')
    await search.fill(REAL_ASSET_ID)

    // The debounced, server-side search narrows to the single matching asset.
    await expect(page.getByRole('link', { name: REAL_ASSET_ID, exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('1 aset')).toBeVisible()
    await expect(page.getByText('Halaman 1 / 1')).toBeVisible()
  })

  test('assets-search-no-match: nonsense keyword shows the empty state', async ({ page }) => {
    await page.getByPlaceholder('Cari AssetID, model, user…').fill('zzz-nonsense-nomatch-xyz')
    await expect(page.getByText('Tidak ada aset yang cocok.')).toBeVisible({ timeout: 15_000 })
  })

  test('assets-filter-by-type-real: real type lookups narrow the grid; badge shown', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Filter' }).click()
    await expect(page.getByRole('heading', { name: 'Filter Aset' })).toBeVisible()

    // The Type select is populated from the real lookups SP (27 real types).
    const typeTrigger = page.getByRole('combobox').first()
    await typeTrigger.click()
    // "MISCELLANEOUS" is a real type in the dev DB.
    await page.getByRole('option', { name: 'MISCELLANEOUS' }).click()
    await expect(typeTrigger).toContainText('MISCELLANEOUS')

    // Close the sheet — the active-filter badge (count 1) shows on the Filter button.
    await page.keyboard.press('Escape')
    const filterBtn = page.getByRole('button', { name: 'Filter' })
    await expect(filterBtn.getByText('1', { exact: true })).toBeVisible()

    // The grid is now scoped: the total drops below the full ≈27,905 but is still large.
    await expect(page.getByText(/\d\.\d{3} aset/)).toBeVisible()
  })

  test('assets-filter-reset: Reset Filter clears the select/badge and restores the full count', async ({
    page,
  }) => {
    // Apply a Type filter first.
    await page.getByRole('button', { name: 'Filter' }).click()
    const typeTrigger = page.getByRole('combobox').first()
    await typeTrigger.click()
    await page.getByRole('option', { name: 'MISCELLANEOUS' }).click()
    await expect(typeTrigger).toContainText('MISCELLANEOUS')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Filter' }).getByText('1', { exact: true })).toBeVisible()

    // Reopen and reset.
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('button', { name: 'Reset Filter' }).click()
    await expect(page.getByRole('combobox').first()).toContainText('Semua Type')
    await page.keyboard.press('Escape')

    // Badge gone and the full real total (tens of thousands) is restored.
    await expect(page.getByRole('button', { name: 'Filter' }).getByText('1', { exact: true })).toBeHidden()
    await expect(page.getByText(/\d{2}\.\d{3} aset/)).toBeVisible()
  })

  test('assets-row-to-detail: clicking a real AssetID routes to /assets/:id', async ({ page }) => {
    const firstLink = assetIdLink(page).first()
    const id = (await firstLink.textContent())?.trim() ?? ''
    expect(id).toMatch(ASSET_ID_RE)
    await firstLink.click()

    await expect(page).toHaveURL(new RegExp(`/assets/${id}$`))
    await expect(page.getByRole('heading', { name: id })).toBeVisible()
  })

  test('assets-row-actions-menu: kebab lists ACL-gated actions; Lihat Detail routes; no write fires', async ({
    page,
  }) => {
    const firstLink = assetIdLink(page).first()
    const id = (await firstLink.textContent())?.trim() ?? ''

    // Guard: fail if any mutating asset-action request ever fires. The IAT must
    // exercise these actions UI-only — the final prod-writing submit is never sent.
    let writeRequest = false
    page.on('request', (req) => {
      if (
        req.method() !== 'GET' &&
        /\/api\/assets\/(assign-user|assign-location|assign-status|change-management|change-company|return|enable|disable)/.test(
          req.url(),
        )
      ) {
        writeRequest = true
      }
    })

    // The kebab (row actions) opens a real dropdown, gated by the row's per-row
    // ACL flags from the grid SP. Locate the row by the AssetID's link.
    const firstRow = page
      .getByRole('row')
      .filter({ has: page.getByRole('link', { name: id, exact: true }) })
    await firstRow.getByRole('button').last().click()

    // Lihat Detail is always present in the menu.
    await expect(page.getByRole('menuitem', { name: 'Lihat Detail' })).toBeVisible()

    // Lihat Detail routes to the asset's detail page.
    await page.getByRole('menuitem', { name: 'Lihat Detail' }).click()
    await expect(page).toHaveURL(new RegExp(`/assets/${id}$`))

    // No prod-writing action request was ever sent.
    expect(writeRequest).toBe(false)
  })

  // The bulk "Return User" button is gated on the page's isReturn ACL, exactly
  // like the legacy Datagrid. The seeded admin account's search response carries
  // isReturn=0, so to exercise the bulk-return UI deterministically (regardless
  // of ACL seeding) we intercept /api/assets/search and grant isReturn on the
  // page + every row. This stays UI-level: no real write is ever sent, and the
  // request guard below fails the test if a /api/assets/return POST leaks out.
  async function grantReturnAcl(page: Page): Promise<void> {
    await page.route('**/api/assets/search', async (route) => {
      const res = await route.fetch()
      const body = await res.json()
      const data = body?.data as unknown[] | undefined
      if (Array.isArray(data)) {
        const rows = data[0] as Array<Record<string, unknown>> | undefined
        rows?.forEach((r) => {
          r.isReturn = 1
        })
        const pageAcl = data[1] as Array<Record<string, unknown>> | undefined
        if (pageAcl?.[0]) pageAcl[0].isReturn = 1
      }
      await route.fulfill({ response: res, json: body })
    })
  }

  test('assets-bulk-return: multi-select opens the Return User dialog with count + AssetIDs; no write fires', async ({
    page,
  }) => {
    // Guard: this UI-level test must NEVER fire the real bulk-return POST (it
    // would write to the shared dev DB). Fail if /api/assets/return is ever hit.
    let returnPosted = false
    page.on('request', (req) => {
      if (req.method() !== 'GET' && /\/api\/assets\/return/.test(req.url())) {
        returnPosted = true
      }
    })

    // Grant isReturn so the bulk "Return User" action is reachable, then reload.
    await grantReturnAcl(page)
    await page.reload()

    // The per-row + select-all checkboxes are gated on the page's isUpdate ACL,
    // which the admin session (STEVEN ALEXANDER) is granted. Wait for real rows
    // (the server-side grid SP can be slow under dev-DB load).
    await expect(assetIdLink(page).first()).toBeVisible({ timeout: 15_000 })

    // Read the first two AssetIDs BEFORE selecting (they appear in the dialog).
    const id0 = (await assetIdLink(page).nth(0).textContent())?.trim() ?? ''
    const id1 = (await assetIdLink(page).nth(1).textContent())?.trim() ?? ''
    expect(id0).toMatch(ASSET_ID_RE)
    expect(id1).toMatch(ASSET_ID_RE)

    // Select the first two rows via their per-row checkboxes (labelled by AssetID).
    const rowChecks = page.getByRole('checkbox', { name: /^Pilih aset / })
    await expect(rowChecks.first()).toBeVisible()
    await rowChecks.nth(0).check()
    await rowChecks.nth(1).check()

    // The bulk action bar reports the selection count and offers Return User.
    await expect(page.getByText('2 aset dipilih')).toBeVisible()
    const returnBtn = page.getByRole('button', { name: 'Return User' })
    await expect(returnBtn).toBeVisible()

    // Opening the dialog shows the Remarks field + the selected AssetIDs, and
    // repeats the count — but we NEVER click the final "Return" confirm.
    await returnBtn.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Return User' })).toBeVisible()
    await expect(dialog.getByText('Kembalikan 2 aset berikut dari user saat ini.')).toBeVisible()

    // The selected AssetIDs are listed in the dialog.
    await expect(dialog.getByText(id0, { exact: true })).toBeVisible()
    await expect(dialog.getByText(id1, { exact: true })).toBeVisible()

    // Remarks is editable.
    const remarks = dialog.getByRole('textbox')
    await remarks.fill('IAT ui-only check')
    await expect(remarks).toHaveValue('IAT ui-only check')

    // Dismiss WITHOUT confirming — no prod write must have fired.
    await page.getByRole('button', { name: 'Batal' }).click()
    await expect(dialog).toBeHidden()
    expect(returnPosted).toBe(false)
  })

  test('assets-bulk-select-all: header checkbox selects every row on the page; Batal Pilih clears', async ({
    page,
  }) => {
    // Grant isReturn so the bulk bar (which reports the count) is reachable.
    await grantReturnAcl(page)
    await page.reload()
    await expect(assetIdLink(page).first()).toBeVisible({ timeout: 15_000 })

    const rowChecks = page.getByRole('checkbox', { name: /^Pilih aset / })
    const rowCount = await rowChecks.count()
    expect(rowCount).toBeGreaterThan(1)

    // The select-all header checkbox ticks every visible row.
    await page.getByRole('checkbox', { name: 'Pilih semua aset di halaman ini' }).check()
    await expect(page.getByText(`${rowCount} aset dipilih`)).toBeVisible()

    // Batal Pilih clears the whole selection (and hides the bulk bar).
    await page.getByRole('button', { name: 'Batal Pilih' }).click()
    await expect(page.getByText(/aset dipilih/)).toBeHidden()
  })

  test('assets-loading-skeleton: row skeleton shows before the grid data arrives', async ({
    page,
  }) => {
    await page.route('**/api/assets/search', async (route) => {
      await new Promise((r) => setTimeout(r, 1500))
      await route.continue()
    })
    await page.goto('/assets')
    await expect(page.getByTestId('skeleton').first()).toBeVisible()
    // Real rows replace the skeleton.
    await expect(assetIdLink(page).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

test.describe('assets list (mobile)', () => {
  test('assets-mobile-cards: mobile hides the table and renders real asset cards', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile card layout assertions')
    await login(page)
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: 'Manage Asset' })).toBeVisible()

    // No desktop table on mobile; real asset-id links still present and go to detail.
    await expect(page.getByRole('columnheader', { name: 'Asset ID' })).toBeHidden()
    const firstLink = assetIdLink(page).first()
    await expect(firstLink).toBeVisible()
    const href = await firstLink.getAttribute('href')
    expect(href).toMatch(/\/assets\/[A-Z0-9-]+/i)
  })
})
