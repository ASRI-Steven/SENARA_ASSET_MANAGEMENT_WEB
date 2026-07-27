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

  test('master-hub-real-counts: cards show real per-entity item counts', async ({ page }) => {
    await page.goto('/master')
    await expect(page.getByRole('heading', { name: 'Master Data' })).toBeVisible()

    // Entity cards link to their sublists.
    for (const label of ['Asset Brand', 'Asset Color', 'Asset Type', 'Asset Location', 'Asset User']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
    const brandCard = page.getByRole('link').filter({ hasText: 'Asset Brand' })
    await expect(brandCard).toHaveAttribute('href', '/master/brand')

    // Real counts load (brand ≈795 → shows a 3-digit "### item"). Wait for the
    // brand card's count to resolve from its skeleton.
    await expect(brandCard.getByText(/\d{3} item/)).toBeVisible({ timeout: 15_000 })
  })

  test('master-open-brand-real-rows: ~795 real rows with counts and ACL actions', async ({
    page,
  }) => {
    await page.goto('/master/brand')
    await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Nama' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Jumlah Aset' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Aksi' })).toBeVisible()

    // The header reports the real total (hundreds of brands, dot-grouped).
    await expect(page.getByText(/\d{3} item/)).toBeVisible({ timeout: 15_000 })

    // A real, well-known brand row (SONY exists in the dev DB).
    await page.getByPlaceholder(/Cari Asset Brand/i).fill('SONY')
    await expect(page.getByRole('cell', { name: 'SONY', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // Tambah + back link present (brand is an editable entity).
    await expect(page.getByRole('button', { name: 'Tambah' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Master', exact: true })).toBeVisible()
  })

  test('master-entity-search-real: server-side search narrows; empty state', async ({ page }) => {
    await page.goto('/master/brand')
    const search = page.getByPlaceholder(/Cari Asset Brand/i)

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

  test('master-location-shows-code-column: Location renders the Kode column', async ({ page }) => {
    await page.goto('/master/location')
    // Location carries an extra "Kode" column (AssetLocationCode).
    await expect(page.getByRole('columnheader', { name: 'Kode' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Nama' })).toBeVisible()

    // A real location row (BASE 2 exists in the dev DB).
    await page.getByPlaceholder(/Cari Asset Location/i).fill('BASE 2')
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
    await page.getByPlaceholder(/Cari Asset User/i).fill('A KAI')
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
    await expect(dialog.getByText('Tambah Asset Brand')).toBeVisible()

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
    await page.getByPlaceholder(/Cari Asset Location/i).fill('BASE 2')
    await expect(page.getByRole('cell', { name: 'BASE 2', exact: true })).toBeVisible({
      timeout: 15_000,
    })

    let updateRequest = false
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/master\/location$/.test(new URL(req.url()).pathname)) {
        updateRequest = true
      }
    })

    // Open the edit dialog on the BASE 2 row; the Nama field is pre-filled.
    await page.getByRole('button', { name: 'Ubah BASE 2' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Ubah Asset Location')).toBeVisible()
    await expect(dialog.getByLabel('Nama')).toHaveValue('BASE 2')

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

  test('master-brand-create-verify-delete-roundtrip: create ZZ_IAT_TEST, verify, self-clean', async ({
    page,
  }) => {
    // The ONE real write test. It creates a clearly test-marked brand, verifies
    // it in the list, then disables + deletes it so the DB is left unchanged.
    const NAME = 'ZZ_IAT_TEST'
    await page.goto('/master/brand')

    // Create.
    await page.getByRole('button', { name: 'Tambah' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Tambah Asset Brand')).toBeVisible()
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
    await page.getByPlaceholder(/Cari Asset Brand/i).fill(NAME)
    await expect(page.getByRole('cell', { name: NAME, exact: true })).toBeVisible({
      timeout: 15_000,
    })

    // Self-clean: delete (the confirm flow disables-then-deletes a DISABLED-able row).
    await page.getByRole('button', { name: `Hapus ${NAME}` }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByText(/Hapus Asset Brand\?/)).toBeVisible()
    const deleteCall = page.waitForResponse(
      (r) =>
        r.request().method() === 'DELETE' &&
        /\/api\/master\/brand$/.test(new URL(r.url()).pathname),
    )
    await confirm.getByRole('button', { name: 'Hapus', exact: true }).click()
    await deleteCall

    // Gone from the list.
    await expect(page.getByRole('cell', { name: NAME, exact: true })).toBeHidden({
      timeout: 15_000,
    })
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
    await expect(page.getByRole('heading', { name: 'Master Data' })).toBeVisible()

    // Real counts load on a card.
    const brandCard = page.getByRole('link').filter({ hasText: 'Asset Brand' })
    await expect(brandCard.getByText(/\d{3} item/)).toBeVisible({ timeout: 15_000 })

    // A card is tappable and routes to its sublist, which loads real rows.
    await brandCard.click()
    await expect(page).toHaveURL(/\/master\/brand$/)
    // The sublist header reports the real brand count. Scope to the page-header
    // paragraph so it's unambiguous: the hub's per-card counts (e.g. Asset
    // Size "1.836 item") are rendered inside link cards, not a <p>, and would
    // otherwise be picked up transiently during the client-side navigation.
    await expect(page.getByRole('paragraph').filter({ hasText: /\d{3} item/ })).toBeVisible({
      timeout: 15_000,
    })
    // Real rows load in the sublist table.
    await expect(page.getByRole('columnheader', { name: 'Jumlah Aset' })).toBeVisible()
  })
})
