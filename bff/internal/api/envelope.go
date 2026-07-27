package api

import (
	"encoding/json"
	"net/http"

	"asrilup-bff/internal/mssql"
)

// Envelope is the single response contract for the new PWA. HTTP status is
// always 200 for business outcomes — errors travel inside `status`.
//
//	{ "status": "success" | "error", "message": "...", "data": [ [rows], [rows] ] }
//
// `data` is the array of SP result sets (Table, Table1, …). The client reads
// them positionally, e.g. data[0] = primary rows, data[1] = pagination/meta.
type Envelope struct {
	Status  string        `json:"status"`
	Message string        `json:"message"`
	Data    []mssql.Rowset `json:"data"`
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(v)
}

func writeSuccess(w http.ResponseWriter, data []mssql.Rowset) {
	if data == nil {
		data = []mssql.Rowset{}
	}
	writeJSON(w, Envelope{Status: "success", Message: "", Data: data})
}

func writeError(w http.ResponseWriter, message string) {
	writeJSON(w, Envelope{Status: "error", Message: message, Data: []mssql.Rowset{}})
}

// writeUnauthorized is the one place we deviate from HTTP-200: a missing session
// returns 401 so the SPA's global interceptor can redirect to /login.
func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(Envelope{Status: "error", Message: "unauthorized", Data: []mssql.Rowset{}})
}
