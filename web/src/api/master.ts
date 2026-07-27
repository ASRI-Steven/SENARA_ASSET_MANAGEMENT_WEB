// Master CRUD data layer. Backs MasterHubScreen / MasterCrudScreen.
// One generic search + save/update/enable/disable/delete over
// POST/PATCH/DELETE /api/master/{entity}. Row shapes differ per entity — the
// column names (name / count / idx) are declared once in MASTER_ENTITIES below
// and consumed generically by the screens.

import { api, rows, firstRow } from '@/api/client'

/** Master entities that have a working CRUD SP set in the dev DB. */
export type MasterEntityKey =
  | 'brand'
  | 'color'
  | 'size'
  | 'status'
  | 'management'
  | 'location'
  | 'type'
  | 'user'
// NOTE: 'group' and 'model' SPs are absent/unexercised in the dev DB — omit.

/**
 * Common columns present on every master row. Entity-specific columns
 * (e.g. AssetBrandName, AssetLocationCode) are read via the index signature
 * through the per-entity column keys declared in MASTER_ENTITIES.
 */
export interface MasterRow {
  Status: string // "ENABLED" | "DISABLED"
  isDelete: number
  isDisable: number
  isEnable: number
  isUpdate: number
  [key: string]: unknown
}

/**
 * Per-entity metadata: label + the SP column keys that carry the display name,
 * the asset count and the primary key. Also declares the extra "code" column a
 * couple of entities have (location/type) and the Save/Update field builders so
 * the generic CRUD screen doesn't need to know entity specifics.
 */
export interface MasterEntityMeta {
  key: MasterEntityKey
  label: string
  /** Column holding the human-readable name (e.g. "AssetBrandName", "Name"). */
  nameKey: string
  /** Column holding the asset count (varies: AssetCount / AssetStatusCount…). */
  countKey: string
  /** Primary-key column (e.g. "IDX_M_AssetBrand"). */
  idxKey: string
  /** Optional short code column (location/type). */
  codeKey?: string
  /** Label for the code column, shown in the UI when codeKey is set. */
  codeLabel?: string
  /** Whether this entity supports create/update of the plain name via this UI. */
  editable: boolean
}

export const MASTER_ENTITIES: MasterEntityMeta[] = [
  {
    key: 'brand',
    label: 'Asset Brand',
    nameKey: 'AssetBrandName',
    countKey: 'AssetCount',
    idxKey: 'IDX_M_AssetBrand',
    editable: true,
  },
  {
    key: 'color',
    label: 'Asset Color',
    nameKey: 'AssetColorName',
    countKey: 'AssetCount',
    idxKey: 'IDX_M_AssetColor',
    editable: true,
  },
  {
    key: 'size',
    label: 'Asset Size',
    nameKey: 'AssetSizeName',
    countKey: 'AssetCount',
    idxKey: 'IDX_M_AssetSize',
    editable: true,
  },
  {
    key: 'status',
    label: 'Asset Status',
    nameKey: 'AssetStatusName',
    countKey: 'AssetStatusCount',
    idxKey: 'IDX_M_AssetStatus',
    editable: true,
  },
  {
    key: 'management',
    label: 'Asset Management',
    nameKey: 'AssetManagementName',
    countKey: 'AssetManagementCount',
    idxKey: 'IDX_M_AssetManagement',
    editable: true,
  },
  {
    key: 'location',
    label: 'Asset Location',
    nameKey: 'AssetLocationName',
    countKey: 'AssetLocationCount',
    idxKey: 'IDX_M_AssetLocation',
    codeKey: 'AssetLocationCode',
    codeLabel: 'Kode',
    editable: true,
  },
  {
    key: 'type',
    label: 'Asset Type',
    nameKey: 'AssetTypeName',
    countKey: 'AssetCount',
    idxKey: 'IDX_M_AssetType',
    codeKey: 'AssetTypeCode',
    codeLabel: 'Kode',
    editable: true,
  },
  {
    // The User master mirrors HRIS; it isn't a plain name entity, so the UI
    // renders it read-only (name + NIK + department) and offers no create form.
    key: 'user',
    label: 'Asset User',
    nameKey: 'Name',
    countKey: 'AssetUserCount',
    idxKey: 'IDX_M_AssetUser',
    codeKey: 'NIK',
    codeLabel: 'NIK',
    editable: false,
  },
]

export function getMasterMeta(key: string): MasterEntityMeta | undefined {
  return MASTER_ENTITIES.find((m) => m.key === key)
}

/** Read the display name off a row via its entity meta. */
export function rowName(meta: MasterEntityMeta, row: MasterRow): string {
  const v = row[meta.nameKey]
  return v == null ? '' : String(v)
}

/** Read the asset count off a row via its entity meta. */
export function rowCount(meta: MasterEntityMeta, row: MasterRow): number {
  const v = row[meta.countKey]
  return typeof v === 'number' ? v : Number(v ?? 0) || 0
}

/** Read the primary key off a row via its entity meta. */
export function rowIdx(meta: MasterEntityMeta, row: MasterRow): number | undefined {
  const v = row[meta.idxKey]
  return v == null ? undefined : Number(v)
}

/** Read the optional code column off a row via its entity meta. */
export function rowCode(meta: MasterEntityMeta, row: MasterRow): string {
  if (!meta.codeKey) return ''
  const v = row[meta.codeKey]
  return v == null ? '' : String(v)
}

/** The single-row status envelope returned by every mutation SP. */
interface StatusEnvelope {
  StatusCode?: string // "Success" | "Error"
  StatusMessage?: string
  StatusCSS?: string
}

/**
 * The mutation SPs always return HTTP 200 with env.status === "success" even on
 * a business error, so the real outcome lives in data[0][0].StatusCode. This
 * unwraps it and throws with the SP's StatusMessage on "Error".
 */
function assertStatus(env: Awaited<ReturnType<typeof api.post<StatusEnvelope>>>): string {
  if (env.status !== 'success') throw new Error(env.message || 'Operasi gagal')
  const s = firstRow(env)
  const msg = (s?.StatusMessage || '').trim()
  if (s?.StatusCode && s.StatusCode.toLowerCase() === 'error') {
    throw new Error(msg || 'Operasi gagal')
  }
  return msg
}

/** POST /api/master/{entity}/search {Keyword} ("" = all). */
export async function searchMaster(
  entity: MasterEntityKey,
  keyword = '',
): Promise<MasterRow[]> {
  const env = await api.post<MasterRow>(`/api/master/${entity}/search`, { Keyword: keyword })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat data master')
  return rows(env)
}

/**
 * POST /api/master/{entity} — create. `fields` carries the SP-specific Save
 * params (e.g. { AssetBrandName }, or { AssetLocationCode, AssetLocationName }).
 * Returns the SP success message.
 */
export async function saveMaster(
  entity: MasterEntityKey,
  fields: Record<string, unknown>,
): Promise<string> {
  const env = await api.post<StatusEnvelope>(`/api/master/${entity}`, fields)
  return assertStatus(env)
}

/**
 * PATCH /api/master/{entity} — update. `fields` must include the idx column plus
 * the SP-specific Update params.
 */
export async function updateMaster(
  entity: MasterEntityKey,
  fields: Record<string, unknown>,
): Promise<string> {
  const env = await api.patch<StatusEnvelope>(`/api/master/${entity}`, fields)
  return assertStatus(env)
}

/** POST /api/master/{entity}/enable {<idxKey>}. */
export async function enableMaster(
  meta: MasterEntityMeta,
  idx: number,
): Promise<string> {
  const env = await api.post<StatusEnvelope>(`/api/master/${meta.key}/enable`, {
    [meta.idxKey]: idx,
  })
  return assertStatus(env)
}

/** POST /api/master/{entity}/disable {<idxKey>}. */
export async function disableMaster(
  meta: MasterEntityMeta,
  idx: number,
): Promise<string> {
  const env = await api.post<StatusEnvelope>(`/api/master/${meta.key}/disable`, {
    [meta.idxKey]: idx,
  })
  return assertStatus(env)
}

/**
 * DELETE /api/master/{entity} {<idxKey>}. The SP only deletes DISABLED records,
 * so a row must be disabled first (the UI wires disable→delete accordingly).
 */
export async function deleteMaster(
  meta: MasterEntityMeta,
  idx: number,
): Promise<string> {
  const env = await api.del<StatusEnvelope>(`/api/master/${meta.key}`, {
    [meta.idxKey]: idx,
  })
  return assertStatus(env)
}
