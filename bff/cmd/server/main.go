// ASRILup BFF — sits between the PWA and SQL Server. The browser only ever
// calls /api/*; this process holds the DB connection server-side and executes
// the usp_CMS_* / usp_SM_* / usp_SECURITY_* stored procedures by name.
package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"asrilup-bff/internal/api"
	"asrilup-bff/internal/config"
	"asrilup-bff/internal/mssql"
)

func main() {
	// Load .env from the working directory (if present) before reading config.
	// Real env vars / docker-compose take precedence and still work without it.
	if err := config.LoadDotenv(".env"); err != nil {
		log.Fatalf("startup: .env: %v", err)
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("startup: %v", err)
	}

	db, err := mssql.Open(cfg.DB)
	if err != nil {
		log.Fatalf("startup: open db: %v", err)
	}
	defer db.Close()

	// Secondary pool: AssetICTDB (holds the usp_CMS_AssetGroup* SPs).
	dbGroup, err := mssql.Open(cfg.DBGroup)
	if err != nil {
		log.Fatalf("startup: open group db: %v", err)
	}
	defer dbGroup.Close()

	// Ping is best-effort — the office DB may be unreachable from where the BFF
	// starts. Log a warning but keep serving; the first query surfaces the error.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Printf("warning: cannot reach %s/%s yet: %v", cfg.DB.Host, cfg.DB.Database, err)
	} else {
		log.Printf("connected to %s/%s", cfg.DB.Host, cfg.DB.Database)
	}
	if err := dbGroup.PingContext(ctx); err != nil {
		log.Printf("warning: cannot reach %s/%s (group) yet: %v", cfg.DBGroup.Host, cfg.DBGroup.Database, err)
	} else {
		log.Printf("connected to %s/%s (group)", cfg.DBGroup.Host, cfg.DBGroup.Database)
	}

	svc := api.NewService(db, dbGroup, cfg.SessionCookieSecure)
	handler := api.NewRouter(svc, cfg.SPAOrigin)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("ASRILup BFF listening on :%s (SPA origin %s)", cfg.Port, cfg.SPAOrigin)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
