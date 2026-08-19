// Menu-access data layer. Backs the nav filtering: GET /api/menu returns the
// forms the logged-in user may access (role-filtered) for ASRILup (IDX_M_Apps=78),
// from CORE.SecurityManagementDB.dbo.usp_ASRI_GetMenu.

import { api, rows } from '@/api/client'

export interface MenuForm {
  IDX_M_Forms: number
  IDX_M_Forms_Parent: number | null
  Form_ID: string
  Form_Name: string
  Form_Url: string | null
  Form_Icon: string | null
  Form_Sort: string | null
  Level: number
}

/**
 * GET /api/menu → the forms the current user can access (usp_ASRI_GetMenu, app 78).
 * On an invalid/expired CORE session the SP returns a status row instead of forms,
 * so we drop any row without IDX_M_Forms — the caller then treats an empty list as
 * "unknown" (optimistic show-all) rather than "no access to anything".
 */
export async function fetchMenuAccess(): Promise<MenuForm[]> {
  const env = await api.get<MenuForm>('/api/menu')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat menu')
  return rows(env).filter((f) => typeof f.IDX_M_Forms === 'number')
}

/** GET /api/user/role → GroupRole_Name (app 78) for "Lihat sebagai {role}". null bila belum ada. */
export async function fetchUserRole(): Promise<string | null> {
  try {
    const env = await api.get<{ RoleName?: string }>('/api/user/role')
    if (env.status !== 'success') return null
    const r = env.data?.[0]?.[0] as { RoleName?: string } | undefined
    return r?.RoleName?.trim() || null
  } catch {
    return null
  }
}
