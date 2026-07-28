@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo ============================================
echo Finished. Press any key to close this window.
echo ============================================
pause >nul
