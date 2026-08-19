// Menu-access store: holds the set of form IDs (IDX_M_Forms, app 78) the current
// user may access (from GET /api/menu → usp_ASRI_GetMenu). The nav components
// filter their items against it so a user only sees menus they have rights to.

import { create } from 'zustand'
import { fetchMenuAccess } from '@/api/menu'

interface MenuState {
  /** Accessible IDX_M_Forms. null = not loaded / unknown → show optimistically. */
  idxs: Set<number> | null
  loading: boolean
  load: () => Promise<void>
}

export const useMenuStore = create<MenuState>((set, get) => ({
  idxs: null,
  loading: false,
  async load() {
    if (get().loading) return
    set({ loading: true })
    try {
      const forms = await fetchMenuAccess()
      // Empty (invalid CORE session / not wired yet) → keep null = optimistic show-all
      // so a transient/unauthorised menu response never blanks the whole nav.
      if (forms.length > 0) {
        set({ idxs: new Set(forms.map((f) => f.IDX_M_Forms)), loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },
}))

/**
 * Whether a nav item should be visible given the loaded access set.
 * - no formIdx (utility with no gating form) → always shown.
 * - not loaded yet (idxs === null) → shown (optimistic; avoids a flash of empty nav).
 * - otherwise → only if the user has access to that form.
 */
export function canSeeMenu(idxs: Set<number> | null, formIdx?: number): boolean {
  if (formIdx == null) return true
  if (idxs === null) return true
  return idxs.has(formIdx)
}
