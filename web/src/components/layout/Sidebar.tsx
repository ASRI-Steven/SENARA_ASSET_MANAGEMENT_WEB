import { NavLink } from 'react-router-dom'
import { NAV_GROUPS } from '@/app/nav'
import { BrandMark } from './BrandMark'
import { cn } from '@/lib/utils'

// Desktop-only fixed left sidebar.
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <BrandMark />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label || 'main'} className="space-y-1">
            {group.label && (
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground">
        ASRILup PWA · v0.1
      </div>
    </aside>
  )
}
