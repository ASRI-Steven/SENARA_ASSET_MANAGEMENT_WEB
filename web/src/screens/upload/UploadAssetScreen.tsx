import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud,
  Eye,
  ListChecks,
  Send,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Lock,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Check,
  X,
  CircleCheck,
  XCircle,
  Clock,
  Pencil,
  Info,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { numberWithDots, formatDateTime } from '@/lib/format'
import { useSession } from '@/store/session'
import {
  searchBatches,
  saveBatch,
  submitBatch,
  validateBatch,
  type UploadBatch,
  type BatchStatus,
} from '@/api/uploadAsset'
import { fetchAssetLookups, type StatusLookup } from '@/api/assets'
import { parseBatchExcel, downloadBatchTemplate, type BatchExcelRow } from '@/lib/uploadExcel'

const TABS: { key: BatchStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'D', label: 'Draft' },
  { key: 'P', label: 'Pending Approval' },
  { key: 'A', label: 'Approve' },
  { key: 'R', label: 'Reject' },
]

const CRITICAL = ['disposal', 'inactive', 'sold']

export function targetBadge(name: string) {
  const n = (name || '').toLowerCase()
  const cls = n.includes('disposal')
    ? 'bg-slate-200 text-slate-700'
    : n.includes('sold')
      ? 'bg-teal-100 text-teal-700'
      : n.includes('inactive')
        ? 'bg-slate-100 text-slate-600'
        : 'bg-muted text-muted-foreground'
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>{name || '-'}</span>
}

export function txnBadge(status: BatchStatus) {
  const map: Record<BatchStatus, { label: string; cls: string; icon: typeof Clock }> = {
    D: { label: 'Draft', cls: 'bg-amber-100 text-amber-700', icon: Pencil },
    P: { label: 'Pending Approval', cls: 'bg-sky-100 text-sky-700', icon: Clock },
    A: { label: 'Approve', cls: 'bg-emerald-100 text-emerald-700', icon: CircleCheck },
    R: { label: 'Reject', cls: 'bg-rose-100 text-rose-700', icon: XCircle },
  }
  const m = map[status]
  const Icon = m.icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', m.cls)}>
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  )
}

function fmtDate(s: string | null): string {
  return s ? formatDateTime(s) : '-'
}

export default function UploadAssetScreen() {
  const navigate = useNavigate()
  const role = useSession((s) => s.role)
  const canNew = role === 'Tim Asset' || !role
  // Samakan dgn UploadAssetDetailScreen: fallback treat-as-Manager saat role
  // belum termuat (mis. belum re-login) supaya tombol Review konsisten dengan
  // Approve/Reject yang muncul di halaman detail.
  const isMgr = role === 'Manager GA' || !role

  const [tab, setTab] = useState<BatchStatus | 'all'>('all')
  const [data, setData] = useState<UploadBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    searchBatches('')
      .then((r) => alive && setData(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Gagal memuat batch'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [reloadKey])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.length, D: 0, P: 0, A: 0, R: 0 }
    for (const b of data) c[b.Status] = (c[b.Status] ?? 0) + 1
    return c
  }, [data])
  const rows = tab === 'all' ? data : data.filter((b) => b.Status === tab)
  const pendingCount = counts.P ?? 0

  async function onSubmit(b: UploadBatch) {
    try {
      const msg = await submitBatch(b.IDX_T_UploadBatch)
      toast.success(msg || 'Batch diajukan')
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal submit batch')
    }
  }

  return (
    <>
      <PageHeader
        title="Batching Status Asset"
        description="Batch dispose / inactive / sold dengan approval Manager"
        action={
          canNew ? (
            <Button onClick={() => setNewOpen(true)}>
              <UploadCloud className="h-4 w-4" /> Batch Baru
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Hanya Tim Asset yang submit
            </span>
          )
        }
      />

      {isMgr && pendingCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">{pendingCount} batch menunggu persetujuan</p>
            <p className="text-xs text-amber-800/80">Klik Review untuk approve atau reject beserta alasan.</p>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
              {counts[t.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <Loader2 className="h-3.5 w-3.5" /> Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead>Pengaju</TableHead>
                <TableHead>Status Target</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-center">Transaction Status</TableHead>
                <TableHead>Terakhir Update</TableHead>
                <TableHead className="w-[180px] text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Tidak ada batch.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((b) => {
                  const upd = b.ApproveDate || b.SubmitDate || b.DCreate
                  return (
                    <TableRow key={b.IDX_T_UploadBatch}>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => navigate(`/upload-asset/${b.IDX_T_UploadBatch}`)}
                          className="font-mono font-semibold text-primary hover:underline"
                        >
                          {b.BatchNo}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-foreground">{b.SubmitName || '-'}</div>
                        {b.SubmitNIK && (
                          <div className="font-mono text-[11px] text-muted-foreground">{b.SubmitNIK}</div>
                        )}
                      </TableCell>
                      <TableCell>{targetBadge(b.TargetStatus)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {numberWithDots(b.Qty)}
                      </TableCell>
                      <TableCell className="text-center">{txnBadge(b.Status)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{fmtDate(upd)}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/upload-asset/${b.IDX_T_UploadBatch}`)}
                          >
                            {b.Status === 'D' && canNew ? (
                              <>
                                <Pencil className="h-4 w-4" /> Edit
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4" /> {b.Status === 'R' ? 'Lihat alasan' : 'View'}
                              </>
                            )}
                          </Button>
                          {b.Status === 'P' && isMgr && (
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate(`/upload-asset/${b.IDX_T_UploadBatch}?mode=review`)
                              }
                            >
                              <ListChecks className="h-4 w-4" /> Review
                            </Button>
                          )}
                          {b.Status === 'D' && canNew && (
                            <Button size="sm" onClick={() => onSubmit(b)}>
                              <Send className="h-4 w-4" /> Submit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <NewBatchModal
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => {
          setNewOpen(false)
          setReloadKey((k) => k + 1)
        }}
      />
    </>
  )
}

// --- Stepper (Upload Excel → Validasi & Error Log → Simpan Draft) ---
function Stepper({ step }: { step: number }) {
  const steps = ['Upload Excel', 'Validasi & Error Log', 'Simpan Draft']
  return (
    <div className="mb-4 flex items-center">
      {steps.map((s, i) => {
        const n = i + 1
        const done = step > n
        const active = step === n
        return (
          <div key={s} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold',
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                      ? 'bg-primary/15 text-primary ring-2 ring-primary'
                      : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </span>
              <span className={cn('text-xs font-medium', active || done ? 'text-foreground' : 'text-muted-foreground')}>
                {s}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={cn('mx-3 h-0.5 flex-1 rounded', step > n ? 'bg-primary' : 'bg-muted')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface CheckedRow extends BatchExcelRow {
  target: string
  err: string
}

// --- New Batch (Excel) modal — port dari mockup ---
function NewBatchModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [statuses, setStatuses] = useState<StatusLookup[]>([])
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<BatchExcelRow[]>([])
  const [serverResults, setServerResults] = useState<Map<string, string>>(new Map())
  const [validating, setValidating] = useState(false)
  const [override, setOverride] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setFileName('')
    setParsed([])
    setServerResults(new Map())
    setOverride('')
    if (statuses.length === 0) fetchAssetLookups().then((l) => setStatuses(l.statuses)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const idxByName = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of statuses) m.set(s.AssetStatusName.trim().toLowerCase(), s.IDX_M_AssetStatus)
    return m
  }, [statuses])

  const targetOptions = useMemo(
    () => statuses.filter((s) => CRITICAL.some((c) => s.AssetStatusName.toLowerCase().includes(c))),
    [statuses],
  )

  // Server-side: cek AssetID ada + dalam scope.
  async function runValidate(source: BatchExcelRow[]) {
    const ids = [...new Set(source.map((r) => r.assetId).filter(Boolean))]
    if (ids.length === 0) {
      setServerResults(new Map())
      return
    }
    setValidating(true)
    try {
      const res = await validateBatch(ids.join(','))
      setServerResults(new Map(res.map((r) => [r.AssetID, r.Result])))
    } catch {
      setServerResults(new Map())
      toast.error('Gagal validasi ke server')
    } finally {
      setValidating(false)
    }
  }

  // Gabung cek klien (format/duplikat) + server (notfound/scope).
  const rowsChecked = useMemo<CheckedRow[]>(() => {
    const seen = new Set<string>()
    return parsed.map((r) => {
      const target = override || r.target
      const id = r.assetId.toLowerCase()
      let err = ''
      if (!r.assetId) err = 'Asset ID kosong.'
      else if (seen.has(id)) err = 'Asset ID duplikat di file.'
      if (r.assetId) seen.add(id)
      if (!err) {
        if (!target) err = 'Status Target kosong.'
        else if (!idxByName.has(target.trim().toLowerCase()))
          err = `Status Target "${target}" tidak dikenali — gunakan Disposal / Inactive / Sold.`
        else {
          const sv = serverResults.get(r.assetId)
          if (sv === 'notfound') err = 'Asset ID tidak ditemukan di database.'
          else if (sv === 'outofscope') err = 'Asset di luar Management scope Anda.'
        }
      }
      return { ...r, target, err }
    })
  }, [parsed, override, idxByName, serverResults])

  const validRows = rowsChecked.filter((r) => !r.err)
  const errRows = rowsChecked.filter((r) => r.err)
  const step = parsed.length === 0 ? 1 : 2

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileName(f.name)
    try {
      const p = await parseBatchExcel(f)
      setParsed(p)
      await runValidate(p)
    } catch {
      toast.error('Gagal membaca file Excel')
      setParsed([])
    }
  }

  async function downloadErrorLog() {
    if (errRows.length === 0) return
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(
      errRows.map((r) => ({ Baris: r.row, 'Asset ID': r.assetId, 'Status Target': r.target, Error: r.err })),
    )
    ws['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 16 }, { wch: 52 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Error Log')
    XLSX.writeFile(wb, 'error_log_batch.xlsx')
  }

  async function createDraft() {
    // All-or-nothing: batch tidak boleh dibuat selama masih ada baris error.
    if (errRows.length > 0) {
      toast.error(`Masih ada ${errRows.length} baris error — perbaiki file sampai 0 error dulu.`)
      return
    }
    if (validRows.length === 0) {
      toast.error('Tidak ada baris valid untuk dibuat batch')
      return
    }
    const byTarget = new Map<string, string[]>()
    for (const r of validRows) {
      const k = r.target.trim().toLowerCase()
      if (!byTarget.has(k)) byTarget.set(k, [])
      byTarget.get(k)!.push(r.assetId)
    }
    setSaving(true)
    try {
      let made = 0
      for (const [k, ids] of byTarget) {
        const idx = idxByName.get(k)
        if (idx == null) continue
        await saveBatch({ IDX_M_AssetStatus: idx, AssetList: ids.join(','), Remarks: fileName })
        made++
      }
      toast.success(`${made} batch Draft dibuat (${validRows.length} asset valid)`)
      onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat batch')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091412]/50 p-5 backdrop-blur-[2px]"
      onClick={() => !saving && onOpenChange(false)}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[680px] flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-primary/10 text-primary">
            <UploadCloud className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">Batch Batching Status Asset Baru</h3>
            <p className="text-[12.5px] text-muted-foreground">
              Format baku: kolom <span className="font-mono">Asset ID</span> +{' '}
              <span className="font-mono">Status Target</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <Stepper step={step} />

          <Label className="text-xs">
            File Excel <span className="text-destructive">*</span>
          </Label>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-4 text-left hover:border-primary/50 hover:bg-muted/40"
          >
            <FileSpreadsheet className="h-7 w-7 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {fileName || 'Klik untuk pilih file Excel'}
              </div>
              <div className="text-xs text-muted-foreground">
                {parsed.length
                  ? `${parsed.length} baris terbaca · klik untuk ganti file`
                  : '.xlsx / .csv · kolom Asset ID + Status Target'}
              </div>
            </div>
          </button>

          {/* Format info banner */}
          <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-[12px] text-sky-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Format baku 2 kolom</div>
              <span className="font-mono">Asset ID</span> dan <span className="font-mono">Status Target</span>{' '}
              (Disposal / Inactive / Sold) — ketiga target melewati alur approval Manager yang sama.
            </div>
            <Select value={override || 'perbaris'} onValueChange={(v) => setOverride(v === 'perbaris' ? '' : v)}>
              <SelectTrigger className="h-8 w-[130px] shrink-0 self-start bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="perbaris">Per baris</SelectItem>
                {targetOptions.map((s) => (
                  <SelectItem key={s.IDX_M_AssetStatus} value={s.AssetStatusName}>
                    Paksa: {s.AssetStatusName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Validation summary pills */}
          {parsed.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium">
                <FileSpreadsheet className="h-3.5 w-3.5" /> {parsed.length} baris
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                <CircleCheck className="h-3.5 w-3.5" /> {validRows.length} valid
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700">
                <XCircle className="h-3.5 w-3.5" /> {errRows.length} error
              </span>
              {validating && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> memvalidasi…
                </span>
              )}
            </div>
          )}

          {/* Error log */}
          {errRows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-rose-200">
              <div className="flex items-center gap-1.5 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Error Log — baris berikut perlu diperbaiki sebelum
                batch tersimpan
              </div>
              <div className="max-h-48 divide-y overflow-y-auto text-xs">
                {errRows.slice(0, 100).map((r, i) => (
                  <div key={i} className="flex gap-3 px-3 py-1.5">
                    <span className="w-16 shrink-0 font-medium text-rose-600">Baris {r.row}</span>
                    <span className="w-32 shrink-0 font-mono text-foreground">{r.assetId || '—'}</span>
                    <span className="text-muted-foreground">{r.err}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={errRows.length === 0} onClick={downloadErrorLog}>
              <Download className="h-4 w-4" /> Unduh Error Log
            </Button>
            <Button variant="ghost" size="sm" onClick={() => downloadBatchTemplate()}>
              <FileSpreadsheet className="h-4 w-4" /> Unduh Template
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={parsed.length === 0 || validating}
              onClick={() => runValidate(parsed)}
            >
              <RefreshCw className={cn('h-4 w-4', validating && 'animate-spin')} /> Validasi Ulang
            </Button>
            <Button
              size="sm"
              onClick={createDraft}
              disabled={saving || validating || errRows.length > 0 || validRows.length === 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Buat Draft ({validRows.length})
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
