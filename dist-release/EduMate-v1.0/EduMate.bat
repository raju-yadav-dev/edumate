@echo off
TITLE EduMate v1.0 — Enterprise University Assistant
COLOR 0B

echo =======================================================
echo   EDUMATE v1.0 — LOCAL-FIRST AI UNIVERSITY ASSISTANT
echo =======================================================
echo.
echo Initializing EduMate Production Ecosystem...
echo.

cd /d "%~dp0"

IF NOT EXIST "node_modules" (
    echo [!] Dependencies not found. Running Installation Wizard...
    call node scripts/installWizard.js
    IF ERRORLEVEL 1 (
        echo [X] Installation failed. Press any key to exit.
        pause
        exit /b 1
    )
)

node scripts/launcher.js

pause
