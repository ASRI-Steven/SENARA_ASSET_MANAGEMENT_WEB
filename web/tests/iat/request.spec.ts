import { test, expect } from '@playwright/test'
import { login } from './helpers'

// --- Request form: real lookups, add/remove items, fill + validate (UI only) --
// SAFETY: the request-submit SP is NOT called. Kirim runs client-side validation
// and (on success) only shows a toast — no POST to the real backend.

test.describe('request form (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop request-form assertions')
    await login(page)
    await page.goto('/request')
    await expect(page.getByRole('heading', { name: 'Request Form' })).toBeVisible()
  })

  test('request-form-real-lookups: Company/User/Lokasi populate from real lookups', async ({
    page,
  }) => {
    for (const label of ['Jenis Request', 'Company', 'User', 'Lokasi']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }

    // Company select is populated from the real lookups SP.
    const companySelect = page.getByRole('combobox').nth(1)
    await companySelect.click()
    // Real companies (e.g. "PT. ALFA GOLDLAND REALTY") appear as options.
    await expect(page.getByRole('option', { name: /PT\. ALFA GOLDLAND REALTY/ })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('option', { name: /PT\. ALFA GOLDLAND REALTY/ }).click()
    await expect(companySelect).toContainText('PT. ALFA GOLDLAND REALTY')

    // Lokasi select is populated too (e.g. "BASE 2").
    const lokasiSelect = page.getByRole('combobox').nth(3)
    await lokasiSelect.click()
    await expect(page.getByRole('option', { name: 'BASE 2', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')

    // One item row + the send button.
    await expect(page.getByText('Item #1')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Kirim' })).toBeVisible()
  })

  test('request-add-remove-item-ui-only: grows to 2 then back to 1; last delete disabled', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Tambah Item' }).click()
    await expect(page.getByText('Item #2')).toBeVisible()

    // Remove the second item.
    await page.getByRole('button', { name: 'Hapus Item #2' }).click()
    await expect(page.getByText('Item #2')).toBeHidden()

    // With a single item the remaining delete button is disabled.
    await expect(page.getByRole('button', { name: 'Hapus Item #1' })).toBeDisabled()
  })

  test('request-fill-and-validate-ui-only: fill real lookups, validate item, no POST', async ({
    page,
  }) => {
    // Guard: assert no request-submit POST is ever sent to the backend.
    let submitRequest = false
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/request/i.test(req.url())) submitRequest = true
    })

    // Pick Company / User / Lokasi via their real Radix selects.
    await page.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: /PT\. ALFA GOLDLAND REALTY/ }).click()
    await page.getByRole('combobox').nth(2).click()
    await page.getByRole('option', { name: /A KAI/ }).first().click()
    await page.getByRole('combobox').nth(3).click()
    await page.getByRole('option', { name: 'BASE 2', exact: true }).click()

    // Fill the item fields.
    const name = page.getByPlaceholder('Nama item')
    const brand = page.getByPlaceholder('Brand')
    await name.fill('Laptop Dinas')
    await brand.fill('Dell')
    await expect(name).toHaveValue('Laptop Dinas')
    await expect(brand).toHaveValue('Dell')

    // Clear the name and Kirim → validation fails (no write). This is the only
    // Kirim click and it never reaches the backend.
    await name.fill('')
    await page.getByRole('button', { name: 'Kirim' }).click()
    await expect(page.getByText('Nama item wajib diisi')).toBeVisible()
    expect(submitRequest).toBe(false)
  })
})

test.describe('request form (mobile)', () => {
  test('request-mobile-layout: single-column with real dropdowns + bottom-nav', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile layout assertions')
    await login(page)
    await page.goto('/request')

    await expect(page.getByRole('heading', { name: 'Request Form' })).toBeVisible()
    await expect(page.getByPlaceholder('Nama item')).toBeVisible()

    // The Company select still populates from real lookups on mobile.
    await page.getByRole('combobox').nth(1).click()
    await expect(page.getByRole('option', { name: /PT\. ALFA GOLDLAND REALTY/ })).toBeVisible({
      timeout: 15_000,
    })
    await page.keyboard.press('Escape')

    // Mobile bottom-nav present.
    await expect(page.getByRole('link', { name: 'Akun' })).toBeVisible()
  })
})
