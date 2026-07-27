import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Pencil, History, AlertCircle, Loader2, MoreVertical } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { rupiah, formatDate, toNumber } from '@/lib/format'
import { statusColorClass } from '@/lib/assetStatus'
import {
  fetchAssetByID,
  fetchAssetHistory,
  type AssetRow,
  type HistoryGroup,
} from '@/api/assets'
import { AssetActionsMenu } from './AssetActions'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/60 py-2.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value || '-'}</dd>
    </div>
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

  // Fetch the asset detail. On success, chain the history load off its IDX.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setAsset(null)
    setHistory([])
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
            .catch(() => {
              // Non-fatal: the detail still renders without history.
            })
            .finally(() => {
              if (alive) setHistoryLoading(false)
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

  return (
    <>
      <PageHeader
        title={asset.AssetID}
        description={[asset.AssetTypeName, asset.AssetTypeModelName].filter(Boolean).join(' · ')}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/assets">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Link>
            </Button>
            <Button asChild>
              <Link to={`/assets/${encodeURIComponent(asset.AssetID)}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
            <AssetActionsMenu
              asset={asset}
              onChanged={() => setReloadKey((k) => k + 1)}
              trigger={
                <Button variant="outline" size="icon" aria-label="Aksi lainnya">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* QR + quick status */}
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="rounded-xl border p-4">
              <QRCodeSVG value={asset.AssetID} size={168} />
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">{asset.AssetID}</div>
              <div
                className={`mt-1 inline-flex items-center gap-1.5 text-sm font-medium ${statusColorClass(
                  asset.CurrentColorAssetStatus,
                )}`}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                {asset.CurrentAssetStatus || '-'}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              Cetak QR
            </Button>
          </CardContent>
        </Card>

        {/* Detail fields */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-6">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              <Field label="Type" value={asset.AssetTypeName} />
              <Field label="Model" value={asset.AssetTypeModelName} />
              <Field label="Brand" value={asset.AssetBrandName} />
              <Field label="Color" value={asset.AssetColorName} />
              <Field label="Size" value={asset.AssetSizeName} />
              <Field label="Company" value={asset.CompanyName} />
              <Field label="Management" value={asset.AssetManagementName} />
              <Field label="Department" value={asset.CurrentAssetDepartment} />
              <Field label="User" value={asset.CurrentAssetUser} />
              <Field label="Location" value={asset.CurrentAssetLocation} />
              <Field label="PO No" value={asset.PONo} />
              <Field label="PO Date" value={formatDate(asset.PODate)} />
              <Field
                label="Nilai"
                value={
                  asset.Currency && asset.Currency !== 'IDR'
                    ? `${asset.Currency} ${rupiah(Math.round(toNumber(asset.UnitPrice))).replace('Rp ', '')}`
                    : rupiah(Math.round(toNumber(asset.UnitPrice)))
                }
              />
              <Field label="Tanggal Aset" value={formatDate(asset.AssetDate)} />
              <Field label="Remarks" value={asset.Remarks} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <div className="mt-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <History className="h-4 w-4" /> Riwayat
        </h2>
        {historyLoading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : history.every((g) => g.entries.length === 0) ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada riwayat.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {history
              .filter((group) => group.entries.length > 0)
              .map((group) => (
                <Card key={group.title} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="mb-3 text-sm font-semibold text-foreground">{group.title}</h3>
                    <ol className="space-y-3">
                      {group.entries.map((e, i) => (
                        <li key={i} className="border-l-2 border-primary/30 pl-3">
                          <div className="text-sm font-medium text-foreground">{e.value}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(e.startDate)}
                            {' – '}
                            {e.endDate ? formatDate(e.endDate) : 'sekarang'}
                          </div>
                          {e.remarks && (
                            <div className="text-xs text-muted-foreground">{e.remarks}</div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </>
  )
}

function DetailSkeleton() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-0 shadow-sm lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <Skeleton className="h-44 w-44" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="grid gap-x-8 gap-y-3 p-6 sm:grid-cols-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
