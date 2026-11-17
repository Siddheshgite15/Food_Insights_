@echo off
echo ========================================================
echo   Starting Banana Food Insight - USB Webcam CNN Pipeline
echo ========================================================
set KMP_DUPLICATE_LIB_OK=TRUE
python ml-service/cnn/cnn_inference.py %*
pause
