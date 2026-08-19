// Permission store: holds the R/I/U/D/A action set per form (app 78) for the
// current user, from GET /api/permissions. UI components call `can(perms, form,
// action)` to show/hide Tambah/Ubah/Hapus/Approve. The BFF ALSO enforces every
// mutation (guardBySP) so hiding a button is UX, not the security boundary.

import { create } from 'zustand'
import { fetchPermissions, type PermAction } from '@/api/perms'

interface PermState {
  /** Map<formIdx, Set<action>>. null = not loaded yet → optimistic allow. */
  perms: Map<number, Set<string>> | null
  loading: boolean
  load: () => Promise<void>
  reset: () => void
}

export const usePermsStore = create<PermState>((set, get) => ({
  perms: null,
  loading: false,
  async load() {
    if (get().loading) return
    set({ loading: true })
    try {
      const perms = await fetchPermissions()
      set({ perms, loading: false })
    } catch {
      set({ loading: false })
    }
  },
  reset() {
    set({ perms: null, loading: false })
  },
}))

/**
 * Whether the user may perform `action` on the form.
 * - no formIdx (utility without a gating form) → allowed.
 * - not loaded yet (perms === null) → allowed (optimistic; avoids a flash of a
 *   missing button while /api/permissions is in flight — the BFF still enforces).
 * - otherwise → only if the role's template grants that action.
 */
export function can(
  perms: Map<number, Set<string>> | null,
  formIdx: number | undefined,
  action: PermAction,
): boolean {
  if (formIdx == null) return true
  if (perms === null) return true
  return perms.get(formIdx)?.has(action) ?? false
}
