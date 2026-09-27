@echo off
TITLE EduMate v1.0 — Production Control Center
COLOR 0B

:MENU
cls
echo =======================================================
echo     EDUMATE v1.0 — WINDOWS PRODUCTION CONTROL
echo =======================================================
echo.
echo   [1] Start EduMate Ecosystem (One-Click)
echo   [2] Run Installation Wizard
echo   [3] Run Automated QA & Test Suite (npm run qa)
echo   [4] Run Security Audit Suite (npm run test:security)
echo   [5] Multi-Model Benchmark Tool
echo   [6] Universal Backup System
echo   [7] Restore System Backup
echo   [8] View Server & Runtime Logs
echo   [9] Package Production Release (EduMate-v1.0)
echo   [0] Exit
echo.
echo =======================================================
set /p choice="Select an option (0-9): "

if "%choice%"=="1" (
    cls
    node scripts/launcher.js
    pause
    goto MENU
)
if "%choice%"=="2" (
    cls
    node scripts/installWizard.js
    pause
    goto MENU
)
if "%choice%"=="3" (
    cls
    node tests/runner.js
    pause
    goto MENU
)
if "%choice%"=="4" (
    cls
    node server/scripts/testMission19SecuritySuite.js
    pause
    goto MENU
)
if "%choice%"=="5" (
    cls
    node scripts/benchmarkModels.js
    pause
    goto MENU
)
if "%choice%"=="6" (
    cls
    node scripts/backupRestoreCenter.js --backup
    pause
    goto MENU
)
if "%choice%"=="7" (
    cls
    node scripts/backupRestoreCenter.js --restore
    pause
    goto MENU
)
if "%choice%"=="8" (
    cls
    if exist "logs" (
        explorer logs
    ) else (
        echo No logs directory found.
    )
    goto MENU
)
if "%choice%"=="9" (
    cls
    node scripts/packageRelease.js
    pause
    goto MENU
)
if "%choice%"=="0" (
    exit /b 0
)

echo Invalid selection.
pause
goto MENU
