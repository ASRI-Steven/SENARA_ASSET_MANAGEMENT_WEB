import { test, expect } from '@playwright/test'
import { login, openRealAsset, REAL_ASSET_ID } from './helpers'

// --- Asset detail: real fields, QR, real history, actions, not-found ---------
// Detail loads via POST /api/asset/search; history via POST /api/assets/history/*
// keyed by the row's real IDX_M_Asset. REAL_ASSET_ID resolves to a real row:
// Type "SOUND SYSTEM", Brand "JBL CONTROL", Company "PT. GARUDA ADHIMATRA INDONESIA".

test.describe('asset detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('asset-detail-real-fields-qr: real fields + QR svg', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop detail action buttons')
    await openRealAsset(page)

    await expect(page.getByRole('heading', { name: REAL_ASSET_ID })).toBeVisible()

    // QR rendered as an svg.
    await expect(page.locator('svg').first()).toBeVisible()

    // Field labels present.
    for (const label of ['Type', 'Model', 'Brand', 'Company', 'User', 'Location', 'Nilai']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible()
    }

    // Real field VALUES from the live SP.
    await expect(page.getByText('SOUND SYSTEM', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('JBL CONTROL', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('PT. GARUDA ADHIMATRA INDONESIA', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('GWK BALI', { exact: false }).first()).toBeVisible()

    // Actions. Edit is a link to the edit route; Kembali/Cetak QR unchanged.
    await expect(page.getByRole('button', { name: 'Cetak QR' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Kembali' })).toBeVisible()
  })

  test('asset-detail-real-history: real dated history via /api/assets/history/*', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')

    // Wait for at least one history call to complete so timelines have rendered.
    const historyCall = page.waitForResponse((r) => r.url().includes('/api/assets/history/'))
    await openRealAsset(page)
    await historyCall

    await expect(page.getByRole('heading', { name: 'Riwayat' })).toBeVisible()

    // Real timelines render (this asset has User + Status history in the live DB).
    await expect(page.getByRole('heading', { name: 'User' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Status' })).toBeVisible()
    // A real dated entry (history rows carry a formatted date range).
    await expect(page.getByText(/\d{4}|sekarang/).first()).toBeVisible()
    // The real status value "OK" appears in the Status timeline.
    await expect(page.getByText('OK', { exact: false }).first()).toBeVisible()
  })

  test('asset-detail-edit-route: Edit routes to the edit form; no write', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop Edit button')
    await openRealAsset(page)

    let writeRequest = false
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && /\/api\/asset$/.test(req.url())) {
        writeRequest = true
      }
    })

    await page.getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(new RegExp(`/assets/${REAL_ASSET_ID}/edit$`))
    await expect(page.getByRole('heading', { name: new RegExp(`Edit ${REAL_ASSET_ID}`) })).toBeVisible()
    expect(writeRequest).toBe(false)
  })

  test('asset-detail-actions-assign-user: dialog opens, user picker loads real lookups, no write', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop actions menu')
    await openRealAsset(page)

    // Guard: no mutating asset-action request may fire (UI-level exercise only).
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

    // The detail "Aksi lainnya" kebab exposes the full action set (detail SP
    // returns no ACL flags, so every action is offered).
    await page.getByRole('button', { name: 'Aksi lainnya' }).click()
    await page.getByRole('menuitem', { name: 'Assign User' }).click()

    // The dialog opens with the right title + a user picker fed by real lookups.
    const dialog = page.getByRole('dialog').last()
    await expect(dialog.getByText('Assign User', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Pilih User' })).toBeVisible()

    // The picker opens a searchable list populated from the real lookups SP.
    await dialog.getByRole('button', { name: 'Pilih User' }).click()
    const search = page.getByPlaceholder('Cari…')
    await expect(search).toBeVisible()
    await search.fill('STEVEN')
    await expect(
      page.getByRole('button').filter({ hasText: /STEVEN/i }).first(),
    ).toBeVisible({ timeout: 15_000 })

    // Close the picker + dialog without submitting — no write must fire.
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    expect(writeRequest).toBe(false)
  })

  test('asset-detail-actions-change-company: dialog loads companies by management, no write', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop actions menu')
    await openRealAsset(page)

    let writeRequest = false
    page.on('request', (req) => {
      if (req.method() !== 'GET' && /\/api\/assets\/change-company/.test(req.url())) {
        writeRequest = true
      }
    })

    // Opening Change Company loads companies scoped to the asset's management.
    const companyCall = page.waitForResponse((r) => r.url().includes('/api/asset/company'))
    await page.getByRole('button', { name: 'Aksi lainnya' }).click()
    await page.getByRole('menuitem', { name: 'Change Company' }).click()
    await companyCall

    const dialog = page.getByRole('dialog').last()
    await expect(dialog.getByText('Change Company', { exact: true })).toBeVisible()
    // The company picker is enabled (companies loaded, not stuck on "Memuat…").
    const picker = dialog.getByRole('button', { name: 'Pilih Company' })
    await expect(picker).toBeVisible()
    await expect(picker).toBeEnabled()

    await page.keyboard.press('Escape')
    expect(writeRequest).toBe(false)
  })

  test('asset-detail-actions-return: Return dialog validates + submits nothing (no write)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop actions menu')
    await openRealAsset(page)

    let writeRequest = false
    page.on('request', (req) => {
      if (req.method() !== 'GET' && /\/api\/assets\/return/.test(req.url())) {
        writeRequest = true
      }
    })

    await page.getByRole('button', { name: 'Aksi lainnya' }).click()
    await page.getByRole('menuitem', { name: 'Return' }).click()

    const dialog = page.getByRole('dialog').last()
    await expect(dialog.getByText('Return Asset', { exact: true })).toBeVisible()
    // Remarks field present; a Return + Batal button pair is shown.
    await expect(dialog.getByRole('button', { name: 'Batal' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Return' })).toBeVisible()

    // Cancel — nothing is written.
    await dialog.getByRole('button', { name: 'Batal' }).click()
    expect(writeRequest).toBe(false)
  })

  test('asset-detail-print: Cetak QR triggers window.print() client-side', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop print action')
    await openRealAsset(page)

    // Stub window.print so the click is observable without a real print dialog.
    await page.evaluate(() => {
      ;(window as unknown as { __printed: number }).__printed = 0
      window.print = () => {
        ;(window as unknown as { __printed: number }).__printed++
      }
    })
    await page.getByRole('button', { name: 'Cetak QR' }).click()
    const printed = await page.evaluate(
      () => (window as unknown as { __printed: number }).__printed,
    )
    expect(printed).toBe(1)
  })

  test('asset-detail-back: Kembali returns to the assets list', async ({ page }) => {
    await openRealAsset(page)
    await page.getByRole('link', { name: 'Kembali' }).click()
    await expect(page).toHaveURL(/\/assets$/)
    await expect(page.getByRole('heading', { name: 'Manage Asset' })).toBeVisible()
  })

  test('asset-detail-not-found: unknown AssetID shows tidak ditemukan + Kembali', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')

    await page.goto('/assets/ZZ-DOES-NOT-EXIST-999')
    await expect(page.getByText(/tidak ditemukan/i)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: 'Kembali' })).toBeVisible()
  })
})
