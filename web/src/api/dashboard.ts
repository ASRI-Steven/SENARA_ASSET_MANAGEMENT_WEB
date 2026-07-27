// Dashboard data layer. Wraps the two BFF endpoints behind typed helpers so
// screens never touch raw envelopes. See web/iat/bff-shapes.md for shapes.

import { api, rows } from '@/api/client'
import type {
  DashboardByCompany,
  DashboardByLocation,
  DashboardByType,
  DashboardByTypeModel,
  DashboardData,
  DashboardSummary,
  ManagementOption,
} from '@/api/types'

/** GET /api/dashboard/managements → management filter options (incl. "All", idx 0). */
export async function fetchManagements(): Promise<ManagementOption[]> {
  const env = await api.get<ManagementOption>('/api/dashboard/managements')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat daftar management')
  return rows(env)
}

/**
 * POST /api/dashboard {IDX_M_AssetManagement} → all 5 rowsets, normalised into
 * one object. `idx` 0 = All. Throws on a BFF error envelope.
 */
export async function fetchDashboard(idx: number): Promise<DashboardData> {
  // The rowsets have different row shapes, so type the envelope loosely and
  // narrow per index below.
  const env = await api.post<Record<string, unknown>>('/api/dashboard', {
    IDX_M_AssetManagement: idx,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat dashboard')
  const data = env.data ?? []
  return {
    summary: (data[0]?.[0] as unknown as DashboardSummary) ?? null,
    byCompany: (data[1] as unknown as DashboardByCompany[]) ?? [],
    byLocation: (data[2] as unknown as DashboardByLocation[]) ?? [],
    byType: (data[3] as unknown as DashboardByType[]) ?? [],
    byTypeModel: (data[4] as unknown as DashboardByTypeModel[]) ?? [],
  }
}
