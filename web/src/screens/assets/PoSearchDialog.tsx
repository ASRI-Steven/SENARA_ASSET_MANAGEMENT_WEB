import { useState } from 'react'
import { Search, Loader2, PackageSearch } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { rupiah, toNumber } from '@/lib/format'
import { searchPO, type POHeader, type POMaterialLine } from '@/api/assetForm'

interface PoSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Prefill the search box (current PONo). */
  initialPONo?: string
  /**
   * Fired when the user confirms a PO. Provides the header (for PODate) and the
   * chosen material line (or null if they picked the header only).
   */
  onSelect: (header: POHeader, line: POMaterialLine | null) => void
}

/**
 * Shared PO lookup dialog (New Asset + Asset Edit). Searches POST /api/po,
 * lists material lines with a client-side filter, and returns the header +
 * a chosen line. A non-existent PO returns empty rowsets → "PO tidak ditemukan".
 */
export function PoSearchDialog({
  open,
  onOpenChange,
  initialPONo = '',
  onSelect,
}: PoSearchDialogProps) {
  const [poNo, setPoNo] = useState(initialPONo)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [header, setHeader] = useState<POHeader | null>(null)
  const [lines, setLines] = useState<POMaterialLine[]>([])
  const [searched, setSearched] = useState(false)

  async function runSearch() {
    const trimmed = poNo.trim()
    if (!trimmed) {
      toast.error('Masukkan nomor PO')
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const res = await searchPO(trimmed)
      setHeader(res.header)
      setLines(res.lines)
      if (!res.header) toast.info('PO tidak ditemukan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mencari PO')
      setHeader(null)
      setLines([])
    } finally {
      setLoading(false)
    }
  }

  const shownLines = lines.filter((l) => {
    const q = filter.trim().toLowerCase()
    if (!q) return true
    return (
      (l.MaterialCode || '').toLowerCase().includes(q) ||
      (l.Category || '').toLowerCase().includes(q) ||
      (l.Subcategory || '').toLowerCase().includes(q) ||
      (l.MaterialType || '').toLowerCase().includes(q)
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-4">
        <DialogHeader>
          <DialogTitle>Cari PO</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={poNo}
              onChange={(e) => setPoNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void runSearch()
                }
              }}
              placeholder="Nomor PO"
              className="pl-9"
            />
          </div>
          <Button type="button" onClick={() => void runSearch()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Cari
          </Button>
        </div>

        {header && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="font-medium text-foreground">{header.PONo}</div>
            {header.POName && (
              <div className="text-xs text-muted-foreground">{header.POName}</div>
            )}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Tanggal PO: {header.PODate ? header.PODate.slice(0, 10) : '-'}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelect(header, null)}
              >
                Gunakan PO ini
              </Button>
            </div>
          </div>
        )}

        {header && lines.length > 0 && (
          <>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter material…"
            />
            <div className="max-h-72 overflow-y-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kode</th>
                    <th className="px-3 py-2 font-medium">Kategori</th>
                    <th className="px-3 py-2 font-medium">Tipe</th>
                    <th className="px-3 py-2 text-right font-medium">Harga</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {shownLines.map((l, i) => (
                    <tr key={`${l.MaterialCode}-${i}`} className="hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium text-foreground">{l.MaterialCode || '-'}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {[l.Category, l.Subcategory].filter(Boolean).join(' / ') || '-'}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{l.MaterialType || '-'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {rupiah(Math.round(toNumber(l.UnitPrice)))}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => header && onSelect(header, l)}
                        >
                          Pilih
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {searched && !loading && !header && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <PackageSearch className="h-8 w-8 opacity-60" />
            PO tidak ditemukan.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
