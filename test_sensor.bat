@echo off
title Arduino UNO DHT22 Sensor Test - Banana Food Insight
echo ============================================================
echo   Arduino UNO + DHT22 Real-Time Temperature ^& Humidity Test
echo ============================================================
echo.
echo NOTE:
echo 1. You do NOT need to re-upload code to Arduino every time.
echo    The code is permanently saved in Arduino's Flash memory!
echo 2. Keep Arduino IDE Serial Monitor CLOSED so it does not block the port.
echo.
set KMP_DUPLICATE_LIB_OK=TRUE
python ml-service\environmental\read_sensor.py --auto --baud 9600
echo.
pause
