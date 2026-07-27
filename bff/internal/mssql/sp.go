package mssql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// Rowset is one SQL Server result set (maps to a "Table"/"Table1"/… in the
// legacy ADO.NET DataSet). Row keys are column names.
type Rowset []map[string]any

// NamedArg is one stored-procedure parameter, bound BY NAME so declaration
// order doesn't matter — this mirrors the .NET backend's
// db.AddParameter("Name", value) exactly.
type NamedArg struct {
	Name  string
	Value string
}

// ExecSP runs "EXEC [dbo].[<sp>] @Name1=@p1, @Name2=@p2, …" with bound
// parameters and returns every result set. Every value is passed as a string;
// SQL Server implicitly converts to the declared parameter type (same outcome
// as the .NET backend, without the SQL-injection surface of concatenation).
//
// spName may be given bare ("usp_CMS_Asset_Search") or bracketed
// ("[dbo].[usp_CMS_Asset_Search]").
func ExecSP(ctx context.Context, db *sql.DB, spName string, args []NamedArg) ([]Rowset, error) {
	var sb strings.Builder
	sb.WriteString("EXEC ")
	sb.WriteString(bracket(spName))

	bound := make([]any, 0, len(args))
	for i, a := range args {
		if i > 0 {
			sb.WriteByte(',')
		}
		p := fmt.Sprintf("p%d", i+1)
		fmt.Fprintf(&sb, " @%s=@%s", a.Name, p)
		bound = append(bound, sql.Named(p, a.Value))
	}

	rows, err := db.QueryContext(ctx, sb.String(), bound...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Rowset
	for {
		rs, err := scanRowset(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, rs)
		if !rows.NextResultSet() {
			break
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// bracket ensures the SP name is schema-qualified and bracketed once.
func bracket(sp string) string {
	if strings.Contains(sp, "[") {
		return sp
	}
	if strings.Contains(sp, ".") {
		return sp
	}
	return "[dbo].[" + sp + "]"
}

// scanRowset reads the current result set into a Rowset. []byte columns are
// converted to string; other native types (int64, float64, bool, time.Time)
// are kept so JSON carries proper types for the new frontend.
func scanRowset(rows *sql.Rows) (Rowset, error) {
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	rs := make(Rowset, 0)
	raw := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range raw {
		ptrs[i] = &raw[i]
	}
	for rows.Next() {
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			if b, ok := raw[i].([]byte); ok {
				row[c] = string(b)
			} else {
				row[c] = raw[i]
			}
		}
		rs = append(rs, row)
	}
	return rs, rows.Err()
}
