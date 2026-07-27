import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronDown } from 'lucide-react'
import { useSession } from '@/store/session'
import { initials } from '@/lib/format'
import { BrandMark } from './BrandMark'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export function TopBar() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-white/90 px-4 backdrop-blur lg:px-8">
      {/* Brand on mobile (sidebar covers desktop) */}
      <div className="lg:hidden">
        <BrandMark />
      </div>
      <div className="hidden lg:block" />

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none transition-colors hover:bg-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(user?.name)}
          </span>
          <span className="max-w-[9rem] text-left text-sm leading-tight sm:max-w-none">
            <span className="block truncate font-medium text-foreground">
              {user?.name ?? 'User'}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {user?.nik ?? '-'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>
            <div className="font-medium">{user?.name ?? 'User'}</div>
            <div className="text-xs font-normal text-muted-foreground">NIK {user?.nik ?? '-'}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:text-rose-600">
            <LogOut className="h-4 w-4" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
