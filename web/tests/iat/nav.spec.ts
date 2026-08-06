import { test, expect } from '@playwright/test'
import { login, USER_NAME } from './helpers'

// --- Navigation (sidebar / bottom-nav / unknown-route) + account identity -----

test.describe('navigation (desktop)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop sidebar assertions')
    await login(page)
  })

  test('nav-desktop-sidebar: routes to all sections with active highlight; hidden on mobile', async ({
    page,
  }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    await sidebar.getByRole('link', { name: 'Manage Asset' }).click()
    await expect(page).toHaveURL(/\/assets$/)
    await expect(page.getByRole('heading', { name: 'Manage Asset' })).toBeVisible()

    await sidebar.getByRole('link', { name: 'Request Form' }).click()
    await expect(page).toHaveURL(/\/request$/)
    await expect(page.getByRole('heading', { name: 'Request Form' })).toBeVisible()

    await sidebar.getByRole('link', { name: 'Master Data' }).click()
    await expect(page).toHaveURL(/\/master$/)
    await expect(page.getByRole('heading', { name: 'Asset Master' })).toBeVisible()

    await sidebar.getByRole('link', { name: 'Print QR' }).click()
    await expect(page).toHaveURL(/\/print-qr$/)
    await expect(page.getByRole('heading', { name: 'Print QR' })).toBeVisible()

    await sidebar.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    // Active item carries aria-current="page".
    await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('nav-unknown-route-redirect: unknown route redirects to /dashboard', async ({ page }) => {
    await page.goto('/totally-unknown-route')
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})

test.describe('navigation (mobile)', () => {
  test('nav-mobile-bottom: routes to all 5 tabs; desktop sidebar not shown', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'mobile bottom-nav assertions')
    await login(page)
    const nav = page.locator('nav').last()

    await nav.getByRole('link', { name: 'Asset', exact: true }).click()
    await expect(page).toHaveURL(/\/assets$/)

    await nav.getByRole('link', { name: 'Request', exact: true }).click()
    await expect(page).toHaveURL(/\/request$/)

    await nav.getByRole('link', { name: 'Master', exact: true }).click()
    await expect(page).toHaveURL(/\/master$/)

    await nav.getByRole('link', { name: 'Akun', exact: true }).click()
    await expect(page).toHaveURL(/\/account$/)

    await nav.getByRole('link', { name: 'Dashboard', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    // The desktop sidebar footer is not shown at mobile width.
    await expect(page.getByText('ASRILup PWA · v0.1')).toBeHidden()
  })
})

test.describe('account', () => {
  test('account-shows-real-identity: real STEVEN ALEXANDER / NIK 2403077 from live session', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'account screen (mobile scenario)')
    await login(page)
    await page.goto('/account')

    await expect(page.getByRole('heading', { name: 'Akun' })).toBeVisible()
    // Identity lives in the account card. The top bar also shows the name, so
    // scope to the main content region to keep the assertion unambiguous.
    await expect(page.getByRole('main').getByText(USER_NAME, { exact: false })).toBeVisible()
    await expect(page.getByText(/NIK\s*2403077/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible()
  })
})
