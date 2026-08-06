import { Link } from 'react-router-dom'
import { ChevronRight, Database } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { MASTER_ENTITIES } from '@/api/master'
import { NAV_SETTINGS } from '@/app/nav'
import { useMenuStore, canSeeMenu } from '@/store/menu'

// Legacy form URL per master entity — used to hide cards the user can't access.
const MASTER_FORM_URL: Record<string, string> = {
  brand: '/BrandAsset',
  color: '/ColorAsset',
  size: '/SizeAsset',
  status: '/StatusAsset',
  management: '/ManagementAsset',
  group: '/GroupAsset',
  location: '/LocationAsset',
  type: '/TypeAsset',
  model: '/ModelAsset',
  user: '/UserAsset',
}

export default function MasterHubScreen() {
  const urls = useMenuStore((s) => s.urls)
  const entities = MASTER_ENTITIES.filter((m) => canSeeMenu(urls, MASTER_FORM_URL[m.key]))
  const settings = NAV_SETTINGS.filter((s) => canSeeMenu(urls, s.formUrl))
  return (
    <>
      <PageHeader title="Asset Master" description="Kelola data referensi aset" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entities.map((m) => (
          <Link key={m.key} to={`/master/${m.key}`}>
            <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-foreground">{m.label}</div>
                    <div className="text-xs text-muted-foreground">Kelola data</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/*
        Setting cards are NOT part of the legacy Master hub — on desktop the
        left sidebar already exposes them, so they are hidden here (lg:hidden).
        They are kept only on mobile, which has no sidebar/menu drawer and would
        otherwise have no path to the settings screens.
      */}
      <div className={settings.length === 0 ? 'hidden' : 'lg:hidden'}>
        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">
          Setting
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {settings.map((s) => (
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
      </div>
    </>
  )
}
