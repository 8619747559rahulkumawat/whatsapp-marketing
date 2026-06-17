@echo off
echo Starting RSendix.pro - SMART BULK MESSAGING PLATFORM...
echo.

echo Starting Backend Server...
pushd "%~dp0backend"
start "WhatsApp Backend" cmd /k "npm run dev"
popd

echo Waiting for backend to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
pushd "%~dp0frontend"
start "WhatsApp Frontend" cmd /k "npm run dev"
popd

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
