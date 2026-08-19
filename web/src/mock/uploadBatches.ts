// MOCK data for the Upload Asset (batch) feature — used by the Dashboard pending
// panel and the Upload Asset screens until the BFF endpoints exist. Mirrors the
// mockup (upload-asset.html / dashboard.html). Replace with real API later.

export type BatchTarget = 'Disposal' | 'Sold' | 'Inactive'
export type BatchStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected'

export interface UploadBatchItem {
  assetId: string
  name: string
  company: string
  currentStatus: string
}

export interface UploadBatch {
  id: string // e.g. UB-2026-0007
  submitter: string
  submitterNik: string
  target: BatchTarget
  qty: number
  submittedAt: string // display string, e.g. "23 Jul 2026, 09:12"
  status: BatchStatus
  reason?: string // reject reason / notes
  items?: UploadBatchItem[]
}

export const MOCK_BATCHES: UploadBatch[] = [
  {
    id: 'UB-2026-0007',
    submitter: 'Sari Wijaya',
    submitterNik: '30110455',
    target: 'Disposal',
    qty: 120,
    submittedAt: '23 Jul 2026, 09:12',
    status: 'Pending',
  },
  {
    id: 'UB-2026-0006',
    submitter: 'Sari Wijaya',
    submitterNik: '30110455',
    target: 'Sold',
    qty: 58,
    submittedAt: '22 Jul 2026, 16:40',
    status: 'Pending',
  },
  {
    id: 'UB-2026-0005',
    submitter: 'Andi Kurnia',
    submitterNik: '30110478',
    target: 'Inactive',
    qty: 36,
    submittedAt: '22 Jul 2026, 11:05',
    status: 'Pending',
  },
  {
    id: 'UB-2026-0004',
    submitter: 'Andi Kurnia',
    submitterNik: '30110478',
    target: 'Disposal',
    qty: 74,
    submittedAt: '19 Jul 2026, 14:20',
    status: 'Draft',
  },
  {
    id: 'UB-2026-0003',
    submitter: 'Sari Wijaya',
    submitterNik: '30110455',
    target: 'Sold',
    qty: 42,
    submittedAt: '15 Jul 2026, 10:03',
    status: 'Approved',
  },
  {
    id: 'UB-2026-0002',
    submitter: 'Budi Santoso',
    submitterNik: '30110401',
    target: 'Inactive',
    qty: 19,
    submittedAt: '11 Jul 2026, 08:55',
    status: 'Rejected',
    reason: 'Sebagian aset masih terpasang di ruang server — batalkan & pisahkan.',
  },
]

export const pendingBatches = (): UploadBatch[] => MOCK_BATCHES.filter((b) => b.status === 'Pending')

/** Tailwind classes for a batch target badge (Disposal / Sold / Inactive). */
export function batchTargetClasses(t: BatchTarget): string {
  switch (t) {
    case 'Disposal':
      return 'bg-violet-100 text-violet-700'
    case 'Sold':
      return 'bg-emerald-100 text-emerald-700'
    case 'Inactive':
      return 'bg-slate-200 text-slate-700'
  }
}

/** Tailwind classes for a batch status badge. */
export function batchStatusClasses(s: BatchStatus): string {
  switch (s) {
    case 'Draft':
      return 'bg-slate-100 text-slate-600'
    case 'Pending':
      return 'bg-amber-100 text-amber-700'
    case 'Approved':
      return 'bg-emerald-100 text-emerald-700'
    case 'Rejected':
      return 'bg-rose-100 text-rose-700'
  }
}
