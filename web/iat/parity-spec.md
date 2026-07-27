# Parity Spec — Legacy Vue → New React PWA

Auditor notes. Legacy source: `C:\xampp\htdocs\ASRILUP_CODE\src\components`.
BFF endpoint→SP registry: `bff/internal/api/registry.go` (all shapes below verified live
against dev DB `10.10.0.42\SQLDEVOPERATION2 / GeneralAffairDB`, login NIK=2403077).
Envelope: `{status,message,data:[rowsets]}`. Mutation SPs return HTTP 200 with a single
status row `data[0][0] = {StatusCode:"Success"|"Error", StatusMessage, StatusCSS}` — unwrap
like `master.ts assertStatus()` (throw on StatusCode==="Error").

Bahasa Indonesia UI, shadcn/Tailwind teal theme. Reuse existing `api` client + patterns.
NEVER render IDX_* columns in any datatable (per memory).

---

## GAP 1 — NEW ASSET (create)  [legacy NewAsset.vue]

Route: add `/assets/new`. Add a "Tambah Aset" button on AssetListScreen (legacy shows this
only when `page.isNew` / row `isInsert` ACL is truthy — gate it the same way). Two-column form.

Lookups: **GET /api/asset/lookups** (9 rowsets, NO Session_ID needed by SP but registry sends
it fine): [0]Types{AssetTypeName,IDX_M_AssetType} [1]Colors{AssetColorName,IDX_M_AssetColor}
[2]Locations{AssetLocationName,IDX_M_AssetLocation} [3]Statuses{AssetStatusName,IDX_M_AssetStatus}
[4]Users{AssetUserName,IDX_M_AssetUser} [5]Sizes{AssetSizeName,IDX_M_AssetSize}
[6]Brands{AssetBrandName,IDX_M_AssetBrand} [7]Managements{AssetManagementName,IDX_M_AssetManagement}
[8]Departments{DepartmentName}. NOTE: this lookup has NO companies and NO type-models rowset.

Cascades:
- Company by management: **POST /api/asset/company {IDX_M_AssetManagement}** → data[0]
  {CompanyName,IDX_M_Company}. [OK live]. Load on management change; clear/disable company until set.
- Model by type: **POST /api/asset/typemodel {IDX_M_AssetType}** is **[BUG] "too many arguments"**
  (registry sends Session_ID; SP takes only @IDX_M_AssetType). WORKAROUND: use
  **GET /api/assets/lookups** data[9] TypeModels{AssetTypeModelName,IDX_M_AssetType,IDX_M_AssetTypeModel}
  and filter client-side by selected IDX_M_AssetType (legacy `ct_assetTypeModel` did exactly this).
  Model dropdown disabled until a Type is chosen.

Currency: static 2 options — value "IDR" (label "IDR Rupiah"), value "USD" (label "$ US Dollar").
Dates default to today (YYYY-MM-DD). PODate is read-only, filled by PO search.

PO search (optional): **POST /api/po {PONo}** (usp_CMS_Asset_ASBSPOList, NO Session_ID) →
data[0]=header rows (PODate,...), data[1]=material lines {MaterialCode,Category,SubCategory,
MaterialType,UnitPrice}. Legacy opens a side panel/table with a client-side search box; on
result sets PODate (+ AssetDate) from data[0][0].PODate. [Live returns 2 empty rowsets for
non-existent PO — treat empty as "PO not found", non-fatal.] PO is NOT required to submit.

Submit: **POST /api/asset** — body keys (exact, from registry usp_CMS_Asset_Save):
IDX_M_AssetManagement, IDX_M_Company, IDX_M_AssetType, AssetTypeModelName, IDX_M_AssetColor,
AssetSizeName, AssetBrandName, IDX_M_AssetUser, IDX_M_AssetLocation, IDX_M_AssetStatus, PONo,
PODate, Currency, UnitPrice, Remarks, AssetDate. (Session_ID injected by BFF.)
WARNING: Model/Size/Brand are submitted as NAME strings (AssetTypeModelName / AssetSizeName /
AssetBrandName), NOT their IDX — matches legacy exactly. Color uses IDX_M_AssetColor.

Client validation (legacy checkField — all required EXCEPT PONo): Management, Company, User,
Location, Status, Type, Model, Color, Size, Brand, Currency, UnitPrice. Show inline errors.
Legacy also had 3 quick-add mini-dialogs (New Size / New Brand / New Model) — see extraGaps
(nice-to-have, master CRUD already exists elsewhere).

IAT: form loads real lookups, dropdowns populate, cascades work, validation blocks empty submit.
DO NOT fire the final POST /api/asset (creates a real asset).

---

## GAP 2 — ASSET EDIT  [legacy AssetEdit.vue]

Route: add `/assets/:id/edit`. Wire the AssetDetailScreen "Edit" button (currently a
`toast.info(... backend menyusul)` stub at AssetDetailScreen.tsx line ~122) to navigate here.

Prefill: **POST /api/asset/search {Keyword:<AssetID>,CurrentPage:1,PageSize:20}** (same as detail;
reuse fetchAssetByID) → row has AssetTypeModelName, AssetSizeName, AssetBrandName, PONo, PODate,
Currency, UnitPrice, Remarks + display-only fields. Read-only (disabled) display fields:
Managed By (AssetManagementName), Company (CompanyName), User (CurrentAssetUser), Location
(CurrentAssetLocation), Status (CurrentAssetStatus), Type (AssetTypeName), Color (AssetColorName),
Asset Date (AssetDate). Show AssetID as a barcode/header.

Editable fields ONLY: Model (select, filtered by the asset's IDX_M_AssetType — from
/api/assets/lookups data[9]), Size (select, AssetSizeName), Brand (select, AssetBrandName),
PONo (text + PO search side panel like New Asset), PODate (read-only), Currency (select IDR/USD),
UnitPrice (text), Remarks (text). Lookups: GET /api/asset/lookups (sizes/brands) + assets/lookups[9]
for models. isConnectedASBSPO shows a share badge (non-interactive).

Submit: **PATCH /api/asset** — body keys (exact, usp_CMS_Asset_Update): IDX_M_Asset,
AssetTypeModelName, AssetSizeName, AssetBrandName, PONo, PODate, Currency, UnitPrice, Remarks.

IAT: open edit, fields prefilled, editable dropdowns populate, DO NOT fire the PATCH.

---

## GAP 3 — ASSET ACTIONS  [legacy Mailgrid.vue / Datagrid.vue action dialogs + CsActionMenu.vue]

Per-row action menu (legacy CsActionMenu → "more_vert" dropdown). Currently RowActions in
AssetListScreen.tsx (lines ~85-109) has only Lihat Detail + two toast stubs. Replace with real
dialogs. Each menu item is gated by the ROW ACL flag (0/1) from /api/assets/search data[0]:
- isAssignUser  → "Assign User" dialog
- isAssignLocation → "Assign Location" dialog
- isAssignStatus → "Assign Status" dialog
- isChangeCompany → "Change Company" dialog
- isChangeManagement → "Change Management" dialog
- isUpdate → "Edit" → link to /assets/:AssetID/edit
- isDisable (non-null) → toggle Enable/Disable (label depends on current isDisable/isEnable)
- Plus static: Check History (/assets/:id — detail has history), Detail (/assets/:id).
Also a list-level "Return User" bulk action gated by page/row isReturn (checkbox multi-select).

Dialog contents (each: a Select from lookups + optional Date + Remarks textarea; Save disabled
until the select has a value). Lookups source = **GET /api/assets/lookups** (richest):
data[3]Statuses, data[2]Locations, data[4]Users, data[7]Managements, data[10]Companies. Company
change ideally scoped to the asset's management (legacy loaded companies via
/api/assets/company {IDX_M_AssetManagement}); acceptable to use lookups[10] for MVP.

Endpoints + exact bodies (all inject Session_ID via BFF; verified in registry):
- Assign User:     POST /api/assets/assign-user     {IDX_M_Asset, IDX_M_AssetUser, Date, Remarks}
- Assign Location: POST /api/assets/assign-location {IDX_M_Asset, IDX_M_AssetLocation, Date, Remarks}
- Assign Status:   POST /api/assets/assign-status   {IDX_M_Asset, IDX_M_AssetStatus, Remarks}   (NO Date)
- Change Management:POST /api/assets/change-management {IDX_M_Asset, IDX_M_AssetManagement, Remarks}
- Change Company:  POST /api/assets/change-company  {IDX_M_Asset, IDX_M_Company, Remarks}
- Return:          POST /api/assets/return          {IDX_M_Asset, Remarks}  (multi: IDX_M_Asset may be comma-joined ids)
- Enable:          POST /api/assets/enable          {IDX_M_Asset}
- Disable:         POST /api/assets/disable         {IDX_M_Asset}
Date format YYYY-MM-DD, defaults to today. Legacy dialogs also show a per-asset History popover
(status/location/user/management/company) — optional; the history SPs are currently [BUG]
"too many arguments" (see extraGaps), so history-in-dialog can be omitted for MVP.
On success: toast the StatusMessage and refetch the grid.

IAT: open each dialog, confirm its select populates from real lookups + Remarks works + Save
gating. DO NOT fire the final POST for any assign/change/return/enable/disable (real writes).

---

## GAP 4a — SETTINGS: Admin Access  [legacy AssetSetting.vue]

Route: add `/settings/admin-access`. Table columns (NO IDX): NIK, Name, Department Name + a
per-row action menu (Edit / Delete gated by row isUpdate / isDelete). Header search box
(client-side filter over the loaded list, legacy `:search`). An orange warning badge when
row.isEnable is truthy.

- List: **POST /api/settings/admin-access/search {Keyword}** ("" = all) → data[0] rows
  {NIK, Name, DepartmentName, IDX_T_AssetAdminAccess, isUpdate, isDelete[, isEnable]};
  data[1][0].isNew gates the "Add" button. [OK live]
- Lookups: **GET /api/settings/admin-access/lookups** → data[0] Security
  {SecurityLevel, SecurityLevelName} (e.g. HO / "-"), data[1] Managements
  {AssetManagementName, IDX_M_AssetManagement} (incl. [ALL]=0), data[2] Companies
  {CompanyName, IDX_M_Company}. [OK live]
- Prefill for edit: **POST /api/settings/admin-access/by-nik {NIK}** → data[0][0]
  {SecurityLevel, IDX_M_AssetManagement, IDX_M_Company, IDX_T_AssetAdminAccess}. [OK live]
- Create: **POST /api/settings/admin-access {NIK, SecurityLevel, IDX_M_AssetManagement, IDX_M_Company}**.
- Update: **PATCH /api/settings/admin-access {IDX_T_AssetAdminAccess, SecurityLevel, IDX_M_AssetManagement, IDX_M_Company}**.
- Delete: **DELETE /api/settings/admin-access {IDX_T_AssetAdminAccess}**.

Add form (side sheet / dialog): NIK (text, required), Security (select from lookups[0]),
Asset Management (select lookups[1]), Company (select lookups[2]). Edit dialog shows NIK/Name/
Department read-only + editable Security/Company/Management selects.

IAT: create→verify→delete roundtrip allowed with a clearly test-marked NIK (contains "ZZ_IAT")
since a clean DELETE exists. Never touch pre-existing real rows.

## GAP 4b — SETTINGS: Group Access  [legacy GroupSetting.vue]  **BLOCKED (SPs missing in dev DB)**

Route: `/settings/group-access`. Registry maps search/lookups/save/update/delete, BUT the dev DB
has NO `usp_CMS_AssetGroupAccess_Search`, `_AdditionalList`, etc. (verified live: both return
`Could not find stored procedure`). Build the screen to the SAME contract as Admin Access so it
works once the SPs exist, but it must **degrade gracefully** (show an empty/"belum tersedia"
state instead of an error) and IAT must NOT assert a working roundtrip.
- List: POST /api/settings/group-access/search {Keyword}  → columns NIK, Name, DepartmentName,
  AssetGroupName + action menu; row key IDX_T_AssetGroup.
- Lookups: GET /api/settings/group-access/lookups → data[0] Users {Name, NIK}, data[1] Groups
  {AssetGroupName, IDX_M_AssetGroup}.
- Create: POST {NIK, IDX_M_AssetGroup} · Update: PATCH {IDX_T_AssetGroup, IDX_M_AssetGroup} ·
  Delete: DELETE {IDX_T_AssetGroup}.
Add form: Nama Karyawan (select users by NIK), Asset Group (select). Edit: NIK/Name/Dept
read-only + editable Group select.

## GAP 4c — SETTINGS: User roles (UserASRILup per-form access)  [legacy UserSetting.vue + CsRole.vue]

Route: `/settings/users`. Table columns (NO IDX): NIK, Name + a per-row Edit button (gated by
row isUpdate). Header search box. An "Add User Access" (person_add) button gated by list isNew.

- List: **POST /api/settings/users/search {Keyword, CurrentPage, PageSize}** → data[0]
  {NIK, Name, isUpdate[, isEnable]}, data[1][0] {TotalRecords, CurrentPage, MaxPage, PageSize, isNew}.
  [OK live — legacy used PageSize 99999 client-side; PWA should paginate server-side.]
- Users dropdown (for Add): **GET /api/settings/users/list** → data[0] {NIK, Name} (~2100). [OK]
- Blank form matrix: **GET /api/settings/users/lookups** → data[0] forms
  {Form_Name, IDX_M_Forms, isRead, isInsert, isUpdate, isDelete} (all 0). [OK]
- Prefill for edit: **POST /api/settings/users/by-nik {NIK}** → data[0] same form rows with the
  user's current isRead/isInsert/isUpdate/isDelete set. [OK]
- Save (create): **POST /api/settings/users {NIK, UserAccess}** where UserAccess is a JSON array
  of `{i:IDX_M_Forms, r:isRead(0/1), u:isUpdate, d:isDelete, n:isInsert}` (legacy CsRole `rudi`).
- Update: **PATCH /api/settings/users {NIK, UserAccess}** (same UserAccess shape; NIK from the row).

Editor UI (legacy CsRole side sheet, width ~700): for Add, a "Selected User" select at top (from
users/list); a table of forms with 4 switches per row (Read / Insert / Update / Delete). Insert/
Update/Delete switches are disabled when the form is read-only (legacy isReadOnly). Build the
UserAccess array from the switch states on Save/Update.

IAT: Admin Access + User roles list/search/lookups load; open Add + Edit editors and confirm
matrices populate. Roundtrip create→delete only where a clean delete exists (Admin Access has
one; Users has no delete — do NOT create test users, keep User-roles IAT read/open-only).

---

## GAP 5 — ASSET LIST advanced search + SORT  [legacy AssetList.vue + CsSearchForm.vue + CsSort.vue]

Current AssetListScreen has keyword + 3 single filters (Type/Status/Location) only. Legacy had a
multi-field "Advance Search" side drawer AND a Sort menu. Both feed extra params into the SAME
**POST /api/assets/search** call (all optional, already in AssetSearchParams / registry).

Advanced search fields (legacy searchItems) — all optional, most multi-select (send as
comma-joined ids since the SP takes a single string per param):
- Assign/Unassign → `ReturnAsset` (0 = Assign, 1 = UnAssign)
- Status (multi) → `IDX_M_AssetStatus`  (lookups data[3])
- User (multi) → `IDX_M_AssetUser`      (data[4])
- Location (multi) → `IDX_M_AssetLocation` (data[2])
- Department (single) → `DepartmentName`  (data[8])
- Brand (single) → `IDX_M_AssetBrand`     (data[6])
- Type (single) → `IDX_M_AssetType`       (data[0])
- Company (multi) → `IDX_M_Company`       (data[10])
Plus TimePeriod already supported (legacy filterItems: 0 All / 1 Last Created / 2 Last Modified).
Reset clears all. Keep the existing 3 quick filters or fold them into this drawer.

Sort (legacy CsSort): two params —
- `SortBy` (1=Status, 2=Location, 3=Company, 4=Asset Number, 5=Asset Disabled, 6=Connect ASBS)
- `SortSequence` (0=Ascending, 1=Descending)
Render as a Sort menu; on change refetch (reset to page 1). [SortBy/SortSequence verified present
in registry usp_CMS_ManageAsset_Search params.]

IAT: open advanced search, multi-selects populate from real lookups, applying narrows the count
(assert count changes / pattern, allow "13.953"-style thousands separators); sort menu changes
result order without error.

---

## extraGaps (other notable legacy features the PWA lacks)

1. **Asset History full timelines [BUG]** — POST /api/assets/history/{status|location|user|
   management|company} {IDX_M_Asset} all return `has too many arguments specified` (registry
   uses gate() but the handler still appears to pass an extra arg; SP takes only @IDX_M_Asset).
   AssetDetailScreen already tolerates this (falls back to Current* fields). Needs a BFF fix
   before real history timelines (and the in-dialog history popovers) work.
2. **Quick-add mini-dialogs on New Asset** — legacy NewAsset had inline "New Size / New Brand /
   New Model" dialogs (POST /api/master/{size|brand|model}) so you could add a missing option
   without leaving the form. Model master SP path exists in registry but is unexercised.
3. **PO detail side panel** — the PONo search opens a searchable material-lines table
   (MaterialCode/Category/SubCategory/MaterialType/UnitPrice) shared by New Asset, Asset Edit
   and the old grid. Needs a reusable component; currently absent.
4. **Bulk Return (multi-select) + Print** — legacy Mailgrid had checkbox multi-select driving a
   bulk "Return User" (comma-joined IDX_M_Asset) and an SSRS print button. PWA list has neither
   selection nor bulk actions yet.
5. **Card ⇄ table (Mailgrid/Datagrid) toggle with rich asset cards** — PWA has a table/card
   toggle already, but legacy cards showed status-colored avatar, user tooltip w/ PO info,
   department, management•companyAlias, and an ASBS "share" badge (isConnectedASBSPO). Minor.
6. **HistoryAsset settings toggles** — legacy /AssetHistory/:id let the user show/hide each
   history section (User/Location/Status/Management/Company) via switches. PWA detail shows all.
7. **CurrentColorAssetStatus is a Vuetify class** (e.g. "teal darken-2") — already mapped by
   lib/assetStatus.ts; keep using that mapper for any new status badges in dialogs.
