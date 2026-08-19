// Batching Status Asset (Upload Asset) data layer. Alur Draft → Pending →
// Approve/Reject; SP usp_CMS_UploadAsset_* (SQL 001/002).

import { api, rows } from '@/api/client'

export type BatchStatus = 'D' | 'P' | 'A' | 'R'

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  D: 'Draft',
  P: 'Pending Approval',
  A: 'Approve',
  R: 'Reject',
}

export interface UploadBatch {
  IDX_T_UploadBatch: number
  BatchNo: string
  IDX_M_AssetStatus: number
  TargetStatus: string
  Qty: number
  Status: BatchStatus
  SubmitNIK: string | null
  SubmitName: string | null
  SubmitDate: string | null
  ApproveNIK: string | null
  ApproveName: string | null
  ApproveDate: string | null
  Reason: string | null
  Remarks?: string | null
  DCreate: string | null
}

export interface UploadBatchItem {
  IDX_T_UploadBatchItem: number
  IDX_M_Asset: number
  AssetID: string
  Applied: number
  CurrentStatus: string | null
}

interface StatusEnvelope {
  StatusCode?: string
  StatusMessage?: string
}

/** Unwrap the single-row status envelope; throw with StatusMessage on "Error". */
function assertStatus(env: { status: string; message: string; data?: unknown }): string {
  if (env.status !== 'success') throw new Error(env.message || 'Operasi gagal')
  const s = (env as { data?: StatusEnvelope[][] }).data?.[0]?.[0]
  const msg = (s?.StatusMessage || '').trim()
  if (s?.StatusCode && s.StatusCode.toLowerCase() === 'error') throw new Error(msg || 'Operasi gagal')
  return msg
}

/** POST /api/upload-asset/search → daftar batch (filter status + keyword). */
export async function searchBatches(status?: BatchStatus | '', keyword = ''): Promise<UploadBatch[]> {
  const env = await api.post<UploadBatch>('/api/upload-asset/search', {
    Status: status ?? '',
    Keyword: keyword,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat batch')
  return rows(env)
}

export interface ValidateRow {
  AssetID: string
  Result: 'ok' | 'notfound' | 'outofscope'
}

/** POST /api/upload-asset/validate → cek tiap AssetID (ada / di luar scope). */
export async function validateBatch(assetList: string): Promise<ValidateRow[]> {
  const env = await api.post<ValidateRow>('/api/upload-asset/validate', { AssetList: assetList })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal validasi')
  return rows(env)
}

/** POST /api/upload-asset/detail → { header, items }. */
export async function fetchBatch(
  idx: number,
): Promise<{ header: UploadBatch | null; items: UploadBatchItem[] }> {
  const env = await api.post<Record<string, unknown>>('/api/upload-asset/detail', {
    IDX_T_UploadBatch: idx,
  })
  if (env.status !== 'success') throw new Error(env.message || 'Gagal memuat detail batch')
  const data = env.data ?? []
  return {
    header: (data[0]?.[0] as unknown as UploadBatch) ?? null,
    items: (data[1] as unknown as UploadBatchItem[]) ?? [],
  }
}

/** POST /api/upload-asset/save → buat Draft dari daftar AssetID (CSV). Return StatusMessage. */
export async function saveBatch(payload: {
  IDX_M_AssetStatus: number
  Remarks?: string
  AssetList: string // CSV AssetID
}): Promise<string> {
  return assertStatus(
    await api.post<StatusEnvelope>('/api/upload-asset/save', {
      IDX_M_AssetStatus: payload.IDX_M_AssetStatus,
      IDX_M_AssetManagement: '',
      Remarks: payload.Remarks ?? '',
      AssetList: payload.AssetList,
    }),
  )
}

export async function submitBatch(idx: number): Promise<string> {
  return assertStatus(await api.post<StatusEnvelope>('/api/upload-asset/submit', { IDX_T_UploadBatch: idx }))
}
/** Hapus satu item dari draft (recompute Qty). */
export async function removeBatchItem(idxItem: number): Promise<string> {
  return assertStatus(
    await api.post<StatusEnvelope>('/api/upload-asset/item/remove', { IDX_T_UploadBatchItem: idxItem }),
  )
}
/** Tambah AssetID (CSV) ke draft (skip not-found & duplikat). */
export async function addBatchItems(idxBatch: number, assetList: string): Promise<string> {
  return assertStatus(
    await api.post<StatusEnvelope>('/api/upload-asset/item/add', {
      IDX_T_UploadBatch: idxBatch,
      AssetList: assetList,
    }),
  )
}
/** Approve batch. `note` = Catatan approval (opsional) — disimpan di Reason. */
export async function approveBatch(idx: number, note = ''): Promise<string> {
  return assertStatus(
    await api.post<StatusEnvelope>('/api/upload-asset/approve', {
      IDX_T_UploadBatch: idx,
      Reason: note,
    }),
  )
}
export async function rejectBatch(idx: number, reason: string): Promise<string> {
  return assertStatus(
    await api.post<StatusEnvelope>('/api/upload-asset/reject', {
      IDX_T_UploadBatch: idx,
      Reason: reason,
    }),
  )
}
