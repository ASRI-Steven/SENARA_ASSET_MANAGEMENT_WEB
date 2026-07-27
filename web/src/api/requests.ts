// Request-form data layer. Backs RequestFormScreen.
//
// The request-submit SP (usp_CMS_AssetRequestForm_Save via POST /api/requests)
// exists, but per the IAT safety rules the actual submit stays UI-level only —
// this module intentionally exposes only the dropdown lookups the form needs.
// The three option lists are sourced from GET /api/assets/lookups (11 rowsets),
// reusing the same SP the asset grid filters use.

import { api } from '@/api/client'

export interface CompanyOption {
  IDX_M_Company: number
  CompanyName: string
  CompanyAlias: string
}

export interface UserOption {
  IDX_M_AssetUser: number
  AssetUserName: string
  DepartmentName: string | null
}

export interface LocationOption {
  IDX_M_AssetLocation: number
  AssetLocationName: string
}

export interface RequestLookups {
  companies: CompanyOption[]
  users: UserOption[]
  locations: LocationOption[]
}

/**
 * GET /api/assets/lookups → the option lists the request form needs.
 * Rowset order (verified live): [0]=types [1]=colors [2]=locations [3]=statuses
 * [4]=users [5]=sizes [6]=brands [7]=managements [8]=departments [9]=typemodels
 * [10]=companies.
 */
export async function fetchRequestLookups(): Promise<RequestLookups> {
  const env = await api.get<Record<string, unknown>>('/api/assets/lookups')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data pilihan')
  const data = env.data ?? []
  return {
    locations: (data[2] as unknown as LocationOption[]) ?? [],
    users: (data[4] as unknown as UserOption[]) ?? [],
    companies: (data[10] as unknown as CompanyOption[]) ?? [],
  }
}

/** Request types (local constant — not a DB lookup). */
export const REQUEST_TYPES = [
  { value: 'new', label: 'New Asset' },
  { value: 'assignto', label: 'Assign To' },
  { value: 'unassign', label: 'Unassign' },
  { value: 'assignfromto', label: 'Assign From / To' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'service', label: 'Service' },
] as const
