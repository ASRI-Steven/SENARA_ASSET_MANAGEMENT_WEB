@echo off
REM Launcher ASRILup BFF dengan HOT-RELOAD (air) di :8090.
REM Cukup jalanin: dev  (atau double-click). Tiap file .go disimpan, BFF auto
REM rebuild + restart sendiri — TIDAK perlu restart manual lagi.
REM (Fallback tanpa reload:  go run ./cmd/server )
set "PATH=C:\Program Files\Go\bin;%PATH%"
cd /d "%~dp0"
echo Starting ASRILup BFF (hot-reload) on http://localhost:8090 ...
go run github.com/air-verse/air@v1.61.7 -c .air.toml
