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
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { numberWithDots } from '@/lib/format'
import {
  fetchGroupAccessLookups,
  searchGroupAccess,
  saveGroupAccess,
  updateGroupAccess,
  deleteGroupAccess,
  type GroupAccessRow,
  type GroupAccessLookups,
} from '@/api/settings'

interface FormState {
  nik: string
  group: string
}

const EMPTY: FormState = { nik: '', group: '' }

/**
 * The Group Access stored procedures (usp_CMS_AssetGroupAccess_*) are not
 * deployed to the dev database, so the BFF returns a "Could not find stored
 * procedure" error. Detect that so we show a clear "feature unavailable" notice
 * instead of a scary red load error.
 */
function isMissingSp(msg: string | null | undefined): boolean {
  return !!msg && /could not find stored procedure/i.test(msg)
}

export default function GroupAccessScreen() {
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [data, setData] = useState<GroupAccessRow[]>([])
  const [canCreate, setCanCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [lookups, setLookups] = useState<GroupAccessLookups | null>(null)
  const [lookupsError, setLookupsError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GroupAccessRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<GroupAccessRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    let alive = true
    fetchGroupAccessLookups()
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

  useEffect(() => {
    const t = setTimeout(() => setKeyword(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const reqId = useRef(0)
  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    searchGroupAccess(keyword)
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
  }, [keyword, reloadKey])

  const userOptions: ComboboxOption[] = useMemo(
    () =>
      lookups?.users.map((u) => ({
        value: u.NIK,
        label: u.Name,
        hint: u.NIK,
      })) ?? [],
    [lookups],
  )

  function openAdd() {
    setEditing(null)
    setForm(EMPTY)
    setDialogOpen(true)
  }

  function openEdit(row: GroupAccessRow) {
    setEditing(row)
    setForm({ nik: row.NIK, group: String(row.IDX_M_AssetGroup ?? '') })
    setDialogOpen(true)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!editing && !form.nik) {
      toast.error('Karyawan wajib dipilih')
      return
    }
    if (!form.group) {
      toast.error('Group wajib dipilih')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const msg = await updateGroupAccess({
          IDX_T_AssetGroup: editing.IDX_T_AssetGroup,
          IDX_M_AssetGroup: Number(form.group),
        })
        toast.success(msg || 'Group access diperbarui')
      } else {
        const msg = await saveGroupAccess({
          NIK: form.nik,
          IDX_M_AssetGroup: Number(form.group),
        })
        toast.success(msg || 'Group access ditambahkan')
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
      const msg = await deleteGroupAccess(deleteTarget.IDX_T_AssetGroup)
      toast.success(msg || `${deleteTarget.Name} dihapus`)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  const colSpan = 5

  return (
    <>
      <PageHeader
        title="Group Access"
        description={loading ? 'Memuat…' : `${numberWithDots(data.length)} pengguna`}
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

      {error && isMissingSp(error) ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-foreground">Fitur belum tersedia</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Stored procedure Group Access (<code>usp_CMS_AssetGroupAccess_*</code>) belum
                di-deploy di database ini, jadi data belum bisa dimuat. Hubungi admin database
                untuk menambahkannya.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
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
                <TableHead>Group</TableHead>
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
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-10 text-center text-muted-foreground">
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((r) => (
                  <TableRow key={r.IDX_T_AssetGroup}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {String(r.NIK).trim()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.Name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.DepartmentName || '-'}
                    </TableCell>
                    <TableCell>
                      {r.AssetGroupName ? (
                        <Badge variant="secondary">{r.AssetGroupName}</Badge>
                      ) : (
                        '-'
                      )}
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

      {lookupsError && !isMissingSp(lookupsError) && !isMissingSp(error) && (
        <p className="mt-3 text-xs text-destructive">Gagal memuat pilihan: {lookupsError}</p>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Ubah Group Access' : 'Tambah Group Access'}</DialogTitle>
            {editing && (
              <DialogDescription>
                {editing.NIK} / {editing.Name}
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {!editing && (
              <div className="space-y-1.5">
                <Label>Nama Karyawan</Label>
                <Combobox
                  id="group-user"
                  title="Pilih Karyawan"
                  value={form.nik}
                  onChange={(v) => set('nik', v)}
                  options={userOptions}
                  disabled={!lookups}
                  placeholder="Pilih karyawan"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Asset Group</Label>
              <Select
                value={form.group}
                onValueChange={(v) => set('group', v)}
                disabled={!lookups}
              >
                <SelectTrigger aria-label="Group">
                  <SelectValue placeholder="Pilih group" />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.groups.map((g) => (
                    <SelectItem key={g.IDX_M_AssetGroup} value={String(g.IDX_M_AssetGroup)}>
                      {g.AssetGroupName}
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
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
            <DialogTitle>Hapus group access?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Group access untuk{' '}
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
