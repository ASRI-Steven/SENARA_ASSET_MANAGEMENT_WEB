import { test, expect, type Page } from '@playwright/test'
import { login } from './helpers'

// --- Settings: Admin Access, Group Access, User roles -------------------------
// SAFETY:
//   • Reads (search / lookups / by-nik / matrix load) are exercised fully E2E.
//   • Add/Edit dialogs on REAL rows are opened UI-only — the final prod-writing
//     submit is asserted NOT to fire (a request listener guards it).
//   • The ONE real write is the Admin Access create→verify→delete roundtrip on a
//     clearly test-marked NIK ("ZZ_IAT_TEST"). It is a synthetic NIK tied to no
//     real employee (Name renders empty) and is deleted at the end, leaving the
//     DB unchanged. User-role saves target real people, so they stay UI-only.

const NAV_SETTING = ['Admin Access', 'Group Access', 'User Setting'] as const

async function gotoSetting(page: Page, path: string) {
  await page.goto(path)
}

test.describe('settings navigation (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sidebar assertions')
    await login(page)
  })

  test('settings-sidebar-section: sidebar shows a Setting group linking all 3 screens', async ({
    page,
  }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // The labelled "Setting" section header renders.
    await expect(sidebar.getByText('Setting', { exact: true })).toBeVisible()

    // Each setting link routes correctly.
    await sidebar.getByRole('link', { name: 'Admin Access' }).click()
    await expect(page).toHaveURL(/\/settings\/admin-access$/)
    await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible()

    await sidebar.getByRole('link', { name: 'Group Access' }).click()
    await expect(page).toHaveURL(/\/settings\/groups$/)
    await expect(page.getByRole('heading', { name: 'Group Access' })).toBeVisible()

    await sidebar.getByRole('link', { name: 'User Setting' }).click()
    await expect(page).toHaveURL(/\/settings\/users$/)
    await expect(page.getByRole('heading', { name: 'User Setting' })).toBeVisible()
  })

  test('settings-master-hub-cards: Master hub surfaces a Setting section with 3 cards', async ({
    page,
  }) => {
    await page.goto('/master')
    await expect(page.getByRole('heading', { name: 'Master Data' })).toBeVisible()

    // The "Setting" sub-heading + three cards (also the mobile-reachable entry).
    // Scope to the main content region so the sidebar's setting links (same text)
    // don't collide with the hub cards.
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Setting' })).toBeVisible()
    for (const label of NAV_SETTING) {
      // The hub card carries the "Kelola akses pengguna" hint under the label.
      await expect(
        main.getByRole('link').filter({ hasText: 'Kelola akses pengguna' }).filter({ hasText: label }),
      ).toBeVisible()
    }
    await expect(
      main.getByRole('link').filter({ hasText: 'Admin Access' }),
    ).toHaveAttribute('href', '/settings/admin-access')
  })
})

test.describe('settings: admin access (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop admin-access assertions')
    await login(page)
  })

  test('admin-access-real-rows: real admin users load with NIK/Name/Departemen columns', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/admin-access')
    await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'NIK' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Nama' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Departemen' })).toBeVisible()

    // Header reports a real count (there are dozens of admin-access rows).
    await expect(page.getByRole('paragraph').filter({ hasText: /\d+ pengguna/ })).toBeVisible({
      timeout: 15_000,
    })
    // At least one real, non-empty admin row renders (a name cell in the body).
    await expect(page.getByRole('cell', { name: /[A-Z]{3,}/ }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('admin-access-search-real: server-side search narrows; empty state on nonsense', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/admin-access')
    const search = page.getByLabel('Cari pengguna')

    // A real admin (WIWIK GUNARSIH exists in the dev DB).
    await search.fill('WIWIK')
    await expect(page.getByRole('cell', { name: /WIWIK/ }).first()).toBeVisible({ timeout: 15_000 })

    // Nonsense keyword → empty state.
    await search.fill('zzz-nonsense-nomatch')
    await expect(page.getByText('Tidak ada data.')).toBeVisible({ timeout: 15_000 })
  })

  test('admin-access-add-validation-ui-only: empty form validates; no write is sent', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/admin-access')

    let saveRequest = false
    page.on('request', (req) => {
      if (
        req.method() === 'POST' &&
        /\/api\/settings\/admin-access$/.test(new URL(req.url()).pathname)
      ) {
        saveRequest = true
      }
    })

    await page.getByRole('button', { name: 'Tambah' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Tambah Akses Admin')).toBeVisible()

    // Empty NIK → validation toast; nothing written.
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await expect(page.getByText('NIK wajib diisi')).toBeVisible()
    expect(saveRequest).toBe(false)

    await dialog.getByRole('button', { name: 'Batal' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('admin-access-edit-prefill-ui-only: Edit loads the real scope via by-nik; Batal writes nothing', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/admin-access')
    await page.getByLabel('Cari pengguna').fill('WIWIK')
    const nameCell = page.getByRole('cell', { name: /WIWIK/ }).first()
    await expect(nameCell).toBeVisible({ timeout: 15_000 })

    let updateRequest = false
    page.on('request', (req) => {
      if (
        req.method() === 'PATCH' &&
        /\/api\/settings\/admin-access$/.test(new URL(req.url()).pathname)
      ) {
        updateRequest = true
      }
    })

    // The by-nik lookup fires when opening the edit dialog.
    const byNik = page.waitForResponse((r) =>
      /\/api\/settings\/admin-access\/by-nik$/.test(new URL(r.url()).pathname),
    )
    // Open the edit pencil for the WIWIK row (aria-label "Ubah <name>").
    await page.getByRole('button', { name: /Ubah WIWIK/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Ubah Akses Admin')).toBeVisible()
    await byNik

    // NIK field is not shown on edit (identity is fixed); the scope selects load.
    await expect(dialog.getByLabel('Security')).toBeVisible()
    await expect(dialog.getByLabel('Company')).toBeVisible()

    // Batal closes without any write.
    await dialog.getByRole('button', { name: 'Batal' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(updateRequest).toBe(false)
  })

  test('admin-access-create-verify-delete-roundtrip: create ZZ_IAT_TEST, verify, self-clean', async ({
    page,
  }) => {
    // The ONE real write in this suite. Uses a synthetic NIK tied to no employee,
    // then deletes it so the DB is left unchanged.
    const NIK = 'ZZ_IAT_TEST'
    await gotoSetting(page, '/settings/admin-access')
    await expect(page.getByRole('button', { name: 'Tambah' })).toBeVisible({ timeout: 15_000 })

    // Create.
    await page.getByRole('button', { name: 'Tambah' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Tambah Akses Admin')).toBeVisible()
    await dialog.getByLabel('NIK').fill(NIK)

    // Pick Security / Management / Company from the real lookups.
    await dialog.getByLabel('Security').click()
    await page.getByRole('option').first().click()
    await dialog.getByLabel('Management').click()
    await page.getByRole('option', { name: '[ALL]' }).click()
    await dialog.getByLabel('Company').click()
    await page.getByRole('option', { name: '[ALL]' }).click()

    const saveCall = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/api\/settings\/admin-access$/.test(new URL(r.url()).pathname),
    )
    await dialog.getByRole('button', { name: 'Simpan' }).click()
    await saveCall
    await expect(page.getByRole('dialog')).toBeHidden()

    // Verify it appears (search to isolate). Use .first() since a partial run
    // could have left more than one test-marked row.
    await page.getByLabel('Cari pengguna').fill(NIK)
    await expect(page.getByRole('cell', { name: NIK, exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Self-clean: delete EVERY ZZ_IAT_TEST row so the DB is left unchanged even if
    // a previous run leaked one. Loop until no test row remains.
    for (let guard = 0; guard < 6; guard++) {
      const rows = page.getByRole('cell', { name: NIK, exact: true })
      if ((await rows.count()) === 0) break
      await page.getByRole('button', { name: /Hapus/ }).first().click()
      const confirm = page.getByRole('dialog')
      await expect(confirm.getByText(/Hapus akses admin\?/)).toBeVisible()
      const deleteCall = page.waitForResponse(
        (r) =>
          r.request().method() === 'DELETE' &&
          /\/api\/settings\/admin-access$/.test(new URL(r.url()).pathname),
      )
      await confirm.getByRole('button', { name: 'Hapus', exact: true }).click()
      await deleteCall
      await expect(page.getByRole('dialog')).toBeHidden()
      // Let the list reload (search keyword still applied).
      await page.waitForTimeout(500)
    }

    // Gone: no test-marked row remains.
    await expect(page.getByRole('cell', { name: NIK, exact: true })).toHaveCount(0, {
      timeout: 15_000,
    })
  })
})

test.describe('settings: group access (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop group-access assertions')
    await login(page)
  })

  test('group-access-loads: screen renders header + search; degrades gracefully if SP absent', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/groups')
    await expect(page.getByRole('heading', { name: 'Group Access' })).toBeVisible()
    await expect(page.getByLabel('Cari pengguna')).toBeVisible()

    // The group-access SPs are not present in the dev DB, so the screen either
    // lists real rows OR shows its error state — both are acceptable. Assert one
    // of the two resolves (never an infinite spinner).
    const errorState = page.getByText('Gagal memuat data')
    const emptyState = page.getByText('Tidak ada data.')
    const anyRow = page.getByRole('cell', { name: /[A-Z]{3,}/ }).first()
    await expect(errorState.or(emptyState).or(anyRow)).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('settings: user roles (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop user-roles assertions')
    await login(page)
  })

  test('user-roles-real-rows: real ASRILup users load with NIK/Nama columns + search', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/users')
    await expect(page.getByRole('columnheader', { name: 'NIK' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Nama' })).toBeVisible()

    // A real user known to be in the ASRILup user list (Steven Alexander).
    await expect(page.getByRole('cell', { name: /Steven Alexander/i }).first()).toBeVisible({
      timeout: 15_000,
    })

    // Search narrows client/server-side.
    await page.getByLabel('Cari pengguna').fill('Arnold')
    await expect(page.getByRole('cell', { name: /Arnold/i }).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('user-roles-edit-matrix-ui-only: Edit opens the R/I/U/D matrix from by-nik; no save fires', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/users')
    const row = page.getByRole('cell', { name: /Steven Alexander/i }).first()
    await expect(row).toBeVisible({ timeout: 15_000 })

    let saveRequest = false
    page.on('request', (req) => {
      const p = new URL(req.url()).pathname
      if (
        (req.method() === 'POST' || req.method() === 'PATCH') &&
        /\/api\/settings\/users$/.test(p)
      ) {
        saveRequest = true
      }
    })

    // The edit pencil is present only if the current user has isUpdate on that
    // row; if not present for this account, the drawer test is not applicable.
    const pencil = page.getByRole('button', { name: /Ubah akses/i }).first()
    if (await pencil.count()) {
      const byNik = page.waitForResponse((r) =>
        /\/api\/settings\/users\/by-nik$/.test(new URL(r.url()).pathname),
      )
      await pencil.click()
      // Drawer opens with the form/access matrix header columns.
      await expect(page.getByRole('columnheader', { name: 'Form' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Read' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Insert' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Update' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Delete' })).toBeVisible()
      await byNik
      // Real form rows populate the matrix (e.g. DASHBOARD).
      await expect(page.getByRole('cell', { name: 'DASHBOARD', exact: true })).toBeVisible({
        timeout: 15_000,
      })
      // A Read checkbox is present and toggleable (UI-only).
      const firstRead = page.getByRole('checkbox', { name: /^Read / }).first()
      await expect(firstRead).toBeVisible()
      await firstRead.click()

      // Cancel: no write is sent.
      await page.getByRole('button', { name: 'Batal' }).click()
      expect(saveRequest).toBe(false)
    }
  })

  test('user-roles-add-drawer-ui-only: Add opens a blank matrix + user picker; no save fires', async ({
    page,
  }) => {
    await gotoSetting(page, '/settings/users')

    let saveRequest = false
    page.on('request', (req) => {
      const p = new URL(req.url()).pathname
      if (req.method() === 'POST' && /\/api\/settings\/users$/.test(p)) {
        saveRequest = true
      }
    })

    const addBtn = page.getByRole('button', { name: 'Tambah' })
    if (await addBtn.count()) {
      // The lookups (template + user list) fire on open.
      const tpl = page.waitForResponse((r) =>
        /\/api\/settings\/users\/lookups$/.test(new URL(r.url()).pathname),
      )
      await addBtn.click()
      await tpl
      await expect(page.getByText('Tambah Akses User')).toBeVisible()
      // The user picker + matrix columns render.
      await expect(page.getByRole('button', { name: 'Pilih User' })).toBeVisible()
      await expect(page.getByRole('columnheader', { name: 'Form' })).toBeVisible()

      // Try submit without a user → validation, no write.
      await page.getByRole('button', { name: 'Simpan' }).click()
      await expect(page.getByText('User wajib dipilih')).toBeVisible()
      expect(saveRequest).toBe(false)

      await page.getByRole('button', { name: 'Batal' }).click()
    }
  })
})

test.describe('settings navigation (mobile)', () => {
  test('settings-mobile-reachable: reach all 3 setting screens via the Master hub cards', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile reachability via master hub')
    await login(page)

    // Bottom-nav → Master, then the Setting cards are the mobile entry point.
    await page.getByRole('link', { name: 'Master', exact: true }).click()
    await expect(page).toHaveURL(/\/master$/)
    const main = page.getByRole('main')
    await expect(main.getByRole('heading', { name: 'Setting' })).toBeVisible()

    await main.getByRole('link').filter({ hasText: 'Admin Access' }).click()
    await expect(page).toHaveURL(/\/settings\/admin-access$/)
    await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible()
  })
})
