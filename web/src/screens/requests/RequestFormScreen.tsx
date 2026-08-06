import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Trash2, Send, Loader2, RefreshCw } from 'lucide-react'
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
  submitRequest,
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

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function RequestFormScreen() {
  const [requestDate, setRequestDate] = useState(today())
  const [requestType, setRequestType] = useState('new')
  const [requestFrom, setRequestFrom] = useState(today())
  const [requestTo, setRequestTo] = useState(todayPlus(30))
  const [company, setCompany] = useState('')
  const [user, setUser] = useState('')
  const [position, setPosition] = useState('')
  const [department, setDepartment] = useState('')
  const [justification, setJustification] = useState('')
  const [expectationDate, setExpectationDate] = useState(todayPlus(7))
  const [location, setLocation] = useState('')
  const [items, setItems] = useState<Item[]>([
    { id: itemSeq++, iname: '', ibrand: '', idesc: '', iqty: 1, irem: '' },
  ])

  const [lookups, setLookups] = useState<RequestLookups | null>(null)
  const [lookupsLoading, setLookupsLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  // Auto-fill Position/Department when the user changes.
  useEffect(() => {
    const u = lookups?.users.find((x) => String(x.IDX_M_AssetUser) === user)
    setPosition(u?.PositionName ?? '')
    setDepartment(u?.DepartmentName ?? '')
  }, [user, lookups])

  const brandOptions = useMemo(() => lookups?.brands ?? [], [lookups])

  function addItem() {
    setItems((prev) => [...prev, { id: itemSeq++, iname: '', ibrand: '', idesc: '', iqty: 1, irem: '' }])
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev))
  }
  function patchItem(id: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  }

  function clear() {
    setRequestDate(today())
    setRequestType('new')
    setCompany('')
    setUser('')
    setPosition('')
    setDepartment('')
    setJustification('')
    setExpectationDate(todayPlus(7))
    setLocation('')
    setItems([{ id: itemSeq++, iname: '', ibrand: '', idesc: '', iqty: 1, irem: '' }])
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (items.some((i) => !i.iname.trim())) {
      toast.error('Nama item wajib diisi')
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      const msg = await submitRequest({
        RequestDate: requestDate,
        RequestType: requestType,
        RequestFrom: requestType === 'assignfromto' ? requestFrom : '',
        RequestTo: requestType === 'assignfromto' ? requestTo : '',
        IDX_M_Company: company,
        IDX_M_AssetUser: user,
        RequestInformation: justification,
        RequestDueDate: expectationDate,
        IDX_M_AssetLocation: location,
        ItemRequest: items.map((i) => ({
          iname: i.iname,
          ibrand: i.ibrand,
          idesc: i.idesc,
          iqty: i.iqty,
          irem: i.irem,
        })),
      })
      toast.success(msg || 'Request berhasil dikirim')
      clear()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Request Form"
        description="Permintaan aset ICT"
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={clear} disabled={submitting}>
              <RefreshCw className="h-4 w-4" /> Clear
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* User Information */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <h3 className="text-sm font-semibold text-foreground sm:col-span-2">User Information</h3>
            <div className="space-y-1.5">
              <Label>Request Date</Label>
              <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Request Type</Label>
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

            {requestType === 'assignfromto' && (
              <>
                <div className="space-y-1.5">
                  <Label>From</Label>
                  <Input type="date" value={requestFrom} onChange={(e) => setRequestFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>To</Label>
                  <Input type="date" value={requestTo} onChange={(e) => setRequestTo(e.target.value)} />
                </div>
              </>
            )}

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
              {/* Position & Department auto-fill when the user changes (see the
                  effect below), so no manual "Check User" button is needed. */}
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
              <Label>Position</Label>
              <Input value={position} readOnly disabled placeholder="-" />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={department} readOnly disabled placeholder="-" />
            </div>
          </CardContent>
        </Card>

        {/* Request Items */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Request Items</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Request Justification</Label>
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Expectation Date</Label>
                  <Input
                    type="date"
                    value={expectationDate}
                    onChange={(e) => setExpectationDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery Location</Label>
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
              </div>
            </div>

            <div className="mb-3 mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">
                {items.length} item
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" /> Add Form {items.length}
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">No {idx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus item ${idx + 1}`}
                      className="h-7 w-7 text-rose-600 hover:text-rose-600"
                      disabled={items.length === 1}
                      onClick={() => removeItem(it.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Item Name</Label>
                      <Input
                        placeholder="Item Name"
                        value={it.iname}
                        onChange={(e) => patchItem(it.id, { iname: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Brand</Label>
                      <Select
                        value={it.ibrand}
                        onValueChange={(v) => patchItem(it.id, { ibrand: v })}
                        disabled={lookupsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandOptions.map((b) => (
                            <SelectItem key={b.IDX_M_AssetBrand} value={String(b.IDX_M_AssetBrand)}>
                              {b.AssetBrandName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Item Description</Label>
                      <Input
                        placeholder="Item Description"
                        value={it.idesc}
                        onChange={(e) => patchItem(it.id, { idesc: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={it.iqty}
                        onChange={(e) => patchItem(it.id, { iqty: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                      <Label className="text-xs">Remarks</Label>
                      <Input
                        placeholder="Remarks"
                        value={it.irem}
                        onChange={(e) => patchItem(it.id, { irem: e.target.value })}
                      />
                    </div>
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
