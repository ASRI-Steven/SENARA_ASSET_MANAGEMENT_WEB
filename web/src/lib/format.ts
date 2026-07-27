// Formatting helpers ported from the legacy ASRILup helpers.js.

/**
 * Coerce a value that may be a numeric string ("73896843744.31") or number
 * into a number. Returns 0 for null/undefined/empty/unparseable input — the
 * BFF returns money/percent columns as strings, so parse before doing math.
 */
export function toNumber(value: number | string | null | undefined): number {
  if (value === undefined || value === null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 1234567 → "1.234.567" (Indonesian thousands separator). */
export function numberWithDots(value: number | string | null | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const parts = value.toString().split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return parts.join(',')
}

/** 1234567 → "Rp 1.234.567". */
export function rupiah(value: number | string | null | undefined): string {
  return `Rp ${numberWithDots(value)}`
}

/** "USD" / "IDR" aware currency label. */
export function currency(value: number | string | null | undefined, code = 'IDR'): string {
  if (code === 'IDR') return rupiah(value)
  return `${code} ${numberWithDots(value)}`
}

/** Initials for an avatar: "Budi Santoso" → "BS". */
export function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/[ -]/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('')
    .toUpperCase()
}

/** ISO date → "20 Jul 2026". */
export function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
