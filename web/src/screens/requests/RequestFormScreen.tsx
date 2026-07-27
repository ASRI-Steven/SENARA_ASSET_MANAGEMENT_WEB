import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Trash2, Send, Loader2 } from 'lucide-react'
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
  fetchRequestLookups,
  REQUEST_TYPES,
  type RequestLookups,
} from '@/api/requests'

interface Item {
  id: number
  iname: string
  ibrand: string
  idesc: string
  iqty: number
  irem: string
}

let itemSeq = 1

export default function RequestFormScreen() {
  const [requestType, setRequestType] = useState('new')
  const [company, setCompany] = useState('')
  const [user, setUser] = useState('')
  const [location, setLocation] = useState('')
  const [info, setInfo] = useState('')
  const [items, setItems] = useState<Item[]>([
    { id: itemSeq++, iname: '', ibrand: '', idesc: '', iqty: 1, irem: '' },
  ])

  const [lookups, setLookups] = useState<RequestLookups | null>(null)
  const [lookupsLoading, setLookupsLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLookupsLoading(true)
    fetchRequestLookups()
      .then((l) => {
        if (alive) setLookups(l)
      })
      .catch(() => {
        // Non-fatal: the form still works; dropdowns just show no options.
        if (alive) toast.error('Gagal memuat data pilihan (company/user/lokasi)')
      })
      .finally(() => {
        if (alive) setLookupsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  function addItem() {
    setItems((prev) => [...prev, { id: itemSeq++, iname: '', ibrand: '', idesc: '', iqty: 1, irem: '' }])
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev))
  }
  function patchItem(id: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (items.some((i) => !i.iname.trim())) {
      toast.error('Nama item wajib diisi')
      return
    }
    // NOTE: request submit stays UI-level per IAT safety rules — no POST to the
    // real SP (it writes shared operational data). Validation runs; the payload
    // that WOULD be sent to POST /api/requests is assembled here for reference.
    toast.success('Request tervalidasi (submit ke backend dinonaktifkan untuk IAT)')
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Request Form"
        description="Permintaan aset ICT"
        action={
          <Button type="submit">
            <Send className="h-4 w-4" /> Kirim
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Jenis Request</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={company} onValueChange={setCompany} disabled={lookupsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={lookupsLoading ? 'Memuat…' : 'Pilih company'} />
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
            <div className="space-y-1.5">
              <Label>User</Label>
              <Select value={user} onValueChange={setUser} disabled={lookupsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={lookupsLoading ? 'Memuat…' : 'Pilih user'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.users.slice(0, 500).map((u) => (
                    <SelectItem key={u.IDX_M_AssetUser} value={String(u.IDX_M_AssetUser)}>
                      {u.AssetUserName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lokasi</Label>
              <Select value={location} onValueChange={setLocation} disabled={lookupsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={lookupsLoading ? 'Memuat…' : 'Pilih lokasi'} />
                </SelectTrigger>
                <SelectContent>
                  {lookups?.locations.map((l) => (
                    <SelectItem key={l.IDX_M_AssetLocation} value={String(l.IDX_M_AssetLocation)}>
                      {l.AssetLocationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Informasi Request</Label>
              <Textarea value={info} onChange={(e) => setInfo(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Item list */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Item Request</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" /> Tambah Item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item #{idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus Item #${idx + 1}`}
                      className="h-7 w-7 text-rose-600 hover:text-rose-600"
                      disabled={items.length === 1}
                      onClick={() => removeItem(it.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                      placeholder="Nama item"
                      value={it.iname}
                      onChange={(e) => patchItem(it.id, { iname: e.target.value })}
                    />
                    <Input
                      placeholder="Brand"
                      value={it.ibrand}
                      onChange={(e) => patchItem(it.id, { ibrand: e.target.value })}
                    />
                    <Input
                      placeholder="Deskripsi"
                      value={it.idesc}
                      onChange={(e) => patchItem(it.id, { idesc: e.target.value })}
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={it.iqty}
                      onChange={(e) => patchItem(it.id, { iqty: Number(e.target.value) })}
                    />
                  </div>
                </div>
              ))}
            </div>
            {lookupsLoading && (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat data pilihan…
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
