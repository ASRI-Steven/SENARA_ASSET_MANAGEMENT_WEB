package api

// Declarative endpoint → stored-procedure registry.
//
// Each entry maps an HTTP route to ONE usp_CMS_* / usp_SECURITY_* SP plus the
// ordered parameter list that SP declares (verified against the legacy .NET
// controllers at C:\xampp\htdocs\ASRILup\WebServerApp1). The generic handler
// (handlers.go) sources each param from the request body/query, a constant, or
// the httpOnly session cookie, then calls mssql.ExecSP by name.
//
// Auth routes (login/logout/check) are NOT here — they need custom cookie logic
// and live in handlers.go.

type paramKind int

const (
	fromBody paramKind = iota
	fromQuery
	fromSession
	fromConst
	// sessionGate requires a valid session for the request (auth gating) but is
	// NOT passed to the stored procedure. Use for SPs that key off IDX only and
	// declare no @Session_ID param (e.g. the ManageAsset *_By_IDXAsset history
	// SPs) — passing Session_ID there yields "too many arguments specified".
	sessionGate
)

type param struct {
	name string    // SP parameter name (= .NET AddParameter name)
	kind paramKind // where the value comes from
	key  string    // body/query key (defaults to name)
	cval string    // constant value (fromConst)
}

type endpoint struct {
	method string
	path   string
	sp     string
	params []param
}

// --- param constructors ---
func sess() param            { return param{name: "Session_ID", kind: fromSession} }
func gate() param            { return param{name: "Session_ID", kind: sessionGate} }
func b(name string) param    { return param{name: name, kind: fromBody, key: name} }
func q(name string) param    { return param{name: name, kind: fromQuery, key: name} }
func c(name, v string) param { return param{name: name, kind: fromConst, cval: v} }

// requiresSession reports whether the endpoint needs a valid session — either
// because a param is session-sourced (fed to the SP) or because it carries a
// sessionGate (auth-only, not fed to the SP).
func (e endpoint) requiresSession() bool {
	for _, p := range e.params {
		if p.kind == fromSession || p.kind == sessionGate {
			return true
		}
	}
	return false
}

// masterDef drives the uniform Master CRUD registration.
type masterDef struct {
	route   string   // URL segment, e.g. "brand"
	sp      string   // SP prefix, e.g. "usp_CMS_AssetBrand"
	idx     string   // primary-key param, e.g. "IDX_M_AssetBrand"
	saveP   []string // extra Save fields (besides Session_ID)
	updateP []string // extra Update fields (besides Session_ID + idx)
}

var masterDefs = []masterDef{
	{"brand", "usp_CMS_AssetBrand", "IDX_M_AssetBrand", []string{"AssetBrandName"}, []string{"AssetBrandName"}},
	{"color", "usp_CMS_AssetColor", "IDX_M_AssetColor", []string{"AssetColorName"}, []string{"AssetColorName"}},
	{"size", "usp_CMS_AssetSize", "IDX_M_AssetSize", []string{"AssetSizeName"}, []string{"AssetSizeName"}},
	{"status", "usp_CMS_AssetStatus", "IDX_M_AssetStatus", []string{"AssetStatusName"}, []string{"AssetStatusName"}},
	{"management", "usp_CMS_AssetManagement", "IDX_M_AssetManagement", []string{"AssetManagementName"}, []string{"AssetManagementName"}},
	{"group", "usp_CMS_AssetGroup", "IDX_M_AssetGroup", []string{"AssetGroupName"}, []string{"AssetGroupName"}},
	{"location", "usp_CMS_AssetLocation", "IDX_M_AssetLocation", []string{"AssetLocationCode", "AssetLocationName"}, []string{"AssetLocationCode", "AssetLocationName"}},
	{"type", "usp_CMS_AssetType", "IDX_M_AssetType", []string{"AssetTypeCode", "AssetTypeName"}, []string{"AssetTypeCode", "AssetTypeName"}},
	{"model", "usp_CMS_AssetTypeModel", "IDX_M_AssetTypeModel", []string{"IDX_M_AssetType", "AssetTypeModelName"}, []string{"IDX_M_AssetType", "AssetTypeModelName"}},
	{"user", "usp_CMS_AssetUser", "IDX_M_AssetUser",
		[]string{"NIK", "Name", "PositionName", "DepartmentName", "DivisionName", "DirectorateName"},
		[]string{"NIK", "Name", "PositionName", "DepartmentName", "DivisionName", "DirectorateName"}},
}

func bodyParams(sess bool, names ...string) []param {
	out := make([]param, 0, len(names)+1)
	if sess {
		out = append(out, param{name: "Session_ID", kind: fromSession})
	}
	for _, n := range names {
		out = append(out, param{name: n, kind: fromBody, key: n})
	}
	return out
}

// endpoints assembles the full registry.
func endpoints() []endpoint {
	eps := []endpoint{
		// --- Security / shell ---
		{"GET", "/api/menu", "usp_SECURITY_PopulateRootMenuAccess",
			[]param{sess(), c("IPAddress", ""), c("IDX_M_Apps", "32"), c("Status", ""), c("RecordStatus", "")}},

		// --- Dashboard ---
		{"GET", "/api/dashboard/managements", "usp_CMS_Dashboard_Asset_AdditionalList", []param{sess()}},
		{"POST", "/api/dashboard", "usp_CMS_Dashboard_Asset", bodyParams(true, "IDX_M_AssetManagement")},

		// --- Manage Asset (admin grid) ---
		{"POST", "/api/assets/search", "usp_CMS_ManageAsset_Search", bodyParams(true,
			"Keyword", "IDX_M_AssetManagement", "IDX_M_Company", "IDX_M_AssetType", "IDX_M_AssetTypeModel",
			"IDX_M_AssetColor", "IDX_M_AssetSize", "IDX_M_AssetBrand", "IDX_M_AssetUser", "DepartmentName",
			"IDX_M_AssetLocation", "IDX_M_AssetStatus", "ReturnAsset", "SortBy", "SortSequence", "TimePeriod",
			"CurrentPage", "PageSize")},
		{"GET", "/api/assets/lookups", "usp_CMS_ManageAsset_AdditionalList", []param{sess()}},
		{"POST", "/api/assets/company", "usp_CMS_ManageAsset_Company_AdditionalList", bodyParams(true, "IDX_M_AssetManagement")},
		{"POST", "/api/assets/admin-access", "usp_CMS_AssetAdminAccess_By_NIK", bodyParams(false, "NIK")},

		// history by asset. These SPs declare ONLY @IDX_M_Asset (no @Session_ID),
		// so gate() enforces auth without feeding Session_ID to the SP.
		{"POST", "/api/assets/history/status", "usp_CMS_ManageAsset_Status_By_IDXAsset", []param{gate(), b("IDX_M_Asset")}},
		{"POST", "/api/assets/history/location", "usp_CMS_ManageAsset_Location_By_IDXAsset", []param{gate(), b("IDX_M_Asset")}},
		{"POST", "/api/assets/history/user", "usp_CMS_ManageAsset_User_By_IDXAsset", []param{gate(), b("IDX_M_Asset")}},
		{"POST", "/api/assets/history/management", "usp_CMS_ManageAsset_Management_By_IDXAsset", []param{gate(), b("IDX_M_Asset")}},
		{"POST", "/api/assets/history/company", "usp_CMS_ManageAsset_Company_By_IDXAsset", []param{gate(), b("IDX_M_Asset")}},

		// actions
		{"POST", "/api/assets/assign-user", "usp_CMS_ManageAsset_User_Assign", bodyParams(true, "IDX_M_Asset", "IDX_M_AssetUser", "Date", "Remarks")},
		{"POST", "/api/assets/assign-location", "usp_CMS_ManageAsset_Location_Assign", bodyParams(true, "IDX_M_Asset", "IDX_M_AssetLocation", "Date", "Remarks")},
		{"POST", "/api/assets/assign-status", "usp_CMS_ManageAsset_Status_Assign", bodyParams(true, "IDX_M_Asset", "IDX_M_AssetStatus", "Remarks")},
		{"POST", "/api/assets/change-management", "usp_CMS_ManageAsset_Management_Change", bodyParams(true, "IDX_M_Asset", "IDX_M_AssetManagement", "Remarks")},
		{"POST", "/api/assets/change-company", "usp_CMS_ManageAsset_Company_Change", bodyParams(true, "IDX_M_Asset", "IDX_M_Company", "Remarks")},
		{"POST", "/api/assets/return", "usp_CMS_ManageAsset_User_ReturnMultiple", bodyParams(true, "IDX_M_Asset", "Remarks")},
		{"POST", "/api/assets/enable", "usp_CMS_Asset_Enable", bodyParams(true, "IDX_M_Asset")},
		{"POST", "/api/assets/disable", "usp_CMS_Asset_Disable", bodyParams(true, "IDX_M_Asset")},

		// request form
		{"POST", "/api/requests", "usp_CMS_AssetRequestForm_Save", bodyParams(true,
			"RequestDate", "RequestType", "RequestFrom", "RequestTo", "IDX_M_Company", "IDX_M_AssetUser",
			"RequestInformation", "RequestDueDate", "IDX_M_AssetLocation", "ItemRequest")},

		// --- Asset (single / new) ---
		{"POST", "/api/asset/search", "usp_CMS_Asset_Search", bodyParams(true,
			"Keyword", "IDX_M_AssetManagement", "IDX_M_Company", "IDX_M_AssetType", "IDX_M_AssetTypeModel",
			"IDX_M_AssetColor", "IDX_M_AssetBrand", "IDX_M_AssetUser", "DepartmentName", "IDX_M_AssetLocation",
			"IDX_M_AssetStatus", "CurrentPage", "PageSize")},
		{"GET", "/api/asset/lookups", "usp_CMS_Asset_AdditionalList", []param{sess()}},
		{"POST", "/api/asset", "usp_CMS_Asset_Save", bodyParams(true,
			"IDX_M_AssetManagement", "IDX_M_Company", "IDX_M_AssetType", "AssetTypeModelName", "IDX_M_AssetColor",
			"AssetSizeName", "AssetBrandName", "IDX_M_AssetUser", "IDX_M_AssetLocation", "IDX_M_AssetStatus",
			"PONo", "PODate", "Currency", "UnitPrice", "Remarks", "AssetDate")},
		{"PATCH", "/api/asset", "usp_CMS_Asset_Update", bodyParams(true,
			"IDX_M_Asset", "AssetTypeModelName", "AssetSizeName", "AssetBrandName", "PONo", "PODate",
			"Currency", "UnitPrice", "Remarks")},
		{"POST", "/api/po", "usp_CMS_Asset_ASBSPOList", bodyParams(false, "PONo")},
		{"POST", "/api/asset/typemodel", "usp_CMS_Asset_AssetTypeModel_By_IDXAssetType", bodyParams(true, "IDX_M_AssetType")},
		{"POST", "/api/asset/company", "usp_CMS_Asset_Company_By_IDXAssetManagement", bodyParams(true, "IDX_M_AssetManagement")},

		// --- Settings: Admin Access ---
		{"POST", "/api/settings/admin-access/search", "usp_CMS_AssetAdminAccess_Search", bodyParams(true, "Keyword")},
		{"GET", "/api/settings/admin-access/lookups", "usp_CMS_AssetAdminAccess_AdditionalList", nil},
		{"POST", "/api/settings/admin-access/by-nik", "usp_CMS_AssetAdminAccess_By_NIK", bodyParams(false, "NIK")},
		{"POST", "/api/settings/admin-access", "usp_CMS_AssetAdminAccess_Save", bodyParams(true, "NIK", "SecurityLevel", "IDX_M_AssetManagement", "IDX_M_Company")},
		{"PATCH", "/api/settings/admin-access", "usp_CMS_AssetAdminAccess_Update", bodyParams(true, "IDX_T_AssetAdminAccess", "SecurityLevel", "IDX_M_AssetManagement", "IDX_M_Company")},
		{"DELETE", "/api/settings/admin-access", "usp_CMS_AssetAdminAccess_Delete", bodyParams(true, "IDX_T_AssetAdminAccess")},

		// --- Settings: Group Access ---
		{"POST", "/api/settings/group-access/search", "usp_CMS_AssetGroupAccess_Search", bodyParams(true, "Keyword")},
		{"GET", "/api/settings/group-access/lookups", "usp_CMS_AssetGroupAccess_AdditionalList", nil},
		{"POST", "/api/settings/group-access", "usp_CMS_AssetGroupAccess_Save", bodyParams(true, "NIK", "IDX_M_AssetGroup")},
		{"PATCH", "/api/settings/group-access", "usp_CMS_AssetGroupAccess_Update", bodyParams(true, "IDX_T_AssetGroup", "IDX_M_AssetGroup")},
		{"DELETE", "/api/settings/group-access", "usp_CMS_AssetGroupAccess_Delete", bodyParams(true, "IDX_T_AssetGroup")},

		// --- Settings: User ASRILup (per-form access) ---
		{"POST", "/api/settings/users/search", "usp_CMS_UserASRILup_Search", bodyParams(true, "Keyword", "CurrentPage", "PageSize")},
		{"GET", "/api/settings/users/list", "usp_CMS_UserASRILup_UserList", nil},
		{"GET", "/api/settings/users/lookups", "usp_CMS_UserASRILup_AdditionalList", nil},
		{"POST", "/api/settings/users/by-nik", "usp_CMS_UserASRILup_By_NIK", bodyParams(false, "NIK")},
		{"POST", "/api/settings/users", "usp_CMS_UserASRILup_Save", bodyParams(true, "NIK", "UserAccess")},
		{"PATCH", "/api/settings/users", "usp_CMS_UserASRILup_Update", bodyParams(true, "NIK", "UserAccess")},

		// --- Master hub ---
		{"POST", "/api/master", "usp_CMS_AdminAsset_Load", bodyParams(true, "Keyword")},
	}

	// Uniform Master CRUD (search/save/update/enable/disable/delete) per entity.
	for _, m := range masterDefs {
		base := "/api/master/" + m.route
		eps = append(eps,
			endpoint{"POST", base + "/search", m.sp + "_Search", bodyParams(true, "Keyword")},
			endpoint{"POST", base, m.sp + "_Save", bodyParams(true, m.saveP...)},
			endpoint{"PATCH", base, m.sp + "_Update", bodyParams(true, append([]string{m.idx}, m.updateP...)...)},
			endpoint{"POST", base + "/enable", m.sp + "_Enable", bodyParams(true, m.idx)},
			endpoint{"POST", base + "/disable", m.sp + "_Disable", bodyParams(true, m.idx)},
			endpoint{"DELETE", base, m.sp + "_Delete", bodyParams(true, m.idx)},
		)
	}

	return eps
}
