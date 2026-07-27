// Mock data layer — mirrors the shape of the legacy .NET/SP DataSets so screens
// can be built before the BFF exists. Swap these for TanStack Query hooks later.

export interface Asset {
  idx: number
  assetId: string
  type: string
  model: string
  brand: string
  color: string
  size: string
  status: string
  statusColor: string // tailwind text color class
  user: string
  location: string
  management: string
  company: string
  department: string
  poNo: string
  poDate: string
  currency: string
  unitPrice: number
  assetDate: string
  remarks: string
  active: boolean
}

export interface Lookup {
  idx: number
  name: string
  count?: number
}

export interface HistoryEntry {
  startDate: string
  endDate: string | null
  value: string
  by: string
  remarks: string
}

export interface ScoreCard {
  label: string
  value: number
  column: 'AssetCount' | 'TotalAssetValue'
  color: string // hex
  percent?: number
  month: string
}

export interface BreakdownRow {
  name: string
  count: number
  value: number
}

// --- Lookups (dropdowns) ---
export const TYPES: Lookup[] = [
  { idx: 1, name: 'Laptop', count: 128 },
  { idx: 2, name: 'Desktop PC', count: 74 },
  { idx: 3, name: 'Monitor', count: 96 },
  { idx: 4, name: 'Printer', count: 33 },
  { idx: 5, name: 'Handphone', count: 41 },
]
export const BRANDS: Lookup[] = [
  { idx: 1, name: 'Dell', count: 90 },
  { idx: 2, name: 'HP', count: 62 },
  { idx: 3, name: 'Lenovo', count: 58 },
  { idx: 4, name: 'Apple', count: 24 },
  { idx: 5, name: 'Asus', count: 30 },
]
export const COLORS: Lookup[] = [
  { idx: 1, name: 'Black', count: 210 },
  { idx: 2, name: 'Silver', count: 88 },
  { idx: 3, name: 'White', count: 44 },
]
export const SIZES: Lookup[] = [
  { idx: 1, name: '13"', count: 30 },
  { idx: 2, name: '14"', count: 70 },
  { idx: 3, name: '15.6"', count: 60 },
  { idx: 4, name: '24"', count: 40 },
]
export const STATUSES: Lookup[] = [
  { idx: 1, name: 'In Use', count: 240 },
  { idx: 2, name: 'Available', count: 60 },
  { idx: 3, name: 'Repair', count: 18 },
  { idx: 4, name: 'Disposed', count: 12 },
]
export const LOCATIONS: Lookup[] = [
  { idx: 1, name: 'Head Office Lt.3', count: 120 },
  { idx: 2, name: 'Mall @ Alam Sutera', count: 88 },
  { idx: 3, name: 'Warehouse', count: 40 },
  { idx: 4, name: 'Branch BSD', count: 52 },
]
export const USERS: Lookup[] = [
  { idx: 1, name: 'Budi Santoso' },
  { idx: 2, name: 'Siti Rahayu' },
  { idx: 3, name: 'Andi Wijaya' },
  { idx: 4, name: 'Dewi Lestari' },
  { idx: 5, name: '(Unassigned)' },
]
export const MANAGEMENTS: Lookup[] = [
  { idx: 1, name: 'IT Division' },
  { idx: 2, name: 'Finance' },
  { idx: 3, name: 'Operations' },
]
export const COMPANIES: Lookup[] = [
  { idx: 1, name: 'PT Alam Sutera Realty' },
  { idx: 2, name: 'PT Delta Mega Persada' },
]
export const DEPARTMENTS: Lookup[] = [
  { idx: 1, name: 'ICT' },
  { idx: 2, name: 'Accounting' },
  { idx: 3, name: 'Marketing' },
]

const statusColor: Record<string, string> = {
  'In Use': 'text-emerald-600',
  Available: 'text-sky-600',
  Repair: 'text-amber-600',
  Disposed: 'text-rose-600',
}

function makeAsset(i: number): Asset {
  const type = TYPES[i % TYPES.length]
  const brand = BRANDS[i % BRANDS.length]
  const color = COLORS[i % COLORS.length]
  const size = SIZES[i % SIZES.length]
  const status = STATUSES[i % STATUSES.length]
  const user = USERS[i % USERS.length]
  const loc = LOCATIONS[i % LOCATIONS.length]
  const mgmt = MANAGEMENTS[i % MANAGEMENTS.length]
  const comp = COMPANIES[i % COMPANIES.length]
  const dept = DEPARTMENTS[i % DEPARTMENTS.length]
  return {
    idx: i,
    assetId: `AST-${String(i).padStart(4, '0')}`,
    type: type.name,
    model: `${brand.name} ${type.name} ${2019 + (i % 6)}`,
    brand: brand.name,
    color: color.name,
    size: size.name,
    status: status.name,
    statusColor: statusColor[status.name] ?? 'text-muted-foreground',
    user: user.name,
    location: loc.name,
    management: mgmt.name,
    company: comp.name,
    department: dept.name,
    poNo: `PO-${2023 + (i % 3)}-${String(1000 + i)}`,
    poDate: `2024-0${(i % 9) + 1}-1${i % 9}`,
    currency: 'IDR',
    unitPrice: 5_000_000 + (i % 20) * 750_000,
    assetDate: `2024-0${(i % 9) + 1}-2${i % 8}`,
    remarks: i % 3 === 0 ? 'Garansi 3 tahun' : '',
    active: i % 11 !== 0,
  }
}

export const ASSETS: Asset[] = Array.from({ length: 68 }, (_, i) => makeAsset(i + 1))

export function getAsset(assetId: string): Asset | undefined {
  return ASSETS.find((a) => a.assetId === assetId)
}

// --- History (for Asset Detail / History) ---
export function assetHistory(): { title: string; entries: HistoryEntry[] }[] {
  return [
    {
      title: 'User',
      entries: [
        { startDate: '2024-06-01', endDate: null, value: 'Budi Santoso', by: 'admin', remarks: 'Assign awal' },
        { startDate: '2024-01-10', endDate: '2024-05-31', value: 'Siti Rahayu', by: 'admin', remarks: 'Rotasi' },
      ],
    },
    {
      title: 'Location',
      entries: [
        { startDate: '2024-06-01', endDate: null, value: 'Head Office Lt.3', by: 'admin', remarks: '' },
      ],
    },
    {
      title: 'Status',
      entries: [
        { startDate: '2024-06-01', endDate: null, value: 'In Use', by: 'admin', remarks: '' },
        { startDate: '2024-05-01', endDate: '2024-05-31', value: 'Repair', by: 'admin', remarks: 'Ganti baterai' },
      ],
    },
  ]
}

// --- Dashboard ---
export const SCORE_CARDS: ScoreCard[] = [
  { label: 'Total Asset', value: 330, column: 'AssetCount', color: '#1B90A5', percent: 4, month: 'Jul 2026' },
  { label: 'Nilai Asset', value: 2_450_000_000, column: 'TotalAssetValue', color: '#3B3A8F', percent: 7, month: 'Jul 2026' },
  { label: 'In Use', value: 240, column: 'AssetCount', color: '#3DBE7B', percent: 2, month: 'Jul 2026' },
  { label: 'Available', value: 60, column: 'AssetCount', color: '#7C5CBF', month: 'Jul 2026' },
]

export const BY_COMPANY: BreakdownRow[] = [
  { name: 'PT Alam Sutera Realty', count: 210, value: 1_580_000_000 },
  { name: 'PT Delta Mega Persada', count: 120, value: 870_000_000 },
]
export const BY_TYPE: BreakdownRow[] = TYPES.map((t) => ({
  name: t.name,
  count: t.count ?? 0,
  value: (t.count ?? 0) * 6_500_000,
}))
export const BY_LOCATION: BreakdownRow[] = LOCATIONS.map((l) => ({
  name: l.name,
  count: l.count ?? 0,
  value: (l.count ?? 0) * 6_200_000,
}))

// --- Master entity registry (drives the generic Master CRUD screen) ---
export interface MasterEntity {
  key: string
  label: string
  data: Lookup[]
  hasCode?: boolean
  parentOf?: string
}
export const MASTER_ENTITIES: MasterEntity[] = [
  { key: 'brand', label: 'Asset Brand', data: BRANDS },
  { key: 'color', label: 'Asset Color', data: COLORS },
  { key: 'type', label: 'Asset Type', data: TYPES, hasCode: true },
  { key: 'model', label: 'Asset Model', data: TYPES.map((t) => ({ idx: t.idx, name: `${t.name} Model` })) },
  { key: 'size', label: 'Asset Size', data: SIZES },
  { key: 'status', label: 'Asset Status', data: STATUSES },
  { key: 'location', label: 'Asset Location', data: LOCATIONS, hasCode: true },
  { key: 'management', label: 'Asset Management', data: MANAGEMENTS },
  { key: 'company', label: 'Company', data: COMPANIES },
  { key: 'group', label: 'Asset Group', data: [{ idx: 1, name: 'Group A' }, { idx: 2, name: 'Group B' }] },
  { key: 'user', label: 'Asset User', data: USERS.filter((u) => u.name !== '(Unassigned)') },
]

export function getMaster(key: string): MasterEntity | undefined {
  return MASTER_ENTITIES.find((m) => m.key === key)
}

// --- Request form ---
export const REQUEST_TYPES = [
  { value: 'new', label: 'New Asset' },
  { value: 'assignto', label: 'Assign To' },
  { value: 'unassign', label: 'Unassign' },
  { value: 'assignfromto', label: 'Assign From / To' },
  { value: 'renewal', label: 'Renewal' },
  { value: 'service', label: 'Service' },
]
