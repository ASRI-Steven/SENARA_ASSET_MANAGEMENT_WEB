import {
  LayoutDashboard,
  Boxes,
  Database,
  UploadCloud,
  UserCog,
  MapPin,
  Building2,
  Tag,
  Layers,
  Users,
  Ruler,
  Palette,
  Activity,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /**
   * IDX_M_Forms (ASRILup app 78) used to gate visibility against the user's menu
   * access (GET /api/menu → usp_ASRI_GetMenu). Omit for utilities with no form.
   */
  formIdx?: number
  /** Sub-menu (Master Data → 9 sub-master). */
  children?: NavItem[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// Master Data → 9 sub-master (forms 31076–31084, order = Form_Sort 3.1–3.9).
const MASTER_CHILDREN: NavItem[] = [
  { to: '/master/location', label: 'Location', icon: MapPin, formIdx: 31076 },
  { to: '/master/management', label: 'Management', icon: Building2, formIdx: 31077 },
  { to: '/master/brand', label: 'Brand', icon: Tag, formIdx: 31078 },
  { to: '/master/type', label: 'Type', icon: Boxes, formIdx: 31079 },
  { to: '/master/model', label: 'Model', icon: Layers, formIdx: 31080 },
  { to: '/master/user', label: 'User', icon: Users, formIdx: 31081 },
  { to: '/master/size', label: 'Size', icon: Ruler, formIdx: 31082 },
  { to: '/master/color', label: 'Color', icon: Palette, formIdx: 31083 },
  { to: '/master/status', label: 'Status', icon: Activity, formIdx: 31084 },
]

// ASRILup app 78 top-level forms. Manage Asset's child forms (Assign/Change/
// Return/Add/Print QR) are ACTION-access forms — they gate the row action menu,
// NOT sidebar items. Role Access = matrix R/I/U/D (dikelola di Senara/eksternal),
// tidak punya form app 78 → no formIdx (selalu tampil).
const N_DASHBOARD: NavItem = { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, formIdx: 31065 }
const N_MANAGE: NavItem = { to: '/assets', label: 'Manage Asset', icon: Boxes, formIdx: 31066 }
const N_MASTER: NavItem = { to: '/master', label: 'Master Data', icon: Database, formIdx: 31073, children: MASTER_CHILDREN }
const N_BATCHING: NavItem = { to: '/upload-asset', label: 'Batching Status Asset', icon: UploadCloud, formIdx: 31085 }
const N_USER_SETTING: NavItem = { to: '/settings/users', label: 'User Setting', icon: UserCog, formIdx: 31086 }

export const NAV: NavItem[] = [N_DASHBOARD, N_MANAGE, N_MASTER, N_BATCHING, N_USER_SETTING]

// Sidebar dikelompokkan sesuai mockup: Utama / Transaksi / Administrasi.
// Role Access dihapus — bukan form app 78 (usp_ASRI_GetMenu tak memetakannya),
// akses role dikelola eksternal (Senara).
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Utama', items: [N_DASHBOARD, N_MANAGE, N_MASTER] },
  { label: 'Transaksi', items: [N_BATCHING] },
  { label: 'Administrasi', items: [N_USER_SETTING] },
]

// Settings surfaced on the Master hub (mobile has no sidebar).
export const NAV_SETTINGS: NavItem[] = [
  { to: '/settings/admin-access', label: 'Admin Access', icon: ShieldCheck },
  { to: '/settings/groups', label: 'Role Access', icon: Users },
  { to: '/settings/users', label: 'User Setting', icon: UserCog, formIdx: 31086 },
]

// Mobile bottom-nav — primary destinations (last = account).
export const BOTTOM_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, formIdx: 31065 },
  { to: '/assets', label: 'Asset', icon: Boxes, formIdx: 31066 },
  { to: '/master', label: 'Master', icon: Database, formIdx: 31073 },
  { to: '/upload-asset', label: 'Batch', icon: UploadCloud, formIdx: 31085 },
]
