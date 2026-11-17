import sys
import os
import time
import re
import json
import threading
import argparse

try:
    import serial
    import serial.tools.list_ports
    HAS_PYSERIAL = True
except ImportError:
    HAS_PYSERIAL = False

# Default configuration (can be overridden by args or environment variables)
DEFAULT_PORT = os.environ.get("ARDUINO_PORT", "COM3")
DEFAULT_BAUD = int(os.environ.get("ARDUINO_BAUD", "9600"))

# Physical validation ranges for DHT22 sensor
MIN_TEMPERATURE = -40.0
MAX_TEMPERATURE = 80.0
MIN_HUMIDITY = 0.0
MAX_HUMIDITY = 100.0


def validate_sensor_reading(temperature: float, humidity: float) -> tuple[bool, str]:
    """
    Validates physical boundaries for DHT22 readings according to Section 9.
    """
    if temperature is None or humidity is None:
        return False, "ERROR: Temperature/Humidity data unavailable."

    if not (MIN_TEMPERATURE <= temperature <= MAX_TEMPERATURE):
        return False, f"ERROR: Invalid temperature reading: {temperature}°C (expected {MIN_TEMPERATURE} to {MAX_TEMPERATURE}°C)"

    if not (MIN_HUMIDITY <= humidity <= MAX_HUMIDITY):
        return False, f"ERROR: Invalid humidity reading: {humidity}% (expected {MIN_HUMIDITY} to {MAX_HUMIDITY}%)"

    return True, "OK"


def parse_serial_line(line: str) -> tuple[float | None, float | None]:
    """
    Parses DHT22 temperature and humidity from various Arduino serial output formats:
      1. 'Temperature: 27.4, Humidity: 61.2' or 'T=27.4, H=61.2'
      2. '31.10,51.90' (comma-separated raw floats from Arduino sketch)
      3. '{"temperature": 27.4, "humidity": 61.2}' (JSON)
    """
    line = line.strip()
    if not line:
        return None, None

    low = line.lower()
    # Skip Arduino boot banner or header lines
    if "food insight" in low or "temperature,humidity" in low:
        return None, None

    # Try JSON format
    if line.startswith("{") and line.endswith("}"):
        try:
            data = json.loads(line)
            t = float(data.get("temperature", data.get("temp", data.get("T"))))
            h = float(data.get("humidity", data.get("humid", data.get("H"))))
            return t, h
        except (ValueError, TypeError, json.JSONDecodeError):
            pass

    # Try labeled regex pattern: 'Temperature: 27.4 ... Humidity: 61.2'
    temp_match = re.search(r'(?:temp(?:erature)?|t)[\s:=]+([+-]?\d+(?:\.\d+)?)', line, re.IGNORECASE)
    hum_match = re.search(r'(?:humid(?:ity)?|rh|h)[\s:=]+([+-]?\d+(?:\.\d+)?)', line, re.IGNORECASE)

    if temp_match and hum_match:
        try:
            return float(temp_match.group(1)), float(hum_match.group(1))
        except ValueError:
            pass

    # Try comma or semicolon-separated numeric values: '31.10, 51.90'
    parts = re.split(r'[,;\t]+', line)
    if len(parts) >= 2:
        try:
            t = float(parts[0].strip())
            h = float(parts[1].strip())
            return t, h
        except ValueError:
            pass

    return None, None


class DHT22SensorReader:
    """
    Thread-safe background reader for Arduino UNO + DHT22 USB serial communication.
    Provides latest temperature and humidity to the real-time ML pipeline.
    """

    def __init__(
        self,
        port: str = DEFAULT_PORT,
        baud_rate: int = DEFAULT_BAUD,
        fallback_temp: float = 25.0,
        fallback_hum: float = 60.0,
        enable_bridge: bool = False
    ):
        self.port = port
        self.baud_rate = baud_rate
        self.fallback_temp = fallback_temp
        self.fallback_hum = fallback_hum
        self.enable_bridge = enable_bridge

        self.serial_conn = None
        self.is_connected = False
        self.last_temperature = None
        self.last_humidity = None
        self.last_error = None
        self.last_timestamp = 0.0

        self._stop_event = threading.Event()
        self._thread = None
        self._lock = threading.Lock()
        self.is_bridge = False

    def _fetch_from_local_bridge(self) -> tuple[float | None, float | None, str]:
        """
        Used ONLY by client CLI scripts (e.g. cnn_inference.py) when enabled,
        to read live sensor data from background service if COM port is locked.
        Never executed by the server itself to prevent deadlocks.
        """
        if not self.enable_bridge:
            return None, None, "Bridge disabled"

        import urllib.request
        for url in ["http://127.0.0.1:8000/sensor/latest", "http://127.0.0.1:5000/api/prediction/sensor/latest"]:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "BananaInsightBridge"})
                with urllib.request.urlopen(req, timeout=0.8) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode('utf-8'))
                        if data.get("is_live"):
                            t = float(data["temperature"])
                            h = float(data["humidity"])
                            valid, msg = validate_sensor_reading(t, h)
                            if valid:
                                return t, h, "OK"
            except Exception:
                pass
        return None, None, "ERROR: Local bridge unavailable"

    def connect(self) -> bool:
        """Attempts connection to the specified Arduino serial port."""
        if not HAS_PYSERIAL:
            self.last_error = "ERROR: pyserial is not installed. Please run: pip install pyserial"
            print(f"[SENSOR] {self.last_error}")
            return False

        try:
            self.serial_conn = serial.Serial(self.port, self.baud_rate, timeout=2)
            time.sleep(1.8)  # Allow Arduino UNO to complete reset sequence
            self.is_connected = True
            self.is_bridge = False
            self.last_error = None
            print(f"[SENSOR] Arduino DHT22 connected successfully on {self.port} ({self.baud_rate} baud)")
            return True
        except serial.SerialException as e:
            # Check if port is locked because local service (app.py) has it open
            t, h, status = self._fetch_from_local_bridge()
            if status == "OK":
                self.is_connected = True
                self.is_bridge = True
                with self._lock:
                    self.last_temperature = t
                    self.last_humidity = h
                    self.last_timestamp = time.time()
                    self.last_error = None
                print(f"[SENSOR] Arduino DHT22 stream active via local service on {self.port}: {t:.1f}°C, {h:.1f}% RH")
                return True

            # Try auto-detecting another port if current port failed
            detected = auto_detect_arduino_port()
            if detected and detected != self.port:
                try:
                    self.serial_conn = serial.Serial(detected, self.baud_rate, timeout=2)
                    time.sleep(1.8)
                    self.port = detected
                    self.is_connected = True
                    self.is_bridge = False
                    self.last_error = None
                    print(f"[SENSOR] Auto-switched to detected Arduino DHT22 on {self.port} ({self.baud_rate} baud)")
                    return True
                except Exception:
                    pass

            self.is_connected = False
            self.last_error = f"ERROR: Could not open serial port '{self.port}': {e}"
            print(f"[SENSOR] {self.last_error}")
            return False
        except Exception as e:
            self.is_connected = False
            self.last_error = f"ERROR: Unexpected connection failure: {e}"
            print(f"[SENSOR] {self.last_error}")
            return False

    def _save_cache(self, t: float, h: float):
        """Saves latest sensor reading to a local JSON cache file for multi-service sync."""
        try:
            from pathlib import Path
            cache_file = Path(__file__).resolve().parent.parent / "latest_sensor.json"
            data = {
                "temperature": t,
                "humidity": h,
                "is_live": True,
                "is_stale": False,
                "error": None,
                "source": f"Live Arduino UNO DHT22 ({self.port})",
                "timestamp": time.time()
            }
            cache_file.write_text(json.dumps(data), encoding="utf-8")
        except Exception:
            pass

    def read_one_sample(self, timeout_sec: float = 3.0) -> tuple[float | None, float | None, str]:
        """Reads a single valid reading from the serial connection or local stream."""
        if getattr(self, "is_bridge", False):
            t, h, status = self._fetch_from_local_bridge()
            if status == "OK":
                with self._lock:
                    self.last_temperature = t
                    self.last_humidity = h
                    self.last_timestamp = time.time()
                    self.last_error = None
                self._save_cache(t, h)
                return t, h, "OK"
            # If bridge disconnected, reset to try direct serial
            self.is_bridge = False
            self.is_connected = False
            return None, None, status

        if not self.serial_conn or not self.serial_conn.is_open:
            return None, None, "ERROR: Serial port is not open."

        start = time.time()
        while time.time() - start < timeout_sec:
            try:
                raw_bytes = self.serial_conn.readline()
                if not raw_bytes:
                    continue
                line = raw_bytes.decode('utf-8', errors='ignore').strip()
                if not line:
                    continue

                t, h = parse_serial_line(line)
                if t is not None and h is not None:
                    valid, msg = validate_sensor_reading(t, h)
                    if valid:
                        with self._lock:
                            self.last_temperature = t
                            self.last_humidity = h
                            self.last_timestamp = time.time()
                            self.last_error = None
                        self._save_cache(t, h)
                        return t, h, "OK"
                    else:
                        return None, None, msg
            except Exception as e:
                return None, None, f"ERROR: Serial read exception: {e}"

        return None, None, "ERROR: Temperature/Humidity data unavailable (timeout reading from Arduino)."

    def start_background_reader(self):
        """Starts asynchronous polling of the DHT22 in a daemon thread."""
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._worker, daemon=True)
        self._thread.start()

    def _worker(self):
        while not self._stop_event.is_set():
            if getattr(self, "is_bridge", False):
                t, h, status = self._fetch_from_local_bridge()
                if status == "OK":
                    with self._lock:
                        self.last_temperature = t
                        self.last_humidity = h
                        self.last_timestamp = time.time()
                        self.last_error = None
                    time.sleep(1.0)
                    continue
                else:
                    self.is_bridge = False
                    self.is_connected = False

            if not self.is_connected:
                # Try reconnecting every 3 seconds
                if self.connect():
                    continue
                else:
                    time.sleep(3.0)
                    continue

            try:
                t, h, status = self.read_one_sample(timeout_sec=3.0)
                if status != "OK":
                    with self._lock:
                        self.last_error = status
            except Exception as e:
                with self._lock:
                    self.is_connected = False
                    self.last_error = f"ERROR: Connection interrupted: {e}"
                try:
                    if self.serial_conn:
                        self.serial_conn.close()
                except Exception:
                    pass
                time.sleep(2.0)

    def get_latest_reading(self) -> dict:
        """
        Returns the latest validated temperature and humidity.
        If live Arduino sensor is not reachable, reports error and provides baseline fallback.
        """
        with self._lock:
            has_reading = (self.last_temperature is not None and self.last_humidity is not None)

        if not has_reading:
            # Synchronous one-shot sample if background thread has not yet populated
            self.read_one_sample(timeout_sec=1.2)

        with self._lock:
            if self.last_temperature is not None and self.last_humidity is not None:
                is_fresh = (time.time() - self.last_timestamp) < 30.0
                src = f"Live Arduino UNO DHT22 ({self.port})"
                return {
                    "temperature": self.last_temperature,
                    "humidity": self.last_humidity,
                    "is_live": True,
                    "is_stale": not is_fresh,
                    "error": None,
                    "source": src
                }
            else:
                return {
                    "temperature": self.fallback_temp,
                    "humidity": self.fallback_hum,
                    "is_live": False,
                    "is_stale": False,
                    "error": self.last_error or "ERROR: Temperature/Humidity data unavailable.",
                    "source": f"Baseline Fallback ({self.fallback_temp}°C, {self.fallback_hum}% RH)"
                }

    def stop(self):
        """Stops background reader and closes COM port."""
        self._stop_event.set()
        if self.serial_conn:
            try:
                self.serial_conn.close()
            except Exception:
                pass
        self.is_connected = False
        self.is_bridge = False


def auto_detect_arduino_port() -> str | None:
    """Finds first serial port matching Arduino UNO hardware identifiers."""
    if not HAS_PYSERIAL:
        return None
    for p in serial.tools.list_ports.comports():
        # Check VID/PID (0x2341 is official Arduino) or description
        if p.vid == 0x2341 or "arduino" in (p.description or "").lower() or "ch340" in (p.description or "").lower():
            return p.device
    return None


def main():
    parser = argparse.ArgumentParser(description="Arduino UNO + DHT22 Serial Reader for Banana Food Insight")
    parser.add_argument("--port", "-p", type=str, default=DEFAULT_PORT, help=f"Serial COM port (default: {DEFAULT_PORT})")
    parser.add_argument("--baud", "-b", type=int, default=DEFAULT_BAUD, help=f"Serial baud rate (default: {DEFAULT_BAUD})")
    parser.add_argument("--auto", action="store_true", help="Auto-detect Arduino port by USB VID/PID")
    parser.add_argument("--json", action="store_true", help="Print single valid reading as JSON and exit")
    args = parser.parse_args()

    port = args.port
    if args.auto or port == DEFAULT_PORT:
        detected = auto_detect_arduino_port()
        if detected:
            port = detected

    if args.json:
        reader = DHT22SensorReader(port=port, baud_rate=args.baud, enable_bridge=True)
        if not reader.connect():
            print(json.dumps({
                "temperature": 25.0,
                "humidity": 60.0,
                "is_live": False,
                "error": reader.last_error or "Could not open port",
                "source": "Baseline Fallback (25.0°C, 60.0% RH)"
            }))
            sys.exit(0)

        t, h, status = reader.read_one_sample(timeout_sec=3.5)
        reader.stop()
        if status == "OK" and t is not None and h is not None:
            print(json.dumps({
                "temperature": t,
                "humidity": h,
                "is_live": True,
                "is_stale": False,
                "error": None,
                "source": f"Live Arduino UNO DHT22 ({port})"
            }))
        else:
            print(json.dumps({
                "temperature": 25.0,
                "humidity": 60.0,
                "is_live": False,
                "error": status,
                "source": "Baseline Fallback (25.0°C, 60.0% RH)"
            }))
        sys.exit(0)

    print("=" * 60)
    print("  Banana Food Insight - Arduino UNO + DHT22 Sensor Reader")
    print("=" * 60)
    print(f"Target Port : {port}")
    print(f"Baud Rate   : {args.baud}")
    print(f"Limits      : {MIN_TEMPERATURE}°C to {MAX_TEMPERATURE}°C | {MIN_HUMIDITY}% to {MAX_HUMIDITY}% RH")
    print("Press Ctrl+C to stop.\n")

    reader = DHT22SensorReader(port=port, baud_rate=args.baud, enable_bridge=True)
    if not reader.connect():
        print(f"\n{reader.last_error}")
        print("Please check:")
        print("  1. Is Arduino plugged in via USB?")
        print("  2. Is Arduino IDE Serial Monitor closed? (Only one app can access a COM port at a time)")
        print(f"  3. Check device manager for the correct port number (current: {port})")
        sys.exit(1)

    try:
        while True:
            temp, hum, status = reader.read_one_sample(timeout_sec=4.0)
            if status == "OK":
                print(f"[SENSOR] Temperature: {temp:5.1f} °C  |  Humidity: {hum:5.1f} % RH  [VALID]")
            else:
                print(f"[SENSOR] {status}")
            time.sleep(1.0)
    except KeyboardInterrupt:
        print("\nStopping sensor reader...")
    finally:
        reader.stop()
        print("Serial port closed cleanly.")


if __name__ == "__main__":
    main()
