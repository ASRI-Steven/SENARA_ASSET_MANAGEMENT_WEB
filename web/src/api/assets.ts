// Asset grid + detail data layer. Backs AssetListScreen / AssetDetailScreen.
// Shapes verified against the dev DB (see web/iat/bff-shapes.md).

import { api, firstRow, rows } from '@/api/client'

/** One row from POST /api/assets/search — data[0] (admin grid). */
export interface AssetRow {
  AssetID: string
  AssetTypeName: string
  AssetTypeModelName: string
  AssetBrandName: string
  AssetColorName: string
  AssetSizeName: string
  AssetManagementName: string
  CompanyName: string
  CompanyAlias: string
  CurrentAssetUser: string
  /** Department of the current user — legacy grid "Department" column. */
  CurrentAssetDepartment: string
  CurrentAssetLocation: string
  CurrentAssetStatus: string
  /** Vuetify colour class (e.g. "teal darken-2") — map to a badge colour yourself. */
  CurrentColorAssetStatus: string
  Currency: string
  UnitPrice: number | string
  PONo: string
  PODate: string
  AssetDate: string
  Remarks: string
  RunningNumber: number
  Status: string
  IDX_M_Asset: number
  IDX_M_AssetType: number
  IDX_M_Company: number
  // per-row ACL flags (0/1)
  isUpdate: number
  isDelete: number
  isDisable: number
  isEnable: number
  isReturn: number
  isAssignUser: number
  isAssignLocation: number
  isAssignStatus: number
  isChangeCompany: number
  isChangeManagement: number
  isManagement: number
  isConnectedASBSPO: number
}

/** POST /api/assets/search — data[1] (pagination + page-level ACL, single row). */
export interface AssetPage {
  CurrentPage: number
  MaxPage: number
  PageSize: number
  TotalRecords: number
  isNew: number
  isUpdate: number
  isDelete: number
  isReturn: number
}

export interface AssetSearchParams {
  CurrentPage: number
  PageSize: number
  Keyword?: string
  IDX_M_AssetManagement?: number
  IDX_M_Company?: number
  IDX_M_AssetType?: number
  IDX_M_AssetTypeModel?: number
  IDX_M_AssetColor?: number
  IDX_M_AssetSize?: number
  IDX_M_AssetBrand?: number
  IDX_M_AssetUser?: number
  DepartmentName?: string
  IDX_M_AssetLocation?: number
  IDX_M_AssetStatus?: number
  ReturnAsset?: number
  /**
   * Sort column, as the integer index the SP's ORDER BY CASE expects (NOT a
   * column name — the SP param is INT). Verified against usp_CMS_ManageAsset_Search:
   * 1=CurrentAssetStatus, 2=CurrentAssetLocation, 3=CompanyAlias, 4=AssetID,
   * 5=isDisabled, 6=isConnectedASBSPO. See SORT_FIELDS in the list screen.
   */
  SortBy?: number
  /** Sort direction the SP expects: 0=Ascending, 1=Descending. */
  SortSequence?: number
  TimePeriod?: string
}

export interface AssetSearchResult {
  rows: AssetRow[]
  page: AssetPage | null
}

/** POST /api/assets/search → grid rows + pagination. Throws on a BFF error. */
export async function searchAssets(params: AssetSearchParams): Promise<AssetSearchResult> {
  const env = await api.post<Record<string, unknown>>('/api/assets/search', params)
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat daftar aset')
  const data = env.data ?? []
  return {
    rows: (data[0] as unknown as AssetRow[]) ?? [],
    page: (data[1]?.[0] as unknown as AssetPage) ?? null,
  }
}

// The per-row ACL flags the action menu gates on. The single-asset detail SP
// (usp_CMS_Asset_Search) does NOT return them, so the detail page can't tell
// which actions the user may perform. We fetch them from the ManageAsset grid SP
// (which computes them from the user's role + the asset state) and merge them in.
const ACL_FLAG_KEYS = [
  'isUpdate',
  'isDelete',
  'isDisable',
  'isEnable',
  'isReturn',
  'isAssignUser',
  'isAssignLocation',
  'isAssignStatus',
  'isChangeCompany',
  'isChangeManagement',
] as const

/** The per-action ACL flags for one asset, from usp_CMS_ManageAsset_Search. */
async function fetchAssetAclFlags(assetId: string): Promise<Partial<AssetRow>> {
  try {
    const env = await api.post<AssetRow>('/api/assets/search', {
      Keyword: assetId,
      CurrentPage: 1,
      PageSize: 20,
    })
    if (env.status !== 'success') return {}
    const r = rows(env).find((x) => x.AssetID === assetId)
    if (!r) return {}
    const flags: Partial<AssetRow> = {}
    for (const k of ACL_FLAG_KEYS) {
      if (r[k] !== undefined) flags[k] = r[k]
    }
    return flags
  } catch {
    // Non-fatal: without flags the action menu falls back to showing all actions.
    return {}
  }
}

/**
 * POST /api/asset/search {Keyword} → single-asset detail row (Asset controller).
 * Returns the row that exactly matches `assetId` (the SP keyword-search may
 * return several near-matches; we pick the exact AssetID, else the first).
 *
 * Also merges the per-action ACL flags from the ManageAsset grid SP so the detail
 * page gates its action menu (Assign/Change/Return/…) the same way the list does.
 */
export async function fetchAssetByID(assetId: string): Promise<AssetRow | undefined> {
  const [env, aclFlags] = await Promise.all([
    api.post<AssetRow>('/api/asset/search', {
      Keyword: assetId,
      CurrentPage: 1,
      PageSize: 20,
    }),
    fetchAssetAclFlags(assetId),
  ])
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat detail aset')
  const list = rows(env)
  const row = list.find((r) => r.AssetID === assetId) ?? list[0]
  if (row) Object.assign(row, aclFlags)
  return row
}

// --- Lookups (filter dropdowns) — GET /api/assets/lookups returns 11 rowsets. ---
export interface TypeLookup {
  AssetTypeName: string
  IDX_M_AssetType: number
}
export interface StatusLookup {
  AssetStatusName: string
  IDX_M_AssetStatus: number
}
export interface LocationLookup {
  AssetLocationName: string
  IDX_M_AssetLocation: number
}
export interface UserLookup {
  AssetUserName: string
  DepartmentName: string | null
  IDX_M_AssetUser: number
}
export interface BrandLookup {
  AssetBrandName: string
  IDX_M_AssetBrand: number
}
export interface DepartmentLookup {
  DepartmentName: string
}
export interface ManagementLookup {
  AssetManagementName: string
  IDX_M_AssetManagement: number
}
export interface CompanyLookup {
  CompanyName: string
  CompanyAlias: string
  IDX_M_Company: number
}

export interface AssetLookups {
  types: TypeLookup[]
  statuses: StatusLookup[]
  locations: LocationLookup[]
  users: UserLookup[]
  brands: BrandLookup[]
  departments: DepartmentLookup[]
  managements: ManagementLookup[]
  companies: CompanyLookup[]
}

/**
 * GET /api/assets/lookups → the filter dropdown options.
 * Rowset order (verified live): [0]=types [1]=colors [2]=locations [3]=statuses
 * [4]=users [5]=sizes [6]=brands [7]=managements [8]=departments [9]=typemodels
 * [10]=companies. We surface the ones the advanced-search filter needs.
 */
export async function fetchAssetLookups(): Promise<AssetLookups> {
  const env = await api.get<Record<string, unknown>>('/api/assets/lookups')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat filter')
  const data = env.data ?? []
  return {
    types: (data[0] as unknown as TypeLookup[]) ?? [],
    locations: (data[2] as unknown as LocationLookup[]) ?? [],
    statuses: (data[3] as unknown as StatusLookup[]) ?? [],
    users: (data[4] as unknown as UserLookup[]) ?? [],
    brands: (data[6] as unknown as BrandLookup[]) ?? [],
    managements: (data[7] as unknown as ManagementLookup[]) ?? [],
    departments: (data[8] as unknown as DepartmentLookup[]) ?? [],
    companies: (data[10] as unknown as CompanyLookup[]) ?? [],
  }
}

// --- History — POST /api/assets/history/{kind} {IDX_M_Asset}. Column shapes
// differ per kind, so each is fetched raw and normalised into a common
// timeline entry for the UI. ---

/** A normalised history entry (one row in a timeline card). */
export interface HistoryEntry {
  value: string // primary label (status / location / user / management / company)
  startDate: string | null
  endDate: string | null
  remarks: string | null
}

export interface HistoryGroup {
  title: string
  entries: HistoryEntry[]
}

interface RawHistoryRow {
  AssetStatusName?: string
  AssetStatusDate?: string
  AssetLocationName?: string
  Name?: string // user
  AssetManagementName?: string
  AssetManagementDate?: string
  CompanyName?: string
  AssetCompanyDate?: string
  StartDate?: string
  EndDate?: string | null
  Remarks?: string | null
}

async function fetchHistory(kind: string, idxAsset: number): Promise<RawHistoryRow[]> {
  const env = await api.post<RawHistoryRow>(`/api/assets/history/${kind}`, {
    IDX_M_Asset: idxAsset,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat riwayat')
  return rows(env)
}

/**
 * Fetch all five history timelines for an asset in parallel and normalise each
 * into a { title, entries } group. Returns empty groups (not throws) on partial
 * failure so the detail page still renders what succeeded.
 */
export async function fetchAssetHistory(idxAsset: number): Promise<HistoryGroup[]> {
  const [status, location, user, management, company] = await Promise.all([
    fetchHistory('status', idxAsset).catch(() => [] as RawHistoryRow[]),
    fetchHistory('location', idxAsset).catch(() => [] as RawHistoryRow[]),
    fetchHistory('user', idxAsset).catch(() => [] as RawHistoryRow[]),
    fetchHistory('management', idxAsset).catch(() => [] as RawHistoryRow[]),
    fetchHistory('company', idxAsset).catch(() => [] as RawHistoryRow[]),
  ])

  return [
    {
      title: 'Status',
      entries: status.map((r) => ({
        value: r.AssetStatusName ?? '-',
        startDate: r.AssetStatusDate ?? null,
        endDate: null,
        remarks: r.Remarks ?? null,
      })),
    },
    {
      title: 'User',
      entries: user.map((r) => ({
        value: r.Name ?? '-',
        startDate: r.StartDate ?? null,
        endDate: r.EndDate ?? null,
        remarks: r.Remarks ?? null,
      })),
    },
    {
      title: 'Location',
      entries: location.map((r) => ({
        value: r.AssetLocationName ?? '-',
        startDate: r.StartDate ?? null,
        endDate: r.EndDate ?? null,
        remarks: r.Remarks ?? null,
      })),
    },
    {
      title: 'Management',
      entries: management.map((r) => ({
        value: r.AssetManagementName ?? '-',
        startDate: r.AssetManagementDate ?? null,
        endDate: null,
        remarks: r.Remarks ?? null,
      })),
    },
    {
      title: 'Company',
      entries: company.map((r) => ({
        value: r.CompanyName ?? '-',
        startDate: r.AssetCompanyDate ?? null,
        endDate: null,
        remarks: r.Remarks ?? null,
      })),
    },
  ]
}

// --- Asset actions (ManageAsset) — POST /api/assets/{action}. Each SP returns
// HTTP 200 with env.status==="success" even on a business error; the real
// outcome is in data[0][0].StatusCode, unwrapped by assertStatus below. ---

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

/** POST /api/assets/assign-user — assign a user to the asset. */
export async function assignAssetUser(payload: {
  IDX_M_Asset: number
  IDX_M_AssetUser: number
  Date: string
  Remarks: string
}): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/assign-user', payload))
}

/** POST /api/assets/assign-location — assign a location to the asset. */
export async function assignAssetLocation(payload: {
  IDX_M_Asset: number
  IDX_M_AssetLocation: number
  Date: string
  Remarks: string
}): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/assign-location', payload))
}

/** POST /api/assets/assign-status — set the asset status. */
export async function assignAssetStatus(payload: {
  IDX_M_Asset: number
  IDX_M_AssetStatus: number
  Remarks: string
}): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/assign-status', payload))
}

/** POST /api/assets/change-management — change the asset's management. */
export async function changeAssetManagement(payload: {
  IDX_M_Asset: number
  IDX_M_AssetManagement: number
  Remarks: string
}): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/change-management', payload))
}

/** POST /api/assets/change-company — change the asset's company. */
export async function changeAssetCompany(payload: {
  IDX_M_Asset: number
  IDX_M_Company: number
  Remarks: string
}): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/change-company', payload))
}

/** POST /api/assets/return — return the asset from its current user. */
export async function returnAsset(payload: {
  IDX_M_Asset: number
  Remarks: string
}): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/return', payload))
}

/**
 * POST /api/assets/return — bulk return several assets from their users in one
 * call. Mirrors the legacy Datagrid "Return User" action (ManageAsset/
 * returnAssetUserMultiple): the SP takes a single string param, so the selected
 * IDX_M_Asset ids are comma-joined. Throws (via assertStatus) on a business error.
 */
export async function returnAssets(payload: {
  IDX_M_Asset: number[]
  Remarks: string
}): Promise<string> {
  return assertStatus(
    await api.post<StatusEnvelope>('/api/assets/return', {
      IDX_M_Asset: payload.IDX_M_Asset.join(','),
      Remarks: payload.Remarks,
    }),
  )
}

/** POST /api/assets/enable — re-enable a disabled asset. */
export async function enableAsset(idxAsset: number): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/enable', { IDX_M_Asset: idxAsset }))
}

/** POST /api/assets/disable — disable (soft-delete) an asset. */
export async function disableAsset(idxAsset: number): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/assets/disable', { IDX_M_Asset: idxAsset }))
}
