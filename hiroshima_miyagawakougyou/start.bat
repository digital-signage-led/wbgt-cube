@echo off
cd /d "%~dp0"
title WBGT Signage

set "NODE="

where node >nul 2>&1
if %errorlevel%==0 set "NODE=node"

if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE=%ProgramFiles%\nodejs\node.exe"
)
if not defined NODE if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE=%ProgramFiles(x86)%\nodejs\node.exe"
)
if not defined NODE if exist "%LocalAppData%\Programs\node\node.exe" (
    set "NODE=%LocalAppData%\Programs\node\node.exe"
)

if not defined NODE (
    echo.
    echo  Node.js not found.
    echo  Install from https://nodejs.org/ then restart PC.
    echo.
    pause
    exit /b 1
)

if not exist "serve.js" (
    echo serve.js not found in this folder.
    pause
    exit /b 1
)

echo.
echo  Starting WBGT signage server (HTTP on Wi-Fi/LAN)...
echo  A black window "WBGT Server" will open. Do NOT close it.
echo  Browser will open on this PC in a few seconds.
echo.

start "WBGT Server" cmd /k "%NODE%" serve.js

timeout /t 4 /nobreak >nul

set "OPEN_URL=http://127.0.0.1:8765/index-4face.html?layout512=1&native640=1"
if exist ".wbgt-server-url" (
    set /p OPEN_URL=<.wbgt-server-url
)

echo  Opening on this PC: %OPEN_URL%
start "" "%OPEN_URL%"

echo.
if exist ".wbgt-signage-url" (
    set /p SIGNAGE_URL=<.wbgt-signage-url
    echo  Signage display URL ^(set on LED browser^):
    echo  %SIGNAGE_URL%
    echo.
)

echo  If browser did not open, copy the Local URL above.
echo  If 8765 fails, check the WBGT Server window for port 8766.
echo.
echo  To stop: close the "WBGT Server" window.
echo.
pause
