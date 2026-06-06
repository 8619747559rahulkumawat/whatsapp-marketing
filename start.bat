@echo off
echo Starting RSendix.pro - SMART BULK MESSAGING PLATFORM...
echo.

echo Starting Backend Server...
start "WhatsApp Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "WhatsApp Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ========================================
echo  RSendix.pro Started!
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:3000
echo.
echo  Super Admin: use ADMIN_EMAIL and ADMIN_PASSWORD from backend\.env
echo ========================================
echo.
pause
