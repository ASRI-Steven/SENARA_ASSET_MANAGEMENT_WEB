import { test, expect, type Page, type Locator } from '@playwright/test'
import { login } from './helpers'

// --- Assets: the EXPANDED advanced-search filters ----------------------------
// The asset list screen (src/screens/assets/AssetListScreen.tsx) exposes, on top
// of Type/Status/Location, the legacy AssetList.vue filters: User (searchable
// Combobox), Department, Brand, Company, Management, Assign/Unassign (ReturnAsset)
// and a TimePeriod quick filter. Every option comes from the real lookups SP
// (GET /api/assets/lookups) and narrows the real POST /api/assets/search grid.
//
// Discriminators below are real dev-DB values verified live against the BFF:
//   • User "DEDE ANDRIANSYAH - 1501030" → 99 assets
//   • Department "Accounting Department" → 42 assets
//   • Company "GAIN" (PT. GARUDA ADHIMATRA INDONESIA) → 5.021 assets
// These reliably drop the total below the full ≈27.905 without emptying the grid.
//
// Management / Assign-Unassign / TimePeriod don't narrow the grid on this DB
// (the SP returns the full set or zero rows for them), so for those we assert the
// control exists and toggling it drives the client-side active-filter badge —
// the badge is derived purely from selection state, independent of row count.

const SEARCH = '/api/assets/search'
const filterButton = (page: Page) => page.getByRole('button', { name: 'Filter' })
const filterBadge = (page: Page) => filterButton(page).getByText(/^\d+$/)

// Locate a <Select> inside the open Filter sheet by the "Semua …" placeholder it
// shows while unset. Each select's placeholder is unique, so this uniquely
// targets Type / Brand / Status / Department / Location / Company / Management /
// Assign / Waktu without relying on DOM order.
function selectByPlaceholder(page: Page, placeholder: string): Locator {
  return page.getByRole('combobox').filter({ hasText: placeholder })
}

// Read the current total from the header description ("13.953 aset") as a number.
async function readTotal(page: Page): Promise<number> {
  const text = await page.getByText(/[\d.]+ aset/).first().innerText()
  const digits = text.replace(/\D/g, '')
  return Number(digits)
}

// Poll the header total until it settles into a narrowed, non-empty range. The
// count updates a tick after the search response, so polling avoids reading the
// previous (stale) total. Asserts 0 < narrowed < full.
async function expectNarrowedBelow(page: Page, full: number): Promise<void> {
  await expect
    .poll(() => readTotal(page), { timeout: 15_000 })
    .toBeLessThan(full)
  expect(await readTotal(page)).toBeGreaterThan(0)
}

// Open the Filter sheet and wait for it to mount its (lazily-built) option lists.
async function openFilters(page: Page): Promise<void> {
  await filterButton(page).click()
  await expect(page.getByRole('heading', { name: 'Filter Aset' })).toBeVisible()
}

// Open the User Combobox picker and select a user by (partial) name. Both the
// Filter Sheet and the Combobox render as role=dialog, so scope to the picker —
// the one carrying the "Cari…" search box — to stay unambiguous.
async function pickUser(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Pilih User' }).click()
  const picker = page
    .getByRole('dialog')
    .filter({ has: page.getByPlaceholder('Cari…') })
  await picker.getByPlaceholder('Cari…').fill(name)
  await picker.getByRole('button', { name: new RegExp(name, 'i') }).first().click()
}

test.describe('assets advanced filters (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop filter-sheet assertions')
    await login(page)
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: 'Manage Asset' })).toBeVisible()
    // The full real total (tens of thousands) is the baseline every test resets to.
    await expect(page.getByText(/\d{2}\.\d{3} aset/)).toBeVisible({ timeout: 15_000 })
  })

  test('assets-filters-all-present: every new advanced filter renders in the sheet', async ({
    page,
  }) => {
    await openFilters(page)

    // Grouped sections from AssetListScreen (Aset / Penempatan / Kepemilikan / Periode).
    await expect(page.getByText('Penempatan')).toBeVisible()
    await expect(page.getByText('Kepemilikan')).toBeVisible()
    await expect(page.getByText('Periode')).toBeVisible()

    // The searchable User Combobox (≈2.100 users) is a labelled button, not a Select.
    await expect(page.getByRole('button', { name: 'Pilih User' })).toBeVisible()

    // Each remaining new filter is a Select carrying its unique "Semua …" placeholder.
    await expect(selectByPlaceholder(page, 'Semua Brand')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Department')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Company')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Management')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Assign / Unassign')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Data')).toBeVisible()

    // The pre-existing Type/Status/Location filters are still there.
    await expect(selectByPlaceholder(page, 'Semua Type')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Status')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Location')).toBeVisible()
  })

  test('assets-filter-user: searchable User combobox narrows the grid + shows the badge', async ({
    page,
  }) => {
    const full = await readTotal(page)

    await openFilters(page)

    // The picker is a search dialog over the real ≈2.100 users. Pick a real one.
    const call = page.waitForResponse((r) => r.url().includes(SEARCH))
    await pickUser(page, 'DEDE ANDRIANSYAH')
    await call

    // The trigger now shows the picked user; the grid narrowed below the full total.
    await expect(page.getByRole('button', { name: 'Pilih User' })).toContainText('DEDE ANDRIANSYAH')
    await page.keyboard.press('Escape')

    await expect(filterBadge(page)).toHaveText('1')
    await expectNarrowedBelow(page, full)
  })

  test('assets-filter-department: Department select narrows the grid + shows the badge', async ({
    page,
  }) => {
    const full = await readTotal(page)

    await openFilters(page)
    const dept = selectByPlaceholder(page, 'Semua Department')
    await dept.click()
    const call = page.waitForResponse((r) => r.url().includes(SEARCH))
    // "Accounting Department" is a real department (≈42 assets in the dev DB).
    await page.getByRole('option', { name: 'Accounting Department', exact: true }).click()
    await call
    await expect(dept).toContainText('Accounting Department')

    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('1')
    await expectNarrowedBelow(page, full)
  })

  test('assets-filter-company: Company select narrows the grid + shows the badge', async ({
    page,
  }) => {
    const full = await readTotal(page)

    await openFilters(page)
    const company = selectByPlaceholder(page, 'Semua Company')
    await company.click()
    const call = page.waitForResponse((r) => r.url().includes(SEARCH))
    // GAIN = PT. GARUDA ADHIMATRA INDONESIA — the populated company (≈5.021 assets).
    await page.getByRole('option', { name: /GAIN/ }).click()
    await call
    await expect(company).toContainText('GAIN')

    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('1')
    await expectNarrowedBelow(page, full)
  })

  test('assets-filter-brand-present-and-selectable: Brand options load from the real lookups', async ({
    page,
  }) => {
    await openFilters(page)
    const brand = selectByPlaceholder(page, 'Semua Brand')
    await brand.click()
    // The dropdown is populated from the real brand lookups (≈795 brands); its own
    // "Semua Brand" reset item plus real brand options are present.
    const options = page.getByRole('option')
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThan(1)
    // Pick the first real brand (after the "Semua Brand" reset row) → badge shows.
    await options.nth(1).click()
    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('1')
  })

  test('assets-filter-management: Management select drives the active-filter badge', async ({
    page,
  }) => {
    await openFilters(page)
    const mgmt = selectByPlaceholder(page, 'Semua Management')
    await mgmt.click()
    // Management options come from the real lookups (22 managements). "Corporate"
    // is a real one; selecting it flips the client-side active-filter badge.
    await page.getByRole('option', { name: 'Corporate', exact: true }).click()
    await expect(mgmt).toContainText('Corporate')
    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('1')
  })

  test('assets-filter-assign: Assign / Unassign select drives the active-filter badge', async ({
    page,
  }) => {
    await openFilters(page)
    const assign = selectByPlaceholder(page, 'Semua Assign / Unassign')
    await assign.click()
    // ReturnAsset options: Assigned / Unassigned. Picking one flips the badge.
    await page.getByRole('option', { name: 'Assigned', exact: true }).click()
    await expect(assign).toContainText('Assigned')
    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('1')
  })

  test('assets-filter-timeperiod: TimePeriod quick filter drives the active-filter badge', async ({
    page,
  }) => {
    await openFilters(page)
    const waktu = selectByPlaceholder(page, 'Semua Data')
    await waktu.click()
    // TimePeriod options: Terakhir Dibuat (1) / Terakhir Diubah (2).
    await page.getByRole('option', { name: 'Terakhir Dibuat', exact: true }).click()
    await expect(waktu).toContainText('Terakhir Dibuat')
    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('1')
  })

  test('assets-filters-badge-counts-multiple: stacking filters bumps the badge count', async ({
    page,
  }) => {
    await openFilters(page)

    // Department + Company → badge should read 2.
    await selectByPlaceholder(page, 'Semua Department').click()
    await page.getByRole('option', { name: 'Accounting Department', exact: true }).click()

    await selectByPlaceholder(page, 'Semua Company').click()
    await page.getByRole('option', { name: /GAIN/ }).click()

    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('2')
  })

  test('assets-filters-reset-clears-all: Reset Filter clears every new filter + the badge', async ({
    page,
  }) => {
    const full = await readTotal(page)

    // Apply THREE different new filters (User combobox + Department + Company).
    await openFilters(page)

    await pickUser(page, 'DEDE ANDRIANSYAH')

    await selectByPlaceholder(page, 'Semua Department').click()
    await page.getByRole('option', { name: 'Accounting Department', exact: true }).click()

    await selectByPlaceholder(page, 'Semua Company').click()
    await page.getByRole('option', { name: /GAIN/ }).click()

    await page.keyboard.press('Escape')
    await expect(filterBadge(page)).toHaveText('3')

    // Reopen and reset — every control returns to its "Semua …" state.
    await filterButton(page).click()
    await page.getByRole('button', { name: 'Reset Filter' }).click()

    await expect(page.getByRole('button', { name: 'Pilih User' })).toContainText('Semua User')
    await expect(selectByPlaceholder(page, 'Semua Department')).toBeVisible()
    await expect(selectByPlaceholder(page, 'Semua Company')).toBeVisible()

    await page.keyboard.press('Escape')

    // Badge gone and the full real total (tens of thousands) is restored.
    await expect(filterBadge(page)).toBeHidden()
    await expect(page.getByText(/\d{2}\.\d{3} aset/)).toBeVisible()
    expect(await readTotal(page)).toBe(full)
  })
})
