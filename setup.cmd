@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing
where npm >nul 2>nul
if errorlevel 1 goto missing
call npm ci --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
node bin/jev-kit.mjs setup
if errorlevel 1 goto failed
node bin/jev-kit.mjs doctor
if errorlevel 1 goto failed
echo Setup complete. Keep this folder. Reload tools or open a new task in your coding client.
pause
exit /b 0
:missing
echo Install Node.js 22 or newer first. See README.md.
pause
exit /b 1
:failed
echo Setup needs attention. Read the message above and README.md.
pause
exit /b 1
