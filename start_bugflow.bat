@echo off
echo ========================================================
echo       Starting BugFlow Defect Tracking System
echo ========================================================
echo.

echo [1/2] Starting Flask Backend Server (Port 5000)...
start "BugFlow Backend (Flask)" cmd /k "cd /d D:\BugFlow\backend && venv\Scripts\python.exe run.py"

timeout /t 2 >nul

echo [2/2] Starting React Vite Frontend (Port 5173)...
start "BugFlow Frontend (Vite)" cmd /k "cd /d D:\BugFlow\frontend && npm run dev"

echo.
echo ========================================================
echo   BugFlow is starting!
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:5000/api/health
echo ========================================================
echo Opening Google Chrome...
start http://localhost:5173
pause
