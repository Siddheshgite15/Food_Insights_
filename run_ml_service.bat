@echo off
echo ========================================================
echo   Starting Banana Food Insight - FastAPI ML Service
echo   Port: 8000
echo ========================================================
set KMP_DUPLICATE_LIB_OK=TRUE
cd ml-service
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
pause
