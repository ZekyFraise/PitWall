@echo off
cd /d "%~dp0"
echo Demarrage du serveur Pit Wall (http://localhost:5173)...
start "Pit Wall - Serveur" cmd /k "npm run dev"
