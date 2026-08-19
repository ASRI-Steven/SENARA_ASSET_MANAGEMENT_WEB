import { useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Printer, Search, AlertCircle, Loader2, Download, QrCode } from 'lucide-react'
import jsPDF from 'jspdf'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { searchAssets, fetchAssetByID, type AssetRow } from '@/api/assets'
import { A4, STICKERS_PER_A4 } from '@/lib/printQr'

const PAGE_SIZE = 30

// Dimensi A4 (mm) + kapasitas — sumber tunggal di lib/printQr.
const A4_MARGIN = A4.MARGIN
const A4_GAP = A4.GAP
const CARD_H = A4.CARD_H
const COLS = A4.COLS
// Kapasitas maksimal barcode dalam 1 halaman A4 (grid 2 kolom) = 16.
const MAX_PER_A4 = STICKERS_PER_A4

/**
 * Stable per-row key. AssetID is NOT unique in the grid (distinct rows can share
 * an AssetID), so key selection/render by IDX_M_Asset + RunningNumber instead.
 */
function assetKey(a: AssetRow): string {
  return `${a.IDX_M_Asset}-${a.RunningNumber}`
}

/**
 * Sticker "Tipe / Model" line — mirrors the physical sample (e.g.
 * "LAPTOP / THINKPAD T14 GEN 3"). Falls back to whatever half we have.
 */
function modelLine(a: AssetRow): string {
  const type = (a.AssetTypeName || '').trim()
  const model = (a.AssetTypeModelName || '').trim()
  const parts = [type, model].filter(Boolean)
  return parts.join(' / ').toUpperCase()
}

/** Company line (baris 1). Prefer the full name, fall back to the alias. */
function companyLine(a: AssetRow): string {
  return (a.CompanyName || a.CompanyAlias || '').toUpperCase()
}

export default function PrintQrScreen() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  // Fast-path: baris aset lengkap dikirim via router state dari Manage Asset.
  // Referensi array-nya stabil selama location tak berubah → aman dijadikan dep.
  const navAssets = (location.state as { assets?: AssetRow[] } | null)?.assets ?? null

  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Selected assets are kept as full rows (keyed by assetKey) so the print sheet
  // can render even after the search list changes underneath the selection.
  const [chosen, setChosen] = useState<Map<string, AssetRow>>(new Map())
  // Bulk deep-link (?ids dari tombol PRINT QR Manage Asset) → langsung preview,
  // panel seleksi disembunyikan (kecuali user klik "Ubah pilihan").
  const [showPicker, setShowPicker] = useState(false)

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

  const idsParam = searchParams.get('ids') ?? ''
  const hasNav = !!navAssets && navAssets.length > 0
  // Bulk deep-link bila datang dari Manage Asset (via state ATAU ?ids).
  const bulkMode = hasNav || idsParam.trim().length > 0

  // Fast-path: seed langsung dari baris yang dikirim Manage Asset — tanpa fetch.
  useEffect(() => {
    if (!navAssets || navAssets.length === 0) return
    setChosen((prev) => {
      const next = new Map(prev)
      for (const a of navAssets) next.set(assetKey(a), a)
      return next
    })
  }, [navAssets])

  // Fallback: hanya fetch by-ID kalau TIDAK ada router state (mis. halaman
  // di-refresh sehingga state hilang, hanya ?ids yang tersisa). Match di-trim
  // supaya trailing-space kolom SQL tak bikin match gagal.
  useEffect(() => {
    if (hasNav) return
    const wanted = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (wanted.length === 0) return

    let cancelled = false
    ;(async () => {
      const norm = (s: string) => s.trim()
      // Seed with any rows already loaded in the default search list.
      const found = new Map<string, AssetRow>()
      for (const a of assets) {
        const k = norm(a.AssetID)
        if (wanted.includes(k) && !found.has(k)) found.set(k, a)
      }
      const missing = wanted.filter((idv) => !found.has(idv))
      const fetched = await Promise.all(
        missing.map((idv) => fetchAssetByID(idv).catch(() => undefined)),
      )
      if (cancelled) return
      setChosen((prev) => {
        const next = new Map(prev)
        for (const idv of wanted) {
          const row = found.get(idv) ?? fetched.find((r) => r && norm(r.AssetID) === idv)
          if (row) next.set(assetKey(row), row)
        }
        return next
      })
    })()

    return () => {
      cancelled = true
    }
    // `assets` is intentionally read as a seed, not a dependency: we only want to
    // (re)run when the ids string changes, and the missing-fetch covers the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam, hasNav])

  const selectedCount = chosen.size
  // 1 halaman A4 hanya muat MAX_PER_A4 barcode. Jika user memilih lebih banyak,
  // ambil MAX_PER_A4 pertama URUT Asset ID menaik; sisanya tidak tercetak.
  const printList = Array.from(chosen.values())
    .sort((a, b) => a.AssetID.localeCompare(b.AssetID))
    .slice(0, MAX_PER_A4)
  const overflow = selectedCount - printList.length

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

  // Draw ONE sticker (kiri kotak tabel 4 baris + kanan QR) into the PDF at (x,y).
  const sheetRef = useRef<HTMLDivElement>(null)
  function drawStickerPdf(
    doc: jsPDF,
    a: AssetRow,
    x: number,
    y: number,
    cardW: number,
    cardH: number,
    qrW: number,
  ) {
    const leftW = cardW - qrW
    const rowH = cardH / 4

    // Kotak sticker + pemisah QR.
    doc.setDrawColor(17, 17, 17)
    doc.setLineWidth(0.5)
    doc.rect(x, y, cardW, cardH)
    doc.line(x + leftW, y, x + leftW, y + cardH)

    // Garis antar-baris (kolom kiri).
    doc.setLineWidth(0.2)
    for (let r = 1; r < 4; r++) doc.line(x, y + rowH * r, x + leftW, y + rowH * r)

    const padX = x + 2
    const textY = (r: number) => y + rowH * r + rowH / 2 + 1
    doc.setTextColor(17, 17, 17)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6)
    doc.text(companyLine(a), padX, textY(0), { maxWidth: leftW - 3 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(modelLine(a), padX, textY(1), { maxWidth: leftW - 3 })

    doc.setFont('courier', 'bold')
    doc.setFontSize(7)
    doc.text(a.AssetID, padX, textY(2), { maxWidth: leftW - 3 })
    // Baris 4 (Info Tambahan) sengaja dikosongkan sesuai sampel.

    // QR — render canvas tersembunyi milik aset ini ke PDF.
    const canvas = sheetRef.current?.querySelector<HTMLCanvasElement>(
      `canvas[data-qr-key="${assetKey(a)}"]`,
    )
    if (canvas) {
      const img = canvas.toDataURL('image/png')
      const qrSize = Math.min(qrW - 4, cardH - 4)
      const qx = x + leftW + (qrW - qrSize) / 2
      const qy = y + (cardH - qrSize) / 2
      doc.addImage(img, 'PNG', qx, qy, qrSize, qrSize)
    }
  }

  // Export selection sebagai 1 halaman A4 (grid 2 kolom, maks MAX_PER_A4 sticker).
  function downloadPdf() {
    if (printList.length === 0) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const cardW = (pageW - A4_MARGIN * 2 - A4_GAP * (COLS - 1)) / COLS
    const qrW = 24
    let x = A4_MARGIN
    let y = A4_MARGIN
    let col = 0
    printList.forEach((a) => {
      drawStickerPdf(doc, a, x, y, cardW, CARD_H, qrW)
      col += 1
      if (col >= COLS) {
        col = 0
        x = A4_MARGIN
        y += CARD_H + A4_GAP
      } else {
        x += cardW + A4_GAP
      }
    })
    doc.save('sticker-qr-asset.pdf')
  }

  return (
    <>
      <PageHeader
        title="Preview Sticker QR Code"
        description={
          <>
            Layout sesuai sampel fisik: <b>kiri</b> kotak tabel 4 baris (Company, Tipe/Model,
            Asset ID, Info Tambahan) — <b>kanan</b> QR Code berisi payload Asset ID.
          </>
        }
        action={
          <>
            <Button
              variant="outline"
              disabled={printList.length === 0}
              onClick={downloadPdf}
            >
              <Download className="h-4 w-4" /> Unduh PDF
            </Button>
            <Button disabled={printList.length === 0} onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak ({printList.length})
            </Button>
          </>
        }
      />

      {/* Selection panel — hidden on print + disembunyikan saat bulk (?ids) */}
      {!bulkMode || showPicker ? (
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
            <Button variant="outline" onClick={() => setChosen(new Map())} disabled={selectedCount === 0}>
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

          {selectedCount === 0 && !loading && !error && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Belum ada aset dipilih. Centang aset di atas untuk melihat pratinjau cetak.
            </p>
          )}
        </div>
      ) : (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            <b className="text-foreground">{selectedCount} aset</b> dipilih dari Manage Asset
          </span>
          <Button variant="outline" size="sm" onClick={() => setShowPicker(true)}>
            Ubah pilihan
          </Button>
        </div>
      )}

      {/* Peringatan kapasitas — bila pilihan melebihi 1 halaman A4. */}
      {overflow > 0 && (
        <div className="no-print mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="text-sm font-medium">
              Maksimal {MAX_PER_A4} barcode per halaman A4
            </div>
            <div className="text-xs">
              {selectedCount} aset dipilih — {overflow} aset tidak ikut tercetak. Yang dicetak
              adalah {MAX_PER_A4} pertama urut Asset ID menaik.
            </div>
          </div>
        </div>
      )}

      {/* Preview (kiri) + panel spesifikasi (kanan) */}
      {printList.length > 0 && (
        <div className="mt-4 grid items-start gap-[18px] lg:grid-cols-[1fr_300px]">
          {/* KIRI — kertas + sticker sheet (area yang dicetak) */}
          <div className="print-area">
            <div className="rounded-lg border bg-white p-5 shadow-sm">
              {/* pp-head: label + spesifikasi kertas, disembunyikan saat print */}
              <div className="no-print mb-4 flex items-center justify-between gap-3 border-b border-dashed pb-3 text-xs text-muted-foreground">
                <span>
                  <b className="text-foreground">Layout Sticker</b> · {printList.length} aset
                  terpilih (bulk)
                </span>
                <span className="font-mono">A4 · grid 2 kolom</span>
              </div>

              {/* sticker-sheet: grid 2 kolom */}
              <div ref={sheetRef} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {printList.map((a) => (
                  <div
                    key={assetKey(a)}
                    className="flex min-h-[104px] overflow-hidden rounded-[3px] border-2 border-black bg-white"
                  >
                    {/* KIRI: kotak tabel 4 baris */}
                    <div className="flex min-w-0 flex-1 flex-col border-r-2 border-black">
                      <div className="flex flex-1 items-center overflow-hidden border-b border-black px-2 py-1 text-[10px] font-extrabold uppercase leading-tight tracking-[0.01em] text-black">
                        {companyLine(a)}
                      </div>
                      <div className="flex flex-1 items-center overflow-hidden border-b border-black px-2 py-1 text-[11px] font-semibold leading-tight text-black">
                        {modelLine(a)}
                      </div>
                      <div className="flex flex-1 items-center overflow-hidden border-b border-black px-2 py-1 font-mono text-[11.5px] font-bold leading-tight tracking-[-0.02em] text-black">
                        {a.AssetID}
                      </div>
                      <div className="flex flex-1 items-center overflow-hidden px-2 py-1 text-[9.5px] leading-tight text-neutral-600">
                        {/* Info Tambahan — kosong sesuai sampel */}
                      </div>
                    </div>

                    {/* KANAN: QR Code (payload = Asset ID) */}
                    <div className="grid w-[104px] shrink-0 place-items-center bg-white p-1.5">
                      {/* SVG for crisp on-screen + print; hidden canvas backs the PDF export. */}
                      <QRCodeSVG value={a.AssetID} className="h-full w-full" />
                      <QRCodeCanvas
                        value={a.AssetID}
                        size={220}
                        data-qr-key={assetKey(a)}
                        className="hidden"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KANAN — Struktur Sticker + catatan presisi */}
          <aside className="no-print flex flex-col gap-[18px]">
            {/* Struktur Sticker */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="mb-1 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md bg-primary/10 text-primary">
                    <QrCode className="h-[18px] w-[18px]" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">Struktur Sticker</h2>
                    <p className="text-xs text-muted-foreground">Spesifikasi §3.3</p>
                  </div>
                </div>
                <dl className="mt-2 divide-y divide-border text-sm">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Baris 1</dt>
                    <dd className="font-medium text-foreground">Company</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Baris 2</dt>
                    <dd className="font-medium text-foreground">Tipe / Model</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Baris 3</dt>
                    <dd className="font-medium text-foreground">Asset ID</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">Sisi kanan</dt>
                    <dd className="font-medium text-foreground">QR (payload Asset ID)</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* Catatan presisi cetak */}
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="text-sm font-medium">Uji presisi cetak</div>
                <div className="text-xs">
                  Template PDF perlu diuji dengan kertas label fisik agar margin &amp; ukuran QR
                  presisi (risiko §12).
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
