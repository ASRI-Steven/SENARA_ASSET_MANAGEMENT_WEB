import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  Loader2,
  UserCog,
  Info,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { numberWithDots } from '@/lib/format'
import {
  fetchAdminAccessLookups,
  searchAdminAccess,
  fetchAdminAccessByNIK,
  saveAdminAccess,
  updateAdminAccess,
  deleteAdminAccess,
  type AdminAccessRow,
  type AdminAccessLookups,
} from '@/api/settings'

interface FormState {
  nik: string
  security: string
  management: string
  company: string
}

const EMPTY: FormState = { nik: '', security: '', management: '', company: '' }

// Sentinel value for cross-management access. TODO: wire this to the backend
// (currently the submit handler still sends Number(form.management)).
const MANAGEMENT_ALL = 'ALL'

export default function AdminAccessScreen() {
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [data, setData] = useState<AdminAccessRow[]>([])
  const [canCreate, setCanCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // The admin-access search SP filters on NIK only, but users expect to search
  // by name/department too (matching the legacy grid, which filtered the full
  // list client-side). The list is small (dozens of rows), so we load it whole
  // and filter in-memory across NIK + Name + Department.
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return data
    return data.filter((r) =>
      [String(r.NIK), r.Name, r.DepartmentName ?? '']
        .some((f) => f.toLowerCase().includes(q)),
    )
  }, [data, keyword])

  const [lookups, setLookups] = useState<AdminAccessLookups | null>(null)
  const [lookupsError, setLookupsError] = useState<string | null>(null)

  // Add / edit dialog.
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminAccessRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete confirmation.
  const [deleteTarget, setDeleteTarget] = useState<AdminAccessRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Load lookups once.
  useEffect(() => {
    let alive = true
    fetchAdminAccessLookups()
      .then((l) => {
        if (alive) setLookups(l)
      })
      .catch((e: unknown) => {
        if (alive) setLookupsError(e instanceof Error ? e.message : 'Gagal memuat data pilihan')
      })
    return () => {
      alive = false
    }
  }, [])

  // Debounce the search box into `keyword`.
  useEffect(() => {
    const t = setTimeout(() => setKeyword(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const reqId = useRef(0)
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    // Load the full list once; filtering happens client-side (see `filtered`).
    searchAdminAccess('')
      .then((r) => {
        if (id !== reqId.current) return
        setData(r.list)
        setCanCreate(r.canCreate)
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return
        setData([])
        setError(e instanceof Error ? e.message : 'Gagal memuat data')
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [reloadKey])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  async function openEdit(row: AdminAccessRow) {
    setEditing(row)
    setForm({ nik: row.NIK, security: '', management: '', company: '' })
    setDialogOpen(true)
    setDetailLoading(true)
    try {
      const detail = await fetchAdminAccessByNIK(row.NIK)
      if (detail) {
        setForm({
          nik: row.NIK,
          security: detail.SecurityLevel ?? '',
          management: String(detail.IDX_M_AssetManagement ?? ''),
          company: String(detail.IDX_M_Company ?? ''),
        })
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat detail')
    } finally {
      setDetailLoading(false)
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!editing && !form.nik.trim()) {
      toast.error('NIK wajib diisi')
      return
    }
    if (!form.security) {
      toast.error('Security wajib dipilih')
      return
    }
    if (!form.management) {
      toast.error('Management wajib dipilih')
      return
    }
    if (!form.company) {
      toast.error('Company wajib dipilih')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const msg = await updateAdminAccess({
          IDX_T_AssetAdminAccess: editing.IDX_T_AssetAdminAccess,
          SecurityLevel: form.security,
          IDX_M_AssetManagement: Number(form.management),
          IDX_M_Company: Number(form.company),
        })
        toast.success(msg || 'Admin access diperbarui')
      } else {
        const msg = await saveAdminAccess({
          NIK: form.nik.trim(),
          SecurityLevel: form.security,
          IDX_M_AssetManagement: Number(form.management),
          IDX_M_Company: Number(form.company),
        })
        toast.success(msg || 'Admin access ditambahkan')
      }
      setDialogOpen(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const msg = await deleteAdminAccess(deleteTarget.IDX_T_AssetAdminAccess)
      toast.success(msg || `${deleteTarget.Name} dihapus`)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  const colSpan = 4

  return (
    <>
      <PageHeader
        title="Admin Access"
        description={loading ? 'Memuat…' : `${numberWithDots(filtered.length)} pengguna`}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/master">
                <ArrowLeft className="h-4 w-4" /> Master
              </Link>
            </Button>
            {canCreate && (
              <Button onClick={openAdd} disabled={!lookups}>
                <Plus className="h-4 w-4" /> Tambah
              </Button>
            )}
          </div>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Cari pengguna…"
          className="pl-9"
          aria-label="Cari pengguna"
        />
      </div>

      {error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">Gagal memuat data</p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" onClick={reload}>
              <Loader2 className="h-3.5 w-3.5" /> Coba lagi
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">NIK</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Departemen</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={colSpan}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.IDX_T_AssetAdminAccess}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {String(r.NIK).trim()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.Name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.DepartmentName || '-'}
                    </TableCell>
                    <TableCell aria-label="Aksi">
                      <div className="flex justify-end gap-1">
                        {r.isUpdate === 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ubah ${r.Name}`}
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {r.isDelete === 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus ${r.Name}`}
                            className="h-8 w-8 text-rose-600 hover:text-rose-600"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {lookupsError && (
        <p className="mt-3 text-xs text-destructive">Gagal memuat pilihan: {lookupsError}</p>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="h-[18px] w-[18px]" />
              </span>
              <div className="space-y-1">
                <DialogTitle>Assign User ke Role</DialogTitle>
                <DialogDescription>NIK + Role + scope Management</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label htmlFor="admin-nik">NIK Karyawan *</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-nik"
                    value={form.nik}
                    onChange={(e) => set('nik', e.target.value)}
                    placeholder="Cari NIK / nama (sumber HRIS)…"
                    className="pl-9"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nama, jabatan &amp; unit terisi otomatis dari HRIS.
                </p>
              </div>
            )}

            {editing && (
              <div className="space-y-1.5">
                <Label>Department Name</Label>
                <Input value={editing.DepartmentName || '-'} readOnly disabled />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Role Name</Label>
              <Select
                value={form.security}
                onValueChange={(v) => set('security', v)}
                disabled={!lookups || detailLoading}
              >
                <SelectTrigger aria-label="Security">
                  <SelectValue placeholder="Pilih security" />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.securityLevels
                    .filter((s) => s.SecurityLevel !== '')
                    .map((s) => (
                      <SelectItem key={s.SecurityLevel} value={s.SecurityLevel}>
                        {s.SecurityLevelName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Management</Label>
              <Select
                value={form.management}
                onValueChange={(v) => set('management', v)}
                disabled={!lookups || detailLoading}
              >
                <SelectTrigger aria-label="Management">
                  <SelectValue placeholder="Pilih management" />
                </SelectTrigger>
                <SelectContent>
                  {/* TODO: wire MANAGEMENT_ALL sentinel to the submit handler / endpoint. */}
                  <SelectItem value={MANAGEMENT_ALL}>[ALL] — semua management</SelectItem>
                  {lookups?.managements.map((m) => (
                    <SelectItem key={m.IDX_M_AssetManagement} value={String(m.IDX_M_AssetManagement)}>
                      {m.AssetManagementName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                <span>
                  Data asset yang tampil untuk user ini akan difilter sesuai Management terpilih.
                  Pilih [ALL] untuk akses lintas management.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select
                value={form.company}
                onValueChange={(v) => set('company', v)}
                disabled={!lookups || detailLoading}
              >
                <SelectTrigger aria-label="Company">
                  <SelectValue placeholder="Pilih company" />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.companies.map((c) => (
                    <SelectItem key={c.IDX_M_Company} value={String(c.IDX_M_Company)}>
                      {c.CompanyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={saving || detailLoading}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus akses admin?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Akses admin untuk{' '}
                  <span className="font-medium text-foreground">
                    {deleteTarget.Name} / {String(deleteTarget.NIK).trim()}
                  </span>{' '}
                  akan dihapus. Tindakan ini tidak dapat dibatalkan.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Batal
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
