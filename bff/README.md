# ASRILup BFF (Go)

Backend-for-Frontend antara PWA dan SQL Server. **Browser cuma ngomong ke `/api/*`** —
proses ini yang pegang koneksi DB (server-side) dan mengeksekusi stored procedure
`usp_CMS_*` / `usp_SM_*` / `usp_SECURITY_*` **by name** dengan parameter ter-bind.

## Kenapa BFF (bukan PWA langsung ke DB)

- Browser **tidak bisa & tidak boleh** konek ke SQL Server (kredensial bocor, DB di LAN internal, protokol TDS).
- BFF simpan connection string **di env server**, session di **httpOnly cookie** (JS tak lihat token),
  panggil SP **parameterized** (`sql.Named`) → anti SQL-injection, bungkus DataSet → JSON envelope.

## Stack

Go 1.23 · `go-chi/chi/v5` · `microsoft/go-mssqldb`. Tanpa ORM.

## Struktur

```
bff/
  cmd/server/main.go          # entrypoint: load config → open DB → serve
  internal/
    config/config.go          # env → Config (fail-fast)
    mssql/
      db.go                   # DSN (named-instance + TLS 1.0) + pool
      sp.go                   # ExecSP: EXEC by named params → []Rowset
    api/
      envelope.go             # { status, message, data:[rowsets] }
      cookie.go               # httpOnly session cookie (asrilup_session)
      middleware.go           # CORS (SPA origin + credentials)
      registry.go             # tabel deklaratif endpoint → SP + params  ← inti
      handlers.go             # generic handler + auth (login/logout/check)
      router.go               # wiring chi
  .env.example                # isi DB_PASSWORD lokal (JANGAN commit)
  Dockerfile
```

## Menjalankan

```bash
cp .env.example .env        # isi DB_PASSWORD dengan password asli
go run ./cmd/server         # :8080
# atau
go build -o server.exe ./cmd/server && ./server.exe
```

Cek: `curl localhost:8080/healthz` → `ok`. Endpoint ber-session balas **401** tanpa cookie login.

## Koneksi DB

- Target: **`GeneralAffairDB`** di `10.10.0.42\SQLDEVOPERATION2` (named instance → SQL Browser UDP 1434).
- SQL Server lama cuma TLS 1.0 → driver di-set `encrypt=disable`, `tlsmin=1.0`, `TrustServerCertificate=true`
  (override via `DB_ENCRYPT` / `DB_TLS_MIN`). Sudah diverifikasi: handshake OK, sampai ke SQL auth.

## Kontrak API

Semua response: HTTP 200, body `{ "status":"success"|"error", "message":"", "data":[ [rows], [rows] ] }`.
`data` = array result set SP (Table, Table1, …). Error bisnis → `status:"error"`. Sesi hilang → HTTP 401.

## Endpoint (registry.go)

Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/check`.
Data (semua otomatis inject `@Session_ID` dari cookie): `GET /api/menu`, `POST /api/dashboard`,
`POST /api/assets/search`, `/api/assets/assign-*`, `/api/assets/change-*`, `/api/assets/return`,
`POST /api/requests`, `POST|PATCH /api/asset`, `POST /api/po`,
`/api/master/{brand|color|size|status|management|group|location|type|model|user}` (search/save/update/enable/disable/delete),
`/api/settings/{admin-access|group-access|users}/*`.

**Menambah endpoint** = tambah 1 baris di `endpoints()` (registry.go): `{method, path, SP, params}`.
Nama param = nama parameter SP (sama persis dengan `AddParameter` di backend .NET lama).

## Peta lengkap endpoint → SP

Lihat `../../ASRILUP_ANALYSIS/02-api-stored-procedures.md` §2.7 (123 SP, terverifikasi dari `WebServerApp1`).

## Keamanan

- **Jangan commit `.env`** (password asli). `.env.example` sengaja kosongkan `DB_PASSWORD`.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` (kecuali `SESSION_COOKIE_INSECURE=1` untuk http localhost).
- SP dipanggil parameterized; BFF tak pernah menyusun SQL string.
