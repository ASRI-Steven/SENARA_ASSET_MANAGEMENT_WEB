import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, Search, AlertCircle, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { searchAssets, type AssetRow } from '@/api/assets'

const PAGE_SIZE = 30

/**
 * Stable per-row key. AssetID is NOT unique in the grid (distinct rows can share
 * an AssetID), so key selection/render by IDX_M_Asset + RunningNumber instead.
 */
function assetKey(a: AssetRow): string {
  return `${a.IDX_M_Asset}-${a.RunningNumber}`
}

export default function PrintQrScreen() {
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Selected assets are kept as full rows (keyed by AssetID) so the print sheet
  // can render even after the search list changes underneath the selection.
  const [chosen, setChosen] = useState<Map<string, AssetRow>>(new Map())

  // Debounce the search box into the request keyword.
  useEffect(() => {
    const t = setTimeout(() => setKeyword(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    searchAssets({ CurrentPage: 1, PageSize: PAGE_SIZE, Keyword: keyword || undefined })
      .then((res) => {
        if (id !== reqId.current) return
        setAssets(res.rows)
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return
        setAssets([])
        setError(e instanceof Error ? e.message : 'Gagal memuat aset')
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [keyword, reloadKey])

  const chosenList = Array.from(chosen.values())

  function toggle(a: AssetRow) {
    setChosen((prev) => {
      const next = new Map(prev)
      const k = assetKey(a)
      if (next.has(k)) next.delete(k)
      else next.set(k, a)
      return next
    })
  }

  function selectAllVisible() {
    setChosen((prev) => {
      const next = new Map(prev)
      assets.forEach((a) => next.set(assetKey(a), a))
      return next
    })
  }

  return (
    <>
      <PageHeader
        title="Print QR"
        description="Pilih aset, lalu cetak / simpan sebagai PDF"
        action={
          <Button disabled={chosenList.length === 0} onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak ({chosenList.length})
          </Button>
        }
      />

      {/* Selection panel — hidden on print */}
      <div className="no-print">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari AssetID / model / user…"
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={selectAllVisible} disabled={loading || assets.length === 0}>
            Pilih semua
          </Button>
          <Button variant="outline" onClick={() => setChosen(new Map())} disabled={chosenList.length === 0}>
            Kosongkan
          </Button>
        </div>

        {error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">Gagal memuat aset</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              </div>
              <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                <Loader2 className="h-3.5 w-3.5" /> Coba lagi
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="grid max-h-80 grid-cols-1 gap-1 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              ) : assets.length === 0 ? (
                <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                  Tidak ada aset yang cocok.
                </p>
              ) : (
                assets.map((a) => (
                  <label
                    key={assetKey(a)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
                  >
                    <Checkbox
                      checked={chosen.has(assetKey(a))}
                      onCheckedChange={() => toggle(a)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{a.AssetID}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.AssetTypeName}
                        {a.AssetTypeModelName ? ` · ${a.AssetTypeModelName}` : ''}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {chosenList.length === 0 && !loading && !error && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Belum ada aset dipilih. Centang aset di atas untuk melihat pratinjau cetak.
          </p>
        )}
      </div>

      {/* Print area — the only thing visible when printing */}
      {chosenList.length > 0 && (
        <div className="print-area mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {chosenList.map((a) => (
              <div
                key={assetKey(a)}
                className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center"
              >
                <QRCodeSVG value={a.AssetID} size={120} />
                <div>
                  <div className="text-sm font-semibold text-foreground">{a.AssetID}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.AssetTypeName}
                    {a.AssetTypeModelName ? ` · ${a.AssetTypeModelName}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
