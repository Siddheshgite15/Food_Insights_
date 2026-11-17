@echo off
title Quick Fetch Sensor Data - Banana Food Insight
echo Fetching latest Arduino DHT22 sensor reading...
echo ------------------------------------------------------------
set KMP_DUPLICATE_LIB_OK=TRUE
python ml-service\environmental\read_sensor.py --json
echo ------------------------------------------------------------
pause
