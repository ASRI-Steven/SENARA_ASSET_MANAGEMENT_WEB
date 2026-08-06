import { NavLink } from 'react-router-dom'
import { BOTTOM_NAV } from '@/app/nav'
import { useMenuStore, canSeeMenu } from '@/store/menu'
import { cn } from '@/lib/utils'

// Mobile-only fixed bottom navigation.
export function BottomNav() {
  const urls = useMenuStore((s) => s.urls)
  const items = BOTTOM_NAV.filter((item) => canSeeMenu(urls, item.formUrl))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-md justify-around">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-gray-400',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
