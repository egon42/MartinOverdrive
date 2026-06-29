@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js and npm were not found on this computer.
  echo Install Node.js, then double-click this launcher again.
  pause
  exit /b 1
)

set "APP_URL=http://127.0.0.1:43117/"
start "Martin Overdrive Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 0.0.0.0 --port 43117 --strictPort"

powershell -NoProfile -Command "$u='%APP_URL%'; for($i=0; $i -lt 30; $i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 1; if($r.StatusCode -eq 200){ exit 0 } } catch {}; Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo Martin Overdrive did not start. Check the server window for details.
  pause
  exit /b 1
)

start "" "%APP_URL%"
endlocal
