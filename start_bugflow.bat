@echo off
echo ========================================================
echo       Starting BugFlow Defect Tracking System
echo ========================================================
echo.

set ROOT=%~dp0

echo [1/2] Starting Flask Backend Server (Port 5000)...
start "BugFlow Backend (Flask)" cmd /k "cd /d "%ROOT%backend" && python run.py"

timeout /t 2 >nul

echo [2/2] Starting React Vite Frontend (Port 5173)...
start "BugFlow Frontend (Vite)" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo ========================================================
echo   BugFlow is starting!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:5000/api/health
echo ========================================================
echo.
pause
