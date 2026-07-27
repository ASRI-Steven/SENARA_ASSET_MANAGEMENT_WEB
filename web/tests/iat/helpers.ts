import { expect, type Page } from '@playwright/test'

// Shared credentials for the real BFF (issues an httpOnly session cookie).
export const NIK = '2403077'
export const PASSWORD = '2403077'
export const USER_NAME = 'STEVEN ALEXANDER'

/**
 * A real AssetID that exists in the dev DB (GeneralAffairDB). AssetIDs follow the
 * "<PREFIX>-YYYY-MM-DD-#####" shape, NOT a synthetic "AST-####" pattern. This one
 * is used by the detail/history/print scenarios that need a concrete, real id.
 */
export const REAL_ASSET_ID = 'GAIN-2020-05-25-00062'

/** Matches a real AssetID (letters/digits, dashes) but excludes empty strings. */
export const ASSET_ID_RE = /^[A-Z0-9][A-Z0-9-]{4,}$/i

/**
 * Log in through the real login screen and wait until the dashboard is shown.
 * The session lives in the BFF's httpOnly cookie, so after this the page's
 * browser context is authenticated for every protected route.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('NIK').fill(NIK)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
}

/**
 * Open the assets list, search for REAL_ASSET_ID, and click through to its detail
 * page. The search box is debounced + server-side, so this waits for the single
 * matching row before navigating.
 */
export async function openRealAsset(page: Page, assetId: string = REAL_ASSET_ID): Promise<void> {
  await page.goto('/assets')
  await page.getByPlaceholder('Cari AssetID, model, user…').fill(assetId)
  const link = page.getByRole('link', { name: assetId, exact: true }).first()
  await expect(link).toBeVisible({ timeout: 15_000 })
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/assets/${assetId}$`))
}
