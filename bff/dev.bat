@echo off
REM Launcher for the ASRILup PWA backend (Go BFF on :8090, connects dev DB).
REM Just run:  dev   (or double-click this file).
set "PATH=C:\Program Files\Go\bin;%PATH%"
cd /d "%~dp0"
echo Starting ASRILup BFF on http://localhost:8090 ...
go run ./cmd/server
