@echo off
TITLE EduMate — Offline AI University Assistant
COLOR 0B
SETLOCAL EnableDelayedExpansion

echo =======================================================
echo   EDUMATE — OFFLINE-FIRST AI UNIVERSITY ASSISTANT
echo =======================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js is installed
where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Auto-create .env from .env.example if missing
IF NOT EXIST ".env" (
    IF EXIST ".env.example" (
        echo [*] Initializing .env configuration from template...
        copy .env.example .env >nul
    )
)

:: 3. Auto-install npm dependencies if missing
IF NOT EXIST "node_modules" (
    echo [*] Workspace dependencies missing. Installing npm packages...
    call npm install
)

:: 4. Launch EduMate Platform Orchestrator
echo [*] Starting EduMate Platform...
node scripts/startup.js

pause
