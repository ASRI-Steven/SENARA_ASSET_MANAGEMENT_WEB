import {
  LayoutDashboard,
  Boxes,
  FileText,
  Database,
  QrCode,
  User,
  ShieldCheck,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Primary navigation — shown in the desktop sidebar.
export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/assets', label: 'Manage Asset', icon: Boxes },
  { to: '/request', label: 'Request Form', icon: FileText },
  { to: '/master', label: 'Master Data', icon: Database },
  { to: '/print-qr', label: 'Print QR', icon: QrCode },
]

// Settings group — rendered as a labelled section in the desktop sidebar and
// surfaced on the Master hub so it stays reachable on mobile (bottom-nav is full).
export const NAV_SETTINGS: NavItem[] = [
  { to: '/settings/admin-access', label: 'Admin Access', icon: ShieldCheck },
  { to: '/settings/groups', label: 'Group Access', icon: Users },
  { to: '/settings/users', label: 'User Setting', icon: UserCog },
]

export const NAV_GROUPS: NavGroup[] = [
  { label: '', items: NAV },
  { label: 'Setting', items: NAV_SETTINGS },
]

// Mobile bottom-nav — the 5 primary destinations (last = account).
export const BOTTOM_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/assets', label: 'Asset', icon: Boxes },
  { to: '/request', label: 'Request', icon: FileText },
  { to: '/master', label: 'Master', icon: Database },
  { to: '/account', label: 'Akun', icon: User },
]
