import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Shield,
  Layers,
  BadgeCheck,
  UserCog,
  User,
  Info,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { cn } from '@/lib/utils'
import { numberWithDots } from '@/lib/format'
import { useSession } from '@/store/session'
import {
  searchUserSetting,
  saveUserSetting,
  deleteUserSetting,
  fetchRoleList,
  fetchEmployeeList,
  fetchAdminAccessLookups,
  type UserSettingRow,
  type RoleOption,
  type EmployeeOption,
  type ManagementOption,
} from '@/api/settings'

// Nilai sentinel untuk scope [ALL] management (SecurityLevel 'HO' di backend).
const MGMT_ALL = '0'
const PAGE_SIZE = 10

/** [ALL] management = SecurityLevel 'HO' (akses lintas-management). */
function isAllScope(r: UserSettingRow): boolean {
  return (r.SecurityLevel || '').toUpperCase() === 'HO'
}
/** Scope Management sudah di-set ([ALL]/HO ATAU 1 management tertentu). */
function hasManagement(r: UserSettingRow): boolean {
  return isAllScope(r) || r.IDX_M_AssetManagement != null
}

export default function UserRolesScreen() {
  // NIK user login — dipakai mencegah hapus akses diri sendiri (biar tak terkunci).
  const meNik = useSession((s) => s.user?.nik)
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [data, setData] = useState<UserSettingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filter + paging (client-side).
  const [roleFilter, setRoleFilter] = useState('all')
  const [mgmtFilter, setMgmtFilter] = useState('all')
  const [page, setPage] = useState(1)

  // Lookups (dimuat saat modal pertama dibuka).
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [managements, setManagements] = useState<ManagementOption[]>([])
  const [users, setUsers] = useState<EmployeeOption[]>([])
  const [lookupsLoaded, setLookupsLoaded] = useState(false)

  // Modal Assign/Edit.
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<UserSettingRow | null>(null)
  const [nik, setNik] = useState('')
  const [roleIdx, setRoleIdx] = useState('')
  const [mgmtIdx, setMgmtIdx] = useState(MGMT_ALL)
  const [saving, setSaving] = useState(false)

  // Delete confirm.
  const [deleteTarget, setDeleteTarget] = useState<UserSettingRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    const t = setTimeout(() => setKeyword(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const reqId = useRef(0)
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    searchUserSetting(keyword)
      .then((list) => {
        if (id !== reqId.current) return
        setData(list)
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return
        setData([])
        setError(e instanceof Error ? e.message : 'Gagal memuat data')
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [keyword, reloadKey])

  // Opsi filter diturunkan dari data (tanpa fetch tambahan).
  const roleFilterOptions = useMemo(() => {
    const seen = new Map<number, string>()
    data.forEach((r) => {
      if (r.IDX_M_GroupsRole != null && r.RoleName) seen.set(r.IDX_M_GroupsRole, r.RoleName)
    })
    return [...seen.entries()].map(([v, l]) => ({ value: String(v), label: l }))
  }, [data])

  const mgmtFilterOptions = useMemo(() => {
    const seen = new Map<string, string>()
    let hasAll = false
    data.forEach((r) => {
      if (isAllScope(r)) hasAll = true
      else if (r.IDX_M_AssetManagement != null)
        seen.set(String(r.IDX_M_AssetManagement), r.AssetManagementName || '—')
    })
    const opts = [...seen.entries()].map(([v, l]) => ({ value: v, label: l }))
    if (hasAll) opts.unshift({ value: 'ALL', label: '[ALL] Management' })
    return opts
  }, [data])

  const filtered = useMemo(
    () =>
      data.filter(
        (r) =>
          (roleFilter === 'all' || String(r.IDX_M_GroupsRole) === roleFilter) &&
          (mgmtFilter === 'all' ||
            (mgmtFilter === 'ALL'
              ? isAllScope(r)
              : !isAllScope(r) && String(r.IDX_M_AssetManagement) === mgmtFilter)),
      ),
    [data, roleFilter, mgmtFilter],
  )

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (page - 1) * PAGE_SIZE
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  // Progress mapping: user "lengkap" bila punya Role DAN scope Management.
  const mappedCount = useMemo(
    () => data.filter((r) => !!r.RoleName && hasManagement(r)).length,
    [data],
  )
  const incompleteCount = data.length - mappedCount
  const mapPct = data.length ? Math.round((mappedCount / data.length) * 100) : 0

  // Reset ke halaman 1 saat filter / keyword berubah.
  useEffect(() => setPage(1), [roleFilter, mgmtFilter, keyword])
  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const userOptions: ComboboxOption[] = useMemo(
    () =>
      users.map((u) => ({
        value: u.NIK,
        label: u.Name,
        hint: u.Jabatan ? `${u.NIK} · ${u.Jabatan}` : u.NIK,
      })),
    [users],
  )
  const picked = useMemo(() => {
    if (editing) return { name: editing.Name || '', jabatan: editing.Jabatan || '' }
    const u = users.find((x) => x.NIK === nik)
    return { name: u?.Name || '', jabatan: u?.Jabatan || '' }
  }, [editing, users, nik])

  async function ensureLookups() {
    if (lookupsLoaded) return
    try {
      const [rl, adm, ul] = await Promise.all([
        fetchRoleList(),
        fetchAdminAccessLookups(),
        fetchEmployeeList(),
      ])
      setRoles(rl)
      // Lookup sudah punya baris placeholder "[ALL]" (IDX 0); buang supaya tak
      // dobel dengan item [ALL] milik kita (MGMT_ALL='0') di dropdown.
      setManagements(adm.managements.filter((m) => m.IDX_M_AssetManagement > 0))
      setUsers(ul)
      setLookupsLoaded(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data pilihan')
    }
  }

  async function openAdd() {
    setEditing(null)
    setNik('')
    setRoleIdx('')
    setMgmtIdx(MGMT_ALL)
    setOpen(true)
    await ensureLookups()
  }

  async function openEdit(row: UserSettingRow) {
    setEditing(row)
    setNik(row.NIK)
    setRoleIdx(row.IDX_M_GroupsRole != null ? String(row.IDX_M_GroupsRole) : '')
    // Specific mgmt → id; HO/[ALL] atau belum di-set → default [ALL].
    setMgmtIdx(row.IDX_M_AssetManagement != null ? String(row.IDX_M_AssetManagement) : MGMT_ALL)
    setOpen(true)
    await ensureLookups()
  }

  async function save() {
    if (!nik.trim()) {
      toast.error('Karyawan wajib dipilih')
      return
    }
    if (!roleIdx) {
      toast.error('Role wajib dipilih')
      return
    }
    setSaving(true)
    try {
      const msg = await saveUserSetting({
        NIK: nik.trim(),
        IDX_M_GroupsRole: Number(roleIdx),
        IDX_M_AssetManagement: Number(mgmtIdx), // 0 = [ALL]
      })
      toast.success(msg || 'User dipetakan ke Role & Management')
      setOpen(false)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const msg = await deleteUserSetting(deleteTarget.NIK)
      toast.success(msg || 'Mapping user dihapus')
      setDeleteTarget(null)
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="User Setting"
        description="Assign tiap user ke sebuah Role + tentukan scope Management ([ALL] atau 1 management). Hanya untuk user yang punya akses sistem."
        action={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Assign User
          </Button>
        }
      />

      {/* Progress mapping — muncul selama masih ada user tanpa Role / Management. */}
      {!loading && !error && incompleteCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              {numberWithDots(incompleteCount)} user belum lengkap (Role / Management)
            </p>
            <p className="text-xs text-amber-800/80">
              <b>
                {numberWithDots(mappedCount)} dari {numberWithDots(data.length)}
              </b>{' '}
              user sudah dipetakan ke Role + scope Management. Lengkapi agar tidak ada user
              kehilangan akses.
            </p>
          </div>
          <div
            className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(#b45309 ${mapPct}%, #fde68a ${mapPct}%)` }}
            role="img"
            aria-label={`${mapPct}% sudah dipetakan`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-[11px] font-bold text-amber-800">
              {mapPct}%
            </span>
          </div>
        </div>
      )}

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
          {/* Toolbar: search + filter Role/Management + jumlah */}
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari NIK, nama, atau role…"
                className="pl-9"
                aria-label="Cari NIK, nama, atau role"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-auto gap-1.5 rounded-full" aria-label="Filter Role">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                {roleFilterOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mgmtFilter} onValueChange={setMgmtFilter}>
              <SelectTrigger className="h-9 w-auto gap-1.5 rounded-full" aria-label="Filter Management">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Management" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Management</SelectItem>
                {mgmtFilterOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="ml-auto shrink-0 pr-1 text-xs text-muted-foreground">
              {loading ? 'memuat…' : `${numberWithDots(filtered.length)} user`}
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">NIK</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Management (scope)</TableHead>
                <TableHead className="w-28 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
                  const incomplete = !r.RoleName || !hasManagement(r)
                  const isSelf = String(r.NIK).trim() === String(meNik ?? '').trim()
                  return (
                    <TableRow key={r.NIK} className={cn(incomplete && 'bg-amber-50/60')}>
                      <TableCell className="font-mono tabular-nums text-muted-foreground">
                        {String(r.NIK).trim()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.Name || '—'}</div>
                        {r.Jabatan && (
                          <div className="text-xs text-muted-foreground">{r.Jabatan}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.RoleName ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-primary/30 bg-primary/10 text-primary"
                          >
                            <Shield className="h-3 w-3" /> {r.RoleName}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="gap-1 border-amber-300 bg-amber-50 text-amber-700"
                          >
                            <AlertTriangle className="h-3 w-3" /> Belum di-assign
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAllScope(r) ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            <BadgeCheck className="h-3.5 w-3.5" /> [ALL] Management
                          </span>
                        ) : hasManagement(r) ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />{' '}
                            {r.AssetManagementName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">— belum di-set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {incomplete ? (
                          <div className="flex justify-center">
                            <Button size="sm" onClick={() => openEdit(r)}>
                              <Plus className="h-4 w-4" /> Map
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ubah ${r.Name}`}
                              className="h-8 w-8"
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Hapus ${r.Name}`}
                              className="h-8 w-8 text-rose-600 hover:text-rose-600"
                              disabled={isSelf}
                              title={isSelf ? 'Tidak bisa hapus akses diri sendiri' : undefined}
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pager */}
          {!loading && filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-3 text-sm">
              <span className="text-muted-foreground">
                Menampilkan{' '}
                <b className="text-foreground">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}
                </b>{' '}
                dari <b className="text-foreground">{numberWithDots(filtered.length)}</b> user
              </span>
              {pageCount > 1 && <UserPager page={page} pageCount={pageCount} onChange={setPage} />}
            </div>
          )}
        </Card>
      )}

      {/* Modal: Assign / edit user ke Role + Management */}
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-primary/10 text-primary">
                <UserCog className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <DialogTitle>Assign User ke Role</DialogTitle>
                <DialogDescription>NIK + Role + scope Management</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>
                NIK Karyawan <span className="text-destructive">*</span>
              </Label>
              <Combobox
                id="us-user"
                title="Pilih Karyawan"
                value={nik}
                onChange={setNik}
                options={userOptions}
                disabled={!!editing}
                placeholder="Cari NIK / nama (sumber HRIS)…"
              />
              <p className="text-xs text-muted-foreground">
                Nama terisi otomatis dari karyawan terpilih.
              </p>
              {picked.name && (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {picked.name}
                    {picked.jabatan ? ` · ${picked.jabatan}` : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Role Name <span className="text-destructive">*</span>
                </Label>
                <Select value={roleIdx} onValueChange={setRoleIdx}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.IDX_M_GroupsRole} value={String(r.IDX_M_GroupsRole)}>
                        {r.GroupRole_Name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Management <span className="text-destructive">*</span>
                </Label>
                <Select value={mgmtIdx} onValueChange={setMgmtIdx}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih management" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MGMT_ALL}>[ALL] — semua management</SelectItem>
                    {managements.map((m) => (
                      <SelectItem
                        key={m.IDX_M_AssetManagement}
                        value={String(m.IDX_M_AssetManagement)}
                      >
                        {m.AssetManagementName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <span>
                Data asset yang tampil untuk user ini akan difilter sesuai Management terpilih.
                Pilih <span className="font-mono">[ALL]</span> untuk akses lintas management.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus mapping user?</DialogTitle>
            <DialogDescription>
              Role &amp; scope Management untuk{' '}
              <b className="text-foreground">{deleteTarget?.Name || deleteTarget?.NIK}</b> akan
              dilepas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Batal
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Pager windowed: ‹ 1 2 … N › (current ±1). */
function UserPager({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (p: number) => void
}) {
  const pages: (number | '…')[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pageCount - 1, page + 1)
  if (from > 2) pages.push('…')
  for (let p = from; p <= to; p++) pages.push(p)
  if (to < pageCount - 1) pages.push('…')
  if (pageCount > 1) pages.push(pageCount)
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Sebelumnya"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-foreground hover:bg-muted disabled:opacity-40"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`g-${i}`} className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'h-8 min-w-8 rounded-md px-2 text-sm tabular-nums transition-colors',
              p === page ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
            )}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Berikutnya"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-foreground hover:bg-muted disabled:opacity-40"
      >
        ›
      </button>
    </div>
  )
}
