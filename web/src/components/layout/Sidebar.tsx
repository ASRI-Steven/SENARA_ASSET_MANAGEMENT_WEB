import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { NAV_GROUPS, type NavItem } from '@/app/nav'
import { useMenuStore, canSeeMenu } from '@/store/menu'
import { BrandMark } from './BrandMark'
import { UserMenu } from './UserMenu'
import { cn } from '@/lib/utils'

// Desktop-only fixed left sidebar — light surface (match the white content area).
// Dikelompokkan Utama / Transaksi / Administrasi (mockup); item + sub-menu di-drive
// dari usp_ASRI_GetMenu (app 78) lewat canSeeMenu(idxs).
export function Sidebar() {
  const idxs = useMenuStore((s) => s.idxs)
  const { pathname } = useLocation()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-card lg:flex">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <BrandMark />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((it) => canSeeMenu(idxs, it.formIdx))
          if (items.length === 0) return null
          return (
            <div key={group.label} className="space-y-0.5">
              <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">
                {group.label}
              </p>
              {items.map((item) =>
                item.children ? (
                  <NavParent key={item.to} item={item} idxs={idxs} pathname={pathname} />
                ) : (
                  <NavLeaf key={item.to} item={item} />
                ),
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t p-3">
        <UserMenu />
      </div>
    </aside>
  )
}

function leafCls(isActive: boolean) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}

function NavLeaf({ item }: { item: NavItem }) {
  return (
    <NavLink to={item.to} end={item.to === '/dashboard'} className={({ isActive }) => leafCls(isActive)}>
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
    </NavLink>
  )
}

/** A top-level item with a sub-menu (Master Data). Collapsible; auto-open when active. */
function NavParent({
  item,
  idxs,
  pathname,
}: {
  item: NavItem
  idxs: Set<number> | null
  pathname: string
}) {
  const kids = (item.children ?? []).filter((c) => canSeeMenu(idxs, c.formIdx))
  const activeInside = pathname === item.to || pathname.startsWith(item.to + '/')
  const [open, setOpen] = useState(activeInside)
  if (kids.length === 0) return <NavLeaf item={item} />

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(leafCls(activeInside), 'w-full')}
        aria-expanded={open}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 pl-4">
          {kids.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <c.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{c.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
