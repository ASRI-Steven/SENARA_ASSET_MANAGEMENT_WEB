import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
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
} from 'lucide-react'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { numberWithDots, rupiah, toNumber } from '@/lib/format'
import { statusColorClass } from '@/lib/assetStatus'
import {
  searchAssets,
  fetchAssetLookups,
  type AssetRow,
  type AssetPage,
  type AssetLookups,
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
  location: { index: 2, label: 'Location' },
}
const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: 'assetId', dir: 'asc' }

function assetRowKey(a: AssetRow, i: number): string {
  return `${a.IDX_M_Asset}-${a.RunningNumber ?? i}`
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
          <Link
            to={`/assets/${encodeURIComponent(asset.AssetID)}`}
            className="truncate font-semibold text-primary hover:underline"
          >
            {asset.AssetID}
          </Link>
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
  // Search input (debounced into `keyword`, which drives the request).
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [type, setType] = useState(ALL) // holds IDX as string, or "all"
  const [status, setStatus] = useState(ALL)
  const [location, setLocation] = useState(ALL)
  const [user, setUser] = useState(ALL) // holds IDX_M_AssetUser as string, or "all"
  const [brand, setBrand] = useState(ALL) // holds IDX_M_AssetBrand as string, or "all"
  const [department, setDepartment] = useState(ALL) // holds DepartmentName, or "all"
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

  // Keep the latest request identity so stale responses are ignored.
  const reqId = useRef(0)

  // Fetch the grid whenever any query input changes.
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    searchAssets({
      CurrentPage: page,
      PageSize: PAGE_SIZE,
      Keyword: keyword || undefined,
      IDX_M_AssetType: type !== ALL ? Number(type) : undefined,
      IDX_M_AssetStatus: status !== ALL ? Number(status) : undefined,
      IDX_M_AssetLocation: location !== ALL ? Number(location) : undefined,
      IDX_M_AssetUser: user !== ALL ? Number(user) : undefined,
      IDX_M_AssetBrand: brand !== ALL ? Number(brand) : undefined,
      DepartmentName: department !== ALL ? department : undefined,
      SortBy: SORT_FIELDS[sortKey].index,
      SortSequence: SEQ[sortDir],
    })
      .then((res) => {
        if (id !== reqId.current) return
        setData(res.rows)
        setPageInfo(res.page)
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
  }, [keyword, type, status, location, user, brand, department, sortKey, sortDir, page, reloadKey])

  const maxPage = pageInfo?.MaxPage ?? 1
  const total = pageInfo?.TotalRecords ?? 0
  const activeFilters = [type, status, location, user, brand, department].filter(
    (v) => v !== ALL,
  ).length

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
  const userOptions = useMemo(
    () =>
      lookups?.users.map((u) => ({
        value: String(u.IDX_M_AssetUser),
        label: u.AssetUserName,
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

  function resetFilters() {
    setType(ALL)
    setStatus(ALL)
    setLocation(ALL)
    setUser(ALL)
    setBrand(ALL)
    setDepartment(ALL)
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

  return (
    <>
      <PageHeader
        title="Manage Asset"
        description={description}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/print-qr">
                <QrCode className="h-4 w-4" /> Print QR
              </Link>
            </Button>
            {pageInfo?.isNew ? (
              <Button asChild>
                <Link to="/assets/new">
                  <Plus className="h-4 w-4" /> Tambah Aset
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
            placeholder="Cari AssetID, model, user…"
            className="pl-9"
          />
        </div>

        <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="shrink-0">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilters > 0 && <Badge className="ml-1 h-5 min-w-5 px-1">{activeFilters}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Filter Aset</SheetTitle>
            </SheetHeader>
            {/* Only mount the (large) option lists while the sheet is open. */}
            {filterOpen && (
              <div className="flex-1 space-y-4 overflow-y-auto pr-1">
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
                  label="Status"
                  value={status}
                  onChange={(v) => {
                    setStatus(v)
                    setPage(1)
                  }}
                  options={statusOptions}
                />
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
                  label="User"
                  value={user}
                  onChange={(v) => {
                    setUser(v)
                    setPage(1)
                  }}
                  options={userOptions}
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
                  label="Department"
                  value={department}
                  onChange={(v) => {
                    setDepartment(v)
                    setPage(1)
                  }}
                  options={departmentOptions}
                />
              </div>
            )}
            <Button variant="outline" className="mt-4 w-full shrink-0" onClick={resetFilters}>
              Reset Filter
            </Button>
          </SheetContent>
        </Sheet>

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
                    <SortableHead
                      label="Asset ID"
                      sortKey="assetId"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                    />
                    <TableHead>Type / Model</TableHead>
                    <SortableHead
                      label="Status"
                      sortKey="status"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                    />
                    <TableHead>User</TableHead>
                    <SortableHead
                      label="Location"
                      sortKey="location"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                    />
                    <TableHead className="text-right">Nilai</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((a, i) => (
                    <TableRow key={assetRowKey(a, i)}>
                      <TableCell>
                        <Link
                          to={`/assets/${encodeURIComponent(a.AssetID)}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {a.AssetID}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{a.AssetTypeName}</div>
                        <div className="text-xs text-muted-foreground">{a.AssetTypeModelName}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge asset={a} />
                      </TableCell>
                      <TableCell>{a.CurrentAssetUser}</TableCell>
                      <TableCell>{a.CurrentAssetLocation}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rupiah(Math.round(toNumber(a.UnitPrice)))}
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
    </>
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  // Some option lists are large (users ≈2,100). Only build the <SelectItem>s
  // while the dropdown is open so opening the Filter sheet stays snappy. The
  // "Semua" item + the currently-selected option are always rendered so the
  // trigger keeps its label even while closed.
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} open={open} onOpenChange={setOpen}>
        <SelectTrigger>
          <SelectValue placeholder={`Semua ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua {label}</SelectItem>
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
