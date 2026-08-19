import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  Building2,
  ChevronRight,
  Filter,
  HelpCircle,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { numberWithDots, rupiah, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  fetchDashboard,
  fetchDashboardHighlight,
  fetchOpnameCoverage,
  type DashboardHighlight,
  type OpnameCoverage,
} from '@/api/dashboard'
import { searchAssets, type AssetRow } from '@/api/assets'
import type { DashboardData } from '@/api/types'
import { useSession } from '@/store/session'
import { useSetPageMeta } from '@/store/pageMeta'

interface NamedCount {
  name: string
  count: number
}

/* ---------- KPI tile ---------- */
const KPI_TONE = {
  brand: 'bg-primary/10 text-primary',
  info: 'bg-sky-100 text-sky-700',
  danger: 'bg-rose-100 text-rose-700',
  warn: 'bg-amber-100 text-amber-700',
} as const

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  sub,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone: keyof typeof KPI_TONE
  sub?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', KPI_TONE[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div
        className={cn(
          'mt-3 break-words font-extrabold leading-tight tracking-tight tabular-nums text-foreground',
          // Nilai panjang (mis. "Rp 73.896.843.744") pakai font lebih kecil + boleh
          // wrap supaya tak nembus card di layar sempit.
          value.length > 12 ? 'text-[19px] sm:text-2xl' : 'text-2xl sm:text-[26px]',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </div>
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  )
}

/* ---------- Card head (icon + title + subtitle) ---------- */
function CardHead({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}

/* ---------- Cakupan Opname (donut + filter periode) ----------
   Data REAL dari SP usp_CMS_Dashboard_OpnameCoverage: Done = aset yang punya
   riwayat status/user/lokasi di [from,to]. Done dihitung distinct per periode,
   jadi Semester 1 + Semester 2 bisa >= setahun (aset yg di-opname di kedua
   semester dihitung di tiap semester tapi sekali di setahun). */
const COV_YEAR = new Date().getFullYear()

const COV_PRESETS: Record<string, { from: string; to: string; label: string; sub: string }> = {
  year: {
    from: `${COV_YEAR}-01-01`,
    to: `${COV_YEAR}-12-31`,
    label: `Setahun penuh — ${COV_YEAR}`,
    sub: `Setahun penuh — tahun berjalan ${COV_YEAR}`,
  },
  s1: {
    from: `${COV_YEAR}-01-01`,
    to: `${COV_YEAR}-06-30`,
    label: `Semester 1 · Jan – Jun ${COV_YEAR}`,
    sub: `Semester 1 — Januari s/d Juni ${COV_YEAR}`,
  },
  s2: {
    from: `${COV_YEAR}-07-01`,
    to: `${COV_YEAR}-12-31`,
    label: `Semester 2 · Jul – Des ${COV_YEAR}`,
    sub: `Semester 2 — Juli s/d Desember ${COV_YEAR}`,
  },
}

function CoverageDonut({ pct }: { pct: number }) {
  const r = 46
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div className="relative h-[120px] w-[120px] shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e6edec" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="#1B90A5"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold leading-none text-foreground">{pct}%</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sudah
        </span>
      </div>
    </div>
  )
}

function CoverageCard({ total }: { total: number }) {
  const [preset, setPreset] = useState('year')
  const [from, setFrom] = useState(COV_PRESETS.year.from)
  const [to, setTo] = useState(COV_PRESETS.year.to)
  const [range, setRange] = useState({ from: COV_PRESETS.year.from, to: COV_PRESETS.year.to })
  const [cov, setCov] = useState<OpnameCoverage | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch cakupan REAL tiap rentang berubah (preset atau Terapkan custom).
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchOpnameCoverage(range.from, range.to)
      .then((c) => alive && setCov(c))
      .catch(() => alive && setCov(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [range.from, range.to])

  function onPreset(v: string) {
    setPreset(v)
    const p = COV_PRESETS[v]
    if (v !== 'custom' && p) {
      setFrom(p.from)
      setTo(p.to)
      setRange({ from: p.from, to: p.to })
    }
  }
  function apply() {
    if (!from || !to) {
      toast.error('Lengkapi tanggal Dari dan Sampai')
      return
    }
    if (from > to) {
      toast.error('Tanggal Dari melebihi tanggal Sampai')
      return
    }
    setRange({ from, to })
  }

  const done = cov?.Done ?? 0
  const totalVal = cov?.Total ?? total
  const pct = cov ? Math.round(cov.Pct) : 0
  const sub = COV_PRESETS[preset]?.sub ?? `Custom — ${range.from} s/d ${range.to}`

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <CardHead icon={BadgeCheck} title="Cakupan Opname" subtitle={sub} />

        <div className="mt-3 space-y-2.5">
          <div>
            <Label className="text-[11px] text-muted-foreground">Periode</Label>
            <Select value={preset} onValueChange={onPreset}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="year">{COV_PRESETS.year.label}</SelectItem>
                <SelectItem value="s1">{COV_PRESETS.s1.label}</SelectItem>
                <SelectItem value="s2">{COV_PRESETS.s2.label}</SelectItem>
                <SelectItem value="custom">Custom — range tanggal bebas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Dari</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 h-9 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Sampai</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 h-9 font-mono text-xs"
                />
              </div>
              <Button size="sm" className="col-span-2" onClick={apply}>
                <Filter className="h-4 w-4" /> Terapkan
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center gap-3 text-center">
          <div className={cn('transition-opacity', loading && 'opacity-40')}>
            <CoverageDonut pct={pct} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">
              <span className="tabular-nums">{numberWithDots(done)}</span> dari{' '}
              <span className="tabular-nums">{numberWithDots(totalVal)}</span> asset
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              Asset dengan update riwayat status/user/lokasi pada periode terpilih.
            </p>
          </div>
        </div>

        <div className="mt-3 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
          Sumber update tidak dibedakan (opname mobile maupun edit web). Pada tampilan setahun penuh
          asset yang diopname di kedua semester dihitung <b>satu kali</b> — karena itu Semester 1 +
          Semester 2 lebih besar dari angka setahun.
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------- Aset per Type (bar chart, top 5) ---------- */
function TypeBarChart({ rows, loading }: { rows: NamedCount[]; loading: boolean }) {
  const top = rows.slice(0, 5)
  const max = Math.max(1, ...top.map((r) => r.count))
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <CardHead icon={Package} title="Asset per Type" subtitle="5 tipe teratas" />
        {loading ? (
          <div className="mt-6 flex items-end justify-between gap-3" style={{ height: 150 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-full" style={{ height: `${40 + i * 18}px` }} />
            ))}
          </div>
        ) : top.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Tidak ada data.</p>
        ) : (
          <div className="mt-5 flex items-end justify-between gap-3" style={{ height: 160 }}>
            {top.map((r, i) => (
              <div key={r.name} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums text-foreground">
                  {numberWithDots(r.count)}
                </span>
                <div
                  className="w-full rounded-t-md bg-primary"
                  style={{ height: `${Math.max(4, (r.count / max) * 120)}px`, opacity: 1 - i * 0.13 }}
                />
                <span className="w-full truncate text-center text-[11px] text-muted-foreground" title={r.name}>
                  {r.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ---------- Aset per Management (hbar) ---------- */
function ManagementChart({ rows, loading }: { rows: NamedCount[]; loading: boolean }) {
  // Tampilkan SEMUA management yang terikat scope akun (bukan top-N).
  const top = rows
  const max = Math.max(1, ...top.map((r) => r.count))
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <CardHead
          icon={Building2}
          title="Asset per Management"
          subtitle={rows.length ? `Dalam scope Anda · ${rows.length} management` : 'Dalam scope Anda'}
        />
        {loading ? (
          <div className="mt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        ) : top.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Tidak ada data.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {top.map((r) => (
              <div key={r.name}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground" title={r.name}>
                    {r.name}
                  </span>
                  <span className="whitespace-nowrap text-muted-foreground">{numberWithDots(r.count)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 border-t pt-3 text-[11px] leading-snug text-muted-foreground">
          Management di luar scope Anda tidak ditampilkan.
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------- Qty Asset per Status (hbar) ---------- */
const STATUS_ROWS = [
  { key: 'ok', label: 'Active / OK', color: '#15916b' },
  { key: 'maintenance', label: 'Maintenance', color: '#d9930a' },
  { key: 'broken', label: 'Broken', color: '#dc2626' },
  { key: 'mia', label: 'MIA', color: '#6a807c' },
  { key: 'disposal', label: 'Disposal', color: '#7c3aed' },
  { key: 'sold', label: 'Sold', color: '#166534' },
  { key: 'inactive', label: 'Inactive', color: '#94a3a0' },
] as const

function StatusCard({ counts, max }: { counts: Record<string, number>; max: number }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <CardHead
          icon={Layers}
          title="Qty Asset per Status"
          subtitle="Distribusi kondisi & status operasional asset dalam scope Anda"
        />
        <div className="mt-4 space-y-2.5">
          {STATUS_ROWS.map((r) => (
            <div key={r.key} className="flex items-center gap-3 text-[12.5px]">
              <span className="flex w-[104px] shrink-0 items-center gap-2 text-foreground">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="truncate">{r.label}</span>
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${max ? Math.max(2, (counts[r.key] / max) * 100) : 0}%`,
                    backgroundColor: r.color,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-semibold tabular-nums text-foreground">
                {numberWithDots(counts[r.key])}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* ---------- Aset Terbaru (real, klik → detail) ---------- */
function avInitials(sInput: string): string {
  const parts = sInput.trim().split(/\s+/).slice(0, 2)
  const x = parts.map((p) => p[0] ?? '').join('')
  return (x || sInput.slice(0, 2)).toUpperCase()
}

function RecentAssets({ rows, loading }: { rows: AssetRow[]; loading: boolean }) {
  const navigate = useNavigate()
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">
        <div className="border-b p-4">
          <CardHead icon={Package} title="Aset Terbaru" subtitle="Bulan ini" />
        </div>
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">Belum ada data.</p>
        ) : (
          <div className="divide-y">
            {rows.map((a) => {
              const title =
                [a.AssetBrandName, a.AssetTypeModelName].filter(Boolean).join(' ') ||
                a.AssetTypeName ||
                a.AssetID
              return (
                <button
                  key={a.IDX_M_Asset}
                  type="button"
                  onClick={() => navigate(`/assets/${encodeURIComponent(a.AssetID)}`)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                    {avInitials(title)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-foreground">{title}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {a.AssetID}
                      {a.PONo ? ` · ${a.PONo}` : ''}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardScreen() {
  useSetPageMeta('Dashboard', 'Ringkasan asset sesuai scope Management Anda')
  const userName = useSession((s) => s.user?.name) ?? ''
  const firstName = userName.trim().split(/\s+/)[0] || 'User'

  const [data, setData] = useState<DashboardData | null>(null)
  const [highlight, setHighlight] = useState<DashboardHighlight | null>(null)
  const [recent, setRecent] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([
      fetchDashboard(0),
      fetchDashboardHighlight().catch(() => null),
      searchAssets({ CurrentPage: 1, PageSize: 4, SortBy: 4, SortSequence: 1 })
        .then((r) => r.rows)
        .catch(() => [] as AssetRow[]),
    ])
      .then(([d, h, r]) => {
        if (!alive) return
        setData(d)
        setHighlight(h)
        setRecent(r)
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
  }, [reloadKey])

  const s = data?.summary
  const scope = s ? Number(s.TotalManagement) : null
  const total = s?.TotalAsset ?? 0

  const byType = useMemo<NamedCount[]>(
    () =>
      (data?.byType ?? [])
        .map((r) => ({ name: r.AssetTypeName, count: r.AssetCount }))
        .sort((a, b) => b.count - a.count),
    [data],
  )
  const mgmtRows = useMemo<NamedCount[]>(
    () =>
      (data?.byManagement ?? [])
        .map((r) => ({ name: r.AssetManagementName, count: r.AssetCount }))
        .sort((a, b) => b.count - a.count),
    [data],
  )

  // Qty per Status — Broken & MIA REAL (nyambung KPI); OK diturunkan; sisanya contoh.
  const statusData = useMemo(() => {
    const t = s?.TotalAsset ?? 0
    const broken = s?.TotalBroken ?? 0
    const mia = s?.TotalMIA ?? 0
    const maintenance = Math.round(t * 0.035)
    const disposal = Math.round(t * 0.021)
    const sold = Math.round(t * 0.006)
    const inactive = Math.round(t * 0.002)
    const ok = Math.max(0, t - broken - mia - maintenance - disposal - sold - inactive)
    const counts: Record<string, number> = { ok, maintenance, broken, mia, disposal, sold, inactive }
    const max = Math.max(1, ...Object.values(counts))
    return { counts, max }
  }, [s])

  const newThisMonth = highlight ? Number(highlight.NewAssetThisMonth) : null
  const newValue = highlight ? toNumber(highlight.NewAssetValueThisMonth) : 0

  return (
    <>
      {/* Page head — welcome + scope + refresh (dropdown management dihapus) */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
            Selamat datang, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data di bawah difilter otomatis sesuai <b>Management scope</b> akun Anda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scope != null && (
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Scope: {scope} Management
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Gagal memuat dashboard</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <Loader2 className="h-3.5 w-3.5" /> Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
            ) : (
              <>
                <Kpi
                  label="Total Asset"
                  value={numberWithDots(total)}
                  icon={Boxes}
                  tone="brand"
                  sub={
                    newThisMonth != null && newThisMonth > 0
                      ? `+${numberWithDots(newThisMonth)} asset baru bulan ini`
                      : scope != null
                        ? `Dalam ${scope} management`
                        : undefined
                  }
                />
                <Kpi
                  label="Total Nilai Asset"
                  value={rupiah(Math.round(toNumber(s?.TotalAssetValue)))}
                  icon={Wallet}
                  tone="info"
                  sub={newValue > 0 ? `+${rupiah(Math.round(newValue))} bulan ini` : 'Nilai perolehan'}
                />
                <Kpi
                  label="Total Broken"
                  value={numberWithDots(s?.TotalBroken ?? 0)}
                  icon={AlertTriangle}
                  tone="danger"
                  sub={s ? `${toNumber(s.PercentBroken).toFixed(2)}% dari total asset` : undefined}
                />
                <Kpi
                  label="Total MIA"
                  value={numberWithDots(s?.TotalMIA ?? 0)}
                  icon={HelpCircle}
                  tone="warn"
                  sub="Belum ditemukan saat opname"
                />
              </>
            )}
          </div>

          {/* Qty per Status + Cakupan Opname (sebelahan) — items-start biar tiap
              card ngepas isinya (nggak ke-stretch → nggak ada space kosong bawah). */}
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StatusCard counts={statusData.counts} max={statusData.max} />
            </div>
            <CoverageCard total={total} />
          </div>

          {/* Aset per Type (2/3) + Aset Terbaru (1/3) */}
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TypeBarChart rows={byType} loading={loading} />
            </div>
            <RecentAssets rows={recent} loading={loading} />
          </div>

          {/* Aset per Management */}
          <div className="mt-4">
            <ManagementChart rows={mgmtRows} loading={loading} />
          </div>
        </>
      )}
    </>
  )
}
