@echo off
echo Stopping BugFlow servers...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq BugFlow*" 2>nul
taskkill /F /IM python.exe /FI "WINDOWTITLE eq BugFlow*" 2>nul
echo BugFlow stopped.
pause
