// Simple ASRILup wordmark. Swap the box for the Alam Sutera logo asset later.
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
        AL
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-sm font-semibold text-foreground">Senara</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Asset Management · Backend
          </div>
        </div>
      )}
    </div>
  )
}
