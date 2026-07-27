package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"asrilup-bff/internal/mssql"
)

// Service holds the dependencies every handler needs.
type Service struct {
	db     *sql.DB
	secure bool // Secure flag for the session cookie
}

func NewService(db *sql.DB, cookieSecure bool) *Service {
	return &Service{db: db, secure: cookieSecure}
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

		rowsets, err := mssql.ExecSP(r.Context(), s.db, ep.sp, args)
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
	args := []mssql.NamedArg{
		{Name: "NIK", Value: toStr(body["NIK"])},
		{Name: "Password", Value: toStr(body["Password"])},
		{Name: "IPAddress", Value: clientIP(r)},
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
