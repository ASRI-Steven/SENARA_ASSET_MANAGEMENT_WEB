// Dashboard data layer. Wraps the two BFF endpoints behind typed helpers so
// screens never touch raw envelopes. See web/iat/bff-shapes.md for shapes.

import { api, rows } from '@/api/client'
import type {
  DashboardByCompany,
  DashboardByLocation,
  DashboardByManagement,
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
    byManagement: (data[5] as unknown as DashboardByManagement[]) ?? [],
  }
}

/** GET /api/dashboard/highlight → "aset baru bulan ini" (count + nilai). */
export interface DashboardHighlight {
  NewAssetThisMonth: number
  NewAssetValueThisMonth: string // numeric string
}
export async function fetchDashboardHighlight(): Promise<DashboardHighlight | null> {
  const env = await api.get<DashboardHighlight>('/api/dashboard/highlight')
  if (env.status !== 'success') return null
  return (env.data?.[0]?.[0] as unknown as DashboardHighlight) ?? null
}

/**
 * POST /api/dashboard/coverage {IDX_M_AssetManagement, From, To} → cakupan opname
 * REAL untuk rentang tanggal. Done = aset (dalam scope) yang punya riwayat
 * status/user/lokasi di [From,To]. Total = total aset scope (= angka dashboard).
 */
export interface OpnameCoverage {
  Total: number
  Done: number
  Pct: number
}
export async function fetchOpnameCoverage(
  from: string,
  to: string,
  idx = 0,
): Promise<OpnameCoverage> {
  const env = await api.post<OpnameCoverage>('/api/dashboard/coverage', {
    IDX_M_AssetManagement: idx,
    From: from,
    To: to,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat cakupan opname')
  const r = env.data?.[0]?.[0] as unknown as OpnameCoverage | undefined
  return { Total: r?.Total ?? 0, Done: r?.Done ?? 0, Pct: r?.Pct ?? 0 }
}
