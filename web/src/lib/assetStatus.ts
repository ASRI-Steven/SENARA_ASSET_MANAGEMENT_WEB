// The BFF returns each asset's status colour as a Vuetify class string
// (e.g. "teal darken-2", "red darken-2") in CurrentColorAssetStatus — NOT a
// Tailwind class. Map the Vuetify base hue to a Tailwind text colour so the
// status dot/label render correctly. Observed hues (dev DB): teal (OK),
// yellow (Maintenance), red (Broken), brown (MIA), blue (Sold).

const HUE_TO_TW: Record<string, string> = {
  teal: 'text-teal-600',
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
  amber: 'text-amber-600',
  orange: 'text-orange-600',
  red: 'text-rose-600',
  pink: 'text-pink-600',
  brown: 'text-amber-800',
  blue: 'text-sky-600',
  indigo: 'text-indigo-600',
  purple: 'text-purple-600',
  grey: 'text-muted-foreground',
  gray: 'text-muted-foreground',
}

/**
 * Map a Vuetify colour class (e.g. "teal darken-2") to a Tailwind text colour.
 * Falls back to the muted foreground for unknown/empty values.
 */
export function statusColorClass(vuetifyClass?: string | null): string {
  if (!vuetifyClass) return 'text-muted-foreground'
  const hue = vuetifyClass.trim().split(/\s+/)[0]?.toLowerCase()
  return HUE_TO_TW[hue] ?? 'text-muted-foreground'
}
