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
} from '@/api/master'

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

  // Edit/create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MasterRow | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MasterRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Per-row busy state (enable/disable), keyed by idx.
  const [busyIdx, setBusyIdx] = useState<number | null>(null)

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

  function openAdd() {
    setEditing(null)
    setName('')
    setCode('')
    setDialogOpen(true)
  }

  function openEdit(row: MasterRow) {
    setEditing(row)
    setName(rowName(meta, row))
    setCode(rowCode(meta, row))
    setDialogOpen(true)
  }

  // Build the SP field payload for save/update. Location & Type carry a code
  // column; everything editable else is just the name column.
  function buildFields(forUpdate: boolean, row?: MasterRow): Record<string, unknown> {
    const fields: Record<string, unknown> = {}
    if (forUpdate && row) fields[meta.idxKey] = rowIdx(meta, row)
    if (meta.codeKey) fields[meta.codeKey] = code.trim()
    fields[meta.nameKey] = name.trim()
    return fields
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Nama wajib diisi')
      return
    }
    if (meta.codeKey && !code.trim()) {
      toast.error(`${meta.codeLabel} wajib diisi`)
      return
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
      // The SP only deletes DISABLED records; disable first if still enabled.
      if (String(deleteTarget.Status).toUpperCase() === 'ENABLED') {
        await disableMaster(meta, idx)
      }
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
  const colSpan = 3 + (hasCode ? 1 : 0) + 1 // #, [code], name, count, aksi

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
          placeholder={`Cari ${meta.label}…`}
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
                <TableHead className="w-12">#</TableHead>
                {hasCode && <TableHead className="w-32">{meta.codeLabel}</TableHead>}
                <TableHead>Nama</TableHead>
                <TableHead className="text-right">Jumlah Aset</TableHead>
                <TableHead className="w-32 text-right">Aksi</TableHead>
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
                data.map((r, i) => {
                  const idx = rowIdx(meta, r)
                  const enabled = String(r.Status).toUpperCase() === 'ENABLED'
                  const busy = busyIdx != null && busyIdx === idx
                  return (
                    <TableRow key={idx ?? i} className={enabled ? '' : 'opacity-60'}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
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
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {numberWithDots(rowCount(meta, r))}
                      </TableCell>
                      <TableCell aria-label="Aksi">
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
                          {(r.isDelete === 1 || r.isDisable === 1) && (
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
        </Card>
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Ubah' : 'Tambah'} {meta.label}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            {hasCode && (
              <div className="space-y-1.5">
                <Label htmlFor="code">{meta.codeLabel}</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={!hasCode}
              />
            </div>
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
                  akan dinonaktifkan lalu dihapus permanen. Tindakan ini tidak dapat
                  dibatalkan.
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
