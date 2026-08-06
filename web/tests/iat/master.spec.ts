import { test, expect } from '@playwright/test'
import { login } from './helpers'

// --- Master: hub counts, entity read, search, code column, read-only user, ----
// add-validation, edit-prefill, and ONE self-cleaning create→delete roundtrip.
// SAFETY: the only real write is the ZZ_IAT_TEST create→disable→delete roundtrip,
// which cleans itself up. Add/Edit dialogs on real rows are exercised UI-only.

test.describe('master (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop master assertions')
    await login(page)
  })

  test('master-hub-entity-cards: hub lists every master entity linking to its sublist', async ({ page }) => {
    await page.goto('/master')
    // Legacy hub title is "Asset Master" (no per-card item-count fetch).
    await expect(page.getByRole('heading', { name: 'Asset Master' })).toBeVisible()

    // Entity cards link to their sublists (incl. Group/Model added for parity).
    for (const label of ['Asset Brand', 'Asset Color', 'Asset Type', 'Asset Location', 'Asset User']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
    const brandCard = page.getByRole('link').filter({ hasText: 'Asset Brand' })
    await expect(brandCard).toHaveAttribute('href', '/master/brand')

    // Group + Model masters are present (mirrors AssetGroup.vue / AssetModel.vue).
    await expect(
      page.getByRole('link').filter({ hasText: 'Asset Group' }),
    ).toHaveAttribute('href', '/master/group')
    await expect(
      page.getByRole('link').filter({ hasText: 'Master Type Model' }),
    ).toHaveAttribute('href', '/master/model')
  })

  test('master-open-brand-real-rows: ~795 real rows with counts and ACL actions', async ({
    page,
  }) => {
    await page.goto('/master/brand')
    // Legacy column headers: no leading "#" index; entity-specific name/count
    // headers; the actions column is labelled "Setting".
    await expect(page.getByRole('columnheader', { name: '#' })).toHaveCount(0)
    await expect(page.getByRole('columnheader', { name: 'Asset Brand Name' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Asset Brand Count' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Setting' })).toBeVisible()

    // The header reports the real total (hundreds of brands, dot-grouped).
    await expect(page.getByText(/\d{3} item/)).toBeVisible({ timeout: 15_000 })

    // A real, well-known brand row (SONY exists in the dev DB).
    await page.getByPlaceholder(/Search Brand/i).fill('SONY')
    await expect(page.getByRole('cell', { name: 'SONY', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // Tambah + back link present (brand is an editable entity).
    await expect(page.getByRole('button', { name: 'Tambah' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Master', exact: true })).toBeVisible()
  })

  test('master-entity-search-real: server-side search narrows; empty state', async ({ page }) => {
    await page.goto('/master/brand')
    const search = page.getByPlaceholder(/Search Brand/i)

    // "SONY" narrows to the real SONY row server-side (SP filters by Keyword).
    await search.fill('SONY')
    await expect(page.getByRole('cell', { name: 'SONY', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText(/^1 item$/)).toBeVisible()

    // A nonsense keyword yields the empty state.
    await search.fill('zzz-nonsense-nomatch')
    await expect(page.getByText('Tidak ada data.')).toBeVisible({ timeout: 15_000 })
  })

  test('master-location-shows-code-column: Location renders the code column', async ({ page }) => {
    await page.goto('/master/location')
    // Location carries an extra "Location Code" column (AssetLocationCode).
    await expect(page.getByRole('columnheader', { name: 'Location Code' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Asset Location Name' })).toBeVisible()

    // A real location row (BASE 2 exists in the dev DB).
    await page.getByPlaceholder(/Search Location/i).fill('BASE 2')
    await expect(page.getByRole('cell', { name: 'BASE 2', exact: true })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('master-user-readonly: Asset User list is read-only; real users load + search', async ({
    page,
  }) => {
    await page.goto('/master/user')
    await expect(page.getByRole('heading', { name: 'Asset User' })).toBeVisible()

    // Read-only: no Tambah button.
    await expect(page.getByRole('button', { name: 'Tambah' })).toBeHidden()

    // Real users load (thousands) and search narrows server-side.
    await expect(page.getByText(/[\d.]+ item/)).toBeVisible({ timeout: 15_000 })
    await page.getByPlaceholder(/Search User/i).fill('A KAI')
    await expect(page.getByRole('cell', { name: /A KAI/ }).first()).toBeVisible({ timeout: 15_000 })
  })

  test('master-add-validation-ui-only: empty Nama shows validation; no request sent', async ({
    page,
  }) => {
    await page.goto('/master/brand')

    let saveRequest = false
    page.on('request', (req) => {
      // A create would be a POST to /api/master/brand (not the /search POST).
      if (
        req.method() === 'POST' &&
        /\/api\/master\/brand$/.test(new URL(req.url()).pathname)
      ) {
        saveRequest = true
      }
    })

    await page.getByRole('button', { name: 'Tambah' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Add Brand')).toBeVisible()

    // Empty submit → validation toast; nothing is written.
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('Nama wajib diisi')).toBeVisible()
    expect(saveRequest).toBe(false)

    // Discard via Batal.
    await dialog.getByRole('button', { name: 'Batal' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('master-edit-dialog-prefill-cancel: Edit pre-fills the real row name; Batal saves nothing', async ({
    page,
  }) => {
    // Location rows are editable (isUpdate=1) in the dev DB, so the edit pencil
    // renders there. "BASE 2" is a real, editable location.
    await page.goto('/master/location')
    await page.getByPlaceholder(/Search Location/i).fill('BASE 2')
    await expect(page.getByRole('cell', { name: 'BASE 2', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    let updateRequest = false
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/master\/location$/.test(new URL(req.url()).pathname)) {
        updateRequest = true
      }
    })

    // Open the edit dialog on the BASE 2 row; the name field is pre-filled.
    await page.getByRole('button', { name: 'Ubah BASE 2' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Edit Detail Location')).toBeVisible()
    await expect(dialog.getByLabel('Location Name')).toHaveValue('BASE 2')

    // Batal closes without any write.
    await dialog.getByRole('button', { name: 'Batal' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(updateRequest).toBe(false)
    await expect(page.getByRole('cell', { name: 'BASE 2', exact: true })).toBeVisible()
  })

  test('master-unknown-entity: unknown master entity shows tidak ditemukan + Kembali', async ({
    page,
  }) => {
    await page.goto('/master/does-not-exist')
    await expect(page.getByText(/tidak ditemukan/i)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kembali' })).toBeVisible()
  })

  test('master-brand-create-verify-roundtrip: create ZZ_IAT_TEST, verify, self-clean via API', async ({
    page,
  }) => {
    // page.request shares the browser context's auth cookie.
    const request = page.request
    // The ONE real write test. It creates a clearly test-marked brand through the
    // UI and verifies it in the list. Under correct legacy ACL gating the delete
    // action is not exposed in the UI for this user (row isDelete=0), so the row
    // is cleaned up via the API (disable → delete) so the DB is left unchanged.
    const NAME = 'ZZ_IAT_TEST'
    await page.goto('/master/brand')

    // Create.
    await page.getByRole('button', { name: 'Tambah' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Add Brand')).toBeVisible()
    await dialog.getByLabel('Nama').fill(NAME)
    const saveCall = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/api\/master\/brand$/.test(new URL(r.url()).pathname),
    )
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await saveCall
    await expect(page.getByRole('dialog')).toBeHidden()

    // Verify it appears in the list (search to isolate the row).
    await page.getByPlaceholder(/Search Brand/i).fill(NAME)
    await expect(page.getByRole('cell', { name: NAME, exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Self-clean via the API: find every test-marked brand, disable then delete,
    // so the shared dev DB is left exactly as before. Uses the page's auth cookie.
    const searchRes = await request.post('/api/master/brand/search', { data: { Keyword: NAME } })
    const body = await searchRes.json()
    const rows: Array<{ IDX_M_AssetBrand: number; AssetBrandName: string }> =
      (body?.data?.[0] ?? []).filter((r: { AssetBrandName: string }) => r.AssetBrandName === NAME)
    for (const row of rows) {
      await request.post('/api/master/brand/disable', {
        data: { IDX_M_AssetBrand: row.IDX_M_AssetBrand },
      })
      const del = await request.delete('/api/master/brand', {
        data: { IDX_M_AssetBrand: row.IDX_M_AssetBrand },
      })
      expect(del.ok()).toBeTruthy()
    }

    // Gone: a fresh search returns no test-marked brand.
    const after = await request.post('/api/master/brand/search', { data: { Keyword: NAME } })
    const afterBody = await after.json()
    const remaining = (afterBody?.data?.[0] ?? []).filter(
      (r: { AssetBrandName: string }) => r.AssetBrandName === NAME,
    )
    expect(remaining.length).toBe(0)
  })
})

test.describe('master (mobile)', () => {
  test('master-mobile-nav: reach hub via bottom-nav; real counts + entity list load', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile bottom-nav assertions')
    await login(page)

    await page.getByRole('link', { name: 'Master', exact: true }).click()
    await expect(page).toHaveURL(/\/master$/)
    await expect(page.getByRole('heading', { name: 'Asset Master' })).toBeVisible()

    // A card is tappable and routes to its sublist, which loads real rows.
    const brandCard = page.getByRole('link').filter({ hasText: 'Asset Brand' })
    await brandCard.click()
    await expect(page).toHaveURL(/\/master\/brand$/)
    // The sublist header reports the real brand count (dot-grouped) in the
    // page-header paragraph.
    await expect(page.getByRole('paragraph').filter({ hasText: /\d{3} item/ })).toBeVisible({
      timeout: 15_000,
    })
    // Real rows load in the sublist table (entity-specific count header).
    await expect(page.getByRole('columnheader', { name: 'Asset Brand Count' })).toBeVisible()
  })
})
