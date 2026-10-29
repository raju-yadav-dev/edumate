@echo off
TITLE EduMate — Installation & Setup Wizard
COLOR 0A
SETLOCAL EnableDelayedExpansion

echo =======================================================
echo   EDUMATE — SYSTEM SETUP & PROVISIONING WIZARD
echo =======================================================
echo.

cd /d "%~dp0"

:: 1. Verify Node.js
where node >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH!
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Install workspace dependencies
echo [*] Installing workspace dependencies...
call npm install

:: 3. Run Setup & Provisioning Wizard
echo.
node scripts/installWizard.js

echo.
echo =======================================================
echo [✓] Setup completed successfully!
echo.
set /p launch="Would you like to start EduMate now? (Y/N): "
IF /I "%launch%"=="Y" (
    cls
    call EduMate.bat
) ELSE (
    echo.
    echo To start EduMate anytime, double-click EduMate.bat
    pause
)
