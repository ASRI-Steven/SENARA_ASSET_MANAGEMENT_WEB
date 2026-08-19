import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search,
  SlidersHorizontal,
  QrCode,
  Plus,
  AlertCircle,
  Loader2,
  LayoutGrid,
  Rows3,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  ArrowDownUp,
  FileDown,
  RotateCcw,
  X,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { STICKERS_PER_A4 } from '@/lib/printQr'
import { numberWithDots, rupiah, toNumber } from '@/lib/format'
import { statusColorClass } from '@/lib/assetStatus'
import {
  searchAssets,
  fetchAssetLookups,
  returnAssets,
  type AssetRow,
  type AssetPage,
  type AssetLookups,
  type AssetSearchParams,
} from '@/api/assets'
import { AssetActionsMenu } from './AssetActions'

const PAGE_SIZE = 12
const ALL = 'all'
type View = 'table' | 'cards'
const VIEW_KEY = 'asrilup:asset-view'

// Sort direction the SP expects (0=ASC, 1=DESC).
type SortDir = 'asc' | 'desc'
const SEQ: Record<SortDir, number> = { asc: 0, desc: 1 }

// Columns the search SP can ORDER BY, keyed by the INT index its ORDER BY CASE
// expects. Verified against usp_CMS_ManageAsset_Search (@SortBy INT):
// 1=CurrentAssetStatus, 2=CurrentAssetLocation, 3=CompanyAlias, 4=AssetID.
// (5=isDisabled, 6=isConnectedASBSPO also exist but aren't user-facing columns.)
// Type / User / Nilai are intentionally absent: the SP cannot sort by them.
type SortKey = 'assetId' | 'status' | 'location'
const SORT_FIELDS: Record<SortKey, { index: number; label: string }> = {
  assetId: { index: 4, label: 'Asset ID' },
  status: { index: 1, label: 'Status' },
  location: { index: 2, label: 'Lokasi' },
}
const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: 'assetId', dir: 'asc' }

// Assign/Unassign filter — maps to the SP's ReturnAsset INT param. Legacy
// AssetList.vue used {Assign:0, UnAssign:1}; leaving it unset returns all rows,
// which we surface as the "Semua" option (value ALL, param omitted).
const RETURN_ASSET_OPTIONS: { value: string; label: string }[] = [
  { value: '0', label: 'Assigned — sudah ada pemegang' },
  { value: '1', label: 'Unassigned — belum ada pemegang' },
]

function assetRowKey(a: AssetRow, i: number): string {
  return `${a.IDX_M_Asset}-${a.RunningNumber ?? i}`
}

/**
 * A disabled (deactivated) asset. The grid SP returns Status='DISABLED' for such
 * rows (and isEnable=1 = the "enable" action is available). Legacy marked these
 * with an orange badge / "DISABLE" label; we mirror that.
 */
function assetDisabled(a: AssetRow): boolean {
  return a.Status?.toUpperCase() === 'DISABLED' || a.isEnable === 1
}

/** "NONAKTIF" marker shown next to the AssetID of a deactivated asset. */
function NonaktifBadge() {
  return (
    <Badge
      variant="outline"
      className="border-amber-400 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-700"
    >
      NONAKTIF
    </Badge>
  )
}

function StatusBadge({ asset }: { asset: AssetRow }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${statusColorClass(
        asset.CurrentColorAssetStatus,
      )}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {asset.CurrentAssetStatus || '-'}
    </span>
  )
}

/** One asset rendered as a card — used by the mobile list and the desktop card grid. */
function AssetCard({ asset, onChanged }: { asset: AssetRow; onChanged: () => void }) {
  return (
    <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              to={`/assets/${encodeURIComponent(asset.AssetID)}`}
              className={cn(
                'truncate font-semibold hover:underline',
                assetDisabled(asset) ? 'text-muted-foreground line-through' : 'text-primary',
              )}
            >
              {asset.AssetID}
            </Link>
            {assetDisabled(asset) && <NonaktifBadge />}
          </div>
          <AssetActionsMenu asset={asset} onChanged={onChanged} />
        </div>
        <StatusBadge asset={asset} />
        <div className="truncate text-sm text-foreground">
          {asset.AssetTypeName}
          {asset.AssetTypeModelName ? ` · ${asset.AssetTypeModelName}` : ''}
        </div>
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <div className="truncate">👤 {asset.CurrentAssetUser || '-'}</div>
          <div className="truncate">📍 {asset.CurrentAssetLocation || '-'}</div>
        </div>
        <div className="mt-auto pt-1 text-sm font-medium text-foreground">
          {rupiah(Math.round(toNumber(asset.UnitPrice)))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AssetListScreen() {
  const navigate = useNavigate()
  // Search input (debounced into `keyword`, which drives the request).
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState(ALL) // holds IDX as string, or "all"
  const [status, setStatus] = useState(ALL)
  const [location, setLocation] = useState(ALL)
  const [user, setUser] = useState(ALL) // holds IDX_M_AssetUser as string, or "all"
  const [brand, setBrand] = useState(ALL) // holds IDX_M_AssetBrand as string, or "all"
  const [department, setDepartment] = useState(ALL) // holds DepartmentName, or "all"
  const [company, setCompany] = useState(ALL) // holds IDX_M_Company as string, or "all"
  const [returnAsset, setReturnAsset] = useState(ALL) // Assign/Unassign — "0"/"1", or "all"
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT.key)
  const [sortDir, setSortDir] = useState<SortDir>(DEFAULT_SORT.dir)
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  // Table vs card-grid view (desktop). Persisted so it survives navigation.
  const [view, setView] = useState<View>(
    () => (localStorage.getItem(VIEW_KEY) as View) || 'table',
  )

  const [lookups, setLookups] = useState<AssetLookups | null>(null)
  const [data, setData] = useState<AssetRow[]>([])
  const [pageInfo, setPageInfo] = useState<AssetPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [reporting, setReporting] = useState(false)

  // Multi-select untuk Print QR: Map IDX_M_Asset -> AssetRow (baris LENGKAP),
  // supaya seleksi AKUMULATIF lintas halaman DAN bisa dikirim langsung ke Print QR
  // via router state (tanpa fetch ulang per-aset yang rawan gagal).
  const [selected, setSelected] = useState<Map<number, AssetRow>>(new Map())
  const [returnOpen, setReturnOpen] = useState(false)

  function changeView(v: View) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  // Debounce the search box → keyword (and reset to page 1 on change).
  useEffect(() => {
    const t = setTimeout(() => {
      setKeyword(searchInput.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Load filter dropdown options once.
  useEffect(() => {
    let alive = true
    fetchAssetLookups()
      .then((l) => {
        if (alive) setLookups(l)
      })
      .catch(() => {
        // Non-fatal: filters just fall back to "all"; the grid still loads.
      })
    return () => {
      alive = false
    }
  }, [])

  // The search params (minus paging) shared by the grid fetch and the PDF
  // report, so the report always matches exactly what's on screen.
  const searchParams = useMemo<Omit<AssetSearchParams, 'CurrentPage' | 'PageSize'>>(
    () => ({
      Keyword: keyword || undefined,
      IDX_M_AssetType: type !== ALL ? Number(type) : undefined,
      IDX_M_AssetStatus: status !== ALL ? Number(status) : undefined,
      IDX_M_AssetLocation: location !== ALL ? Number(location) : undefined,
      IDX_M_AssetUser: user !== ALL ? Number(user) : undefined,
      IDX_M_AssetBrand: brand !== ALL ? Number(brand) : undefined,
      DepartmentName: department !== ALL ? department : undefined,
      IDX_M_Company: company !== ALL ? Number(company) : undefined,
      ReturnAsset: returnAsset !== ALL ? Number(returnAsset) : undefined,
      SortBy: SORT_FIELDS[sortKey].index,
      SortSequence: SEQ[sortDir],
    }),
    [
      keyword,
      type,
      status,
      location,
      user,
      brand,
      department,
      company,
      returnAsset,
      sortKey,
      sortDir,
    ],
  )

  // Keep the latest request identity so stale responses are ignored.
  const reqId = useRef(0)

  // Fetch the grid whenever any query input changes.
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    searchAssets({ ...searchParams, CurrentPage: page, PageSize: PAGE_SIZE })
      .then((res) => {
        if (id !== reqId.current) return
        setData(res.rows)
        setPageInfo(res.page)
        // JANGAN clear selection di sini — biar persist saat pindah halaman.
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return
        setData([])
        setPageInfo(null)
        setError(e instanceof Error ? e.message : 'Gagal memuat daftar aset')
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [searchParams, page, reloadKey])

  // Reset seleksi Print QR hanya saat filter/keyword berubah (result set baru),
  // BUKAN saat pindah halaman — supaya centang terkumpul lintas halaman.
  useEffect(() => {
    setSelected(new Map())
  }, [searchParams])

  const maxPage = pageInfo?.MaxPage ?? 1
  const total = pageInfo?.TotalRecords ?? 0
  const activeFilters = [
    type,
    status,
    location,
    user,
    brand,
    department,
    company,
    returnAsset,
  ].filter((v) => v !== ALL).length

  const description = useMemo(() => {
    if (loading && !pageInfo) return 'Memuat…'
    return `${numberWithDots(total)} aset`
  }, [loading, pageInfo, total])

  // Memoise the filter option lists. Some lookups are large (users ≈2,100,
  // brands ≈800) so rebuilding these arrays on every render — and the thousands
  // of <SelectItem>s they feed — noticeably slows re-renders. Recompute only
  // when the lookups payload changes.
  const typeOptions = useMemo(
    () =>
      lookups?.types.map((t) => ({
        value: String(t.IDX_M_AssetType),
        label: t.AssetTypeName,
      })) ?? [],
    [lookups],
  )
  const statusOptions = useMemo(
    () =>
      lookups?.statuses.map((s) => ({
        value: String(s.IDX_M_AssetStatus),
        label: s.AssetStatusName,
      })) ?? [],
    [lookups],
  )
  const locationOptions = useMemo(
    () =>
      lookups?.locations.map((l) => ({
        value: String(l.IDX_M_AssetLocation),
        label: l.AssetLocationName,
      })) ?? [],
    [lookups],
  )
  // User options feed the searchable Combobox (≈2,100 users). The department is
  // surfaced as a hint so it's searchable too.
  const userOptions = useMemo<ComboboxOption[]>(
    () =>
      lookups?.users.map((u) => ({
        value: String(u.IDX_M_AssetUser),
        label: u.AssetUserName,
        hint: u.DepartmentName ?? undefined,
      })) ?? [],
    [lookups],
  )
  const brandOptions = useMemo(
    () =>
      lookups?.brands.map((b) => ({
        value: String(b.IDX_M_AssetBrand),
        label: b.AssetBrandName,
      })) ?? [],
    [lookups],
  )
  const departmentOptions = useMemo(
    () =>
      lookups?.departments
        .filter((d) => d.DepartmentName && d.DepartmentName !== '-')
        .map((d) => ({ value: d.DepartmentName, label: d.DepartmentName })) ?? [],
    [lookups],
  )
  const companyOptions = useMemo(
    () =>
      lookups?.companies.map((c) => ({
        value: String(c.IDX_M_Company),
        label: c.CompanyAlias ? `${c.CompanyName} (${c.CompanyAlias})` : c.CompanyName,
      })) ?? [],
    [lookups],
  )

  // Human-readable "Label: value" lines for the active filters — printed in the
  // PDF report header so a reader knows exactly what was filtered.
  const filterSummary = useMemo<string[]>(() => {
    const labelOf = (
      opts: { value: string; label: string }[],
      v: string,
    ): string => opts.find((o) => o.value === v)?.label ?? v
    const out: string[] = []
    if (keyword) out.push(`Pencarian: ${keyword}`)
    if (type !== ALL) out.push(`Type: ${labelOf(typeOptions, type)}`)
    if (brand !== ALL) out.push(`Brand: ${labelOf(brandOptions, brand)}`)
    if (status !== ALL) out.push(`Status: ${labelOf(statusOptions, status)}`)
    if (user !== ALL) out.push(`User: ${labelOf(userOptions, user)}`)
    if (department !== ALL) out.push(`Department: ${department}`)
    if (location !== ALL) out.push(`Lokasi: ${labelOf(locationOptions, location)}`)
    if (returnAsset !== ALL)
      out.push(`Assign: ${labelOf(RETURN_ASSET_OPTIONS, returnAsset)}`)
    if (company !== ALL) out.push(`Company: ${labelOf(companyOptions, company)}`)
    return out
  }, [
    keyword,
    type,
    brand,
    status,
    user,
    department,
    location,
    returnAsset,
    company,
    typeOptions,
    brandOptions,
    statusOptions,
    userOptions,
    locationOptions,
    companyOptions,
  ])

  // Generate + download a PDF of the current filtered result set.
  async function handlePrintReport() {
    if (reporting) return
    // No row cap (prints every matching asset), but a very large unfiltered
    // export is slow + produces a big PDF — warn the user so they can filter first.
    if (total > 10000) {
      const ok = window.confirm(
        `Laporan akan mencetak ${numberWithDots(total)} aset. Ini bisa memakan waktu ` +
          `dan menghasilkan file besar. Sebaiknya persempit dengan filter dulu. Tetap lanjutkan?`,
      )
      if (!ok) return
    }
    setReporting(true)
    const toastId = toast.loading('Menyiapkan laporan PDF…')
    try {
      // Lazy-load the (heavy) jsPDF report module so it only ships when the
      // user actually prints — keeps the list-screen bundle light.
      const { buildAssetReport } = await import('@/lib/assetReport')
      const res = await buildAssetReport({
        params: searchParams,
        filterSummary,
        title: 'Laporan Aset',
      })
      if (res.rowCount === 0) {
        toast.error('Tidak ada aset untuk dicetak.', { id: toastId })
      } else if (res.truncated) {
        toast.success(
          `Laporan diunduh: ${numberWithDots(res.rowCount)} dari ${numberWithDots(
            res.totalRecords,
          )} aset (dibatasi).`,
          { id: toastId },
        )
      } else {
        toast.success(`Laporan diunduh: ${numberWithDots(res.rowCount)} aset.`, {
          id: toastId,
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat laporan.', {
        id: toastId,
      })
    } finally {
      setReporting(false)
    }
  }

  function resetFilters() {
    setType(ALL)
    setStatus(ALL)
    setLocation(ALL)
    setUser(ALL)
    setBrand(ALL)
    setDepartment(ALL)
    setCompany(ALL)
    setReturnAsset(ALL)
    setPage(1)
  }

  // Apply a sort column + direction, always resetting to page 1.
  function applySort(key: SortKey, dir: SortDir) {
    setSortKey(key)
    setSortDir(dir)
    setPage(1)
  }

  // Click a sortable header: first click sorts asc; clicking the active column
  // toggles asc <-> desc.
  function toggleSort(key: SortKey) {
    if (sortKey === key) applySort(key, sortDir === 'asc' ? 'desc' : 'asc')
    else applySort(key, 'asc')
  }

  // Re-fetch the current page after a row action mutates an asset.
  function refresh() {
    setReloadKey((k) => k + 1)
  }

  // --- Bulk selection ---
  // Checkbox seleksi Print QR: tersedia untuk SEMUA user (tak digate izin).
  const canSelect = true
  // Bulk "Return User" tetap disembunyikan (mockup tak memilikinya).
  const canReturn = false && pageInfo?.isReturn === 1
  const allSelected = data.length > 0 && data.every((a) => selected.has(a.IDX_M_Asset))
  const someSelected = selected.size > 0 && !allSelected
  // Print QR wajib muat 1 halaman A4 → seleksi dibatasi kapasitas 1 A4 (16).
  // Begitu penuh, aset yang belum dicentang tak bisa ditambah lagi (tak tumpah
  // ke halaman ke-2, tak ada data yang kebuang).
  const atSelectCap = selected.size >= STICKERS_PER_A4

  function toggleRow(a: AssetRow, checked: boolean) {
    // Tolak penambahan bila kuota 1 halaman A4 sudah penuh.
    if (checked && !selected.has(a.IDX_M_Asset) && selected.size >= STICKERS_PER_A4) {
      toast.info(`Maksimal ${STICKERS_PER_A4} aset per cetak (muat 1 halaman A4).`)
      return
    }
    setSelected((prev) => {
      const next = new Map(prev)
      if (checked) next.set(a.IDX_M_Asset, a)
      else next.delete(a.IDX_M_Asset)
      return next
    })
  }

  // Select-all: isi baris halaman ini sampai kuota A4 (16) penuh, sisanya
  // diabaikan. Tetap PERTAHANKAN pilihan dari halaman lain (akumulatif).
  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (checked) {
        for (const a of data) {
          if (next.size >= STICKERS_PER_A4) break
          next.set(a.IDX_M_Asset, a)
        }
        if (next.size >= STICKERS_PER_A4 && !data.every((a) => next.has(a.IDX_M_Asset))) {
          toast.info(`Maksimal ${STICKERS_PER_A4} aset per cetak (muat 1 halaman A4).`)
        }
      } else {
        data.forEach((a) => next.delete(a.IDX_M_Asset))
      }
      return next
    })
  }

  // Semua baris terpilih (lintas halaman) — dipakai dialog Return dormant + Print QR.
  const selectedRows = useMemo(() => [...selected.values()], [selected])

  // AssetID unik yang terpilih (lintas halaman) — untuk label tombol + fallback URL.
  const selectedAssetIds = useMemo(
    () => [...new Set(selectedRows.map((r) => r.AssetID.trim()))],
    [selectedRows],
  )

  // Go to Print QR — kirim baris LENGKAP via router state (fast-path, tanpa fetch
  // ulang), plus ?ids sebagai fallback bila halaman di-refresh (state hilang).
  function goPrintQr() {
    if (selectedRows.length > 0) {
      navigate('/print-qr?ids=' + encodeURIComponent(selectedAssetIds.join(',')), {
        state: { assets: selectedRows },
      })
    } else {
      navigate('/print-qr')
    }
  }

  return (
    <>
      <PageHeader
        title="Manage Asset"
        description={description}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrintReport}
              disabled={reporting}
              aria-label="Export"
            >
              {reporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button asChild variant="outline">
              <Link to="/print-qr">
                <QrCode className="h-4 w-4" /> PRINT QR
              </Link>
            </Button>
            {pageInfo?.isNew ? (
              <Button asChild>
                <Link to="/assets/new">
                  <Plus className="h-4 w-4" /> NEW ASSET
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Search + filter + view toggle */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari Asset ID / nama / NIK / No. PO…"
            className="pl-9"
          />
        </div>

        {/* Advance Search toggle — opens the inline panel above the table. */}
        <Button
          variant="outline"
          className="shrink-0"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen((o) => !o)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Advance Search</span>
          {activeFilters > 0 && <Badge className="ml-1 h-5 min-w-5 px-1">{activeFilters}</Badge>}
        </Button>

        {/* PRINT QR — labelled with the pick count when any rows are selected. */}
        <Button variant="outline" className="shrink-0" onClick={goPrintQr}>
          <QrCode className="h-4 w-4" />
          <span className="hidden sm:inline">
            PRINT QR
            {selectedAssetIds.length > 0
              ? ` (${selectedAssetIds.length}/${STICKERS_PER_A4} dipilih)`
              : ''}
          </span>
        </Button>

        {/* Total records — mirrors the mockup's muted "{n} asset" text. */}
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {numberWithDots(total)} asset
        </span>

        {/* Sort control — always available on mobile, and on desktop when the
            card grid is active (the table sorts via its clickable headers). */}
        <div className={cn('shrink-0', view === 'table' && 'lg:hidden')}>
          <SortControl
            sortKey={sortKey}
            sortDir={sortDir}
            onChange={applySort}
          />
        </div>

        {/* Table ⇄ card-grid toggle (desktop only — mobile always uses cards) */}
        <div className="hidden shrink-0 items-center rounded-md border p-0.5 lg:flex">
          <button
            type="button"
            aria-label="Tampilan tabel"
            aria-pressed={view === 'table'}
            onClick={() => changeView('table')}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded',
              view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Rows3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Tampilan kartu"
            aria-pressed={view === 'cards'}
            onClick={() => changeView('cards')}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded',
              view === 'cards' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Advance Search — inline panel above the table (mockup: adv-panel).
          A flat 4-col grid of the 8 filters, in mockup order. Only mounts the
          (large) option lists while open so opening stays snappy. */}
      {filterOpen && (
        <Card className="mb-4 border-0 shadow-sm">
          <CardContent className="p-4">
            {/* Head: icon + title/subtext + close */}
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Search className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">Advance Search</h3>
                <p className="text-xs text-muted-foreground">
                  Kombinasikan beberapa parameter sekaligus, lalu tekan SEARCH
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup Advance Search"
                onClick={() => setFilterOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Flat grid — label + order exactly per mockup:
                Assign/Unassign, Status, User, Location, Department, Brand, Type, Company.
                NB: Type must stay the FIRST role=combobox in the panel
                (the IAT locates it via getByRole('combobox').first()) —
                it is, since the FilterSelect Selects precede it and User is a
                Combobox; the earliest Select trigger is Assign/Unassign. */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect
                label="Assign / Unassign"
                value={returnAsset}
                onChange={(v) => {
                  setReturnAsset(v)
                  setPage(1)
                }}
                options={RETURN_ASSET_OPTIONS}
              />
              <FilterSelect
                label="Status"
                value={status}
                onChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
                options={statusOptions}
              />
              <div className="space-y-1.5">
                <Label>User</Label>
                <Combobox
                  title="Pilih User"
                  placeholder="Semua User"
                  clearable
                  value={user === ALL ? '' : user}
                  onChange={(v) => {
                    setUser(v ? v : ALL)
                    setPage(1)
                  }}
                  options={userOptions}
                />
              </div>
              <FilterSelect
                label="Location"
                value={location}
                onChange={(v) => {
                  setLocation(v)
                  setPage(1)
                }}
                options={locationOptions}
              />
              <FilterSelect
                label="Department"
                value={department}
                onChange={(v) => {
                  setDepartment(v)
                  setPage(1)
                }}
                options={departmentOptions}
              />
              <FilterSelect
                label="Brand"
                value={brand}
                onChange={(v) => {
                  setBrand(v)
                  setPage(1)
                }}
                options={brandOptions}
              />
              <FilterSelect
                label="Type"
                value={type}
                onChange={(v) => {
                  setType(v)
                  setPage(1)
                }}
                options={typeOptions}
              />
              <FilterSelect
                label="Company"
                value={company}
                onChange={(v) => {
                  setCompany(v)
                  setPage(1)
                }}
                options={companyOptions}
              />
            </div>

            {/* Foot: source banner + RESET + SEARCH */}
            <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
              <span className="flex flex-1 items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Pilihan <b>User</b> &amp; <b>Department</b> bersumber dari HRIS; Status,
                  Location, Brand, Type dari Master Data. Hasil tetap dibatasi Management
                  scope akun Anda.
                </span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4" /> RESET
                </Button>
                <Button size="sm" onClick={() => setFilterOpen(false)}>
                  <Search className="h-4 w-4" /> SEARCH
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk action bar — shown when the page allows Return and ≥1 row is
          selected. Mirrors the legacy Datagrid "Return User" toolbar button. */}
      {canReturn && selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-2.5">
          <span className="text-sm text-foreground">
            {numberWithDots(selected.size)} aset dipilih
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Map())}>
              Batal Pilih
            </Button>
            <Button size="sm" onClick={() => setReturnOpen(true)}>
              <RotateCcw className="h-4 w-4" /> Return User
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Gagal memuat daftar aset</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <Loader2 className="h-3.5 w-3.5" /> Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <AssetListSkeleton view={view} />
      ) : data.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Tidak ada aset yang cocok.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table (view=table) */}
          {view === 'table' && (
            <Card className="hidden border-0 shadow-sm lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    {canSelect && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          onCheckedChange={(v) => toggleAll(v === true)}
                          aria-label="Pilih semua aset di halaman ini"
                        />
                      </TableHead>
                    )}
                    <SortableHead
                      label="Asset"
                      sortKey="assetId"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                    />
                    <TableHead>Pemegang (NIK)</TableHead>
                    <TableHead>Management</TableHead>
                    <TableHead>No. PO</TableHead>
                    <SortableHead
                      label="Lokasi"
                      sortKey="location"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                    />
                    <SortableHead
                      label="Status"
                      sortKey="status"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                    />
                    <TableHead className="w-10">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a, i) => (
                    <TableRow
                      key={assetRowKey(a, i)}
                      data-state={selected.has(a.IDX_M_Asset) ? 'selected' : undefined}
                    >
                      {canSelect && (
                        <TableCell>
                          <Checkbox
                            checked={selected.has(a.IDX_M_Asset)}
                            disabled={atSelectCap && !selected.has(a.IDX_M_Asset)}
                            onCheckedChange={(v) => toggleRow(a, v === true)}
                            aria-label={`Pilih aset ${a.AssetID}`}
                          />
                        </TableCell>
                      )}
                      {/* Aset: AssetID + Type · Model sebagai subteks (mockup gabung Type ke sel Asset) */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/assets/${encodeURIComponent(a.AssetID)}`}
                            className={cn(
                              'font-medium hover:underline',
                              assetDisabled(a)
                                ? 'text-muted-foreground line-through'
                                : 'text-primary',
                            )}
                          >
                            {a.AssetID}
                          </Link>
                          {assetDisabled(a) && <NonaktifBadge />}
                        </div>
                        {(a.AssetTypeName || a.AssetTypeModelName) && (
                          <div className="truncate text-xs text-muted-foreground">
                            {a.AssetTypeName}
                            {a.AssetTypeModelName ? ` · ${a.AssetTypeModelName}` : ''}
                          </div>
                        )}
                      </TableCell>
                      {/* Pemegang (NIK): nama + NIK subteks (NIK dari SP ALTER 008) */}
                      <TableCell className={cn(assetDisabled(a) && 'text-muted-foreground')}>
                        {a.CurrentAssetUser || '-'}
                        {a.CurrentAssetUserNIK && (
                          <span className="block font-mono text-xs text-muted-foreground">
                            NIK {a.CurrentAssetUserNIK}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{a.AssetManagementName || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{a.PONo || '-'}</TableCell>
                      <TableCell>{a.CurrentAssetLocation}</TableCell>
                      <TableCell>
                        <StatusBadge asset={a} />
                      </TableCell>
                      <TableCell>
                        <AssetActionsMenu asset={a} onChanged={refresh} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Desktop card grid (view=cards) — ~4 per row on wide screens */}
          {view === 'cards' && (
            <div className="hidden gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-4">
              {data.map((a, i) => (
                <AssetCard key={assetRowKey(a, i)} asset={a} onChanged={refresh} />
              ))}
            </div>
          )}

          {/* Mobile: always a card grid (1 col on phones, 2 on small tablets) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {data.map((a, i) => (
              <AssetCard key={assetRowKey(a, i)} asset={a} onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {!error && data.length > 0 && (
        <Pager
          page={pageInfo?.CurrentPage ?? page}
          maxPage={maxPage}
          disabled={loading}
          onChange={setPage}
        />
      )}

      {/* Bulk "Return User" confirm dialog (Remarks + selected AssetIDs). */}
      <BulkReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        rows={selectedRows}
        onDone={() => {
          setSelected(new Map())
          refresh()
        }}
      />
    </>
  )
}

/**
 * Bulk "Return User" confirm dialog. Shows the selected AssetIDs + a Remarks
 * field; on confirm POSTs /api/assets/return with the comma-joined IDX_M_Asset
 * ids (via returnAssets), then toasts and lets the caller clear + refresh.
 * Mirrors the legacy Datagrid return dialog.
 */
function BulkReturnDialog({
  open,
  onOpenChange,
  rows,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  rows: AssetRow[]
  onDone: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setRemarks('')
  }, [open])

  async function submit() {
    if (rows.length === 0) return
    setSubmitting(true)
    try {
      const msg = await returnAssets({
        IDX_M_Asset: rows.map((r) => r.IDX_M_Asset),
        Remarks: remarks,
      })
      toast.success(msg || `${rows.length} aset berhasil dikembalikan`)
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengembalikan aset')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return User</DialogTitle>
          <DialogDescription>
            Kembalikan {numberWithDots(rows.length)} aset berikut dari user saat ini.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Asset ID</Label>
            <div className="max-h-32 overflow-y-auto rounded-md border p-2">
              <div className="flex flex-wrap gap-1.5">
                {rows.map((r) => (
                  <Badge key={r.IDX_M_Asset} variant="secondary" className="font-normal">
                    {r.AssetID}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={submitting || rows.length === 0}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Windowed numbered pager: « ‹ 1 … 7 [8] 9 … 13953 › ». */
function Pager({
  page,
  maxPage,
  disabled,
  onChange,
}: {
  page: number
  maxPage: number
  disabled: boolean
  onChange: (p: number) => void
}) {
  const pages = pageWindow(page, maxPage)
  return (
    <nav className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        Halaman {numberWithDots(page)} / {numberWithDots(maxPage)}
      </span>
      <div className="flex items-center gap-1">
        <PagerBtn disabled={disabled || page <= 1} onClick={() => onChange(1)} label="Halaman pertama">
          «
        </PagerBtn>
        <PagerBtn disabled={disabled || page <= 1} onClick={() => onChange(page - 1)} label="Sebelumnya">
          ‹
        </PagerBtn>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              disabled={disabled}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'h-8 min-w-8 rounded-md px-2 text-sm tabular-nums transition-colors',
                p === page
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted disabled:opacity-50',
              )}
            >
              {p}
            </button>
          ),
        )}
        <PagerBtn disabled={disabled || page >= maxPage} onClick={() => onChange(page + 1)} label="Berikutnya">
          ›
        </PagerBtn>
        <PagerBtn disabled={disabled || page >= maxPage} onClick={() => onChange(maxPage)} label="Halaman terakhir">
          »
        </PagerBtn>
      </div>
    </nav>
  )
}

function PagerBtn({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean
  onClick: () => void
  label: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-foreground hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/** Page numbers to render: current ± 2, with first/last and ellipses. */
function pageWindow(page: number, maxPage: number): (number | '…')[] {
  const out: (number | '…')[] = []
  const push = (p: number) => out.push(p)
  const from = Math.max(2, page - 2)
  const to = Math.min(maxPage - 1, page + 2)
  push(1)
  if (from > 2) out.push('…')
  for (let p = from; p <= to; p++) push(p)
  if (to < maxPage - 1) out.push('…')
  if (maxPage > 1) push(maxPage)
  return out
}

function AssetListSkeleton({ view }: { view: View }) {
  if (view === 'cards') {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="divide-y p-0">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Skeleton className="h-4 w-32" />
            <div className="hidden flex-1 gap-4 sm:flex">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="ml-auto h-4 w-24" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** A clickable, accessible sortable column header with a caret indicator. */
function SortableHead({
  label,
  sortKey,
  activeKey,
  dir,
  onToggle,
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  dir: SortDir
  onToggle: (key: SortKey) => void
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        aria-label={`Urutkan berdasarkan ${label}${
          active ? (dir === 'asc' ? ', menaik' : ', menurun') : ''
        }`}
        aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          '-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden />
        )}
      </button>
    </TableHead>
  )
}

/**
 * Compact sort control for card view + mobile: a Select for the sort field
 * plus an asc/desc toggle button. Mirrors the table-header sorting.
 */
function SortControl({
  sortKey,
  sortDir,
  onChange,
}: {
  sortKey: SortKey
  sortDir: SortDir
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <Select value={sortKey} onValueChange={(v) => onChange(v as SortKey, sortDir)}>
        <SelectTrigger className="h-9 w-[132px] gap-1" aria-label="Urutkan berdasarkan">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_FIELDS) as SortKey[]).map((k) => (
            <SelectItem key={k} value={k}>
              {SORT_FIELDS[k].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        aria-label={sortDir === 'asc' ? 'Urutan menaik' : 'Urutan menurun'}
        aria-pressed={sortDir === 'desc'}
        onClick={() => onChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc')}
      >
        {sortDir === 'asc' ? (
          <ArrowUp className="h-4 w-4" />
        ) : (
          <ArrowDown className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  /** Text for the "all / none selected" item + placeholder. Default: `Semua ${label}`. */
  allLabel?: string
}) {
  // Some option lists are large (users ≈2,100). Only build the <SelectItem>s
  // while the dropdown is open so opening the Filter sheet stays snappy. The
  // "Semua" item + the currently-selected option are always rendered so the
  // trigger keeps its label even while closed.
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  const all = allLabel ?? `Semua ${label}`
  // Keep the "Semua …" placeholder text in the trigger even after a value is
  // picked: unset it reads "Semua Management"; set it reads "Semua Management ·
  // Corporate". This gives each select a STABLE, unique text handle (so it can
  // be targeted by its "Semua …" label regardless of selection) while still
  // showing the chosen value — a familiar "field: value" filter-chip pattern.
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger>
          {selected ? (
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <span className="shrink-0 text-muted-foreground">{all}</span>
              <span className="shrink-0 text-muted-foreground">·</span>
              <span className="truncate font-medium text-foreground">
                {selected.label}
              </span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{all}</span>
          )}
        </SelectTrigger>
        {/* Close instantly (no exit animation): a large option list (brand ≈800)
            otherwise keeps the popover mounted through its fade/zoom-out, which
            traps focus long enough that a follow-up Escape lands on the popover
            instead of the Filter sheet. Skipping the close animation returns
            focus to the sheet immediately so Escape reliably dismisses it. */}
        <SelectContent className="data-[state=closed]:animate-none data-[state=closed]:duration-0">
          <SelectItem value={ALL}>{all}</SelectItem>
          {open
            ? options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))
            : selected && (
                <SelectItem value={selected.value}>{selected.label}</SelectItem>
              )}
        </SelectContent>
      </Select>
    </div>
  )
}
