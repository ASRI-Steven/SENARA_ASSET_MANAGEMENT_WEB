// Menu-access data layer. Backs the nav filtering: GET /api/menu returns the
// forms the logged-in user may access (roots + children) with per-form R/I/U/D
// flags, from usp_SM_PopulateMenuAccess (IDX_M_Apps=32).

import { api, rows } from '@/api/client'

export interface MenuForm {
  FORM: string
  URL: string | null
  PARENT: number | null
  FORMS: number
  R: number
  I: number
  U: number
  D: number
}

/** GET /api/menu → the forms the current user can access. */
export async function fetchMenuAccess(): Promise<MenuForm[]> {
  const env = await api.get<MenuForm>('/api/menu')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat menu')
  return rows(env)
}
