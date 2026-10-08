@echo off
cd /d "%~dp0"
taskkill /F /IM electron.exe >nul 2>&1
start "" "node_modules\electron\dist\electron.exe" .
