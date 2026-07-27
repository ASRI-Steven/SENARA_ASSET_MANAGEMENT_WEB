# BFF Endpoint Shapes (verified against dev DB 10.10.0.42\SQLDEVOPERATION2 / GeneralAffairDB)

BFF: http://localhost:8080  | Registry: `bff/internal/api/registry.go`
Envelope: `{ status, message, data: [ ...rowsets ] }` where each `data[i]` is an array of row objects.
Frontend helpers (`web/src/api/client.ts`): `rows(env)=data[0]`, `firstRow(env)=data[0][0]`.
Auth: `POST /api/auth/login {NIK,Password}` sets httpOnly cookie; all others use `credentials:'include'`.
Login test user: NIK=2403077 / pw=2403077 -> "STEVEN ALEXANDER".

Legend: [OK] verified working, [BUG] returns `status:error` due to a BFF registry bug (see "KNOWN BFF BUGS" at bottom).

---

## Auth
### POST /api/auth/login  [OK]
Body `{NIK, Password}`. `data[0][0]` = `{NIK, Name, Apps_Timeout, Session_ID}`.

---

## Dashboard (DashboardScreen)

### GET /api/dashboard/managements  [OK]
No body. `data[0]` = array of `{IDX_M_AssetManagement, AssetManagementName}`.
First row is `{IDX_M_AssetManagement:0, AssetManagementName:"All"}`; rest are alphabetical (23 total incl. All).
=> Use as the management filter dropdown on Dashboard AND as a filter source elsewhere.

### POST /api/dashboard  [OK]  — 5 rowsets
Body `{IDX_M_AssetManagement}` (0 = All).
- `data[0]` (len 1, SUMMARY): `{TotalAsset, TotalAssetValue, TotalBroken, TotalMIA, TotalManagement, PercentBroken, PercentMIA}`.
  NOTE: TotalAssetValue, PercentBroken, PercentMIA are STRINGS (e.g. "73896843744.31", "2.1075"); TotalAsset/TotalBroken/TotalMIA/TotalManagement are numbers.
- `data[1]` (by COMPANY): `{CompanyName, AssetCount, TotalAssetValue(string), IDX_M_Company}`.
- `data[2]` (by LOCATION): `{AssetLocationName, AssetCount, TotalAssetValue(string), IDX_M_AssetLocation}`.
- `data[3]` (by TYPE): `{AssetTypeName, AssetCount, TotalAssetValue(string), IDX_M_AssetType}`.
- `data[4]` (by TYPE MODEL, ~1564 rows): `{AssetTypeModelName, AssetCount, TotalAssetValue(string), IDX_M_AssetTypeModel}`.
Each grouped rowset is sorted by AssetCount/value desc. Parse numeric strings with Number()/parseFloat for charts.

---

## Assets grid (AssetListScreen) — admin ManageAsset controller

### POST /api/assets/search  [OK]  — 2 rowsets
Body: `{CurrentPage, PageSize, Keyword?, IDX_M_AssetManagement?, IDX_M_Company?, IDX_M_AssetType?, IDX_M_AssetTypeModel?, IDX_M_AssetColor?, IDX_M_AssetSize?, IDX_M_AssetBrand?, IDX_M_AssetUser?, DepartmentName?, IDX_M_AssetLocation?, IDX_M_AssetStatus?, ReturnAsset?, SortBy?, SortSequence?, TimePeriod?}`.
Empty `{"CurrentPage":1,"PageSize":25}` returns all (~27,905 records).
- `data[0]` = asset rows. Keys:
  `AssetID, AssetTypeName, AssetTypeModelName, AssetBrandName, AssetColorName, AssetSizeName, AssetManagementName, CompanyName, CompanyAlias, CurrentAssetUser, CurrentAssetDepartment, CurrentAssetLocation, CurrentAssetStatus, CurrentColorAssetStatus, Currency, UnitPrice(number here), PONo, PODate, AssetDate, Remarks, RunningNumber, Status("ENABLED"/...), IDX_M_Asset, IDX_M_AssetType, IDX_M_Company,`
  ACL flags (0/1 ints): `isUpdate, isDelete, isDisable, isEnable, isReturn, isAssignUser, isAssignLocation, isAssignStatus, isChangeCompany, isChangeManagement, isManagement, isConnectedASBSPO`.
  WARNING: `CurrentColorAssetStatus` is a **Vuetify** class (e.g. "teal darken-2", "red", "orange darken-3"), NOT Tailwind — map it to a Tailwind/shadcn badge color yourself. Dates are RFC3339 (`2018-12-31T00:00:00Z`).
- `data[1]` (len 1, PAGINATION + page-level ACL): `{CurrentPage, MaxPage, PageSize, TotalRecords, isNew, isUpdate, isDelete, isReturn}`.

---

## Asset detail / new (AssetDetailScreen) — single-asset Asset controller

### POST /api/asset/search  [OK]  — 1 rowset
Body `{Keyword, CurrentPage, PageSize, ...same optional filters as /api/assets/search minus IDX_M_AssetSize/ReturnAsset/Sort*}`.
Pass the AssetID as `Keyword` to fetch one asset. `data[0]` = matching rows. Keys are a SUBSET of the grid row:
`AssetID, AssetTypeName, AssetTypeModelName, AssetBrandName, AssetColorName, AssetSizeName, AssetManagementName, CompanyName, CompanyAlias, CurrentAssetUser, CurrentAssetDepartment, CurrentAssetLocation, CurrentAssetStatus, Currency, UnitPrice(STRING "0.00" here), PONo, PODate, AssetDate, Remarks, Status, IDX_M_Asset, IDX_M_AssetType, IDX_M_Company, isConnectedASBSPO, isDisable, isEnable`.
NOTE: no `CurrentColorAssetStatus`, no per-action ACL flags, UnitPrice is a STRING here (vs number in the grid).

---

## Filter dropdown sources (LOOKUPS)

Both lookups endpoints WORK (the original task note that /api/assets/lookups was empty is no longer true).

### GET /api/assets/lookups  [OK]  — 11 rowsets  (ManageAsset_AdditionalList) — PREFERRED for the grid/filters
- `data[0]` Types: `{AssetTypeName, IDX_M_AssetType}`
- `data[1]` Colors: `{AssetColorName, IDX_M_AssetColor}`
- `data[2]` Locations: `{AssetLocationName, IDX_M_AssetLocation}`
- `data[3]` Statuses: `{AssetStatusName, IDX_M_AssetStatus}`  (5: Broken, ... )
- `data[4]` Users (~2125): `{AssetUserName, IDX_M_AssetUser, DepartmentName, DivisionName, DirectorateName, PositionName}`
- `data[5]` Sizes (~1836): `{AssetSizeName}`  (NO IDX here — use /api/asset/lookups data[5] if you need IDX_M_AssetSize)
- `data[6]` Brands (~794): `{AssetBrandName, IDX_M_AssetBrand}`
- `data[7]` Managements (22): `{AssetManagementName, IDX_M_AssetManagement}`
- `data[8]` Departments (~247): `{DepartmentName}`
- `data[9]` TypeModels (~1703): `{AssetTypeModelName, IDX_M_AssetType, IDX_M_AssetTypeModel}`  (has parent IDX_M_AssetType → filter models by selected type client-side)
- `data[10]` Companies (12): `{CompanyName, CompanyAlias, IDX_M_Company}`

### GET /api/asset/lookups  [OK]  — 9 rowsets  (Asset_AdditionalList) — use for the NEW/EDIT asset form
- data[0] Types, data[1] Colors, data[2] Locations, data[3] Statuses, data[4] Users `{AssetUserName, IDX_M_AssetUser}`,
  data[5] Sizes `{AssetSizeName, IDX_M_AssetSize}` (HAS IDX_M_AssetSize, unlike the grid lookup), data[6] Brands, data[7] Managements, data[8] Departments.
  No TypeModels / no Companies rowset here.

RECOMMENDATION: For AssetListScreen filters use **/api/assets/lookups** (richest: incl. status, management, company, type-model with parent). For AssetDetailScreen form use **/api/asset/lookups** (has IDX_M_AssetSize).

### Cascading helpers for the form (both currently [BUG], see bottom):
- POST /api/asset/typemodel `{IDX_M_AssetType}` → models for a type. **[BUG] "too many arguments" (Session_ID).**
- POST /api/asset/company `{IDX_M_AssetManagement}`  [OK] → `data[0]` = `{CompanyName, IDX_M_Company}` (companies for a management).

---

## Asset history (AssetDetailScreen timelines)

### POST /api/assets/history/{status|location|user|management|company}  [BUG]
Body `{IDX_M_Asset}`. **ALL FIVE currently return `status:error`:**
`mssql: Procedure or function usp_CMS_ManageAsset_<X>_By_IDXAsset has too many arguments specified.`
Root cause: registry passes `bodyParams(true, "IDX_M_Asset")` → sends Session_ID, but these SPs take ONLY `@IDX_M_Asset`.
Until the BFF is fixed, the detail screen must fall back to the "current" fields already present on the search row
(CurrentAssetStatus/Location/User/etc.) and cannot render full history timelines.

---

## Master CRUD (MasterHubScreen / MasterCrudScreen)

### POST /api/master/{entity}/search  — body `{Keyword}` ("" = all)
| entity | status | rows | keys |
|---|---|---|---|
| brand | [OK] | 794 | AssetBrandName, AssetCount, IDX_M_AssetBrand, Status, isDelete/isDisable/isEnable/isUpdate |
| color | [OK] | 36 | AssetColorName, AssetCount, IDX_M_AssetColor, Status, isDelete/isDisable/isEnable/isUpdate |
| size  | [OK] | 1836 | AssetSizeName, AssetCount, IDX_M_AssetSize, Status, is* |
| status | [OK] | 5 | AssetStatusName, AssetStatusCount, IDX_M_AssetStatus, Status, is* |
| management | [OK] | 29 | AssetManagementName, AssetManagementCount, IDX_M_AssetManagement, Status, is* |
| location | [OK] | 68 | AssetLocationCode, AssetLocationName, AssetLocationCount, IDX_M_AssetLocation, Status, is* |
| type | [OK] | 28 | AssetTypeCode, AssetTypeName, AssetCount, AssetTypeModelCount, IDX_M_AssetType, Status, is* |
| user | [OK] | 2149 | NIK, Name, PositionName, DepartmentName, DivisionName, DirectorateName, RESIGN_DATE, AssetUserCount, IDX_M_AssetUser, Status, isHRIS/isUpdateHRIS/is* |
| group | [BUG] | — | `usp_CMS_AssetGroup_Search` does NOT exist in dev DB → status:error. Skip "group" master entity (also `model` SP not exercised; use /api/asset/lookups data[9] for models). |

Common pattern: each row has `Status` ("ENABLED"/...) and per-row ACL flags `isDelete, isDisable, isEnable, isUpdate` (0/1).
Save/Update/Enable/Disable/Delete routes exist per entity (see registry `masterDefs`); NOT exercised here (writes).
For a CRUD roundtrip test use a self-cleaning "ZZ_IAT_TEST" name and delete it after.

### POST /api/master (hub, usp_CMS_AdminAsset_Load)  [BUG]
Body `{Keyword}` → `mssql: ... usp_CMS_AdminAsset_Load has too many arguments specified.` (Session_ID bug again). MasterHub tiles should be built from the static entity list, not this endpoint.

---

## KNOWN BFF BUGS (registry.go) — Session_ID sent to SPs that don't declare it
Pattern: `mssql: Procedure or function <SP> has too many arguments specified.`
Affected (all use `bodyParams(true, ...)` but the SP has no `@Session_ID`):
- `/api/assets/history/{status,location,user,management,company}` → `usp_CMS_ManageAsset_*_By_IDXAsset`
- `/api/asset/typemodel` → `usp_CMS_Asset_AssetTypeModel_By_IDXAssetType`
- `/api/master` (hub) → `usp_CMS_AdminAsset_Load`
FIX (BFF side): change these registry entries to `bodyParams(false, ...)` (drop the leading `sess()`), OR verify each SP's real @params against the live DB and align. The Windows frontend should treat these endpoints as unavailable until fixed and degrade gracefully.
Separately, `/api/master/group/*` fails because `usp_CMS_AssetGroup_*` SPs are absent in the dev DB (not a param bug).

Note: firing many /api/master/*/search calls in a tight loop occasionally yields transient
`TCP Provider: No connection ... actively refused` (connection-pool churn), not a real endpoint failure — retried individually they all succeed.
