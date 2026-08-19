// Shared row types for the BFF result sets. Each interface mirrors one SP
// rowset (keys verified against the dev DB — see web/iat/bff-shapes.md).
//
// Numeric-string caveat: several money/percent fields come back as STRINGS
// (e.g. TotalAssetValue "73896843744.31", PercentBroken "2.1075"). Parse with
// `toNumber` from '@/lib/format' before doing math or formatting.

/** GET /api/dashboard/managements — data[0]. Also usable as a filter source. */
export interface ManagementOption {
  IDX_M_AssetManagement: number
  AssetManagementName: string
}

/** POST /api/dashboard — data[0] (summary, single row). */
export interface DashboardSummary {
  TotalAsset: number
  TotalAssetValue: string // numeric string
  TotalBroken: number
  TotalMIA: number
  TotalManagement: number
  PercentBroken: string // numeric string
  PercentMIA: string // numeric string
}

/** POST /api/dashboard — data[1] (by company). */
export interface DashboardByCompany {
  CompanyName: string
  AssetCount: number
  TotalAssetValue: string // numeric string
  IDX_M_Company: number
}

/** POST /api/dashboard — data[2] (by location). */
export interface DashboardByLocation {
  AssetLocationName: string
  AssetCount: number
  TotalAssetValue: string // numeric string
  IDX_M_AssetLocation: number
}

/** POST /api/dashboard — data[3] (by type). */
export interface DashboardByType {
  AssetTypeName: string
  AssetCount: number
  TotalAssetValue: string // numeric string
  IDX_M_AssetType: number
}

/** POST /api/dashboard — data[4] (by type-model, ~1500+ rows). */
export interface DashboardByTypeModel {
  AssetTypeModelName: string
  AssetCount: number
  TotalAssetValue: string // numeric string
  IDX_M_AssetTypeModel: number
}

/** POST /api/dashboard — data[5] (by management; rowset ditambah oleh ALTER SP 004). */
export interface DashboardByManagement {
  IDX_M_AssetManagement: number
  AssetManagementName: string
  AssetCount: number
  TotalAssetValue: string // numeric string
}

/** Normalised dashboard payload (6 rowsets). */
export interface DashboardData {
  summary: DashboardSummary | null
  byCompany: DashboardByCompany[]
  byLocation: DashboardByLocation[]
  byType: DashboardByType[]
  byTypeModel: DashboardByTypeModel[]
  byManagement: DashboardByManagement[]
}
