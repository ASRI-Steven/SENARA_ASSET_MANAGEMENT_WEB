import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  Ban,
  Camera,
  ChevronRight,
  Download,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  QrCode,
  Tag,
  Upload,
  User,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { rupiah, formatDate, formatDateTime, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  fetchAssetByID,
  fetchAssetHistory,
  fetchAssetPhoto,
  saveAssetPhoto,
  type AssetPhoto,
  type AssetRow,
  type HistoryEntry,
  type HistoryGroup,
} from '@/api/assets'
import { photoUrl, uploadPhoto } from '@/api/upload'
import { AssetActionsMenu } from './AssetActions'

function avInitials(s: string): string {
  const parts = s.trim().split(/\s+/).slice(0, 2)
  const x = parts.map((p) => p[0] ?? '').join('')
  return (x || s.slice(0, 2)).toUpperCase()
}

/** Badge colour by status name (history has only the name, no colour class). */
function statusBadgeClass(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('ok') || n.includes('active')) return 'bg-emerald-100 text-emerald-700'
  if (n.includes('broken')) return 'bg-rose-100 text-rose-700'
  if (n.includes('maint')) return 'bg-amber-100 text-amber-700'
  if (n.includes('mia')) return 'bg-violet-100 text-violet-700'
  if (n.includes('sold')) return 'bg-teal-100 text-teal-700'
  if (n.includes('disposal')) return 'bg-slate-200 text-slate-700'
  if (n.includes('inactive')) return 'bg-slate-100 text-slate-600'
  return 'bg-muted text-muted-foreground'
}

/** "18 Agu 2026 · 10.24" — tanggal + jam (id-ID). */
function fmtDateTime(s: string | null): string {
  return s ? formatDateTime(s) : '—'
}

/** "341 KB" / "1.2 MB" dari bytes. */
function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** Tag kecil di label field (mis. "= PO ID", "baru") — meniru .tag-field mockup. */
const FIELD_TAG =
  'ml-1 rounded bg-muted px-1 py-0.5 align-middle text-[10px] font-normal text-muted-foreground'

/** One label/value row in a summary <dl>. */
function InfoRow({ label, value, mono }: { label: ReactNode; value?: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn('min-w-0 text-right font-medium text-foreground', mono && 'font-mono')}>
        {value || '-'}
      </dd>
    </div>
  )
}

/** Card head: icon chip + title + subtitle + optional trailing node. */
function CardHead({
  icon: Icon,
  title,
  subtitle,
  trailing,
}: {
  icon: typeof Camera
  title: ReactNode
  subtitle?: string
  trailing?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {trailing}
    </div>
  )
}

/** Sub-teks untuk entri paling awal (registrasi) per tab. */
const INITIAL_SUB: Record<'status' | 'user' | 'loc', string> = {
  status: 'Registrasi asset baru dari ASBS-Asset',
  user: 'Pemegang awal saat registrasi',
  loc: 'Lokasi awal saat registrasi',
}

/** History timeline for one field (status / user / location). */
function Timeline({ entries, kind }: { entries: HistoryEntry[]; kind: 'status' | 'user' | 'loc' }) {
  if (!entries.length) {
    return <p className="py-10 text-center text-xs text-muted-foreground">Belum ada riwayat.</p>
  }
  return (
    <ul className="mt-4">
      {entries.map((e, i) => {
        // list DESC (terbaru dulu) → elemen terakhir = paling lama = baris registrasi.
        const isInitial = i === entries.length - 1
        return (
          <li
            key={i}
            className="relative border-l-2 border-primary/20 pb-5 pl-4 last:border-l-transparent last:pb-0"
          >
            <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary" />
            <div className="text-sm font-medium text-foreground">
              {kind === 'status' ? (
                <>
                  {isInitial && <span className="text-muted-foreground">Status awal: </span>}
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      statusBadgeClass(e.value),
                    )}
                  >
                    {e.value}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">→ </span>
                  {e.value}
                  {kind === 'user' && e.nik && (
                    <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">
                      (NIK {e.nik})
                    </span>
                  )}
                </>
              )}
            </div>
            {isInitial ? (
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">{INITIAL_SUB[kind]}</div>
            ) : e.changedBy ? (
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">Diubah oleh {e.changedBy}</div>
            ) : null}
            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {fmtDateTime(e.changedDate ?? e.startDate)}
            </div>
            {e.remarks && (
              <div className="mt-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs leading-snug text-muted-foreground">
                Remarks: “{e.remarks}”
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default function AssetDetailScreen() {
  const { id = '' } = useParams()
  const assetId = decodeURIComponent(id)

  const [asset, setAsset] = useState<AssetRow | null>(null)
  const [history, setHistory] = useState<HistoryGroup[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [photo, setPhoto] = useState<AssetPhoto | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setAsset(null)
    setHistory([])
    setPhoto(null)
    fetchAssetByID(assetId)
      .then((row) => {
        if (!alive) return
        setAsset(row ?? null)
        if (row) {
          setHistoryLoading(true)
          fetchAssetHistory(row.IDX_M_Asset)
            .then((groups) => {
              if (alive) setHistory(groups)
            })
            .catch(() => {})
            .finally(() => {
              if (alive) setHistoryLoading(false)
            })
          setPhotoLoading(true)
          fetchAssetPhoto(row.IDX_M_Asset)
            .then((p) => {
              if (alive) setPhoto(p)
            })
            .catch(() => {})
            .finally(() => {
              if (alive) setPhotoLoading(false)
            })
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat detail aset')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [assetId, reloadKey])

  function pickFile() {
    fileRef.current?.click()
  }
  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset → bisa pilih file yang sama lagi
    if (!file || !asset) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran maksimal 5 MB')
      return
    }
    setUploading(true)
    try {
      const up = await uploadPhoto(file, file.name)
      await saveAssetPhoto({
        IDX_M_Asset: asset.IDX_M_Asset,
        PhotoPath: up.path,
        PhotoFileName: up.fileName,
        PhotoSize: up.size,
        PhotoWidth: up.width,
        PhotoHeight: up.height,
      })
      setPhoto(await fetchAssetPhoto(asset.IDX_M_Asset))
      toast.success('Foto asset tersimpan')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload foto gagal')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Gagal memuat detail aset</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <Loader2 className="h-3.5 w-3.5" /> Coba lagi
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/assets">Kembali</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!asset) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Aset {assetId} tidak ditemukan.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/assets">Kembali</Link>
        </Button>
      </div>
    )
  }

  const name =
    [asset.AssetBrandName, asset.AssetTypeModelName].filter(Boolean).join(' ') ||
    asset.AssetTypeName ||
    asset.AssetID
  const typeModel = [asset.AssetTypeName, asset.AssetTypeModelName].filter(Boolean).join(' · ')
  const price =
    asset.Currency && asset.Currency !== 'IDR'
      ? `${asset.Currency} ${rupiah(Math.round(toNumber(asset.UnitPrice))).replace('Rp ', '')}`
      : rupiah(Math.round(toNumber(asset.UnitPrice)))

  const statusEntries = history.find((g) => g.title === 'Status')?.entries ?? []
  const userEntries = history.find((g) => g.title === 'User')?.entries ?? []
  const locEntries = history.find((g) => g.title === 'Location')?.entries ?? []
  // NIK pemegang = NIK entri User terbaru (SP history User balikin M_AssetUser.NIK).
  const pemegangNik = userEntries[0]?.nik ?? null

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link to="/assets" className="hover:text-primary">
          Manage Asset
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="font-mono">{asset.AssetID}</span>
      </div>

      {/* Page head */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground">{name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{asset.AssetID}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {asset.isUpdate !== 0 && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/assets/${encodeURIComponent(asset.AssetID)}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/print-qr">
              <QrCode className="h-4 w-4" /> Print QR
            </Link>
          </Button>
          <AssetActionsMenu
            asset={asset}
            onChanged={() => setReloadKey((k) => k + 1)}
            hideNav
            trigger={
              <Button size="sm">
                <User className="h-4 w-4" /> Assign / Change
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* LEFT — summary + foto + pengadaan */}
        <div className="space-y-4">
          {/* Summary */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-mono text-sm font-bold text-primary">
                  {avInitials(name)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold text-foreground">{name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{asset.AssetID}</div>
                  {asset.CurrentAssetStatus && (
                    <span
                      className={cn(
                        'mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        statusBadgeClass(asset.CurrentAssetStatus),
                      )}
                    >
                      {asset.CurrentAssetStatus}
                    </span>
                  )}
                </div>
              </div>
              <dl className="divide-y divide-dashed">
                <InfoRow label="Company" value={asset.CompanyName} />
                <InfoRow label="Management" value={asset.AssetManagementName} />
                <InfoRow label="Type / Model" value={typeModel} />
                <InfoRow label="Brand" value={asset.AssetBrandName} />
                <InfoRow label="Color" value={asset.AssetColorName} />
                <InfoRow label="Size" value={asset.AssetSizeName} />
                <InfoRow label="Lokasi" value={asset.CurrentAssetLocation} />
                <InfoRow
                  label="Pemegang"
                  value={
                    <>
                      {asset.CurrentAssetUser || '-'}
                      {pemegangNik && (
                        <span className="mt-0.5 block font-mono text-[11px] font-normal text-muted-foreground">
                          NIK {pemegangNik}
                        </span>
                      )}
                    </>
                  }
                />
              </dl>
            </CardContent>
          </Card>

          {/* Foto Asset */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <CardHead
                icon={Camera}
                title={
                  <>
                    Foto Asset <span className={FIELD_TAG}>baru</span>
                  </>
                }
                subtitle="Bukti fisik aset"
                trailing={
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      photo
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {photo ? 'Ada' : 'Kosong'}
                  </span>
                }
              />
              {photoLoading ? (
                <Skeleton className="mt-3 h-40 w-full rounded-xl" />
              ) : photo ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreview(true)}
                    className="mt-3 block w-full overflow-hidden rounded-xl border bg-muted"
                  >
                    <img
                      src={photoUrl(photo.PhotoPath)}
                      alt="Foto asset"
                      className="h-40 w-full object-cover"
                    />
                  </button>
                  <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                    {photo.PhotoFileName || '—'}
                    {photo.PhotoSize ? ` · ${fmtBytes(photo.PhotoSize)}` : ''}
                    {photo.PhotoWidth && photo.PhotoHeight
                      ? ` · ${photo.PhotoWidth}×${photo.PhotoHeight}`
                      : ''}
                  </div>
                </>
              ) : (
                <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-center text-muted-foreground">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs">Belum ada foto aset</span>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!photo}
                  onClick={() => setPreview(true)}
                >
                  <Eye className="h-4 w-4" /> Lihat
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={uploading}
                  onClick={pickFile}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {photo ? 'Ganti' : 'Unggah'}
                </Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                Terkompresi otomatis di server saat diunggah (maks 5 MB).
              </p>
            </CardContent>
          </Card>

          {/* Data Pengadaan */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              <CardHead icon={FileText} title="Data Pengadaan" subtitle="Field baru: No. PO & NIK" />
              <dl className="mt-2 divide-y divide-dashed">
                <InfoRow
                  label={
                    <>
                      No. PO <span className={FIELD_TAG}>= PO ID</span>
                    </>
                  }
                  value={asset.PONo}
                  mono
                />
                <InfoRow
                  label={
                    <>
                      NIK <span className={FIELD_TAG}>baru</span>
                    </>
                  }
                  value={null}
                  mono
                />
                <InfoRow label="Tgl PO" value={formatDate(asset.PODate)} mono />
                <InfoRow label="Currency" value={asset.Currency} />
                <InfoRow label="Unit Price" value={price} />
                <InfoRow label="Tgl Perolehan" value={formatDate(asset.AssetDate)} mono />
              </dl>
              <div className="mt-3 flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                <p className="text-[11px] leading-snug text-sky-800">
                  Data PO dikelola di ASBS-Asset dan disinkronkan otomatis.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — History */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <CardHead
              icon={History}
              title="History Asset"
              subtitle="Audit trail read-only · perubahan tiap field dicatat terpisah beserta remarks"
            />

            {historyLoading ? (
              <div className="mt-5 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <Tabs defaultValue="status" className="mt-4">
                <TabsList>
                  <TabsTrigger value="status" className="gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Status
                    <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                      {statusEntries.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="user" className="gap-1.5">
                    <User className="h-3.5 w-3.5" /> User
                    <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                      {userEntries.length}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="loc" className="gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Location
                    <span className="ml-0.5 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                      {locEntries.length}
                    </span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="status">
                  <Timeline entries={statusEntries} kind="status" />
                </TabsContent>
                <TabsContent value="user">
                  <Timeline entries={userEntries} kind="user" />
                </TabsContent>
                <TabsContent value="loc">
                  <Timeline entries={locEntries} kind="loc" />
                </TabsContent>
              </Tabs>
            )}

            <div className="mt-5 flex gap-3 rounded-xl border border-primary/15 bg-primary/[0.06] p-3.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium leading-snug text-foreground">
                  Pemisahan remarks & foto multi-field
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Satu opname yang mengubah beberapa field (mis. Status + Lokasi) menyimpan baris
                  terpisah di tiap tabel history dengan remarks dan foto masing-masing. Klik chip
                  foto untuk membuka preview gambar yang di-capture.
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium leading-snug text-amber-900">
                  Pengecualian foto: status MIA
                </p>
                <p className="text-xs leading-relaxed text-amber-800/80">
                  Foto dokumentasi <b>mandatory</b> untuk setiap perubahan. Satu-satunya pengecualian
                  adalah perubahan status menjadi <b>MIA</b> — asset memang tidak ditemukan sehingga
                  tidak ada foto yang bisa diambil. Baris lama hasil migrasi & perubahan otomatis
                  sistem ditandai terpisah.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Foto — port 1:1 dari mockup (modal "Preview Foto History") */}
      {preview && photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091412]/50 p-5 backdrop-blur-[2px]"
          onClick={() => setPreview(false)}
        >
          <div
            className="flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl bg-card shadow-[0_12px_40px_rgba(17,48,46,0.14)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* head: ikon + judul + konteks + close */}
            <div className="flex items-start gap-3 border-b px-5 py-[18px]">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground">Preview Foto</h3>
                <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                  Foto utama · {asset.AssetID}
                </p>
              </div>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setPreview(false)}
                className="grid h-[38px] w-[38px] flex-none place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* body: foto + dl 4 baris + banner info */}
            <div className="overflow-y-auto px-5 py-[18px]">
              <img
                src={photoUrl(photo.PhotoPath)}
                alt="Foto asset"
                className="aspect-[4/3] w-full rounded-lg border bg-muted object-cover"
              />
              <dl className="mt-3">
                <div className="flex justify-between gap-4 border-b border-dashed py-2.5 text-[13.5px]">
                  <dt className="flex-none text-muted-foreground">Nama file</dt>
                  <dd className="min-w-0 truncate text-right font-mono font-medium text-foreground">
                    {photo.PhotoFileName || '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-dashed py-2.5 text-[13.5px]">
                  <dt className="flex-none text-muted-foreground">Diambil oleh</dt>
                  <dd className="min-w-0 text-right font-medium text-foreground">
                    {photo.UCreate || '—'} · Web
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-dashed py-2.5 text-[13.5px]">
                  <dt className="flex-none text-muted-foreground">Waktu capture</dt>
                  <dd className="min-w-0 text-right font-mono font-medium text-foreground">
                    {photo.DCreate ? fmtDateTime(photo.DCreate) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-2.5 text-[13.5px]">
                  <dt className="flex-none text-muted-foreground">Ukuran</dt>
                  <dd className="min-w-0 text-right font-mono font-medium text-foreground">
                    {photo.PhotoSize ? fmtBytes(photo.PhotoSize) : '—'}
                    {photo.PhotoWidth && photo.PhotoHeight
                      ? ` · ${photo.PhotoWidth}×${photo.PhotoHeight}`
                      : ''}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2.5 text-sky-800">
                <Lock className="mt-0.5 h-[15px] w-[15px] flex-none text-sky-600" />
                <p className="text-[12px] leading-relaxed">
                  Foto bagian dari audit trail — tidak dapat diganti atau dihapus.
                </p>
              </div>
            </div>

            {/* foot: Unduh (kiri) · Tutup (kanan) */}
            <div className="flex items-center justify-between gap-2 border-t px-5 py-[14px]">
              <Button asChild variant="ghost" size="sm">
                <a href={photo.PhotoPath} target="_blank" rel="noreferrer" download>
                  <Download className="h-4 w-4" /> Unduh
                </a>
              </Button>
              <Button size="sm" onClick={() => setPreview(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailSkeleton() {
  return (
    <>
      <div className="mb-5 space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-3 p-5">
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
