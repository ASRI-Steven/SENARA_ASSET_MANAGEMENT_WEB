import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronRight,
  ListChecks,
  FileText,
  History,
  ArrowRight,
  ThumbsUp,
  XCircle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CircleCheck,
  Check,
  Info,
  Eye,
  Clock,
  Trash2,
  Send,
  Plus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { usePermsStore, can } from '@/store/perms'
import {
  fetchBatch,
  approveBatch,
  rejectBatch,
  submitBatch,
  removeBatchItem,
  addBatchItems,
  validateBatch,
  type UploadBatch,
  type UploadBatchItem,
} from '@/api/uploadAsset'
import { parseBatchExcel } from '@/lib/uploadExcel'
import { targetBadge, txnBadge } from './UploadAssetScreen'

// Item Batch: pagination client-side, maks 5 item / halaman (sesuai mockup).
const ITEMS_PER_PAGE = 5

function fmtDateTime(s: string | null): string {
  return s ? formatDateTime(s) : '—'
}

function statusBadge(name: string | null) {
  const n = (name || '').toLowerCase()
  const cls = n.includes('ok')
    ? 'bg-emerald-100 text-emerald-700'
    : n.includes('broken')
      ? 'bg-rose-100 text-rose-700'
      : n.includes('maint')
        ? 'bg-amber-100 text-amber-700'
        : n.includes('mia')
          ? 'bg-violet-100 text-violet-700'
          : 'bg-muted text-muted-foreground'
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>{name || '-'}</span>
}

export default function UploadAssetDetailScreen() {
  const { id = '' } = useParams()
  const idx = Number(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // ?mode=review (dari tombol "Review") → boleh Approve/Reject. Tanpa itu ("View")
  // halaman bersifat read-only walau user Manager.
  const reviewMode = searchParams.get('mode') === 'review'
  const role = useSession((s) => s.role)
  // Approve/Reject butuh aksi 'A' pada form Upload Asset (31085) — hanya Manager GA
  // yang punya. Gate tombol via permission (BFF juga meng-enforce approve/reject).
  const perms = usePermsStore((s) => s.perms)
  const canApprove = can(perms, 31085, 'A')

  const [header, setHeader] = useState<UploadBatch | null>(null)
  const [items, setItems] = useState<UploadBatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null)
  const [busyItem, setBusyItem] = useState<number | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [itemPage, setItemPage] = useState(1)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetchBatch(idx)
      .then((r) => {
        if (!alive) return
        setHeader(r.header)
        setItems(r.items)
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Gagal memuat batch'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [idx, reloadKey])

  // Reset ke halaman 1 saat pindah batch; clamp bila item berkurang (hapus item).
  useEffect(() => setItemPage(1), [idx])
  useEffect(() => {
    const pc = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE))
    if (itemPage > pc) setItemPage(pc)
  }, [items.length, itemPage])

  if (loading) return <DetailSkeleton />
  if (error || !header) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error || 'Batch tidak ditemukan.'}</p>
          <Button size="sm" variant="outline" asChild>
            <Link to="/upload-asset">Kembali</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isPending = header.Status === 'P'
  // Draft bisa diedit oleh Tim Asset (fallback longgar bila role belum termuat).
  const canEdit = header.Status === 'D' && (role === 'Tim Asset' || !role)

  // Slice item untuk halaman aktif (maks 5).
  const itemPageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE))
  const pageStart = (itemPage - 1) * ITEMS_PER_PAGE
  const pageItems = items.slice(pageStart, pageStart + ITEMS_PER_PAGE)

  async function submitDraft() {
    try {
      const msg = await submitBatch(idx)
      toast.success(msg || 'Batch diajukan')
      navigate('/upload-asset')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal submit batch')
    }
  }
  async function removeItem(itemIdx: number) {
    setBusyItem(itemIdx)
    try {
      const msg = await removeBatchItem(itemIdx)
      toast.success(msg || 'Item dihapus')
      setReloadKey((k) => k + 1)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus item')
    } finally {
      setBusyItem(null)
    }
  }

  return (
    <>
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/upload-asset" className="hover:text-primary">
          Batching Status Asset
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono">{header.BatchNo}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-extrabold text-foreground">{header.BatchNo}</h1>
            {txnBadge(header.Status)}
            {targetBadge(`Target: ${header.TargetStatus}`)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Diajukan oleh <b className="text-foreground">{header.SubmitName || '—'}</b>
            {header.SubmitNIK ? ` (NIK ${header.SubmitNIK})` : ''} · {fmtDateTime(header.SubmitDate || header.DCreate)}
          </p>
        </div>
        <div className="flex gap-2">
          {isPending && canApprove && reviewMode ? (
            <>
              <Button variant="outline" className="text-rose-600" onClick={() => setModal('reject')}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setModal('approve')}>
                <ThumbsUp className="h-4 w-4" /> Approve
              </Button>
            </>
          ) : canEdit ? (
            <>
              <Button variant="outline" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" /> Tambah Item
              </Button>
              <Button disabled={header.Qty === 0} onClick={submitDraft}>
                <Send className="h-4 w-4" /> Submit
              </Button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Read-only
            </span>
          )}
        </div>
      </div>

      {header.Status === 'R' && header.Reason && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3.5">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-medium text-rose-900">Batch ditolak</p>
            <p className="text-xs text-rose-800/80">Alasan: {header.Reason}</p>
          </div>
        </div>
      )}

      {header.Status === 'A' && header.Reason && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-900">Batch di-approve</p>
            <p className="text-xs text-emerald-800/80">Catatan: {header.Reason}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <ListChecks className="h-[18px] w-[18px]" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Item Batch</h2>
                <p className="text-[11.5px] text-muted-foreground">
                  {numberWithDots(header.Qty)} asset · seluruhnya akan diubah menjadi {header.TargetStatus} bila di-approve
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Status Saat Ini</TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Target</TableHead>
                  {canEdit && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 5 : 4} className="py-8 text-center text-muted-foreground">
                      Tidak ada item.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((it) => (
                    <TableRow key={it.IDX_T_UploadBatchItem}>
                      <TableCell className="font-mono text-sm">{it.AssetID}</TableCell>
                      <TableCell>{statusBadge(it.CurrentStatus)}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        <ArrowRight className="mx-auto h-3.5 w-3.5" />
                      </TableCell>
                      <TableCell>{targetBadge(header.TargetStatus)}</TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-600 hover:text-rose-600"
                            disabled={busyItem === it.IDX_T_UploadBatchItem}
                            onClick={() => removeItem(it.IDX_T_UploadBatchItem)}
                            aria-label={`Hapus ${it.AssetID}`}
                          >
                            {busyItem === it.IDX_T_UploadBatchItem ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Footer: "Menampilkan X–Y dari N item" + pager (maks 5/halaman) */}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  Menampilkan{' '}
                  <b className="text-foreground">
                    {pageStart + 1}–{Math.min(pageStart + ITEMS_PER_PAGE, items.length)}
                  </b>{' '}
                  dari <b className="text-foreground">{numberWithDots(items.length)}</b> item
                </span>
                {itemPageCount > 1 && (
                  <ItemPager page={itemPage} pageCount={itemPageCount} onChange={setItemPage} />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ringkasan + Timeline */}
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" /> Ringkasan
              </div>
              <dl className="mt-2 divide-y divide-dashed text-sm">
                <Row label="Total item" value={`${numberWithDots(header.Qty)} asset`} />
                <Row label="Target status" value={targetBadge(header.TargetStatus)} />
                <Row label="Pengaju" value={header.SubmitName || '—'} />
                <Row label="Sumber" value={<span className="font-mono text-xs">{header.Remarks || '—'}</span>} />
              </dl>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-primary" /> Timeline Batch
              </div>
              <ul className="mt-3 space-y-0">
                {(header.Status === 'A' || header.Status === 'R') && (
                  <TL
                    title={header.Status === 'A' ? 'Approved' : 'Rejected'}
                    sub={`Oleh ${header.ApproveName || '—'}`}
                    time={fmtDateTime(header.ApproveDate)}
                  />
                )}
                {header.Status === 'P' && (
                  <TL title="Menunggu approval" sub="Manager GA belum menindaklanjuti" time="—" muted />
                )}
                {header.SubmitDate && (
                  <TL
                    title="Submit → Pending Approval"
                    sub={`Oleh ${header.SubmitName || '—'}`}
                    time={fmtDateTime(header.SubmitDate)}
                  />
                )}
                <TL title="Draft dibuat" sub={`Upload ${numberWithDots(header.Qty)} baris (valid)`} time={fmtDateTime(header.DCreate)} last />
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div>
          <p className="text-sm font-medium text-sky-900">Reject bersifat per-batch (all-or-nothing)</p>
          <p className="text-xs text-sky-800/80">
            Bila Manager reject, seluruh batch kembali ke Draft — bukan menolak sebagian baris. Setiap transisi
            status menyimpan timestamp.
          </p>
        </div>
      </div>

      <ApproveRejectModal
        mode={modal}
        batch={header}
        onClose={() => setModal(null)}
        onDone={() => {
          setModal(null)
          setReloadKey((k) => k + 1)
          navigate('/upload-asset')
        }}
      />
      <AddItemModal
        open={addOpen}
        batchIdx={idx}
        existing={items}
        onOpenChange={setAddOpen}
        onDone={() => {
          setAddOpen(false)
          setReloadKey((k) => k + 1)
        }}
      />
    </>
  )
}

// --- Tambah Item (Excel) modal — validasi + error log sebelum append ke draft ---
function AddItemModal({
  open,
  batchIdx,
  existing,
  onOpenChange,
  onDone,
}: {
  open: boolean
  batchIdx: number
  existing: UploadBatchItem[]
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<string[]>([])
  const [serverResults, setServerResults] = useState<Map<string, string>>(new Map())
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFileName('')
      setParsed([])
      setServerResults(new Map())
    }
  }, [open])

  const existingSet = new Set(existing.map((i) => i.AssetID.toLowerCase()))

  async function runValidate(ids: string[]) {
    const uniq = [...new Set(ids.filter(Boolean))]
    if (uniq.length === 0) {
      setServerResults(new Map())
      return
    }
    setValidating(true)
    try {
      const res = await validateBatch(uniq.join(','))
      setServerResults(new Map(res.map((r) => [r.AssetID, r.Result])))
    } catch {
      setServerResults(new Map())
      toast.error('Gagal validasi ke server')
    } finally {
      setValidating(false)
    }
  }

  // error = blokir (kosong / duplikat file / not-found / out-of-scope);
  // skip = sudah ada di batch (dilewati, bukan error).
  const seen = new Set<string>()
  const rows = parsed.map((assetId, i) => {
    const id = assetId.toLowerCase()
    let err = ''
    let skip = false
    if (!assetId) err = 'Asset ID kosong.'
    else if (seen.has(id)) err = 'Asset ID duplikat di file.'
    if (assetId) seen.add(id)
    if (!err) {
      if (existingSet.has(id)) skip = true
      else {
        const sv = serverResults.get(assetId)
        if (sv === 'notfound') err = 'Asset ID tidak ditemukan di database.'
        else if (sv === 'outofscope') err = 'Aset di luar Management scope Anda.'
      }
    }
    return { row: i + 2, assetId, err, skip }
  })
  const valid = rows.filter((r) => !r.err && !r.skip)
  const errs = rows.filter((r) => r.err)
  const skipped = rows.filter((r) => r.skip)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setFileName(f.name)
    try {
      const parsedRows = await parseBatchExcel(f)
      const ids = parsedRows.map((r) => r.assetId)
      setParsed(ids)
      await runValidate(ids)
    } catch {
      toast.error('Gagal membaca file Excel')
      setParsed([])
    }
  }

  async function add() {
    if (errs.length > 0) {
      toast.error(`Masih ada ${errs.length} baris error — perbaiki file dulu.`)
      return
    }
    if (valid.length === 0) {
      toast.error('Tidak ada item baru yang valid untuk ditambahkan')
      return
    }
    setSaving(true)
    try {
      const msg = await addBatchItems(batchIdx, valid.map((r) => r.assetId).join(','))
      toast.success(msg || 'Item ditambahkan')
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menambah item')
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
        className="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-primary/10 text-primary">
            <Plus className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">Tambah Item ke Draft</h3>
            <p className="text-[12.5px] text-muted-foreground">
              Upload Excel kolom <span className="font-mono">Asset ID</span> — divalidasi dulu sebelum
              ditambahkan.
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
          <div className="flex gap-2 rounded border border-sky-200 bg-sky-50 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
            <div>
              <p className="text-sm font-semibold text-sky-900">Validasi sebelum tambah</p>
              <p className="text-[12.5px] text-sky-800/80">
                Asset ID di-cek ke database &amp; Management scope sebelum ditambahkan ke Draft.
              </p>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed p-4 text-left hover:border-primary/50 hover:bg-muted/40"
          >
            <ListChecks className="h-7 w-7 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">
                {fileName || 'Klik untuk pilih file Excel'}
              </div>
              <div className="text-xs text-muted-foreground">
                {parsed.length ? `${parsed.length} baris terbaca · klik untuk ganti` : '.xlsx / .csv · kolom Asset ID'}
              </div>
            </div>
          </button>

          {parsed.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                {valid.length} akan ditambahkan
              </span>
              {skipped.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                  {skipped.length} sudah ada (dilewati)
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700">
                {errs.length} error
              </span>
              {validating && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> memvalidasi…
                </span>
              )}
            </div>
          )}

          {errs.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-rose-200">
              <div className="bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                Error Log — perbaiki sebelum ditambahkan
              </div>
              <div className="max-h-40 divide-y overflow-y-auto text-xs">
                {errs.slice(0, 100).map((r, i) => (
                  <div key={i} className="flex gap-3 px-3 py-1.5">
                    <span className="w-14 shrink-0 font-medium text-rose-600">Baris {r.row}</span>
                    <span className="w-32 shrink-0 font-mono">{r.assetId || '—'}</span>
                    <span className="text-muted-foreground">{r.err}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button size="sm" onClick={add} disabled={saving || validating || errs.length > 0 || valid.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Tambah ({valid.length})
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Pager item batch: ‹ 1 2 … 24 › — windowed (current ±1, dgn first/last). */
function ItemPager({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (p: number) => void
}) {
  const pages = pageWindow(page, pageCount)
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Sebelumnya"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-foreground hover:bg-muted disabled:opacity-40"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-8 min-w-8 rounded-md px-2 text-sm tabular-nums transition-colors',
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Berikutnya"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-foreground hover:bg-muted disabled:opacity-40"
      >
        ›
      </button>
    </div>
  )
}

/** Nomor halaman yang dirender: current ±1, dengan first/last + ellipsis. */
function pageWindow(page: number, maxPage: number): (number | '…')[] {
  const out: (number | '…')[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(maxPage - 1, page + 1)
  if (from > 2) out.push('…')
  for (let p = from; p <= to; p++) out.push(p)
  if (to < maxPage - 1) out.push('…')
  if (maxPage > 1) out.push(maxPage)
  return out
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  )
}

function TL({
  title,
  sub,
  time,
  muted,
  last,
}: {
  title: string
  sub: string
  time: string
  muted?: boolean
  last?: boolean
}) {
  return (
    <li className={cn('relative border-l-2 border-primary/20 pb-4 pl-4', last && 'border-l-transparent pb-0')}>
      <span
        className={cn(
          'absolute -left-[5px] top-1 h-2 w-2 rounded-full',
          muted ? 'bg-muted-foreground/40' : 'bg-primary',
        )}
      />
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
      <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> {time}
      </div>
    </li>
  )
}

function ApproveRejectModal({
  mode,
  batch,
  onClose,
  onDone,
}: {
  mode: 'approve' | 'reject' | null
  batch: UploadBatch
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (mode) {
      setReason('')
      setNote('')
    }
  }, [mode])
  if (!mode) return null
  const isReject = mode === 'reject'

  async function submit() {
    setBusy(true)
    try {
      const msg = isReject
        ? await rejectBatch(batch.IDX_T_UploadBatch, reason.trim())
        : await approveBatch(batch.IDX_T_UploadBatch, note.trim())
      toast.success(msg || (isReject ? 'Batch ditolak' : 'Batch di-approve'))
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operasi gagal')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#091412]/50 p-5 backdrop-blur-[2px]"
      onClick={() => !busy && onClose()}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Head: ikon-kotak + judul/subjudul + tombol X (mockup) */}
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <span
            className={cn(
              'grid h-9 w-9 flex-none place-items-center rounded-lg',
              isReject ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600',
            )}
          >
            {isReject ? (
              <XCircle className="h-[18px] w-[18px]" />
            ) : (
              <ThumbsUp className="h-[18px] w-[18px]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">
              {isReject ? 'Reject' : 'Approve'} Batch {batch.BatchNo}
            </h3>
            <p className="text-[12.5px] text-muted-foreground">
              {isReject
                ? 'Batch akan kembali ke status Draft'
                : `${numberWithDots(batch.Qty)} asset → ${batch.TargetStatus}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {isReject ? (
            <>
              {/* Banner warn: Reject per-batch */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Reject per-batch</p>
                  <p className="text-[12.5px] text-amber-800/80">
                    Seluruh {numberWithDots(batch.Qty)} item kembali ke Draft. Tim Asset dapat
                    memperbaiki data lalu submit ulang.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Alasan Reject <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan agar Tim Asset bisa memperbaiki…"
                  disabled={busy}
                />
              </div>
            </>
          ) : (
            <>
              {/* Banner success: Konfirmasi persetujuan */}
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">Konfirmasi persetujuan</p>
                  <p className="text-[12.5px] text-emerald-800/80">
                    Status {numberWithDots(batch.Qty)} asset akan langsung berubah menjadi{' '}
                    {batch.TargetStatus} dan timestamp approval tercatat.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Catatan (opsional)</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Catatan approval…"
                  disabled={busy}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Batal
          </Button>
          <Button
            size="sm"
            className={isReject ? '' : 'bg-emerald-600 hover:bg-emerald-700'}
            variant={isReject ? 'destructive' : 'default'}
            disabled={busy || (isReject && !reason.trim())}
            onClick={submit}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isReject ? (
              <Send className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {isReject ? 'Kirim Reject' : 'Approve Batch'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <>
      <Skeleton className="mb-2 h-3 w-40" />
      <Skeleton className="mb-5 h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Skeleton className="h-80 w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </>
  )
}
