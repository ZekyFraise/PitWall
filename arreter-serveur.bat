@echo off
echo Arret du serveur Pit Wall (port 5173)...
set FOUND=0
for /f "tokens=5" %%P in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /F /PID %%P >nul 2>&1
    set FOUND=1
)
if "%FOUND%"=="1" (
    echo Serveur arrete.
) else (
    echo Aucun serveur trouve sur le port 5173.
)
pause
