import { test, expect } from '@playwright/test'
import { login, NIK, PASSWORD, USER_NAME } from './helpers'

// --- Auth: real login, validation, route guard, session persistence, logout ---
// Every login here hits the real BFF → GeneralAffairDB and gets a real httpOnly
// session cookie back (no mocks).

test.describe('auth', () => {
  test('auth-login-success: real credentials land on dashboard as STEVEN ALEXANDER', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('NIK').fill(NIK)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Masuk' }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    // The real identity from the login SP surfaces in the top-bar user menu.
    await expect(page.getByText(USER_NAME, { exact: false }).first()).toBeVisible()
  })

  test('auth-login-wrong-password: rejected by the real BFF, stays on login', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')

    await page.goto('/login')
    await page.getByLabel('NIK').fill(NIK)
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Masuk' }).click()

    // The real BFF returns status:"error" ("NIK atau password salah"); the app
    // surfaces it via a sonner error toast and never leaves /login.
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible()
  })

  test('auth-login-empty-validation: empty fields validate client-side, no network', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')

    let loginRequestMade = false
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) loginRequestMade = true
    })

    await page.goto('/login')
    await page.getByRole('button', { name: 'Masuk' }).click()

    await expect(page.getByText('NIK dan Password wajib diisi')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    expect(loginRequestMade).toBe(false)
  })

  test('auth-guard-redirect-unauthenticated: deep-link shows splash then redirects to login', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')

    // Deep-link into a protected route with no session. The guard shows the
    // session splash while it resolves /api/auth/check, then bounces to login.
    await page.goto('/assets')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible()
  })

  test('auth-guard-persists-session: reload re-validates the cookie and keeps the session', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'runs once on desktop')

    await login(page)

    // A full reload re-runs the guard, which validates the httpOnly cookie via
    // GET /api/auth/check. We should stay authenticated (no bounce to /login).
    const checkResponse = page.waitForResponse((r) => r.url().includes('/api/auth/check'))
    await page.reload()
    const res = await checkResponse
    expect(res.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText(USER_NAME, { exact: false }).first()).toBeVisible()

    // Regression: the persisted session must survive SEVERAL rapid reloads
    // (mimics a Vite HMR full-reload storm that used to reset the store to
    // 'unknown' and bounce the user to /login mid-check). Never land on /login.
    for (let i = 0; i < 3; i++) {
      await page.reload()
      await expect(page).toHaveURL(/\/dashboard$/)
    }
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('auth-logout-from-account: returns to login and re-guards protected routes', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'account logout (mobile scenario)')

    await login(page)
    await page.goto('/account')
    await expect(page.getByRole('heading', { name: 'Akun' })).toBeVisible()
    await page.getByRole('button', { name: 'Keluar' }).click()

    await expect(page).toHaveURL(/\/login$/)
    // Revisiting a protected route bounces back to login.
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('auth-logout-from-topbar: user menu Keluar returns to login', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'top-bar user menu (desktop scenario)')

    await login(page)
    // The top-bar trigger shows the real user name; open it and click Keluar.
    await page.getByRole('button', { name: new RegExp(USER_NAME, 'i') }).click()
    await page.getByRole('menuitem', { name: 'Keluar' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible()
  })
})
