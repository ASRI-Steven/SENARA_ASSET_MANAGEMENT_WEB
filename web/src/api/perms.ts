// Permission data layer. GET /api/permissions → the R/I/U/D/A actions the
// current user's role (ASRILup app 78) has per form, from CORES T_TemplatesRole
// (usp_ASRI_GetPermissions). Backs the button gating in the master/approval UI.
// Enforcement is ALSO done server-side (BFF guardBySP) — this only hides buttons.

import { api, rows } from '@/api/client'

/** TemplateRole_Actions codes: Read / Insert / Update / Delete / Approve. */
export type PermAction = 'R' | 'I' | 'U' | 'D' | 'A'

interface PermRow {
  IDX_M_Forms: number
  Action: string
}

/** Map<IDX_M_Forms, Set<action>> for the current user. Empty on invalid session. */
export async function fetchPermissions(): Promise<Map<number, Set<string>>> {
  const env = await api.get<PermRow>('/api/permissions')
  const map = new Map<number, Set<string>>()
  if (env.status !== 'success') return map
  for (const r of rows(env)) {
    if (typeof r.IDX_M_Forms !== 'number') continue
    const a = String(r.Action ?? '').trim().toUpperCase()
    if (!a) continue
    let set = map.get(r.IDX_M_Forms)
    if (!set) {
      set = new Set<string>()
      map.set(r.IDX_M_Forms, set)
    }
    set.add(a)
  }
  return map
}
