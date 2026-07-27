import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Search } from 'lucide-react'
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
import { Combobox, dedupeOptions, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
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

// Per IAT safety, the final create POST is disabled by default. Flip to true only
// for a deliberate real write.
const ALLOW_REAL_SUBMIT = false

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
    ['management', 'Management wajib dipilih'],
    ['company', 'Company wajib dipilih'],
    ['type', 'Type wajib dipilih'],
    ['model', 'Model wajib dipilih'],
    ['color', 'Color wajib dipilih'],
    ['size', 'Size wajib dipilih'],
    ['brand', 'Brand wajib dipilih'],
    ['user', 'User wajib dipilih'],
    ['location', 'Location wajib dipilih'],
    ['status', 'Status wajib dipilih'],
    ['currency', 'Currency wajib dipilih'],
    ['unitPrice', 'Unit Price wajib diisi'],
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

  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)

  const [poOpen, setPoOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  // Load all lookups once.
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
  }, [])

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

    if (!ALLOW_REAL_SUBMIT) {
      // IAT safety: form validated, payload assembled, but the real create POST
      // is disabled so automated tests never write a live asset.
      toast.success('Form tervalidasi (submit ke backend dinonaktifkan untuk IAT)')
      return
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
        <PageHeader title="Tambah Aset" description="Buat aset baru" />
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
        title="Tambah Aset"
        description="Buat aset baru"
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" type="button">
              <Link to="/assets">
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Klasifikasi */}
        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-foreground sm:col-span-2">Klasifikasi</h3>

            <div className="space-y-1.5">
              <Label>Management</Label>
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
              <Err msg={errors.model} />
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
              <Err msg={errors.size} />
            </div>

            <div className="space-y-1.5">
              <Label>Brand</Label>
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
              <Err msg={errors.brand} />
            </div>
          </CardContent>
        </Card>

        {/* Penempatan */}
        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-foreground sm:col-span-2">Penempatan</h3>

            <div className="space-y-1.5 sm:col-span-2">
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
              <Label>Tanggal Aset</Label>
              <Input
                type="date"
                value={form.assetDate}
                onChange={(e) => set('assetDate', e.target.value)}
                disabled={disabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pembelian */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-foreground sm:col-span-2">Pembelian</h3>

            <div className="space-y-1.5">
              <Label>Nomor PO (opsional)</Label>
              <div className="flex gap-2">
                <Input
                  value={form.poNo}
                  onChange={(e) => set('poNo', e.target.value)}
                  placeholder="Nomor PO"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPoOpen(true)}
                  disabled={disabled}
                >
                  <Search className="h-4 w-4" /> Cari
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tanggal PO</Label>
              <Input type="date" value={form.poDate} readOnly disabled />
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                rows={2}
                disabled={disabled}
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
