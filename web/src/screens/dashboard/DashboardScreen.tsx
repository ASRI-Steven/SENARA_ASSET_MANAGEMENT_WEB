import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
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
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
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
          <div className="space-y-3">
            {rows.map((r) => (
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
      </CardContent>
    </Card>
  )
}

/** Take the top N rows by asset count and normalise the numeric-string value. */
function topRows(
  src: { AssetCount: number; TotalAssetValue: string }[],
  nameOf: (r: never) => string,
  n = 6,
): BreakdownRow[] {
  return src.slice(0, n).map((r) => ({
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
    () => topRows(data?.byCompany ?? [], (r: { CompanyName: string }) => r.CompanyName),
    [data],
  )
  const byType = useMemo(
    () => topRows(data?.byType ?? [], (r: { AssetTypeName: string }) => r.AssetTypeName),
    [data],
  )
  const byLocation = useMemo(
    () => topRows(data?.byLocation ?? [], (r: { AssetLocationName: string }) => r.AssetLocationName),
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
            <BreakdownPanel
              title="Aset per Type Model (Top 6)"
              rows={topRows(
                data?.byTypeModel ?? [],
                (r: { AssetTypeModelName: string }) => r.AssetTypeModelName,
              )}
              loading={loading}
            />
          </div>
        </>
      )}
    </>
  )
}
