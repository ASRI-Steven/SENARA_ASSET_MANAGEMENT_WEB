// Settings data layer. Backs the three Setting screens (ported from the legacy
// mySetting/{AssetSetting,GroupSetting,UserSetting}.vue):
//
//   • Admin Access  — per-user security level + management + company scope.
//   • Group Access  — per-user asset-group membership.
//   • User Roles    — per-form R/I/U/D access matrix (legacy CsRole drawer).
//
// Every mutation SP returns HTTP 200 with env.status === "success" even on a
// business error; the real outcome lives in data[0][0].StatusCode /
// StatusMessage — assertStatus() unwraps that (same convention as master.ts).

import { api, rows, firstRow } from '@/api/client'

/** The single-row status envelope returned by every mutation SP. */
interface StatusEnvelope {
  StatusCode?: string // "Success" | "Error"
  StatusMessage?: string
  StatusCSS?: string
}

/**
 * Mutation SPs report business errors inside data[0][0], not the HTTP envelope.
 * Throw with the SP message on "Error"; otherwise return the success message.
 */
function assertStatus(env: {
  status: string
  message: string
  data: StatusEnvelope[][]
}): string {
  if (env.status !== 'success') throw new Error(env.message || 'Operasi gagal')
  const s = firstRow(env)
  const msg = (s?.StatusMessage || '').trim()
  if (s?.StatusCode && s.StatusCode.toLowerCase() === 'error') {
    throw new Error(msg || 'Operasi gagal')
  }
  return msg
}

// ---------------------------------------------------------------------------
// Admin Access
// ---------------------------------------------------------------------------

export interface AdminAccessRow {
  IDX_T_AssetAdminAccess: number
  NIK: string
  Name: string
  DepartmentName: string | null
  isUpdate: number
  isDelete: number
  isEnable?: number
}

/** Lookup: security levels (Table[0] of admin-access lookups). */
export interface SecurityLevelOption {
  SecurityLevel: string
  SecurityLevelName: string
}

/** Lookup: managements (Table1). */
export interface ManagementOption {
  IDX_M_AssetManagement: number
  AssetManagementName: string
}

/** Lookup: companies (Table2). */
export interface CompanyOption {
  IDX_M_Company: number
  CompanyName: string
}

export interface AdminAccessLookups {
  securityLevels: SecurityLevelOption[]
  managements: ManagementOption[]
  companies: CompanyOption[]
}

/** The existing scope for a NIK (from by-nik), used to prefill the edit form. */
export interface AdminAccessDetail {
  IDX_T_AssetAdminAccess: number
  SecurityLevel: string
  IDX_M_AssetManagement: number
  IDX_M_Company: number
}

/** GET /api/settings/admin-access/lookups → 3 rowsets (security/mgmt/company). */
export async function fetchAdminAccessLookups(): Promise<AdminAccessLookups> {
  const env = await api.get('/api/settings/admin-access/lookups')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data pilihan')
  const data = env.data ?? []
  return {
    securityLevels: (data[0] as unknown as SecurityLevelOption[]) ?? [],
    managements: (data[1] as unknown as ManagementOption[]) ?? [],
    companies: (data[2] as unknown as CompanyOption[]) ?? [],
  }
}

/**
 * POST /api/settings/admin-access/search {Keyword} ("" = all). Table[0] is the
 * row list; Table[1][0].isNew tells whether the user may create new records.
 */
export async function searchAdminAccess(
  keyword = '',
): Promise<{ list: AdminAccessRow[]; canCreate: boolean }> {
  const env = await api.post<AdminAccessRow>('/api/settings/admin-access/search', {
    Keyword: keyword,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data admin access')
  const list = rows(env)
  const meta = (env.data?.[1]?.[0] as { isNew?: number } | undefined) ?? undefined
  return { list, canCreate: meta?.isNew === 1 }
}

/** POST /api/settings/admin-access/by-nik {NIK} → the existing scope for a NIK. */
export async function fetchAdminAccessByNIK(nik: string): Promise<AdminAccessDetail | null> {
  const env = await api.post<AdminAccessDetail>('/api/settings/admin-access/by-nik', { NIK: nik })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat detail')
  return firstRow(env) ?? null
}

/** POST /api/settings/admin-access — create. */
export async function saveAdminAccess(fields: {
  NIK: string
  SecurityLevel: string
  IDX_M_AssetManagement: number
  IDX_M_Company: number
}): Promise<string> {
  const env = await api.post<StatusEnvelope>('/api/settings/admin-access', fields)
  return assertStatus(env)
}

/** PATCH /api/settings/admin-access — update scope of an existing record. */
export async function updateAdminAccess(fields: {
  IDX_T_AssetAdminAccess: number
  SecurityLevel: string
  IDX_M_AssetManagement: number
  IDX_M_Company: number
}): Promise<string> {
  const env = await api.patch<StatusEnvelope>('/api/settings/admin-access', fields)
  return assertStatus(env)
}

/** DELETE /api/settings/admin-access {IDX_T_AssetAdminAccess}. */
export async function deleteAdminAccess(idx: number): Promise<string> {
  const env = await api.del<StatusEnvelope>('/api/settings/admin-access', {
    IDX_T_AssetAdminAccess: idx,
  })
  return assertStatus(env)
}

// ---------------------------------------------------------------------------
// Group Access
// ---------------------------------------------------------------------------

export interface GroupAccessRow {
  IDX_T_AssetGroup: number
  IDX_M_AssetGroup: number
  NIK: string
  Name: string
  DepartmentName: string | null
  AssetGroupName: string
  isUpdate: number
  isDelete: number
  isEnable?: number
}

/** Lookup: selectable users (Table[0]) for the add form. */
export interface GroupUserOption {
  NIK: string
  Name: string
}

/** Lookup: asset groups (Table1). */
export interface AssetGroupOption {
  IDX_M_AssetGroup: number
  AssetGroupName: string
}

export interface GroupAccessLookups {
  users: GroupUserOption[]
  groups: AssetGroupOption[]
}

/** GET /api/settings/group-access/lookups → 2 rowsets (users / groups). */
export async function fetchGroupAccessLookups(): Promise<GroupAccessLookups> {
  const env = await api.get('/api/settings/group-access/lookups')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data pilihan')
  const data = env.data ?? []
  return {
    users: (data[0] as unknown as GroupUserOption[]) ?? [],
    groups: (data[1] as unknown as AssetGroupOption[]) ?? [],
  }
}

/** POST /api/settings/group-access/search {Keyword} ("" = all). */
export async function searchGroupAccess(
  keyword = '',
): Promise<{ list: GroupAccessRow[]; canCreate: boolean }> {
  const env = await api.post<GroupAccessRow>('/api/settings/group-access/search', {
    Keyword: keyword,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data group access')
  const list = rows(env)
  const meta = (env.data?.[1]?.[0] as { isNew?: number } | undefined) ?? undefined
  return { list, canCreate: meta?.isNew === 1 }
}

/** POST /api/settings/group-access — create. */
export async function saveGroupAccess(fields: {
  NIK: string
  IDX_M_AssetGroup: number
}): Promise<string> {
  const env = await api.post<StatusEnvelope>('/api/settings/group-access', fields)
  return assertStatus(env)
}

/** PATCH /api/settings/group-access — change a member's group. */
export async function updateGroupAccess(fields: {
  IDX_T_AssetGroup: number
  IDX_M_AssetGroup: number
}): Promise<string> {
  const env = await api.patch<StatusEnvelope>('/api/settings/group-access', fields)
  return assertStatus(env)
}

/** DELETE /api/settings/group-access {IDX_T_AssetGroup}. */
export async function deleteGroupAccess(idx: number): Promise<string> {
  const env = await api.del<StatusEnvelope>('/api/settings/group-access', {
    IDX_T_AssetGroup: idx,
  })
  return assertStatus(env)
}

// ---------------------------------------------------------------------------
// User Roles (UserASRILup) — per-form R/I/U/D matrix
// ---------------------------------------------------------------------------

export interface UserRoleRow {
  NIK: string
  Name: string
  isUpdate: number
  isEnable?: number
}

/** A single form's access flags, as returned by lookups / by-nik. */
export interface FormAccess {
  IDX_M_Forms: number
  Form_Name: string
  isRead: number
  isInsert: number
  isUpdate: number
  isDelete: number
  /** Legacy CsRole disabled I/U/D when isReadOnly; absent in the dev DB. */
  isReadOnly?: number
}

/** Selectable user for the "add" form. */
export interface UserListOption {
  NIK: string
  Name: string
}

/** Paging metadata (Table1 of users/search). */
export interface UserRolePage {
  CurrentPage: number
  MaxPage: number
  PageSize: number
  TotalRecords: number
  isNew: number
}

/**
 * The per-form access record posted back to the Save/Update SP. Legacy CsRole
 * mapping (fn_go): i=IDX_M_Forms, r=isRead, u=isUpdate, d=isDelete, n=isInsert.
 */
export interface UserAccessEntry {
  i: number
  r: number
  u: number
  d: number
  n: number
}

/**
 * POST /api/settings/users/search {Keyword,CurrentPage,PageSize}.
 * Table[0]=rows, Table[1][0]=paging+isNew.
 */
export async function searchUserRoles(
  keyword = '',
  currentPage = 1,
  pageSize = 9999,
): Promise<{ list: UserRoleRow[]; page: UserRolePage | null }> {
  const env = await api.post<UserRoleRow>('/api/settings/users/search', {
    Keyword: keyword,
    CurrentPage: currentPage,
    PageSize: pageSize,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data user')
  const list = rows(env)
  const page = (env.data?.[1]?.[0] as unknown as UserRolePage | undefined) ?? null
  return { list, page }
}

/** GET /api/settings/users/list → selectable users for the add form. */
export async function fetchUserList(): Promise<UserListOption[]> {
  const env = await api.get<UserListOption>('/api/settings/users/list')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat daftar user')
  return rows(env)
}

/**
 * GET /api/settings/users/lookups → the blank form template (all flags 0) used
 * when adding a brand-new user's access matrix.
 */
export async function fetchUserFormTemplate(): Promise<FormAccess[]> {
  const env = await api.get<FormAccess>('/api/settings/users/lookups')
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat daftar form')
  return rows(env)
}

/** POST /api/settings/users/by-nik {NIK} → the existing access matrix for a NIK. */
export async function fetchUserAccessByNIK(nik: string): Promise<FormAccess[]> {
  const env = await api.post<FormAccess>('/api/settings/users/by-nik', { NIK: nik })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat akses user')
  return rows(env)
}

/** Convert a FormAccess matrix into the compact UserAccess payload (r/u/d/n). */
export function toUserAccess(forms: FormAccess[]): UserAccessEntry[] {
  return forms.map((f) => ({
    i: f.IDX_M_Forms,
    r: f.isRead ? 1 : 0,
    u: f.isUpdate ? 1 : 0,
    d: f.isDelete ? 1 : 0,
    n: f.isInsert ? 1 : 0,
  }))
}

/**
 * Serialise the access matrix to the XML `usp_CMS_UserASRILup_Save/Update`
 * expects: `<root><item><i>formId</i><r/><u/><d/><n/></item>…</root>`, parsed by
 * the SP via SP_XML_PREPAREDOCUMENT + OPENXML. Sending JSON (the BFF's default
 * for arrays) makes the SP fail with "Invalid at the top level of the document"
 * — so we build the XML ourselves and send it as a plain string param.
 */
export function userAccessXml(forms: FormAccess[]): string {
  const items = toUserAccess(forms)
    .map(
      (a) =>
        '<item>' +
        `<i>${a.i}</i><r>${a.r}</r><u>${a.u}</u><d>${a.d}</d><n>${a.n}</n>` +
        '</item>',
    )
    .join('')
  return `<root>${items}</root>`
}

/** POST /api/settings/users {NIK,UserAccess} — create a new user's access. */
export async function saveUserRoles(nik: string, forms: FormAccess[]): Promise<string> {
  const env = await api.post<StatusEnvelope>('/api/settings/users', {
    NIK: nik,
    UserAccess: userAccessXml(forms),
  })
  return assertStatus(env)
}

/** PATCH /api/settings/users {NIK,UserAccess} — update an existing user's access. */
export async function updateUserRoles(nik: string, forms: FormAccess[]): Promise<string> {
  const env = await api.patch<StatusEnvelope>('/api/settings/users', {
    NIK: nik,
    UserAccess: userAccessXml(forms),
  })
  return assertStatus(env)
}
