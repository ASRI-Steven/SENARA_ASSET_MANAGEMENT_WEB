// Package config loads BFF settings from the environment. No secret is ever
// hardcoded — DB credentials and the SPA origin come from env at startup.
package config

import (
	"fmt"
	"os"
	"strings"

	"asrilup-bff/internal/mssql"
)

type Config struct {
	DB   mssql.Config // GeneralAffairDB (all usp_CMS_* + auth SPs)
	Port string       // BFF listen port

	// SPAOrigin is the single browser origin allowed by CORS (with credentials).
	SPAOrigin string

	// SessionCookieSecure sets the Secure flag on the session cookie. Default
	// true (prod HTTPS). Set SESSION_COOKIE_INSECURE=1 for local http dev.
	SessionCookieSecure bool
}

const (
	EnvDBHost    = "DB_HOST"
	EnvDBPort    = "DB_PORT"
	EnvDBName    = "DB_NAME"
	EnvDBUser    = "DB_USER"
	EnvDBPass    = "DB_PASSWORD"
	EnvDBEncrypt = "DB_ENCRYPT"
	EnvDBTLSMin  = "DB_TLS_MIN"
	EnvPort      = "PORT"
	EnvSPAOrig   = "SPA_ORIGIN"
	EnvInsecure  = "SESSION_COOKIE_INSECURE"
)

const (
	defaultDBPort    = "1433"
	defaultPort      = "8080"
	defaultSPAOrigin = "http://localhost:5173"
)

// Load reads and validates configuration, failing fast on missing required keys.
func Load() (Config, error) {
	env := func(k string) string { return strings.TrimSpace(os.Getenv(k)) }
	def := func(k, d string) string {
		if v := env(k); v != "" {
			return v
		}
		return d
	}

	cfg := Config{
		DB: mssql.Config{
			Host:     env(EnvDBHost),
			Port:     def(EnvDBPort, defaultDBPort),
			Database: env(EnvDBName),
			Username: env(EnvDBUser),
			Password: os.Getenv(EnvDBPass),
			Encrypt:  def(EnvDBEncrypt, "disable"),
			TLSMin:   def(EnvDBTLSMin, "1.0"),
		},
		Port:                def(EnvPort, defaultPort),
		SPAOrigin:           def(EnvSPAOrig, defaultSPAOrigin),
		SessionCookieSecure: env(EnvInsecure) != "1",
	}

	var missing []string
	for _, r := range []struct{ key, val string }{
		{EnvDBHost, cfg.DB.Host},
		{EnvDBName, cfg.DB.Database},
		{EnvDBUser, cfg.DB.Username},
	} {
		if r.val == "" {
			missing = append(missing, r.key)
		}
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("config: missing required env vars: %s", strings.Join(missing, ", "))
	}
	return cfg, nil
}
