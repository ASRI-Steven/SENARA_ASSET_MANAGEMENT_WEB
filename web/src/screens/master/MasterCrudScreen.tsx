import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  Loader2,
  Power,
  PowerOff,
  ChevronLeft,
  ChevronRight,
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
  DialogClose,
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
  getMasterMeta,
  searchMaster,
  saveMaster,
  updateMaster,
  disableMaster,
  enableMaster,
  deleteMaster,
  rowName,
  rowCount,
  rowIdx,
  rowCode,
  type MasterRow,
  type MasterEntityMeta,
  type MasterFormField,
} from '@/api/master'

// Rows shown per page in the master tables (client-side paging so long lists
// like Location / User don't run off the bottom of the screen).
const PAGE_SIZE = 10

export default function MasterCrudScreen() {
  const { entity = '' } = useParams()
  const meta = getMasterMeta(entity)

  if (!meta) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Master "{entity}" tidak ditemukan.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/master">Kembali</Link>
        </Button>
      </div>
    )
  }

  return <MasterCrud meta={meta} />
}

function MasterCrud({ meta }: { meta: MasterEntityMeta }) {
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')

  const [data, setData] = useState<MasterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // The create/edit form fields (legacy order). Simple masters get a code?+name
  // form; richer ones (Type Model, User) declare formFields in their meta.
  const fieldDefs: MasterFormField[] = meta.formFields ?? [
    ...(meta.codeKey
      ? [{ param: meta.codeKey, label: meta.codeLabel ?? 'Kode', control: 'text' as const }]
      : []),
    { param: meta.nameKey, label: meta.nameLabel ?? 'Nama', control: 'text' as const },
  ]

  // Edit/create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MasterRow | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  // Options for any select field (e.g. Type Model's parent Type), keyed by param.
  const [selectOptions, setSelectOptions] = useState<
    Record<string, { value: string; label: string }[]>
  >({})

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MasterRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Per-row busy state (enable/disable), keyed by idx.
  const [busyIdx, setBusyIdx] = useState<number | null>(null)

  // Client-side paging.
  const [page, setPage] = useState(1)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  // Debounce the search box into `keyword` (SP filters server-side by Keyword).
  useEffect(() => {
    const t = setTimeout(() => setKeyword(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Ignore stale responses when queries race.
  const reqId = useRef(0)

  useEffect(() => {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    searchMaster(meta.key, keyword)
      .then((r) => {
        if (id !== reqId.current) return
        setData(r)
      })
      .catch((e: unknown) => {
        if (id !== reqId.current) return
        setData([])
        setError(e instanceof Error ? e.message : 'Gagal memuat data')
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false)
      })
  }, [meta.key, keyword, reloadKey])

  // Reset to the first page whenever the result set changes.
  useEffect(() => {
    setPage(1)
  }, [meta.key, keyword])

  // Lazily load dropdown options for any select field when the dialog opens.
  useEffect(() => {
    if (!dialogOpen) return
    let alive = true
    for (const f of fieldDefs) {
      if (f.control !== 'select' || !f.optionsFrom || selectOptions[f.param]) continue
      searchMaster(f.optionsFrom)
        .then((opts) => {
          if (!alive) return
          setSelectOptions((prev) => ({
            ...prev,
            [f.param]: opts
              .map((o) => ({
                value: String(o[f.optionValueKey ?? ''] ?? ''),
                label: String(o[f.optionLabelKey ?? ''] ?? ''),
              }))
              .filter((o) => o.value),
          }))
        })
        .catch(() => {
          if (alive) toast.error(`Gagal memuat pilihan ${f.label}`)
        })
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, meta.key])

  // Current page slice (clamp so a shrinking list never strands us past the end).
  const maxPage = Math.max(1, Math.ceil(data.length / PAGE_SIZE))
  const currentPage = Math.min(page, maxPage)
  const pageRows = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const rangeStart = data.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, data.length)

  function openAdd() {
    setEditing(null)
    setValues(Object.fromEntries(fieldDefs.map((f) => [f.param, ''])))
    setDialogOpen(true)
  }

  function openEdit(row: MasterRow) {
    setEditing(row)
    setValues(
      Object.fromEntries(
        fieldDefs.map((f) => {
          const raw = row[f.rowValueKey ?? f.param]
          return [f.param, raw == null ? '' : String(raw)]
        }),
      ),
    )
    setDialogOpen(true)
  }

  // Build the SP field payload for save/update from the form fields.
  function buildFields(forUpdate: boolean, row?: MasterRow): Record<string, unknown> {
    const fields: Record<string, unknown> = {}
    if (forUpdate && row) fields[meta.idxKey] = rowIdx(meta, row)
    for (const f of fieldDefs) fields[f.param] = (values[f.param] ?? '').trim()
    return fields
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    // Every non-optional field must be filled (mirrors legacy "required" rules).
    for (const f of fieldDefs) {
      if (!f.optional && !(values[f.param] ?? '').trim()) {
        toast.error(`${f.label} wajib diisi`)
        return
      }
    }
    setSaving(true)
    try {
      if (editing) {
        const msg = await updateMaster(meta.key, buildFields(true, editing))
        toast.success(msg || `${meta.label} diperbarui`)
      } else {
        const msg = await saveMaster(meta.key, buildFields(false))
        toast.success(msg || `${meta.label} ditambahkan`)
      }
      setDialogOpen(false)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(row: MasterRow) {
    const idx = rowIdx(meta, row)
    if (idx == null) return
    setBusyIdx(idx)
    try {
      const isEnabled = String(row.Status).toUpperCase() === 'ENABLED'
      const msg = isEnabled
        ? await disableMaster(meta, idx)
        : await enableMaster(meta, idx)
      toast.success(msg || (isEnabled ? 'Dinonaktifkan' : 'Diaktifkan'))
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status')
    } finally {
      setBusyIdx(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const idx = rowIdx(meta, deleteTarget)
    if (idx == null) return
    setDeleting(true)
    try {
      // Legacy calls the delete SP directly; it only succeeds on rows already
      // disabled (the user disables first via the action menu).
      const msg = await deleteMaster(meta, idx)
      toast.success(msg || `${rowName(meta, deleteTarget)} dihapus`)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setDeleting(false)
    }
  }

  const hasCode = !!meta.codeKey
  const showCount = !meta.hideCount
  const colSpan = 1 + (hasCode ? 1 : 0) + (showCount ? 1 : 0) + 1 // [code], name, [count], setting
  // Entity-specific column headers to mirror the legacy masters
  // (e.g. "Asset Brand Name" / "Asset Brand Count"). User is the exception.
  const nameHeader = meta.key === 'user' ? 'Name' : `${meta.label} Name`
  const countHeader = `${meta.label} Count`
  // Short entity name for dialog titles: "Asset Brand" -> "Brand".
  const shortName = meta.label.replace(/^Asset\s+/, '')

  return (
    <>
      <PageHeader
        title={meta.label}
        description={loading ? 'Memuat…' : `${numberWithDots(data.length)} item`}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/master">
                <ArrowLeft className="h-4 w-4" /> Master
              </Link>
            </Button>
            {meta.editable && (
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
          placeholder={`Search ${shortName}`}
          className="pl-9"
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
                {hasCode && <TableHead className="w-32">{meta.codeLabel}</TableHead>}
                <TableHead>{nameHeader}</TableHead>
                {showCount && <TableHead className="text-right">{countHeader}</TableHead>}
                <TableHead className="w-32 text-right">Setting</TableHead>
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
                  <TableCell
                    colSpan={colSpan}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Tidak ada data.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r, i) => {
                  const idx = rowIdx(meta, r)
                  const enabled = String(r.Status).toUpperCase() === 'ENABLED'
                  const busy = busyIdx != null && busyIdx === idx
                  return (
                    <TableRow key={idx ?? i} className={enabled ? '' : 'opacity-60'}>
                      {hasCode && (
                        <TableCell className="text-muted-foreground">
                          {rowCode(meta, r) || '-'}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {rowName(meta, r) || '-'}
                          </span>
                          {meta.key === 'user' && rowCode(meta, r) && (
                            <span className="text-xs text-muted-foreground">
                              {rowCode(meta, r)}
                            </span>
                          )}
                          {!enabled && (
                            <Badge variant="secondary" className="text-[10px]">
                              Nonaktif
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {showCount && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {numberWithDots(rowCount(meta, r))}
                        </TableCell>
                      )}
                      <TableCell aria-label="Setting">
                        <div className="flex justify-end gap-1">
                          {meta.editable && r.isUpdate === 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Ubah ${rowName(meta, r)}`}
                              className="h-8 w-8"
                              disabled={busy}
                              onClick={() => openEdit(r)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {(r.isDisable === 1 || r.isEnable === 1) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${enabled ? 'Nonaktifkan' : 'Aktifkan'} ${rowName(meta, r)}`}
                              className="h-8 w-8"
                              disabled={busy}
                              onClick={() => toggleStatus(r)}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : enabled ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {/* Legacy cs-action-menu: delete shows only when the
                              row's isDelete flag is set AND it is not currently
                              disable-able (i.e. already disabled). Group never. */}
                          {!meta.noDelete && r.isDelete === 1 && r.isDisable !== 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Hapus ${rowName(meta, r)}`}
                              className="h-8 w-8 text-rose-600 hover:text-rose-600"
                              disabled={busy}
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          {/* Pagination footer — only when the list exceeds one page. */}
          {!loading && data.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">
                {numberWithDots(rangeStart)}–{numberWithDots(rangeEnd)} dari{' '}
                {numberWithDots(data.length)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Hal {currentPage}/{maxPage}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Sebelumnya"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Berikutnya"
                  disabled={currentPage >= maxPage}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit Detail ${shortName}` : `Add ${shortName}`}
            </DialogTitle>
            {editing && (
              <DialogDescription>{rowName(meta, editing) || '-'}</DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {fieldDefs.map((f, i) => (
              <div key={f.param} className="space-y-1.5">
                <Label htmlFor={`field-${f.param}`}>{f.label}</Label>
                {f.control === 'select' ? (
                  <Select
                    value={values[f.param] ?? ''}
                    onValueChange={(v) => setValues((s) => ({ ...s, [f.param]: v }))}
                  >
                    <SelectTrigger id={`field-${f.param}`}>
                      <SelectValue placeholder={`Pilih ${f.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectOptions[f.param] ?? []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`field-${f.param}`}
                    value={values[f.param] ?? ''}
                    onChange={(e) => setValues((s) => ({ ...s, [f.param]: e.target.value }))}
                    autoFocus={i === 0}
                  />
                )}
              </div>
            ))}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Batal
                </Button>
              </DialogClose>
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
            <DialogTitle>Hapus {meta.label}?</DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                <>
                  Data <span className="font-medium text-foreground">
                    {rowName(meta, deleteTarget)}
                  </span>{' '}
                  akan dihapus permanen. Data harus dinonaktifkan terlebih dahulu.
                  Tindakan ini tidak dapat dibatalkan.
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
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
