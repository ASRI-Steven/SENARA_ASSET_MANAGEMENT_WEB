import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Eye, Search } from 'lucide-react'
import { usePageMeta } from '@/store/pageMeta'
import { useSession } from '@/store/session'
import { BrandMark } from './BrandMark'
import { UserMenu } from './UserMenu'
import { NotificationBell } from './NotificationBell'

// Fallback judul dari route kalau screen belum set useSetPageMeta().
const ROUTE_META: { match: RegExp; title: string; subtitle?: string }[] = [
  { match: /^\/dashboard/, title: 'Dashboard', subtitle: 'Ringkasan asset sesuai scope Management Anda' },
  { match: /^\/assets\/new/, title: 'Tambah Asset', subtitle: 'Buat aset baru — foto wajib' },
  { match: /^\/assets\/[^/]+\/edit/, title: 'Ubah Asset' },
  { match: /^\/assets\/[^/]+$/, title: 'Detail Asset' },
  { match: /^\/assets/, title: 'Manage Asset', subtitle: 'Daftar & aksi aset dalam scope Anda' },
  { match: /^\/master/, title: 'Master Data' },
  { match: /^\/settings\/admin-access/, title: 'Admin Access' },
  { match: /^\/settings\/groups/, title: 'Role Access' },
  { match: /^\/settings\/users/, title: 'User Setting' },
  { match: /^\/print-qr/, title: 'Print QR' },
  { match: /^\/account/, title: 'Akun' },
]

function routeMeta(pathname: string): { title: string; subtitle?: string } {
  return ROUTE_META.find((r) => r.match.test(pathname)) ?? { title: 'Senara' }
}

export function TopBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const metaTitle = usePageMeta((s) => s.title)
  const metaSub = usePageMeta((s) => s.subtitle)
  const user = useSession((s) => s.user)
  const role = useSession((s) => s.role)
  const [q, setQ] = useState('')

  const fb = routeMeta(pathname)
  const title = metaTitle || fb.title
  const subtitle = metaSub || fb.subtitle || ''

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const t = q.trim()
    if (!t) return
    navigate(`/assets?q=${encodeURIComponent(t)}`)
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/85 px-4 backdrop-blur lg:px-6">
      {/* Brand on mobile (sidebar covers desktop) */}
      <div className="lg:hidden">
        <BrandMark />
      </div>
      {/* Page title on desktop */}
      <div className="hidden min-w-0 lg:block">
        <h1 className="truncate text-[17px] font-bold leading-tight text-foreground">{title}</h1>
        {subtitle && <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex-1" />

      {/* Global search */}
      <form onSubmit={submitSearch} className="relative hidden sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari asset, NIK, No. PO…"
          aria-label="Cari"
          className="w-[220px] rounded-full border bg-muted/50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15 lg:w-[240px]"
        />
      </form>

      {/* "Lihat sebagai {role}" — GroupRole_Name app 78 (usp_ASRI_GetUserRole).
          Fallback ke nama user bila role belum ada (SP belum di-apply / user tanpa role). */}
      {user && (
        <div className="hidden items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs md:flex">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Lihat sebagai</span>
          <span className="max-w-[160px] truncate font-medium text-foreground">
            {role || user.name}
          </span>
        </div>
      )}

      {/* Notifikasi — batch pending approval */}
      <NotificationBell />

      {/* User menu — mobile only (desktop shows it in the sidebar footer) */}
      <div className="lg:hidden">
        <UserMenu />
      </div>
    </header>
  )
}
