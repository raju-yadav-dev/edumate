@echo off
TITLE EduMate — Windows Production Control Center
COLOR 0B
SETLOCAL EnableDelayedExpansion

:MENU
cls
echo =======================================================
echo     🎓 EDUMATE — WINDOWS PRODUCTION CONTROL
echo =======================================================
echo.
echo   [1] Start EduMate Platform (Web & API)
echo   [2] Start Local llama.cpp LLM Server
echo   [3] Run System Health Check (Doctor)
echo   [4] Run Verification Test Suite
echo   [5] Ingest Knowledge Documents (storage/)
echo   [6] Synchronize Storage with Database
echo   [7] Rebuild Vector Index (Reindex)
echo   [8] Backup System & Knowledge Data
echo   [9] Restore from Backup
echo   [0] Exit
echo.
echo =======================================================
set /p choice="Select an option (0-9): "

if "%choice%"=="1" (
    cls
    call EduMate.bat
    goto MENU
)
if "%choice%"=="2" (
    cls
    node scripts/startLlamaServer.js
    pause
    goto MENU
)
if "%choice%"=="3" (
    cls
    node scripts/doctor.js
    pause
    goto MENU
)
if "%choice%"=="4" (
    cls
    node server/tests/verify_optimization.js
    pause
    goto MENU
)
if "%choice%"=="5" (
    cls
    node server/scripts/runChunkingWorker.js
    pause
    goto MENU
)
if "%choice%"=="6" (
    cls
    node server/scripts/syncStorage.js
    pause
    goto MENU
)
if "%choice%"=="7" (
    cls
    node scripts/migrateToJina.js
    pause
    goto MENU
)
if "%choice%"=="8" (
    cls
    node scripts/backupRestoreCenter.js --backup
    pause
    goto MENU
)
if "%choice%"=="9" (
    cls
    node scripts/backupRestoreCenter.js --restore
    pause
    goto MENU
)
if "%choice%"=="0" (
    exit /b 0
)

echo.
echo Invalid option. Please select 0-9.
timeout /t 2 >nul
goto MENU
