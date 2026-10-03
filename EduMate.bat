@echo off
TITLE EduMate v1.0 — Enterprise University Assistant
COLOR 0B

echo =======================================================
echo   EDUMATE v1.0 — LOCAL-FIRST AI UNIVERSITY ASSISTANT
echo =======================================================
echo.
echo Initializing EduMate Ecosystem...
echo.

cd /d "%~dp0"

:: 1. Auto-check & Auto-install npm workspace dependencies if missing
IF NOT EXIST "node_modules" (
    echo [!] Workspace dependencies not found. Auto-installing npm packages...
    call npm install
)

:: 2. Launch Startup Orchestrator (Auto-boots Docker, Qdrant, Llama, Backend, Frontend)
node scripts/startup.js

pause
