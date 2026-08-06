import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, Save, Loader2, Search, Share2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Barcode } from '@/components/ui/barcode'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox, dedupeOptions, type ComboboxOption } from '@/components/ui/combobox'
import { formatDate } from '@/lib/format'
import { fetchAssetByID, type AssetRow } from '@/api/assets'
import {
  fetchAssetFormLookups,
  updateAsset,
  CURRENCY_OPTIONS,
  type AssetFormLookups,
  type POHeader,
  type POMaterialLine,
} from '@/api/assetForm'
import { PoSearchDialog } from './PoSearchDialog'

interface EditState {
  model: string
  size: string
  brand: string
  poNo: string
  poDate: string
  currency: string
  unitPrice: string
  remarks: string
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground">
        {value || '-'}
      </div>
    </div>
  )
}

export default function AssetEditScreen() {
  const { id = '' } = useParams()
  const assetId = decodeURIComponent(id)
  const navigate = useNavigate()

  const [asset, setAsset] = useState<AssetRow | null>(null)
  const [form, setForm] = useState<EditState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [lookups, setLookups] = useState<AssetFormLookups | null>(null)
  const [poOpen, setPoOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load lookups (sizes/brands/models) once.
  useEffect(() => {
    let alive = true
    fetchAssetFormLookups()
      .then((l) => {
        if (alive) setLookups(l)
      })
      .catch(() => {
        // Non-fatal: editable dropdowns fall back to empty; prefill still shows.
      })
    return () => {
      alive = false
    }
  }, [])

  // Load the asset and prefill the editable fields.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    fetchAssetByID(assetId)
      .then((row) => {
        if (!alive) return
        if (!row) {
          setAsset(null)
          return
        }
        setAsset(row)
        setForm({
          model: row.AssetTypeModelName ?? '',
          size: row.AssetSizeName ?? '',
          brand: row.AssetBrandName ?? '',
          poNo: row.PONo ?? '',
          poDate: row.PODate ? row.PODate.slice(0, 10) : '',
          currency: row.Currency || 'IDR',
          unitPrice: row.UnitPrice != null ? String(row.UnitPrice) : '',
          remarks: row.Remarks ?? '',
        })
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
  }, [assetId])

  function set<K extends keyof EditState>(key: K, value: EditState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // Legacy "Clear" resets the editable fields to empty.
  function clear() {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            model: '',
            size: '',
            brand: '',
            poNo: '',
            poDate: '',
            currency: '',
            unitPrice: '',
            remarks: '',
          }
        : prev,
    )
  }

  // Models for the asset's type (filtered from lookups[9]).
  const modelOptions: ComboboxOption[] = useMemo(() => {
    if (!lookups || !asset) return []
    return dedupeOptions(
      lookups.typeModels
        .filter((m) => m.IDX_M_AssetType === asset.IDX_M_AssetType)
        .map((m) => ({ value: m.AssetTypeModelName, label: m.AssetTypeModelName })),
    )
  }, [lookups, asset])

  const sizeOptions: ComboboxOption[] = useMemo(
    () =>
      dedupeOptions(lookups?.sizes.map((s) => ({ value: s.AssetSizeName, label: s.AssetSizeName })) ?? []),
    [lookups],
  )
  const brandOptions: ComboboxOption[] = useMemo(
    () =>
      dedupeOptions(
        lookups?.brands.map((b) => ({ value: b.AssetBrandName, label: b.AssetBrandName })) ?? [],
      ),
    [lookups],
  )

  function onPoSelect(header: POHeader, line: POMaterialLine | null) {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            poNo: header.PONo,
            poDate: header.PODate ? header.PODate.slice(0, 10) : prev.poDate,
            unitPrice: line ? String(Math.round(Number(line.UnitPrice) || 0)) : prev.unitPrice,
          }
        : prev,
    )
    setPoOpen(false)
    toast.success('PO diterapkan')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!asset || !form) return
    if (!form.unitPrice.trim()) {
      toast.error('Unit Price wajib diisi')
      return
    }

    const payload = {
      IDX_M_Asset: asset.IDX_M_Asset,
      AssetTypeModelName: form.model,
      AssetSizeName: form.size,
      AssetBrandName: form.brand,
      PONo: form.poNo,
      PODate: form.poDate,
      Currency: form.currency,
      UnitPrice: form.unitPrice,
      Remarks: form.remarks,
    }

    setSubmitting(true)
    try {
      const msg = await updateAsset(payload)
      toast.success(msg || 'Aset berhasil diperbarui')
      navigate(`/assets/${encodeURIComponent(assetId)}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui aset')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <EditSkeleton />

  if (error) {
    return (
      <>
        <PageHeader title="Edit Aset" description={assetId} />
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">Gagal memuat detail aset</p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <Button asChild variant="outline">
              <Link to="/assets">Kembali</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  if (!asset || !form) {
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
    <form onSubmit={submit}>
      <PageHeader
        title={`Edit Asset`}
        description={
          <span className="flex items-center gap-3">
            <span>{asset.AssetID}</span>
            <Barcode value={asset.AssetID} height={40} />
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {asset.isConnectedASBSPO ? (
              <Badge variant="secondary" className="gap-1">
                <Share2 className="h-3 w-3" /> ASBS
              </Badge>
            ) : null}
            <Button type="button" variant="outline" onClick={clear} disabled={submitting}>
              <RefreshCw className="h-4 w-4" /> Clear
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Update
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Read-only info */}
        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <ReadOnlyField label="Managed By" value={asset.AssetManagementName} />
            <ReadOnlyField label="Company" value={asset.CompanyName} />
            <ReadOnlyField label="User" value={asset.CurrentAssetUser} />
            <ReadOnlyField label="Location" value={asset.CurrentAssetLocation} />
            <ReadOnlyField label="Status" value={asset.CurrentAssetStatus} />
            <ReadOnlyField label="Type" value={asset.AssetTypeName} />
            <ReadOnlyField label="Color" value={asset.AssetColorName} />
            <ReadOnlyField label="Asset Date" value={formatDate(asset.AssetDate)} />
          </CardContent>
        </Card>

        {/* Editable */}
        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Combobox
                id="asset-model"
                title="Pilih Model"
                value={form.model}
                onChange={(v) => set('model', v)}
                options={modelOptions}
                placeholder="Pilih model"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Combobox
                id="asset-brand"
                title="Pilih Brand"
                value={form.brand}
                onChange={(v) => set('brand', v)}
                options={brandOptions}
                placeholder="Pilih brand"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Size</Label>
              <Combobox
                id="asset-size"
                title="Pilih Size"
                value={form.size}
                onChange={(v) => set('size', v)}
                options={sizeOptions}
                placeholder="Pilih size"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Purchase Order</Label>
              <div className="flex gap-2">
                <Input
                  value={form.poNo}
                  onChange={(e) => set('poNo', e.target.value)}
                  placeholder="Purchase Order"
                />
                <Button type="button" variant="outline" onClick={() => setPoOpen(true)}>
                  <Search className="h-4 w-4" /> Cari
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>PO Date</Label>
              <Input type="date" value={form.poDate} readOnly disabled />
            </div>

            <div className="space-y-1.5">
              <Label>Unit Price</Label>
              <Input
                inputMode="numeric"
                value={form.unitPrice}
                onChange={(e) => set('unitPrice', e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <PoSearchDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        initialPONo={form.poNo}
        onSelect={onPoSelect}
      />
    </form>
  )
}

function EditSkeleton() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, c) => (
          <Card key={c} className="border-0 shadow-sm">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
