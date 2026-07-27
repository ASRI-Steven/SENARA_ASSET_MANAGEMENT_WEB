// Package mssql wraps the SQL Server connection and stored-procedure calls.
// The BFF NEVER writes ad-hoc SQL — it only EXECs named stored procedures
// (usp_CMS_* / usp_SM_* / usp_SECURITY_*) with bound parameters.
package mssql

import (
	"database/sql"
	"fmt"
	"net/url"
	"strings"
	"time"

	_ "github.com/microsoft/go-mssqldb"
)

// Config identifies one SQL Server database (ASRILup's GeneralAffairDB).
type Config struct {
	Host     string // may be "host\\instance", e.g. 10.10.0.42\SQLDEVOPERATION2
	Port     string
	Database string
	Username string
	Password string

	// Encrypt / TLSMin control the TLS handshake. The legacy SQL Server only
	// offers TLS 1.0, which Go rejects by default (min TLS 1.2) — so the login
	// packet's pre-login TLS must be allowed down to 1.0. Defaults:
	// Encrypt="disable", TLSMin="1.0" (see config.Load). TrustServerCertificate
	// is always on (internal LAN, self-signed cert).
	Encrypt string // "disable" | "false" | "true"
	TLSMin  string // "1.0" | "1.1" | "1.2" | "1.3"
}

// DSN renders the go-mssqldb URL form, escaping credentials.
//
// If Host names an instance ("host\instance"), the instance goes into the URL
// path and the port is IGNORED — go-mssqldb asks the SQL Browser service
// (UDP 1434) for the instance's real (dynamic) port. Without an instance the
// DSN is plain host:port.
func (c Config) DSN() string {
	host, instance, hasInstance := strings.Cut(c.Host, `\`)

	encrypt := c.Encrypt
	if encrypt == "" {
		encrypt = "disable"
	}
	tlsMin := c.TLSMin
	if tlsMin == "" {
		tlsMin = "1.0"
	}

	q := url.Values{
		"database":               {c.Database},
		"encrypt":                {encrypt},
		"tlsmin":                 {tlsMin},
		"TrustServerCertificate": {"true"},
	}
	u := url.URL{
		Scheme:   "sqlserver",
		User:     url.UserPassword(c.Username, c.Password),
		Host:     fmt.Sprintf("%s:%s", host, c.Port),
		RawQuery: q.Encode(),
	}
	if hasInstance {
		u.Host = host // no port: SQL Browser resolves the instance's port
		u.Path = instance
	}
	return u.String()
}

// Open returns a lazy connection pool. sql.Open never dials, so this succeeds
// even when the server is unreachable; the first query surfaces the failure.
func Open(c Config) (*sql.DB, error) {
	db, err := sql.Open("sqlserver", c.DSN())
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)
	return db, nil
}
