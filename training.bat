@echo off
setlocal

cd /d "%~dp0"

set "NODE_BIN=C:/Users/SignalB/.workbuddy/binaries/node/versions/22.22.2-3"
if not exist "%NODE_BIN%\npm.cmd" set "NODE_BIN=D:/nodejs"
if exist "%NODE_BIN%\npm.cmd" (
  set "PATH=%NODE_BIN%;%PATH%"
) else (
  echo Node.js not found. Please install Node.js first.
  pause
  exit /b 1
)

echo ============================================
echo   Local Game Hub - Starting...
echo   Dir: %CD%
echo ============================================

if not exist "%~dp0node_modules\.bin\vite" (
  echo Dependencies missing, running npm install ...
  call npm install
  if errorlevel 1 (
    echo npm install failed. Check network or run npm install manually.
    pause
    exit /b 1
  )
)

start "GameHub-Server" cmd /k "npm run dev"

set PORT=5173
echo Waiting for server on port %PORT% ...
ping -n 4 127.0.0.1 >nul
start "" "http://localhost:%PORT%/"
echo Browser opened. Keep the server window open; press Ctrl+C to stop.
endlocal
