// Menu-access store: holds the set of legacy form URLs the current user may
// access (from GET /api/menu). The nav components filter their items against it
// so a user only sees the menus they have rights to (matches the legacy app,
// which builds its drawer from the same access SP).

import { create } from 'zustand'
import { fetchMenuAccess } from '@/api/menu'

const norm = (u: string) => u.trim().toLowerCase()

interface MenuState {
  /** Accessible legacy form URLs (lowercased). null = not loaded yet. */
  urls: Set<string> | null
  loading: boolean
  load: () => Promise<void>
}

export const useMenuStore = create<MenuState>((set, get) => ({
  urls: null,
  loading: false,
  async load() {
    if (get().loading) return
    set({ loading: true })
    try {
      const forms = await fetchMenuAccess()
      const urls = new Set(
        forms
          .map((f) => f.URL)
          .filter((u): u is string => !!u)
          .map(norm),
      )
      set({ urls, loading: false })
    } catch {
      // Leave urls untouched (null → optimistic show) so a transient failure
      // never blanks the whole nav.
      set({ loading: false })
    }
  },
}))

/**
 * Whether a nav item should be visible given the loaded access set.
 * - no formUrl (PWA-only utility like Print QR, no legacy form) → always shown.
 * - not loaded yet (urls === null) → shown (optimistic; avoids a flash of empty
 *   nav while /api/menu is in flight).
 * - otherwise → only if the user has access to that form URL.
 */
export function canSeeMenu(urls: Set<string> | null, formUrl?: string): boolean {
  if (!formUrl) return true
  if (urls === null) return true
  return urls.has(norm(formUrl))
}
