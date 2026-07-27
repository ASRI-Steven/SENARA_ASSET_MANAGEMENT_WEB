@echo off
REM Launcher for the ASRILup PWA frontend (Vite dev server on :5173).
REM Sets Node v24 in PATH internally so it works regardless of the flaky
REM nvm/User-PATH propagation. Just run:  dev   (or double-click this file).
set "PATH=C:\Users\2403077\AppData\Local\nvm\v24.11.0;%PATH%"
cd /d "%~dp0"
echo Node: & node -v
echo Starting Vite dev server on http://localhost:5173 ...
call npm run dev
