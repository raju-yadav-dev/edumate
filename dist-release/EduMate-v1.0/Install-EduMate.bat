@echo off
TITLE EduMate v1.0 — Installation & Setup Wizard
COLOR 0A

echo =======================================================
echo   EDUMATE v1.0 — INSTALLATION & ENVIRONMENT WIZARD
echo =======================================================
echo.

cd /d "%~dp0"
node scripts/installWizard.js

echo.
echo =======================================================
echo Setup complete. Press any key to launch EduMate...
echo =======================================================
pause
node scripts/launcher.js
