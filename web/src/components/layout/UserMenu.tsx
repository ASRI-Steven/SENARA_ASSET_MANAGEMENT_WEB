import { useNavigate } from 'react-router-dom'
import { LogOut, ChevronDown, CircleUser } from 'lucide-react'
import { useSession } from '@/store/session'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

// Avatar + nama + dropdown (Akun / Keluar). Dipakai di footer sidebar (dark) dan
// di topbar mobile (light) — sidebar disembunyikan di mobile jadi ini fallback-nya.
export function UserMenu({ dark = false }: { dark?: boolean }) {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          // w-full di dua mode: tanpa lebar terbatas, truncate nama tak berfungsi
          // sehingga nama panjang (mis. "JASON WENARDI HADINATA") overflow sidebar.
          'flex w-full items-center gap-2.5 rounded-lg outline-none transition-colors',
          dark ? 'p-2 hover:bg-white/5' : 'py-1 pl-1 pr-2 hover:bg-muted',
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold',
            dark ? 'bg-primary text-white' : 'bg-primary/10 text-primary',
          )}
        >
          {initials(user?.name)}
        </span>
        <span className="min-w-0 flex-1 text-left leading-tight">
          <span
            className={cn(
              'block truncate text-[13px] font-semibold',
              dark ? 'text-white' : 'text-foreground',
            )}
          >
            {user?.name ?? 'User'}
          </span>
          <span
            className={cn('block truncate text-[11px]', dark ? 'text-[#7fa09a]' : 'text-muted-foreground')}
          >
            NIK {user?.nik ?? '-'}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0', dark ? 'text-[#7fa09a]' : 'text-muted-foreground')} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          <div className="font-medium">{user?.name ?? 'User'}</div>
          <div className="text-xs font-normal text-muted-foreground">NIK {user?.nik ?? '-'}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/account')}>
          <CircleUser className="h-4 w-4" />
          Akun
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout} className="text-rose-600 focus:text-rose-600">
          <LogOut className="h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
