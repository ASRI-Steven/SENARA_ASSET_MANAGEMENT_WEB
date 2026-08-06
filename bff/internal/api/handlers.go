package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"asrilup-bff/internal/mssql"
)

// Service holds the dependencies every handler needs.
type Service struct {
	db      *sql.DB // primary: GeneralAffairDB (asset data + most SPs)
	dbGroup *sql.DB // AssetICTDB: holds the usp_CMS_AssetGroup* SPs
	secure  bool    // Secure flag for the session cookie
}

func NewService(db, dbGroup *sql.DB, cookieSecure bool) *Service {
	return &Service{db: db, dbGroup: dbGroup, secure: cookieSecure}
}

// pool selects the DB pool for an endpoint. A handful of SPs live ONLY in
// AssetICTDB, not the primary GeneralAffairDB, so they must run on the group
// pool:
//   - usp_CMS_AssetGroup*        — Group Access + Asset Group master.
//   - usp_CMS_AssetRequestForm_Save — Request Form submit. NOTE: this SP's
//     INSERTs are fully-qualified to GeneralAffairDB.dbo.M_/T_AssetRequestForm,
//     so the request data still lands in the primary DB (and the company/user/
//     location IDs stay consistent with the GeneralAffairDB lookups) — routing it
//     to AssetICTDB is both required (that's where the SP is) and safe.
// Everything else uses the primary pool.
func (s *Service) pool(ep endpoint) *sql.DB {
	if s.dbGroup == nil {
		return s.db
	}
	if strings.HasPrefix(ep.sp, "usp_CMS_AssetGroup") ||
		ep.sp == "usp_CMS_AssetRequestForm_Save" {
		return s.dbGroup
	}
	return s.db
}

// makeHandler builds the generic handler for a registry endpoint: it sources
// each SP parameter (body / query / const / session cookie) and EXECs the SP.
func (s *Service) makeHandler(ep endpoint) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := readSession(r)
		if ep.requiresSession() && session == "" {
			writeUnauthorized(w)
			return
		}

		body := decodeBody(r)

		args := make([]mssql.NamedArg, 0, len(ep.params))
		for _, p := range ep.params {
			var val string
			switch p.kind {
			case sessionGate:
				// Auth-only marker: gated above via requiresSession; never passed
				// to the SP (the SP declares no matching @param).
				continue
			case fromSession:
				val = session
			case fromConst:
				val = p.cval
			case fromQuery:
				val = r.URL.Query().Get(p.key)
			case fromBody:
				val = toStr(body[p.key])
			}
			args = append(args, mssql.NamedArg{Name: p.name, Value: val})
		}

		rowsets, err := mssql.ExecSP(r.Context(), s.pool(ep), ep.sp, args)
		if err != nil {
			writeError(w, err.Error())
			return
		}
		writeSuccess(w, rowsets)
	}
}

// --- Auth (custom cookie logic) ---

// handleLogin validates credentials via usp_SM_ValidateLoginAccess and, on
// success, stores the returned Session_ID in the httpOnly cookie. The token is
// NEVER returned to the browser JS.
func (s *Service) handleLogin(w http.ResponseWriter, r *http.Request) {
	body := decodeBody(r)
	// IPAddress MUST be the empty string, matching the legacy .NET
	// HomeController.validateUserLogin (which hardcodes db.AddParameter("IPAddress","")).
	// usp_SM_ValidateLoginAccess stores this verbatim into T_Sessions.IP_Address,
	// and the menu SP (usp_SM_PopulateRootMenuAccessVue) validates the session with
	// `IP_Address=''`. Passing a real client IP here stored a non-empty IP, so the
	// menu SP fell into its "NO VALID SESSION" branch and returned one blank row.
	args := []mssql.NamedArg{
		{Name: "NIK", Value: toStr(body["NIK"])},
		{Name: "Password", Value: toStr(body["Password"])},
		{Name: "IPAddress", Value: ""},
	}
	rowsets, err := mssql.ExecSP(r.Context(), s.db, "usp_SM_ValidateLoginAccess", args)
	if err != nil {
		writeError(w, err.Error())
		return
	}
	session := firstString(rowsets, "Session_ID")
	if session == "" {
		writeError(w, "NIK atau password salah")
		return
	}
	setSession(w, session, s.secure)
	writeSuccess(w, rowsets)
}

// handleCheck resolves the current user's name/NIK from the session cookie.
func (s *Service) handleCheck(w http.ResponseWriter, r *http.Request) {
	session := readSession(r)
	if session == "" {
		writeUnauthorized(w)
		return
	}
	rowsets, err := mssql.ExecSP(r.Context(), s.db, "usp_SECURITY_GetUsername",
		[]mssql.NamedArg{{Name: "Session_ID", Value: session}})
	if err != nil {
		writeError(w, err.Error())
		return
	}
	writeSuccess(w, rowsets)
}

// handleLogout destroys the server session and clears the cookie.
func (s *Service) handleLogout(w http.ResponseWriter, r *http.Request) {
	if session := readSession(r); session != "" {
		// Best-effort: ignore errors so logout always clears the cookie.
		_, _ = mssql.ExecSP(r.Context(), s.db, "usp_T_Sessions_Destroy",
			[]mssql.NamedArg{{Name: "SessionID", Value: session}})
	}
	clearSession(w, s.secure)
	writeSuccess(w, nil)
}

// handleReturn returns one or more asset users (the ManageAsset "Return User"
// action — single row or bulk).
//
// The legacy CSV SP usp_CMS_ManageAsset_User_ReturnMultiple exists ONLY in
// AssetICTDB, which is a different, much smaller dataset (≈2.7k assets) than the
// primary GeneralAffairDB (≈27.8k assets) the app actually reads/writes. Routing
// the return there would UPDATE the wrong rows (0 rows for most assets) while
// still reporting "Success". So instead we replicate its behaviour against the
// real DB by looping the single-asset usp_CMS_ManageAsset_User_Return (which IS
// in GeneralAffairDB) once per selected asset — same net effect: set EndDate to
// today on each asset's open T_AssetUser row.
func (s *Service) handleReturn(w http.ResponseWriter, r *http.Request) {
	session := readSession(r)
	if session == "" {
		writeUnauthorized(w)
		return
	}

	body := decodeBody(r)
	remarks := toStr(body["Remarks"])
	// The client sends IDX_M_Asset as a comma-joined string (bulk) or a single
	// id. Tolerate the legacy "[id],[id]" bracket form too.
	raw := strings.NewReplacer("[", "", "]", "").Replace(toStr(body["IDX_M_Asset"]))
	today := time.Now().Format("2006-01-02")

	ids := make([]string, 0)
	for _, part := range strings.Split(raw, ",") {
		if id := strings.TrimSpace(part); id != "" {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		writeError(w, "Tidak ada aset yang dipilih untuk di-return.")
		return
	}

	var last []mssql.Rowset
	for _, id := range ids {
		rowsets, err := mssql.ExecSP(r.Context(), s.db, "usp_CMS_ManageAsset_User_Return",
			[]mssql.NamedArg{
				{Name: "IDX_M_Asset", Value: id},
				{Name: "Date", Value: today},
				{Name: "Remarks", Value: remarks},
				{Name: "Session_ID", Value: session},
			})
		if err != nil {
			writeError(w, err.Error())
			return
		}
		// The SP signals a business failure via StatusCode='Error' in row 0 (HTTP
		// is still 200). Surface it exactly as the frontend's assertStatus expects
		// — return the SP's own status rowset so its StatusMessage reaches the user.
		if statusIsError(rowsets) {
			writeSuccess(w, rowsets)
			return
		}
		last = rowsets
	}
	// All assets returned — hand back the last Success status rowset.
	writeSuccess(w, last)
}

// statusIsError reports whether the SP's first-row StatusCode is "Error".
func statusIsError(rowsets []mssql.Rowset) bool {
	if len(rowsets) == 0 || len(rowsets[0]) == 0 {
		return false
	}
	if v, ok := rowsets[0][0]["StatusCode"]; ok {
		if s, ok := v.(string); ok {
			return strings.EqualFold(strings.TrimSpace(s), "Error")
		}
	}
	return false
}

// --- helpers ---

func decodeBody(r *http.Request) map[string]any {
	if r.Body == nil {
		return map[string]any{}
	}
	var m map[string]any
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil || m == nil {
		return map[string]any{}
	}
	return m
}

// toStr renders a JSON body value the way the .NET backend passed it to the SP:
// strings as-is, numbers without trailing zeros, bools as "1"/"0", and
// arrays/objects (ItemRequest, UserAccess) as their JSON text.
func toStr(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case bool:
		if x {
			return "1"
		}
		return "0"
	default:
		b, err := json.Marshal(x)
		if err != nil {
			return ""
		}
		return string(b)
	}
}

func firstString(rowsets []mssql.Rowset, col string) string {
	if len(rowsets) == 0 || len(rowsets[0]) == 0 {
		return ""
	}
	if v, ok := rowsets[0][0][col]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}
