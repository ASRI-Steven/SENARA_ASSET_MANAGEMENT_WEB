import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw, Save, Loader2, Search, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Combobox, dedupeOptions, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { saveMaster } from '@/api/master'
import {
  fetchAssetFormLookups,
  fetchCompaniesByManagement,
  createAsset,
  CURRENCY_OPTIONS,
  type AssetFormLookups,
  type CompanyOption,
  type POHeader,
  type POMaterialLine,
} from '@/api/assetForm'
import { PoSearchDialog } from './PoSearchDialog'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface FormState {
  management: string
  company: string
  type: string
  model: string
  color: string
  size: string
  brand: string
  user: string
  location: string
  status: string
  poNo: string
  poDate: string
  currency: string
  unitPrice: string
  remarks: string
  assetDate: string
}

const EMPTY: FormState = {
  management: '',
  company: '',
  type: '',
  model: '',
  color: '',
  size: '',
  brand: '',
  user: '',
  location: '',
  status: '',
  poNo: '',
  poDate: today(),
  currency: 'IDR',
  unitPrice: '',
  remarks: '',
  assetDate: today(),
}

/** Field-level validation. All required EXCEPT PONo (matches legacy checkField). */
function validate(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {}
  const req: [keyof FormState, string][] = [
    ['management', 'Managed By required'],
    ['company', 'Company required'],
    ['user', 'User required'],
    ['location', 'Location required'],
    ['status', 'Status required'],
    ['type', 'Type required'],
    ['model', 'Model required'],
    ['color', 'Color required'],
    ['size', 'Size required'],
    ['brand', 'Brand required'],
    ['currency', 'Currency required'],
    ['unitPrice', 'Unit Price required'],
  ]
  for (const [k, msg] of req) {
    if (!String(f[k]).trim()) e[k] = msg
  }
  return e
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive">{msg}</p>
}

export default function AssetNewScreen() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})

  const [lookups, setLookups] = useState<AssetFormLookups | null>(null)
  const [lookupsLoading, setLookupsLoading] = useState(true)
  const [lookupsError, setLookupsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)

  const [poOpen, setPoOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Quick-add dialogs (mirror the legacy inline "+" New Model / Brand / Size).
  const [modelDialog, setModelDialog] = useState(false)
  const [brandDialog, setBrandDialog] = useState(false)
  const [sizeDialog, setSizeDialog] = useState(false)
  const [newModelType, setNewModelType] = useState('')
  const [newModel, setNewModel] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const [newSize, setNewSize] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Load all lookups once (and on quick-add to pick up new options).
  useEffect(() => {
    let alive = true
    setLookupsLoading(true)
    setLookupsError(null)
    fetchAssetFormLookups()
      .then((l) => {
        if (alive) setLookups(l)
      })
      .catch((err: unknown) => {
        if (alive) setLookupsError(err instanceof Error ? err.message : 'Gagal memuat data pilihan')
      })
      .finally(() => {
        if (alive) setLookupsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reloadKey])

  // Cascade: reload companies when management changes; clear company.
  useEffect(() => {
    if (!form.management) {
      setCompanies([])
      return
    }
    let alive = true
    setCompanyLoading(true)
    fetchCompaniesByManagement(Number(form.management))
      .then((c) => {
        if (alive) setCompanies(c)
      })
      .catch(() => {
        if (alive) setCompanies([])
      })
      .finally(() => {
        if (alive) setCompanyLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.management])

  // Models for the currently-selected type (filtered client-side from lookups[9]).
  const modelOptions: ComboboxOption[] = useMemo(() => {
    if (!lookups || !form.type) return []
    const t = Number(form.type)
    return dedupeOptions(
      lookups.typeModels
        .filter((m) => m.IDX_M_AssetType === t)
        .map((m) => ({ value: m.AssetTypeModelName, label: m.AssetTypeModelName })),
    )
  }, [lookups, form.type])

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
  const userOptions: ComboboxOption[] = useMemo(
    () =>
      lookups?.users.map((u) => ({
        value: String(u.IDX_M_AssetUser),
        label: u.AssetUserName,
      })) ?? [],
    [lookups],
  )

  function onPoSelect(header: POHeader, line: POMaterialLine | null) {
    setForm((prev) => ({
      ...prev,
      poNo: header.PONo,
      poDate: header.PODate ? header.PODate.slice(0, 10) : prev.poDate,
      assetDate: header.PODate ? header.PODate.slice(0, 10) : prev.assetDate,
      unitPrice: line ? String(Math.round(Number(line.UnitPrice) || 0)) : prev.unitPrice,
    }))
    setPoOpen(false)
    toast.success('PO diterapkan')
  }

  // Legacy Cancel = clear the form back to defaults (refresh icon).
  function clear() {
    setForm(EMPTY)
    setErrors({})
  }

  async function quickAddModel() {
    if (!newModelType) {
      toast.error('Type wajib dipilih')
      return
    }
    if (!newModel.trim()) {
      toast.error('Model wajib diisi')
      return
    }
    setQuickSaving(true)
    try {
      const msg = await saveMaster('model', {
        IDX_M_AssetType: Number(newModelType),
        AssetTypeModelName: newModel.trim(),
      })
      toast.success(msg || 'Model ditambahkan')
      setModelDialog(false)
      setNewModel('')
      setNewModelType('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan model')
    } finally {
      setQuickSaving(false)
    }
  }

  async function quickAddBrand() {
    if (!newBrand.trim()) {
      toast.error('Brand wajib diisi')
      return
    }
    setQuickSaving(true)
    try {
      const msg = await saveMaster('brand', { AssetBrandName: newBrand.trim() })
      toast.success(msg || 'Brand ditambahkan')
      setBrandDialog(false)
      setNewBrand('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan brand')
    } finally {
      setQuickSaving(false)
    }
  }

  async function quickAddSize() {
    if (!newSize.trim()) {
      toast.error('Size wajib diisi')
      return
    }
    setQuickSaving(true)
    try {
      const msg = await saveMaster('size', { AssetSizeName: newSize.trim() })
      toast.success(msg || 'Size ditambahkan')
      setSizeDialog(false)
      setNewSize('')
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan size')
    } finally {
      setQuickSaving(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Lengkapi field yang wajib diisi')
      return
    }

    const payload = {
      IDX_M_AssetManagement: Number(form.management),
      IDX_M_Company: Number(form.company),
      IDX_M_AssetType: Number(form.type),
      AssetTypeModelName: form.model,
      IDX_M_AssetColor: Number(form.color),
      AssetSizeName: form.size,
      AssetBrandName: form.brand,
      IDX_M_AssetUser: Number(form.user),
      IDX_M_AssetLocation: Number(form.location),
      IDX_M_AssetStatus: Number(form.status),
      PONo: form.poNo,
      PODate: form.poDate,
      Currency: form.currency,
      UnitPrice: form.unitPrice,
      Remarks: form.remarks,
      AssetDate: form.assetDate,
    }

    setSubmitting(true)
    try {
      const msg = await createAsset(payload)
      toast.success(msg || 'Aset berhasil dibuat')
      navigate('/assets')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat aset')
    } finally {
      setSubmitting(false)
    }
  }

  if (lookupsError) {
    return (
      <>
        <PageHeader title="Add Asset" description="Buat aset baru" />
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-foreground">Gagal memuat data pilihan</p>
            <p className="text-xs text-muted-foreground">{lookupsError}</p>
            <Button asChild variant="outline">
              <Link to="/assets">Kembali</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    )
  }

  const disabled = lookupsLoading

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Add Asset"
        description="Buat aset baru"
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clear} disabled={submitting}>
              <RefreshCw className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        }
      />

      <Card className="border-0 shadow-sm">
        <CardContent className="grid gap-x-6 gap-y-4 p-5 lg:grid-cols-2">
          {/* Left column: Managed By, Company, User, Location, Status, Purchase Order, Remarks */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Managed By</Label>
              <Select
                value={form.management}
                onValueChange={(v) => {
                  set('management', v)
                  set('company', '')
                }}
                disabled={disabled}
              >
                <SelectTrigger className={cn(errors.management && 'border-destructive')}>
                  <SelectValue placeholder={disabled ? 'Memuat…' : 'Pilih management'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.managements.map((m) => (
                    <SelectItem key={m.IDX_M_AssetManagement} value={String(m.IDX_M_AssetManagement)}>
                      {m.AssetManagementName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err msg={errors.management} />
            </div>

            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={form.company}
                onValueChange={(v) => set('company', v)}
                disabled={disabled || !form.management || companyLoading}
              >
                <SelectTrigger className={cn(errors.company && 'border-destructive')}>
                  <SelectValue
                    placeholder={
                      !form.management
                        ? 'Pilih management dulu'
                        : companyLoading
                          ? 'Memuat…'
                          : 'Pilih company'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.IDX_M_Company} value={String(c.IDX_M_Company)}>
                      {c.CompanyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err msg={errors.company} />
            </div>

            <div className="space-y-1.5">
              <Label>User</Label>
              <Combobox
                id="asset-user"
                title="Pilih User"
                value={form.user}
                onChange={(v) => set('user', v)}
                options={userOptions}
                disabled={disabled}
                placeholder="Pilih user"
                className={cn(errors.user && 'border-destructive')}
              />
              <Err msg={errors.user} />
            </div>

            <div className="space-y-1.5">
              <Label>Location</Label>
              <Select
                value={form.location}
                onValueChange={(v) => set('location', v)}
                disabled={disabled}
              >
                <SelectTrigger className={cn(errors.location && 'border-destructive')}>
                  <SelectValue placeholder={disabled ? 'Memuat…' : 'Pilih location'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.locations.map((l) => (
                    <SelectItem key={l.IDX_M_AssetLocation} value={String(l.IDX_M_AssetLocation)}>
                      {l.AssetLocationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err msg={errors.location} />
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)} disabled={disabled}>
                <SelectTrigger className={cn(errors.status && 'border-destructive')}>
                  <SelectValue placeholder={disabled ? 'Memuat…' : 'Pilih status'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.statuses.map((s) => (
                    <SelectItem key={s.IDX_M_AssetStatus} value={String(s.IDX_M_AssetStatus)}>
                      {s.AssetStatusName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err msg={errors.status} />
            </div>

            <div className="space-y-1.5">
              <Label>Purchase Order</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  value={form.poNo}
                  onChange={(e) => set('poNo', e.target.value)}
                  placeholder="Purchase Order"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Cari PO"
                  onClick={() => setPoOpen(true)}
                  disabled={disabled}
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Input type="date" value={form.poDate} readOnly disabled className="col-span-2" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                rows={2}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Right column: Type, Model, Brand, Color, Size, Currency, Asset Date, Unit Price */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  set('type', v)
                  set('model', '')
                }}
                disabled={disabled}
              >
                <SelectTrigger className={cn(errors.type && 'border-destructive')}>
                  <SelectValue placeholder={disabled ? 'Memuat…' : 'Pilih type'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.types.map((t) => (
                    <SelectItem key={t.IDX_M_AssetType} value={String(t.IDX_M_AssetType)}>
                      {t.AssetTypeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err msg={errors.type} />
            </div>

            <div className="space-y-1.5">
              <Label>Model</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Combobox
                  id="asset-model"
                  title="Pilih Model"
                  value={form.model}
                  onChange={(v) => set('model', v)}
                  options={modelOptions}
                  disabled={disabled || !form.type}
                  placeholder={!form.type ? 'Pilih type dulu' : 'Pilih model'}
                  className={cn(errors.model && 'border-destructive')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="New Model"
                  onClick={() => {
                    setNewModelType(form.type)
                    setModelDialog(true)
                  }}
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Err msg={errors.model} />
            </div>

            <div className="space-y-1.5">
              <Label>Brand</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Combobox
                  id="asset-brand"
                  title="Pilih Brand"
                  value={form.brand}
                  onChange={(v) => set('brand', v)}
                  options={brandOptions}
                  disabled={disabled}
                  placeholder="Pilih brand"
                  className={cn(errors.brand && 'border-destructive')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="New Brand"
                  onClick={() => setBrandDialog(true)}
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Err msg={errors.brand} />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <Select value={form.color} onValueChange={(v) => set('color', v)} disabled={disabled}>
                <SelectTrigger className={cn(errors.color && 'border-destructive')}>
                  <SelectValue placeholder={disabled ? 'Memuat…' : 'Pilih color'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.colors.map((c) => (
                    <SelectItem key={c.IDX_M_AssetColor} value={String(c.IDX_M_AssetColor)}>
                      {c.AssetColorName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Err msg={errors.color} />
            </div>

            <div className="space-y-1.5">
              <Label>Size</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Combobox
                  id="asset-size"
                  title="Pilih Size"
                  value={form.size}
                  onChange={(v) => set('size', v)}
                  options={sizeOptions}
                  disabled={disabled}
                  placeholder="Pilih size"
                  className={cn(errors.size && 'border-destructive')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="New Size"
                  onClick={() => setSizeDialog(true)}
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Err msg={errors.size} />
            </div>

            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set('currency', v)} disabled={disabled}>
                <SelectTrigger className={cn(errors.currency && 'border-destructive')}>
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
              <Err msg={errors.currency} />
            </div>

            <div className="space-y-1.5">
              <Label>Asset Date</Label>
              <Input
                type="date"
                value={form.assetDate}
                onChange={(e) => set('assetDate', e.target.value)}
                disabled={disabled}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Unit Price</Label>
              <Input
                inputMode="numeric"
                value={form.unitPrice}
                onChange={(e) => set('unitPrice', e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="0"
                className={cn(errors.unitPrice && 'border-destructive')}
                disabled={disabled}
              />
              <Err msg={errors.unitPrice} />
            </div>
          </div>
        </CardContent>
      </Card>

      <PoSearchDialog
        open={poOpen}
        onOpenChange={setPoOpen}
        initialPONo={form.poNo}
        onSelect={onPoSelect}
      />

      {/* New Model quick-add */}
      <Dialog open={modelDialog} onOpenChange={setModelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={newModelType} onValueChange={setNewModelType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih type" />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.types.map((t) => (
                    <SelectItem key={t.IDX_M_AssetType} value={String(t.IDX_M_AssetType)}>
                      {t.AssetTypeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={newModel} onChange={(e) => setNewModel(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={quickSaving}
              onClick={() => setModelDialog(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={quickSaving} onClick={quickAddModel}>
              {quickSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Brand quick-add */}
      <Dialog open={brandDialog} onOpenChange={setBrandDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Brand</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Brand</Label>
            <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={quickSaving}
              onClick={() => setBrandDialog(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={quickSaving} onClick={quickAddBrand}>
              {quickSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Size quick-add */}
      <Dialog open={sizeDialog} onOpenChange={setSizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Size</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Size</Label>
            <Input value={newSize} onChange={(e) => setNewSize(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={quickSaving}
              onClick={() => setSizeDialog(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={quickSaving} onClick={quickAddSize}>
              {quickSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
