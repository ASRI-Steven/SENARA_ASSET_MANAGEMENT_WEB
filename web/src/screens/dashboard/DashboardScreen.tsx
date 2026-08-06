import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { numberWithDots, rupiah, toNumber } from '@/lib/format'
import { fetchDashboard, fetchManagements } from '@/api/dashboard'
import type { DashboardData, ManagementOption } from '@/api/types'

interface ScoreCardModel {
  label: string
  value: string
  color: string
  hint?: string
}

interface BreakdownRow {
  name: string
  count: number
  value: number
}

function ScoreCard({ card }: { card: ScoreCardModel }) {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: card.color }} />
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
        <p className="mt-1 text-2xl font-semibold text-foreground">{card.value}</p>
        <div className="mt-1 flex items-center justify-end text-xs">
          <span className="text-muted-foreground">{card.hint ?? ' '}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreCardSkeleton() {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="h-1.5 bg-muted" />
      <CardContent className="space-y-2 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  )
}

const PANEL_PAGE_SIZE = 6

/**
 * Breakdown panel with its own search box + pagination. Receives the FULL row
 * set (no top-N truncation); filters by name and pages locally so a management
 * with hundreds of companies/types/locations is fully browsable. The bar scale
 * (`max`) is taken over ALL rows so widths stay comparable across pages.
 */
function BreakdownPanel({
  title,
  rows,
  loading,
  showValue = true,
}: {
  title: string
  rows: BreakdownRow[]
  loading: boolean
  showValue?: boolean
}) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  // Reset search + page whenever the underlying rows change (e.g. the dashboard
  // management filter switched) — otherwise a stale search term can leave the
  // panel showing "Tidak ada yang cocok" (empty) for the new data set.
  useEffect(() => {
    setQ('')
    setPage(1)
  }, [rows])

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return kw ? rows.filter((r) => r.name.toLowerCase().includes(kw)) : rows
  }, [rows, q])

  const max = useMemo(() => Math.max(...rows.map((r) => r.count), 1), [rows])
  const maxPage = Math.max(1, Math.ceil(filtered.length / PANEL_PAGE_SIZE))
  const current = Math.min(page, maxPage)
  const pageRows = filtered.slice((current - 1) * PANEL_PAGE_SIZE, current * PANEL_PAGE_SIZE)

  // Reset to page 1 whenever the search term changes.
  function onSearch(v: string) {
    setQ(v)
    setPage(1)
  }

  return (
    <Card className="border-0 shadow-sm" data-testid={`panel-${title}`}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {!loading && rows.length > 0 && (
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {numberWithDots(filtered.length)} item
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Tidak ada data.</p>
        ) : (
          <>
            {/* Search — only shown when there's enough to warrant it */}
            {rows.length > PANEL_PAGE_SIZE && (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder={`Cari ${title.replace(/^Aset per\s*/i, '').toLowerCase()}…`}
                  className="h-8 pl-8 text-xs"
                  aria-label={`Cari di ${title}`}
                />
              </div>
            )}

            {pageRows.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Tidak ada yang cocok.
              </p>
            ) : (
              <div className="space-y-3">
                {pageRows.map((r) => (
                  <div key={r.name}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-foreground" title={r.name}>
                        {r.name}
                      </span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {numberWithDots(r.count)}
                        {showValue && ` · ${rupiah(Math.round(r.value))}`}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(r.count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination — only when more than one page */}
            {maxPage > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Hal {current}/{maxPage}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Sebelumnya"
                    disabled={current <= 1}
                    onClick={() => setPage(current - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Berikutnya"
                    disabled={current >= maxPage}
                    onClick={() => setPage(current + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Map the raw breakdown rows (numeric-string value) — full set, no truncation. */
function mapRows(
  src: { AssetCount: number; TotalAssetValue: string }[],
  nameOf: (r: never) => string,
): BreakdownRow[] {
  return src.map((r) => ({
    name: nameOf(r as never),
    count: r.AssetCount,
    value: toNumber(r.TotalAssetValue),
  }))
}

export default function DashboardScreen() {
  const [managements, setManagements] = useState<ManagementOption[]>([])
  const [mgmt, setMgmt] = useState('0') // "0" = All (idx from BFF)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Load the management dropdown once.
  useEffect(() => {
    let alive = true
    fetchManagements()
      .then((list) => {
        if (alive) setManagements(list)
      })
      .catch(() => {
        // Non-fatal: the dropdown just falls back to "All"; dashboard still loads.
      })
    return () => {
      alive = false
    }
  }, [])

  // Load dashboard data whenever the selected management changes.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetchDashboard(Number(mgmt))
      .then((d) => {
        if (alive) setData(d)
      })
      .catch((e: unknown) => {
        if (alive) {
          setData(null)
          setError(e instanceof Error ? e.message : 'Gagal memuat dashboard')
        }
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [mgmt, reloadKey])

  const scoreCards = useMemo<ScoreCardModel[]>(() => {
    const s = data?.summary
    return [
      {
        label: 'Total Asset',
        value: numberWithDots(s?.TotalAsset ?? 0),
        color: '#1B90A5',
      },
      {
        label: 'Nilai Asset',
        value: rupiah(Math.round(toNumber(s?.TotalAssetValue))),
        color: '#3B3A8F',
      },
      {
        label: 'Broken',
        value: numberWithDots(s?.TotalBroken ?? 0),
        color: '#E4572E',
        hint: s ? `${toNumber(s.PercentBroken).toFixed(2)}% dari total` : undefined,
      },
      {
        label: 'MIA',
        value: numberWithDots(s?.TotalMIA ?? 0),
        color: '#7C5CBF',
        hint: s ? `${toNumber(s.PercentMIA).toFixed(2)}% dari total` : undefined,
      },
    ]
  }, [data])

  const byCompany = useMemo(
    () => mapRows(data?.byCompany ?? [], (r: { CompanyName: string }) => r.CompanyName),
    [data],
  )
  const byType = useMemo(
    () => mapRows(data?.byType ?? [], (r: { AssetTypeName: string }) => r.AssetTypeName),
    [data],
  )
  const byLocation = useMemo(
    () => mapRows(data?.byLocation ?? [], (r: { AssetLocationName: string }) => r.AssetLocationName),
    [data],
  )
  const byTypeModel = useMemo(
    () =>
      mapRows(data?.byTypeModel ?? [], (r: { AssetTypeModelName: string }) => r.AssetTypeModelName),
    [data],
  )

  // The BFF's "All" option (idx 0) is surfaced as the Bahasa "Semua Management"
  // label in both the trigger and the dropdown list.
  const labelFor = (m: ManagementOption) =>
    m.IDX_M_AssetManagement === 0 ? 'Semua Management' : m.AssetManagementName

  const selectedName =
    (() => {
      const found = managements.find((m) => String(m.IDX_M_AssetManagement) === mgmt)
      return found ? labelFor(found) : 'Semua Management'
    })()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan aset per management"
        action={
          <Select value={mgmt} onValueChange={setMgmt}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Semua Management">{selectedName}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {managements.length === 0 ? (
                <SelectItem value="0">Semua Management</SelectItem>
              ) : (
                managements.map((m) => (
                  <SelectItem
                    key={m.IDX_M_AssetManagement}
                    value={String(m.IDX_M_AssetManagement)}
                  >
                    {labelFor(m)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        }
      />

      {error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Gagal memuat dashboard</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Loader2 className="h-3.5 w-3.5" /> Coba lagi
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <ScoreCardSkeleton key={i} />)
              : scoreCards.map((c) => <ScoreCard key={c.label} card={c} />)}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <BreakdownPanel title="Aset per Company" rows={byCompany} loading={loading} />
            <BreakdownPanel title="Aset per Type" rows={byType} loading={loading} />
            <BreakdownPanel title="Aset per Location" rows={byLocation} loading={loading} />
            <BreakdownPanel title="Aset per Type Model" rows={byTypeModel} loading={loading} />
          </div>
        </>
      )}
    </>
  )
}
