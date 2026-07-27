// New-asset / asset-edit data layer. Backs AssetNewScreen / AssetEditScreen.
// Shapes verified live against the dev DB (login NIK=2403077):
//   GET  /api/asset/lookups   → 9 rowsets (NO companies, NO type-models)
//   GET  /api/assets/lookups  → 11 rowsets ([9]=type-models, [10]=companies)
//   POST /api/asset/company {IDX_M_AssetManagement} → company-by-management
//   POST /api/po {PONo}       → [0]=header (PODate…), [1]=material lines
//   POST  /api/asset          → create (usp_CMS_Asset_Save)
//   PATCH /api/asset          → update (usp_CMS_Asset_Update)
//
// The mutation SPs return HTTP 200 with env.status==="success" even on a business
// error; the real outcome is in data[0][0].StatusCode — unwrapped by assertStatus.

import { api, firstRow, rows } from '@/api/client'

// --- Option row shapes (from GET /api/asset/lookups, 9 rowsets) ---
export interface TypeOption {
  AssetTypeName: string
  IDX_M_AssetType: number
}
export interface ColorOption {
  AssetColorName: string
  IDX_M_AssetColor: number
}
export interface LocationOption {
  AssetLocationName: string
  IDX_M_AssetLocation: number
}
export interface StatusOption {
  AssetStatusName: string
  IDX_M_AssetStatus: number
}
export interface UserOption {
  AssetUserName: string
  IDX_M_AssetUser: number
}
export interface SizeOption {
  AssetSizeName: string
  IDX_M_AssetSize: number
}
export interface BrandOption {
  AssetBrandName: string
  IDX_M_AssetBrand: number
}
export interface ManagementOption {
  AssetManagementName: string
  IDX_M_AssetManagement: number
}
/** From GET /api/assets/lookups data[9] — type-models (filter client-side by type). */
export interface TypeModelOption {
  AssetTypeModelName: string
  IDX_M_AssetType: number
  IDX_M_AssetTypeModel: number
}
export interface CompanyOption {
  CompanyName: string
  IDX_M_Company: number
}

/** All option lists the New-Asset form needs. */
export interface AssetFormLookups {
  types: TypeOption[]
  colors: ColorOption[]
  locations: LocationOption[]
  statuses: StatusOption[]
  users: UserOption[]
  sizes: SizeOption[]
  brands: BrandOption[]
  managements: ManagementOption[]
  /** All type-models; filter by the selected IDX_M_AssetType client-side. */
  typeModels: TypeModelOption[]
}

/** Currency options (static — matches legacy NewAsset.vue). */
export const CURRENCY_OPTIONS = [
  { value: 'IDR', label: 'IDR Rupiah' },
  { value: 'USD', label: '$ US Dollar' },
] as const

/**
 * Loads the full New-Asset lookup set. The single-asset lookup SP
 * (GET /api/asset/lookups) provides types/colors/locations/statuses/users/
 * sizes/brands/managements but NOT companies or type-models, so the type-models
 * come from the richer grid lookup (GET /api/assets/lookups data[9]). Companies
 * are loaded on management change via fetchCompaniesByManagement.
 */
export async function fetchAssetFormLookups(): Promise<AssetFormLookups> {
  const [assetEnv, gridEnv] = await Promise.all([
    api.get<Record<string, unknown>>('/api/asset/lookups'),
    api.get<Record<string, unknown>>('/api/assets/lookups'),
  ])
  if (assetEnv.status !== 'success') {
    throw new Error(assetEnv.message || 'Gagal memuat data pilihan')
  }
  const a = assetEnv.data ?? []
  const g = gridEnv.status === 'success' ? (gridEnv.data ?? []) : []
  return {
    types: (a[0] as unknown as TypeOption[]) ?? [],
    colors: (a[1] as unknown as ColorOption[]) ?? [],
    locations: (a[2] as unknown as LocationOption[]) ?? [],
    statuses: (a[3] as unknown as StatusOption[]) ?? [],
    users: (a[4] as unknown as UserOption[]) ?? [],
    sizes: (a[5] as unknown as SizeOption[]) ?? [],
    brands: (a[6] as unknown as BrandOption[]) ?? [],
    managements: (a[7] as unknown as ManagementOption[]) ?? [],
    typeModels: (g[9] as unknown as TypeModelOption[]) ?? [],
  }
}

/** POST /api/asset/company {IDX_M_AssetManagement} → companies for that management. */
export async function fetchCompaniesByManagement(
  idxManagement: number,
): Promise<CompanyOption[]> {
  const env = await api.post<CompanyOption>('/api/asset/company', {
    IDX_M_AssetManagement: idxManagement,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat company')
  return rows(env)
}

// --- PO search ---
export interface POHeader {
  PONo: string
  PODate: string
  POName?: string
  PONote?: string
  Type?: string
}
export interface POMaterialLine {
  MaterialCode: string
  Category: string
  Subcategory: string
  MaterialType: string
  UnitPrice: number | string
}
export interface POResult {
  header: POHeader | null
  lines: POMaterialLine[]
}

/**
 * POST /api/po {PONo} → [0]=header rows, [1]=material lines. A non-existent PO
 * returns two empty rowsets (header === null) — the caller treats that as
 * "PO not found" (non-fatal; PO is optional on submit).
 */
export async function searchPO(poNo: string): Promise<POResult> {
  const env = await api.post<Record<string, unknown>>('/api/po', { PONo: poNo })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal mencari PO')
  const data = env.data ?? []
  const header = (data[0]?.[0] as unknown as POHeader) ?? null
  const lines = (data[1] as unknown as POMaterialLine[]) ?? []
  return { header, lines }
}

// --- Create / Update ---
interface StatusEnvelope {
  StatusCode?: string // "Success" | "Error"
  StatusMessage?: string
  StatusCSS?: string
}

/** Unwrap the single-row status envelope; throw with StatusMessage on "Error". */
function assertStatus(env: { status: string; message: string; data?: unknown }): string {
  if (env.status !== 'success') throw new Error(env.message || 'Operasi gagal')
  const s = firstRow(env as never) as StatusEnvelope | undefined
  const msg = (s?.StatusMessage || '').trim()
  if (s?.StatusCode && s.StatusCode.toLowerCase() === 'error') {
    throw new Error(msg || 'Operasi gagal')
  }
  return msg
}

/** Body for POST /api/asset (create). Field names match usp_CMS_Asset_Save exactly. */
export interface AssetCreatePayload {
  IDX_M_AssetManagement: number
  IDX_M_Company: number
  IDX_M_AssetType: number
  AssetTypeModelName: string
  IDX_M_AssetColor: number
  AssetSizeName: string
  AssetBrandName: string
  IDX_M_AssetUser: number
  IDX_M_AssetLocation: number
  IDX_M_AssetStatus: number
  PONo: string
  PODate: string
  Currency: string
  UnitPrice: string
  Remarks: string
  AssetDate: string
}

/** POST /api/asset — create a new asset. Returns the SP success message. */
export async function createAsset(payload: AssetCreatePayload): Promise<string> {
  const env = await api.post<StatusEnvelope>('/api/asset', payload)
  return assertStatus(env)
}

/** Body for PATCH /api/asset (update). Field names match usp_CMS_Asset_Update exactly. */
export interface AssetUpdatePayload {
  IDX_M_Asset: number
  AssetTypeModelName: string
  AssetSizeName: string
  AssetBrandName: string
  PONo: string
  PODate: string
  Currency: string
  UnitPrice: string
  Remarks: string
}

/** PATCH /api/asset — update an existing asset. Returns the SP success message. */
export async function updateAsset(payload: AssetUpdatePayload): Promise<string> {
  const env = await api.patch<StatusEnvelope>('/api/asset', payload)
  return assertStatus(env)
}
