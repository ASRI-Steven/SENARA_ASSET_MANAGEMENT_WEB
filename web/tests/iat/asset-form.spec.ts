import { test, expect, type Page } from '@playwright/test'
import { login, openRealAsset, REAL_ASSET_ID } from './helpers'

// --- New Asset (create) + Asset Edit -----------------------------------------
// Both screens load real lookups (GET /api/asset/lookups + /api/assets/lookups),
// cascade companies (POST /api/asset/company) and search POs (POST /api/po).
// Per IAT safety the final create/update POST/PATCH is disabled in the UI, so
// these tests exercise loading + dropdowns + cascade + validation ONLY and assert
// no write ever fires.
//
// The shadcn <Label> isn't associated with its Radix <Select> trigger, so the
// selects are addressed by their DOM order via role="combobox" (matching the
// existing request/asset specs). The searchable Combobox trigger is a <button>
// carrying aria-label={title}, so it's addressed by its accessible name.

/** Fail the test if a create/update write to /api/asset ever leaves the browser. */
function guardNoAssetWrite(page: Page): () => boolean {
  let wrote = false
  page.on('request', (req) => {
    const m = req.method()
    if (/\/api\/asset$/.test(req.url()) && (m === 'POST' || m === 'PATCH')) {
      wrote = true
    }
  })
  return () => wrote
}

// New-Asset Radix selects. The <Label> isn't wired to the Radix trigger. In the
// legacy-matched two-column layout, Management + Company are the first two selects
// in the left column (stable order, before the User combobox), so they're taken by
// DOM order. Type + Color sit in the right column interleaved with Comboboxes
// (Model/Brand/Size), so DOM order there is not stable — address them by the
// placeholder text their SelectValue renders while empty ("Pilih type"/"Pilih color").
const NEW = {
  management: (p: Page) => p.getByRole('combobox').nth(0),
  company: (p: Page) => p.getByRole('combobox').nth(1),
  type: (p: Page) => p.getByRole('combobox').filter({ hasText: 'Pilih type' }).first(),
  color: (p: Page) => p.getByRole('combobox').filter({ hasText: 'Pilih color' }).first(),
}

test.describe('new asset (create)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')
    await login(page)
  })

  test('new-asset-loads-lookups: form + real management/type options', async ({ page }) => {
    const noWrite = guardNoAssetWrite(page)

    const lookupsCall = page.waitForResponse((r) => r.url().includes('/api/asset/lookups'))
    await page.goto('/assets/new')
    await lookupsCall

    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    // Management select populates from the real SP (22 real managements).
    await NEW.management(page).click()
    await expect(page.getByRole('option').first()).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')

    // Type select populates (27 real types incl. MISCELLANEOUS).
    await NEW.type(page).click()
    await expect(page.getByRole('option', { name: 'MISCELLANEOUS' })).toBeVisible()
    await page.keyboard.press('Escape')

    expect(noWrite()).toBe(false)
  })

  test('new-asset-company-cascade: company disabled until management, then loads real companies', async ({
    page,
  }) => {
    await page.goto('/assets/new')
    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    // Company select is disabled with a "pick management first" placeholder.
    const company = NEW.company(page)
    await expect(company).toBeDisabled()
    await expect(company).toContainText(/management dulu/i)

    // Selecting a management fires POST /api/asset/company and enables the select.
    const companyCall = page.waitForResponse((r) => r.url().includes('/api/asset/company'))
    await NEW.management(page).click()
    await page.getByRole('option').first().click()
    await companyCall

    await expect(company).toBeEnabled()
    await company.click()
    // At least one real company option (all are "PT. …").
    await expect(page.getByRole('option', { name: /PT\./i }).first()).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
  })

  test('new-asset-model-cascade: model disabled until a type is chosen, then real models', async ({
    page,
  }) => {
    await page.goto('/assets/new')
    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    // Model combobox (a button) is disabled until a type is selected.
    const model = page.getByRole('button', { name: 'Pilih Model' })
    await expect(model).toBeDisabled()

    // Pick MISCELLANEOUS → model becomes enabled and lists real models for it.
    await NEW.type(page).click()
    await page.getByRole('option', { name: 'MISCELLANEOUS' }).click()
    await expect(model).toBeEnabled()

    await model.click()
    // The picker dialog opens with a search box + at least one real model row.
    await expect(page.getByPlaceholder('Cari…')).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button').nth(1)).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('new-asset-searchable-user: user picker filters ~2000 real users', async ({ page }) => {
    await page.goto('/assets/new')
    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    await page.getByRole('button', { name: 'Pilih User' }).click()
    const search = page.getByPlaceholder('Cari…')
    await expect(search).toBeVisible()
    // Typing filters the (large) user list; results still render.
    await search.fill('a')
    await expect(page.getByRole('dialog').getByRole('button').nth(1)).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('new-asset-po-search: PO dialog searches a real PO and lists it', async ({ page }) => {
    await page.goto('/assets/new')
    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    // Open the PO search dialog via the "Cari PO" button next to the PO field.
    await page.getByRole('button', { name: 'Cari PO' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Cari PO' })).toBeVisible()

    // Search a real PO number → POST /api/po returns a header + material lines.
    const poCall = page.waitForResponse((r) => r.url().includes('/api/po'))
    await dialog.getByPlaceholder('Nomor PO').fill('PO/TMAY/06/20/0068')
    await dialog.getByRole('button', { name: 'Cari' }).click()
    await poCall

    // The real PO header renders with its PONo + a "Gunakan PO ini" action.
    await expect(dialog.getByText('PO/TMAY/06/20/0068').first()).toBeVisible({ timeout: 15_000 })
    await expect(dialog.getByRole('button', { name: 'Gunakan PO ini' })).toBeVisible()
  })

  test('new-asset-validation-blocks-empty-submit: no write on invalid submit', async ({
    page,
  }) => {
    const noWrite = guardNoAssetWrite(page)
    await page.goto('/assets/new')
    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    // Submit with an empty form → inline errors + an error toast, no POST.
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Managed By required')).toBeVisible()
    await expect(page.getByText('Unit Price required')).toBeVisible()
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible()
    expect(noWrite()).toBe(false)
  })
})

test.describe('asset edit', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')
    await login(page)
  })

  test('asset-edit-prefill: opens from detail, read-only info + editable fields prefilled', async ({
    page,
  }) => {
    const noWrite = guardNoAssetWrite(page)

    await openRealAsset(page)
    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(new RegExp(`/assets/${REAL_ASSET_ID}/edit$`))
    // Legacy title is "Edit Asset"; the AssetID + barcode render in the subheader.
    await expect(page.getByRole('heading', { name: 'Edit Asset' })).toBeVisible()
    await expect(page.getByText(REAL_ASSET_ID, { exact: false }).first()).toBeVisible()

    // Read-only info from the live SP (this asset: Company GARUDA ADHIMATRA).
    await expect(
      page.getByText('PT. GARUDA ADHIMATRA INDONESIA', { exact: false }).first(),
    ).toBeVisible()

    // Editable fields present with the Model/Size/Brand pickers.
    await expect(page.getByRole('button', { name: 'Pilih Model' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pilih Size' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pilih Brand' })).toBeVisible()

    // Brand picker prefilled with the asset's real brand (JBL CONTROL).
    await expect(page.getByRole('button', { name: 'Pilih Brand' })).toContainText('JBL CONTROL')

    expect(noWrite()).toBe(false)
  })

  test('asset-edit-editable-dropdowns-populate: size picker lists real options', async ({
    page,
  }) => {
    await page.goto(`/assets/${REAL_ASSET_ID}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Asset' })).toBeVisible({ timeout: 15_000 })

    // Open the Size picker — a searchable dialog with real size options.
    await page.getByRole('button', { name: 'Pilih Size' }).click()
    await expect(page.getByPlaceholder('Cari…')).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('button').nth(1)).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('asset-edit-update-button-present: valid form exposes Update; write is not exercised', async ({
    page,
  }) => {
    const noWrite = guardNoAssetWrite(page)
    await page.goto(`/assets/${REAL_ASSET_ID}/edit`)
    await expect(page.getByRole('heading', { name: 'Edit Asset' })).toBeVisible({ timeout: 15_000 })

    // The real Update PATCH now writes to the shared dev DB, so the automated test
    // stays UI-level: it asserts the Update button is present + enabled but never
    // clicks it (per IAT safety). No write leaves the browser.
    const update = page.getByRole('button', { name: 'Update' })
    await expect(update).toBeVisible()
    await expect(update).toBeEnabled()
    expect(noWrite()).toBe(false)
  })
})
