import {
  LayoutDashboard,
  Boxes,
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
  /**
   * Legacy form URL used to gate visibility against the user's menu access
   * (GET /api/menu). Omit for PWA-only utilities with no legacy form (Print QR),
   * which are always shown.
   */
  formUrl?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Primary navigation — shown in the desktop sidebar.
// NOTE: "Request Form" (/request) is intentionally hidden — the legacy app does
// not surface it in its UI either, and its submit SP is broken in this DB (see
// requests.ts). The route still exists in router.tsx; re-add the entry here to
// restore it once the backend is fixed.
export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, formUrl: '/Dashboard' },
  { to: '/assets', label: 'Manage Asset', icon: Boxes, formUrl: '/ManageAsset' },
  { to: '/master', label: 'Master Data', icon: Database, formUrl: '/MasterAsset' },
  // Print QR has no legacy form (PWA-only utility) → always shown.
  { to: '/print-qr', label: 'Print QR', icon: QrCode },
]

// Settings group — rendered as a labelled section in the desktop sidebar and
// surfaced on the Master hub so it stays reachable on mobile (bottom-nav is full).
export const NAV_SETTINGS: NavItem[] = [
  { to: '/settings/admin-access', label: 'Admin Access', icon: ShieldCheck, formUrl: '/SettingAsset' },
  { to: '/settings/groups', label: 'Group Access', icon: Users, formUrl: '/SettingGroup' },
  { to: '/settings/users', label: 'User Setting', icon: UserCog, formUrl: '/SettingUser' },
]

export const NAV_GROUPS: NavGroup[] = [
  { label: '', items: NAV },
  { label: 'Setting', items: NAV_SETTINGS },
]

// Mobile bottom-nav — primary destinations (last = account). "Request" is hidden
// to match the sidebar / legacy app (see NAV note above).
export const BOTTOM_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, formUrl: '/Dashboard' },
  { to: '/assets', label: 'Asset', icon: Boxes, formUrl: '/ManageAsset' },
  { to: '/master', label: 'Master', icon: Database, formUrl: '/MasterAsset' },
  // Account is always available (own profile) — no legacy form gate.
  { to: '/account', label: 'Akun', icon: User },
]
