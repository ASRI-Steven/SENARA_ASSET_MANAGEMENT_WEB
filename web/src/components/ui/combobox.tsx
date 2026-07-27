import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Optional secondary text shown under the label (e.g. NIK, department). */
  hint?: string
}

/**
 * Drop options with a duplicate `value`. The asset masters carry duplicate
 * name strings (e.g. two "BRACKET SPEAKER" sizes) and Model/Size/Brand submit as
 * NAME strings, so duplicates are semantically identical — collapse them.
 */
export function dedupeOptions(options: ComboboxOption[]): ComboboxOption[] {
  const seen = new Set<string>()
  const out: ComboboxOption[] = []
  for (const o of options) {
    if (seen.has(o.value)) continue
    seen.add(o.value)
    out.push(o)
  }
  return out
}

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  /** Dialog title + search placeholder. */
  title?: string
  disabled?: boolean
  /** aria-label / id for testing hooks. */
  id?: string
  className?: string
  /** Show a clear ("Kosongkan") action inside the picker. */
  clearable?: boolean
}

/**
 * A searchable single-select built on Dialog (no cmdk/popover dependency).
 * Suited to the large asset lookups (users ~2100, sizes ~1800, brands ~800,
 * models ~1700) where a plain <Select> is unusable. Renders a trigger button
 * showing the current label; clicking opens a searchable, filtered list.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Pilih…',
  title = 'Pilih',
  disabled,
  id,
  className,
  clearable,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 200)
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint ? o.hint.toLowerCase().includes(q) : false),
      )
      .slice(0, 200)
  }, [options, query])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        type="button"
        id={id}
        aria-label={title}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery('') }}>
        <DialogContent className="max-w-md gap-3 p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          <div className="px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto px-2 pb-3">
            {clearable && (
              <button
                type="button"
                onClick={() => pick('')}
                className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent"
              >
                Kosongkan pilihan
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Tidak ada hasil.
              </p>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={`${o.value}-${i}`}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent',
                    o.value === value && 'bg-accent/60',
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      o.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.hint}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
            {!query && options.length > 200 && (
              <p className="px-2 pt-2 text-center text-xs text-muted-foreground">
                Menampilkan 200 dari {options.length}. Ketik untuk mencari.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
