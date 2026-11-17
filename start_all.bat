@echo off
echo ========================================================
echo   Launching Complete Banana Food Insight System
echo   1. Python FastAPI ML Service (Port 8000)
echo   2. Express Backend (Port 5000)
echo   3. React Frontend (Port 3000)
echo ========================================================
start "Banana ML Service (8000)" cmd /k "set KMP_DUPLICATE_LIB_OK=TRUE && cd /d %~dp0ml-service && python -m uvicorn app:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul
start "Banana Express Backend (5000)" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 2 /nobreak >nul
start "Banana React Frontend (3000)" cmd /k "cd /d %~dp0frontend && npm run dev -- --port 3000 --host"
echo All services launched!
echo Open http://localhost:3000 in your browser.
pause
