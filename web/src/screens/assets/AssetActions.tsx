// Asset action dialogs (ManageAsset parity). Each dropdown item opens a real
// shadcn Dialog with the right inputs (Select/Combobox + Date + Remarks) wired
// to its BFF endpoint. On success we toast + call onChanged() so the caller can
// refresh the list/detail.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  Pencil,
  UserCheck,
  MapPin,
  Activity,
  Building2,
  Briefcase,
  RotateCcw,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import {
  assignAssetUser,
  assignAssetLocation,
  assignAssetStatus,
  changeAssetManagement,
  changeAssetCompany,
  returnAsset,
  enableAsset,
  disableAsset,
  type AssetRow,
} from '@/api/assets'
import {
  fetchAssetFormLookups,
  fetchCompaniesByManagement,
  type AssetFormLookups,
  type CompanyOption,
} from '@/api/assetForm'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// Which action dialog is open (null = none).
type ActionKind =
  | 'assign-user'
  | 'assign-location'
  | 'assign-status'
  | 'change-management'
  | 'change-company'
  | 'return'
  | 'enable'
  | 'disable'

// --- Shared lookups (loaded once, lazily, on first dialog open) ---
let lookupsCache: AssetFormLookups | null = null

function useLookups(enabled: boolean) {
  const [lookups, setLookups] = useState<AssetFormLookups | null>(lookupsCache)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || lookups) return
    let alive = true
    setLoading(true)
    setError(null)
    fetchAssetFormLookups()
      .then((l) => {
        lookupsCache = l
        if (alive) setLookups(l)
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat data pilihan')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [enabled, lookups])

  return { lookups, loading, error }
}

// --- Reusable dialog shell for the field-based actions ---
function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitting,
  canSubmit,
  onSubmit,
  destructive,
  children,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  submitLabel: string
  submitting: boolean
  canSubmit: boolean
  onSubmit: () => void
  destructive?: boolean
  children?: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={submitting}>
            Batal
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={onSubmit}
            disabled={submitting || !canSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemarksField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>Remarks</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} disabled={disabled} />
    </div>
  )
}

// --- Assign User ---
function AssignUserDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { lookups, loading: lookupsLoading, error: lookupsError } = useLookups(open)
  const [user, setUser] = useState('')
  const [date, setDate] = useState(today())
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setUser('')
      setDate(today())
      setRemarks('')
    }
  }, [open])

  const userOptions: ComboboxOption[] = useMemo(
    () =>
      lookups?.users.map((u) => ({
        value: String(u.IDX_M_AssetUser),
        label: u.AssetUserName,
      })) ?? [],
    [lookups],
  )

  async function submit() {
    if (!user) return
    setSubmitting(true)
    try {
      const msg = await assignAssetUser({
        IDX_M_Asset: asset.IDX_M_Asset,
        IDX_M_AssetUser: Number(user),
        Date: date,
        Remarks: remarks,
      })
      toast.success(msg || 'User berhasil ditetapkan')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menetapkan user')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign User"
      description={`Tetapkan user untuk aset ${asset.AssetID}.`}
      submitLabel="Simpan"
      submitting={submitting}
      canSubmit={!!user}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>User</Label>
          <Combobox
            id="assign-user-picker"
            title="Pilih User"
            value={user}
            onChange={setUser}
            options={userOptions}
            disabled={lookupsLoading || !!lookupsError}
            placeholder={lookupsLoading ? 'Memuat…' : 'Pilih user'}
          />
          {lookupsError && <p className="text-xs text-destructive">{lookupsError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Tanggal</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <RemarksField value={remarks} onChange={setRemarks} disabled={submitting} />
      </div>
    </ActionDialog>
  )
}

// --- Assign Location ---
function AssignLocationDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { lookups, loading: lookupsLoading, error: lookupsError } = useLookups(open)
  const [location, setLocation] = useState('')
  const [date, setDate] = useState(today())
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setLocation('')
      setDate(today())
      setRemarks('')
    }
  }, [open])

  const locationOptions: ComboboxOption[] = useMemo(
    () =>
      lookups?.locations.map((l) => ({
        value: String(l.IDX_M_AssetLocation),
        label: l.AssetLocationName,
      })) ?? [],
    [lookups],
  )

  async function submit() {
    if (!location) return
    setSubmitting(true)
    try {
      const msg = await assignAssetLocation({
        IDX_M_Asset: asset.IDX_M_Asset,
        IDX_M_AssetLocation: Number(location),
        Date: date,
        Remarks: remarks,
      })
      toast.success(msg || 'Location berhasil ditetapkan')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menetapkan location')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign Location"
      description={`Tetapkan location untuk aset ${asset.AssetID}.`}
      submitLabel="Simpan"
      submitting={submitting}
      canSubmit={!!location}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Location</Label>
          <Combobox
            id="assign-location-picker"
            title="Pilih Location"
            value={location}
            onChange={setLocation}
            options={locationOptions}
            disabled={lookupsLoading || !!lookupsError}
            placeholder={lookupsLoading ? 'Memuat…' : 'Pilih location'}
          />
          {lookupsError && <p className="text-xs text-destructive">{lookupsError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Tanggal</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <RemarksField value={remarks} onChange={setRemarks} disabled={submitting} />
      </div>
    </ActionDialog>
  )
}

// --- Assign Status ---
function AssignStatusDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { lookups, loading: lookupsLoading, error: lookupsError } = useLookups(open)
  const [status, setStatus] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setStatus('')
      setRemarks('')
    }
  }, [open])

  async function submit() {
    if (!status) return
    setSubmitting(true)
    try {
      const msg = await assignAssetStatus({
        IDX_M_Asset: asset.IDX_M_Asset,
        IDX_M_AssetStatus: Number(status),
        Remarks: remarks,
      })
      toast.success(msg || 'Status berhasil diperbarui')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memperbarui status')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign Status"
      description={`Ubah status aset ${asset.AssetID}.`}
      submitLabel="Simpan"
      submitting={submitting}
      canSubmit={!!status}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus} disabled={lookupsLoading || !!lookupsError}>
            <SelectTrigger id="assign-status-picker">
              <SelectValue placeholder={lookupsLoading ? 'Memuat…' : 'Pilih status'} />
            </SelectTrigger>
            <SelectContent>
              {lookups?.statuses.map((s) => (
                <SelectItem key={s.IDX_M_AssetStatus} value={String(s.IDX_M_AssetStatus)}>
                  {s.AssetStatusName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lookupsError && <p className="text-xs text-destructive">{lookupsError}</p>}
        </div>
        <RemarksField value={remarks} onChange={setRemarks} disabled={submitting} />
      </div>
    </ActionDialog>
  )
}

// --- Change Management ---
function ChangeManagementDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { lookups, loading: lookupsLoading, error: lookupsError } = useLookups(open)
  const [management, setManagement] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setManagement('')
      setRemarks('')
    }
  }, [open])

  async function submit() {
    if (!management) return
    setSubmitting(true)
    try {
      const msg = await changeAssetManagement({
        IDX_M_Asset: asset.IDX_M_Asset,
        IDX_M_AssetManagement: Number(management),
        Remarks: remarks,
      })
      toast.success(msg || 'Management berhasil diubah')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah management')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Management"
      description={`Ubah management aset ${asset.AssetID} (saat ini: ${asset.AssetManagementName || '-'}).`}
      submitLabel="Simpan"
      submitting={submitting}
      canSubmit={!!management}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Management</Label>
          <Select
            value={management}
            onValueChange={setManagement}
            disabled={lookupsLoading || !!lookupsError}
          >
            <SelectTrigger id="change-management-picker">
              <SelectValue placeholder={lookupsLoading ? 'Memuat…' : 'Pilih management'} />
            </SelectTrigger>
            <SelectContent>
              {lookups?.managements.map((m) => (
                <SelectItem key={m.IDX_M_AssetManagement} value={String(m.IDX_M_AssetManagement)}>
                  {m.AssetManagementName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lookupsError && <p className="text-xs text-destructive">{lookupsError}</p>}
        </div>
        <RemarksField value={remarks} onChange={setRemarks} disabled={submitting} />
      </div>
    </ActionDialog>
  )
}

// --- Change Company ---
// Companies are scoped to the asset's current management. We resolve that
// management's IDX by matching AssetManagementName against the managements
// lookup, then load its companies (matches legacy ManageAsset behaviour).
function ChangeCompanyDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const { lookups, loading: lookupsLoading, error: lookupsError } = useLookups(open)
  const [company, setCompany] = useState('')
  const [remarks, setRemarks] = useState('')
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [companyLoading, setCompanyLoading] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setCompany('')
      setRemarks('')
    }
  }, [open])

  // Resolve the asset's management IDX from the lookups, then load its companies.
  const managementIdx = useMemo(() => {
    if (!lookups) return null
    const m = lookups.managements.find(
      (x) => x.AssetManagementName === asset.AssetManagementName,
    )
    return m ? m.IDX_M_AssetManagement : null
  }, [lookups, asset.AssetManagementName])

  useEffect(() => {
    if (!open || managementIdx == null) {
      setCompanies([])
      return
    }
    let alive = true
    setCompanyLoading(true)
    setCompanyError(null)
    fetchCompaniesByManagement(managementIdx)
      .then((c) => {
        if (alive) setCompanies(c)
      })
      .catch((e: unknown) => {
        if (alive) setCompanyError(e instanceof Error ? e.message : 'Gagal memuat company')
      })
      .finally(() => {
        if (alive) setCompanyLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open, managementIdx])

  const companyOptions: ComboboxOption[] = useMemo(
    () =>
      companies.map((c) => ({
        value: String(c.IDX_M_Company),
        label: c.CompanyName,
      })),
    [companies],
  )

  async function submit() {
    if (!company) return
    setSubmitting(true)
    try {
      const msg = await changeAssetCompany({
        IDX_M_Asset: asset.IDX_M_Asset,
        IDX_M_Company: Number(company),
        Remarks: remarks,
      })
      toast.success(msg || 'Company berhasil diubah')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah company')
    } finally {
      setSubmitting(false)
    }
  }

  const loading = lookupsLoading || companyLoading
  const err = lookupsError || companyError

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change Company"
      description={`Ubah company aset ${asset.AssetID} (saat ini: ${asset.CompanyName || '-'}).`}
      submitLabel="Simpan"
      submitting={submitting}
      canSubmit={!!company}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Company</Label>
          <Combobox
            id="change-company-picker"
            title="Pilih Company"
            value={company}
            onChange={setCompany}
            options={companyOptions}
            disabled={loading || !!err}
            placeholder={loading ? 'Memuat…' : 'Pilih company'}
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <RemarksField value={remarks} onChange={setRemarks} disabled={submitting} />
      </div>
    </ActionDialog>
  )
}

// --- Return ---
function ReturnDialog({
  asset,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setRemarks('')
  }, [open])

  async function submit() {
    setSubmitting(true)
    try {
      const msg = await returnAsset({ IDX_M_Asset: asset.IDX_M_Asset, Remarks: remarks })
      toast.success(msg || 'Aset berhasil dikembalikan')
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengembalikan aset')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Return Asset"
      description={`Kembalikan aset ${asset.AssetID} dari user saat ini (${asset.CurrentAssetUser || '-'}).`}
      submitLabel="Return"
      submitting={submitting}
      canSubmit
      onSubmit={submit}
    >
      <RemarksField value={remarks} onChange={setRemarks} disabled={submitting} />
    </ActionDialog>
  )
}

// --- Enable / Disable (confirm) ---
function ToggleDialog({
  asset,
  mode,
  open,
  onOpenChange,
  onDone,
}: {
  asset: AssetRow
  mode: 'enable' | 'disable'
  open: boolean
  onOpenChange: (o: boolean) => void
  onDone: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const isDisable = mode === 'disable'

  async function submit() {
    setSubmitting(true)
    try {
      const msg = isDisable
        ? await disableAsset(asset.IDX_M_Asset)
        : await enableAsset(asset.IDX_M_Asset)
      toast.success(msg || (isDisable ? 'Aset dinonaktifkan' : 'Aset diaktifkan'))
      onOpenChange(false)
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Operasi gagal')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isDisable ? 'Nonaktifkan Aset' : 'Aktifkan Aset'}
      description={
        isDisable
          ? `Yakin ingin menonaktifkan aset ${asset.AssetID}? Aset tidak akan tampil di daftar aktif.`
          : `Aktifkan kembali aset ${asset.AssetID}?`
      }
      submitLabel={isDisable ? 'Nonaktifkan' : 'Aktifkan'}
      submitting={submitting}
      canSubmit
      destructive={isDisable}
      onSubmit={submit}
    />
  )
}

/**
 * The per-row/detail actions menu. Renders a dropdown of the actions permitted
 * by the row's ACL flags and hosts every action dialog. `onChanged` is called
 * after any successful mutation so the caller can refresh.
 */
export function AssetActionsMenu({
  asset,
  onChanged,
  trigger,
}: {
  asset: AssetRow
  onChanged: () => void
  /** Custom trigger element; defaults to a three-dot icon button. */
  trigger?: ReactNode
}) {
  const navigate = useNavigate()
  const [action, setAction] = useState<ActionKind | null>(null)

  const close = () => setAction(null)
  const done = () => {
    close()
    onChanged()
  }

  // The grid SP (usp_CMS_ManageAsset_Search) returns per-row ACL flags; the
  // single-asset detail SP does NOT. When the flags are absent (detail context)
  // we show the full action set; when present (list rows) we respect them.
  const aclKnown =
    asset.isUpdate !== undefined ||
    asset.isAssignUser !== undefined ||
    asset.isChangeCompany !== undefined
  const can = (flag: number | undefined) => !aclKnown || flag === 1

  // Enable vs disable: prefer the explicit ACL flags; otherwise fall back to the
  // row Status (ENABLED → can disable; anything else → can enable).
  const statusEnabled = String(asset.Status ?? '').toUpperCase() !== 'DISABLED'
  const canDisable = aclKnown ? asset.isDisable === 1 : statusEnabled
  const canEnable = aclKnown ? asset.isEnable === 1 : !statusEnabled

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            !trigger &&
              'rounded-md p-1.5 text-muted-foreground outline-none hover:bg-muted focus:outline-none',
          )}
          asChild={!!trigger}
        >
          {trigger ?? <MoreVerticalIcon />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => navigate(`/assets/${encodeURIComponent(asset.AssetID)}`)}>
            <Eye className="h-4 w-4" /> Lihat Detail
          </DropdownMenuItem>
          {can(asset.isUpdate) ? (
            <DropdownMenuItem
              onClick={() => navigate(`/assets/${encodeURIComponent(asset.AssetID)}/edit`)}
            >
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          {can(asset.isAssignUser) ? (
            <DropdownMenuItem onClick={() => setAction('assign-user')}>
              <UserCheck className="h-4 w-4" /> Assign User
            </DropdownMenuItem>
          ) : null}
          {can(asset.isAssignLocation) ? (
            <DropdownMenuItem onClick={() => setAction('assign-location')}>
              <MapPin className="h-4 w-4" /> Assign Location
            </DropdownMenuItem>
          ) : null}
          {can(asset.isAssignStatus) ? (
            <DropdownMenuItem onClick={() => setAction('assign-status')}>
              <Activity className="h-4 w-4" /> Assign Status
            </DropdownMenuItem>
          ) : null}
          {can(asset.isChangeManagement) ? (
            <DropdownMenuItem onClick={() => setAction('change-management')}>
              <Briefcase className="h-4 w-4" /> Change Management
            </DropdownMenuItem>
          ) : null}
          {can(asset.isChangeCompany) ? (
            <DropdownMenuItem onClick={() => setAction('change-company')}>
              <Building2 className="h-4 w-4" /> Change Company
            </DropdownMenuItem>
          ) : null}
          {can(asset.isReturn) ? (
            <DropdownMenuItem onClick={() => setAction('return')}>
              <RotateCcw className="h-4 w-4" /> Return
            </DropdownMenuItem>
          ) : null}

          {(canDisable || canEnable) && <DropdownMenuSeparator />}
          {canDisable ? (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setAction('disable')}
            >
              <PowerOff className="h-4 w-4" /> Nonaktifkan
            </DropdownMenuItem>
          ) : null}
          {canEnable ? (
            <DropdownMenuItem onClick={() => setAction('enable')}>
              <Power className="h-4 w-4" /> Aktifkan
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs (mounted only for the active action so their state resets) */}
      <AssignUserDialog
        asset={asset}
        open={action === 'assign-user'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <AssignLocationDialog
        asset={asset}
        open={action === 'assign-location'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <AssignStatusDialog
        asset={asset}
        open={action === 'assign-status'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <ChangeManagementDialog
        asset={asset}
        open={action === 'change-management'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <ChangeCompanyDialog
        asset={asset}
        open={action === 'change-company'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <ReturnDialog
        asset={asset}
        open={action === 'return'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <ToggleDialog
        asset={asset}
        mode="disable"
        open={action === 'disable'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
      <ToggleDialog
        asset={asset}
        mode="enable"
        open={action === 'enable'}
        onOpenChange={(o) => !o && close()}
        onDone={done}
      />
    </>
  )
}

function MoreVerticalIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}
