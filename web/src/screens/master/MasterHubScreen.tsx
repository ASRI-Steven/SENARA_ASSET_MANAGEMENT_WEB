import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Database } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { numberWithDots } from '@/lib/format'
import { MASTER_ENTITIES, searchMaster } from '@/api/master'
import { NAV_SETTINGS } from '@/app/nav'

export default function MasterHubScreen() {
  // Live item count per entity (undefined = loading, null = failed to load).
  const [counts, setCounts] = useState<Record<string, number | null>>({})

  useEffect(() => {
    let alive = true
    // Fetch each entity's row count in parallel; failures fall back to null so
    // the card still renders (just without a number).
    MASTER_ENTITIES.forEach((m) => {
      searchMaster(m.key, '')
        .then((r) => {
          if (alive) setCounts((prev) => ({ ...prev, [m.key]: r.length }))
        })
        .catch(() => {
          if (alive) setCounts((prev) => ({ ...prev, [m.key]: null }))
        })
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <PageHeader title="Master Data" description="Kelola data referensi aset" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MASTER_ENTITIES.map((m) => {
          const count = counts[m.key]
          return (
            <Link key={m.key} to={`/master/${m.key}`}>
              <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Database className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{m.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {count === undefined ? (
                          <Skeleton className="mt-0.5 h-3 w-12" />
                        ) : count === null ? (
                          'Kelola data'
                        ) : (
                          `${numberWithDots(count)} item`
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
        Setting
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_SETTINGS.map((s) => (
          <Link key={s.to} to={s.to}>
            <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{s.label}</div>
                    <div className="text-xs text-muted-foreground">Kelola akses pengguna</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
