import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Search,
  AlertCircle,
  Loader2,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { numberWithDots } from '@/lib/format'
import {
  searchUserRoles,
  fetchUserList,
  fetchUserFormTemplate,
  fetchUserAccessByNIK,
  saveUserRoles,
  updateUserRoles,
  type UserRoleRow,
  type FormAccess,
  type UserListOption,
} from '@/api/settings'

type AccessFlag = 'isRead' | 'isInsert' | 'isUpdate' | 'isDelete'

export default function UserRolesScreen() {
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [data, setData] = useState<UserRoleRow[]>([])
  const [canCreate, setCanCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Selectable users for the add form (loaded lazily).
  const [userList, setUserList] = useState<UserListOption[]>([])

  // Role editor drawer state.
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add')
  const [drawerNIK, setDrawerNIK] = useState<string>('') // target NIK (edit) or picked NIK (add)
  const [drawerName, setDrawerName] = useState<string>('')
  const [forms, setForms] = useState<FormAccess[]>([])
  const [formsLoading, setFormsLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
    searchUserRoles(keyword)
      .then((r) => {
        if (id !== reqId.current) return
        setData(r.list)
        setCanCreate(r.page?.isNew === 1)
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
    () => userList.map((u) => ({ value: u.NIK, label: u.Name, hint: u.NIK })),
    [userList],
  )

  async function openAdd() {
    setDrawerMode('add')
    setDrawerNIK('')
    setDrawerName('')
    setForms([])
    setDrawerOpen(true)
    setFormsLoading(true)
    try {
      const [tpl, list] = await Promise.all([fetchUserFormTemplate(), fetchUserList()])
      setForms(tpl)
      setUserList(list)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data form')
    } finally {
      setFormsLoading(false)
    }
  }

  async function openEdit(row: UserRoleRow) {
    setDrawerMode('edit')
    setDrawerNIK(row.NIK)
    setDrawerName(row.Name)
    setForms([])
    setDrawerOpen(true)
    setFormsLoading(true)
    try {
      const access = await fetchUserAccessByNIK(row.NIK)
      setForms(access)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat akses user')
    } finally {
      setFormsLoading(false)
    }
  }

  function toggleFlag(idx: number, flag: AccessFlag, checked: boolean) {
    setForms((prev) =>
      prev.map((f) =>
        f.IDX_M_Forms === idx ? { ...f, [flag]: checked ? 1 : 0 } : f,
      ),
    )
  }

  async function save() {
    const nik = drawerNIK.trim()
    if (!nik) {
      toast.error('User wajib dipilih')
      return
    }
    if (forms.length === 0) {
      toast.error('Data form belum termuat')
      return
    }
    setSaving(true)
    try {
      const msg =
        drawerMode === 'add'
          ? await saveUserRoles(nik, forms)
          : await updateUserRoles(nik, forms)
      toast.success(msg || 'Akses user disimpan')
      setDrawerOpen(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const colSpan = 3

  return (
    <>
      <PageHeader
        title="User Setting"
        description={loading ? 'Memuat…' : `${numberWithDots(data.length)} pengguna`}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/master">
                <ArrowLeft className="h-4 w-4" /> Master
              </Link>
            </Button>
            {canCreate && (
              <Button onClick={openAdd}>
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
                <TableHead className="w-40">NIK</TableHead>
                <TableHead>Nama</TableHead>
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
                  <TableRow key={r.NIK}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {String(r.NIK).trim()}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{r.Name}</TableCell>
                    <TableCell aria-label="Aksi">
                      <div className="flex justify-end gap-1">
                        {r.isUpdate === 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ubah akses ${r.Name}`}
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                          >
                            <Pencil className="h-4 w-4" />
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

      {/* Role editor drawer (ported from legacy CsRole) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {drawerMode === 'add' ? 'Tambah Akses User' : 'Ubah Akses User'}
            </SheetTitle>
            <SheetDescription>
              {drawerMode === 'edit'
                ? `${String(drawerNIK).trim()} / ${drawerName}`
                : 'Pilih user lalu atur akses per form.'}
            </SheetDescription>
          </SheetHeader>

          {drawerMode === 'add' && (
            <div className="space-y-1.5 pb-3">
              <Label>User</Label>
              <Combobox
                id="role-user"
                title="Pilih User"
                value={drawerNIK}
                onChange={setDrawerNIK}
                options={userOptions}
                disabled={formsLoading}
                placeholder="Pilih user"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead className="w-14 text-center">Read</TableHead>
                  <TableHead className="w-14 text-center">Insert</TableHead>
                  <TableHead className="w-14 text-center">Update</TableHead>
                  <TableHead className="w-14 text-center">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formsLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : forms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Tidak ada form.
                    </TableCell>
                  </TableRow>
                ) : (
                  forms.map((f) => {
                    const disabled = !!f.isReadOnly
                    return (
                      <TableRow key={f.IDX_M_Forms}>
                        <TableCell className="text-xs font-medium text-foreground">
                          {f.Form_Name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            aria-label={`Read ${f.Form_Name}`}
                            checked={!!f.isRead}
                            onCheckedChange={(c) => toggleFlag(f.IDX_M_Forms, 'isRead', c === true)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            aria-label={`Insert ${f.Form_Name}`}
                            checked={!!f.isInsert}
                            disabled={disabled}
                            onCheckedChange={(c) => toggleFlag(f.IDX_M_Forms, 'isInsert', c === true)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            aria-label={`Update ${f.Form_Name}`}
                            checked={!!f.isUpdate}
                            disabled={disabled}
                            onCheckedChange={(c) => toggleFlag(f.IDX_M_Forms, 'isUpdate', c === true)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            aria-label={`Delete ${f.Form_Name}`}
                            checked={!!f.isDelete}
                            disabled={disabled}
                            onCheckedChange={(c) => toggleFlag(f.IDX_M_Forms, 'isDelete', c === true)}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDrawerOpen(false)}
            >
              Batal
            </Button>
            <Button type="button" onClick={save} disabled={saving || formsLoading}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {drawerMode === 'add' ? 'Simpan' : 'Perbarui'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
