import os
import sys
from pathlib import Path
import threading

# Prevent Intel OpenMP duplicate runtime collision on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# Ensure both ml-service and ml-service/cnn are in sys.path for robust imports
current_dir = Path(__file__).resolve().parent
ml_service_dir = current_dir.parent
if str(ml_service_dir) not in sys.path:
    sys.path.insert(0, str(ml_service_dir))
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

import argparse
from datetime import datetime
import time
import cv2
import numpy as np
import torch
from PIL import Image

try:
    from cnn.model import load_cnn_model, CLASS_NAMES, resolve_model_path
    from cnn.preprocessing import transform, preprocess_cv2_frame
    from cnn.predict import extract_features_and_predict
    from cnn.validator import validate_banana_specimen
    from features.feature_combination import combine_features
    from lstm.model import load_lstm_and_scaler
    from lstm.sequence_manager import SequenceManager
    from lstm.predict import predict_shelf_life
    from environmental.adjustment import calculate_environmental_adjustment
    from environmental.read_sensor import DHT22SensorReader, auto_detect_arduino_port
except ImportError:
    from model import load_cnn_model, CLASS_NAMES, resolve_model_path
    from preprocessing import transform, preprocess_cv2_frame
    from predict import extract_features_and_predict
    from validator import validate_banana_specimen
    from features.feature_combination import combine_features
    from lstm.model import load_lstm_and_scaler
    from lstm.sequence_manager import SequenceManager
    from lstm.predict import predict_shelf_life
    from environmental.adjustment import calculate_environmental_adjustment
    from environmental.read_sensor import DHT22SensorReader, auto_detect_arduino_port


def parse_args():
    parser = argparse.ArgumentParser(
        description="External USB Webcam + Arduino UNO DHT22 + Resnet & LSTM ML Pipeline for Banana Freshness"
    )
    parser.add_argument(
        "--camera", "--index", "-c",
        type=int,
        default=0,
        help="USB camera index (default: 0 for USB2.0 PC CAMERA). Try 1 or 2 if multiple cameras are connected."
    )
    parser.add_argument(
        "--port", "-p",
        type=str,
        default=os.environ.get("ARDUINO_PORT", "COM3"),
        help="Serial COM port for Arduino UNO (default: COM3)."
    )
    parser.add_argument(
        "--baud", "-b",
        type=int,
        default=int(os.environ.get("ARDUINO_BAUD", "9600")),
        help="Serial baud rate for Arduino (default: 9600)."
    )
    parser.add_argument(
        "--auto-sensor",
        action="store_true",
        help="Auto-detect Arduino UNO port by USB VID/PID."
    )
    parser.add_argument(
        "--no-sensor",
        action="store_true",
        help="Disable Arduino serial reading and use manual temperature/humidity parameters."
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=None,
        help="Optional path to banana_Resnet2category_complete.pt model file."
    )
    parser.add_argument(
        "--image", "-i",
        type=str,
        default=None,
        help="Optional path to a static image file to test inference without camera."
    )
    parser.add_argument(
        "--temp",
        type=float,
        default=25.0,
        help="Manual fallback ambient temperature in Celsius (default: 25.0)."
    )
    parser.add_argument(
        "--humidity",
        type=float,
        default=60.0,
        help="Manual fallback ambient relative humidity percentage (default: 60.0)."
    )
    return parser.parse_args()


def run_full_pipeline(
    cnn_model: torch.nn.Module,
    lstm_model,
    scaler,
    frame_bgr: np.ndarray,
    temperature: float = 25.0,
    humidity: float = 60.0,
    sensor_source: str = "Baseline"
):
    """
    Executes the complete multi-stage ML pipeline:
    1. Preprocessing: Resize(224, 224) + Normalize ImageNet -> Tensor (1, 3, 224, 224)
    2. Specimen Validation: Verify banana presence via MobileNetV3 + color moments
    3. Resnet121 CNN: Extract 1024-dim features + Classification
    4. Feature Fusion: Combine 1024 CNN features with color & GLCM texture -> 38-D vector
    5. Sequence Manager: Construct 8-timestep progression matrix (1, 8, 38)
    6. Existing Scaler: Scale 38 features with StandardScaler
    7. Existing LSTM: Predict Base Remaining Shelf Life (Days at 25°C)
    8. Kinetic Environmental Adjustment: Respiration Q10 adjustment for temperature & humidity
    """
    tensor, pil_img = preprocess_cv2_frame(frame_bgr)

    # 0. Specimen Validation (Verify banana presence)
    validation = validate_banana_specimen(pil_img)
    if not validation["is_banana"]:
        detected_item = validation.get("top_prediction", "non-banana object")
        print(f"\n[SPECIMEN ALERT] Non-banana image detected: '{detected_item}' ({validation.get('top_confidence', 0)*100:.1f}%)")
        print("                 Banana confidence is near zero. Freshness index and shelf life set to 0.\n")
        return {
            "class": "Invalid Specimen (Not a Banana)",
            "confidence": 0.0,
            "probabilities": {"Fresh": 0.0, "Rotten": 0.0},
            "baseRemainingDays": 0.0,
            "adjustedRemainingDays": 0.0,
            "freshnessIndex": 0.0,
            "status": "No Banana Detected",
            "isBanana": False,
            "detectedObject": detected_item,
            "message": validation.get("message", "No banana detected"),
            "temperature": temperature,
            "humidity": humidity,
            "sensorSource": sensor_source
        }

    # 1. Resnet121 CNN
    cnn_res = extract_features_and_predict(cnn_model, tensor)
    fresh_prob = cnn_res["probabilities"].get("Fresh", 0.5)

    base_days = 0.0
    adjusted_days = 0.0
    freshness_index = 0.0
    status = cnn_res["class"]

    # 2. LSTM & Feature Engineering (if LSTM is available)
    if lstm_model is not None and scaler is not None:
        combined_38 = combine_features(cnn_res["cnn_features"], pil_img)
        seq_manager = SequenceManager(sequence_length=8, feature_dim=38)
        seq_8x38 = seq_manager.create_single_capture_sequence(combined_38, fresh_prob=fresh_prob)
        base_days = predict_shelf_life(lstm_model, scaler, seq_8x38, cnn_fresh_prob=fresh_prob)

        # 3. Environmental Adjustment
        env_res = calculate_environmental_adjustment(
            base_remaining_days=base_days,
            current_temp=temperature,
            current_humidity=humidity
        )
        adjusted_days = env_res["adjustedRemainingDays"]
        freshness_index = env_res["freshnessIndex"]
        status = env_res["status"]

    return {
        "class": cnn_res["class"],
        "confidence": cnn_res["confidence"] * 100.0 if cnn_res["confidence"] <= 1.0 else cnn_res["confidence"],
        "probabilities": {
            k: v * 100.0 if v <= 1.0 else v for k, v in cnn_res["probabilities"].items()
        },
        "baseRemainingDays": base_days,
        "adjustedRemainingDays": adjusted_days,
        "freshnessIndex": freshness_index,
        "status": status,
        "temperature": temperature,
        "humidity": humidity,
        "sensorSource": sensor_source
    }


def sync_to_backend_async(image_path: Path, temperature: float, humidity: float):
    """
    Sends captured image to the Express backend (/api/prediction) in background
    so http://localhost:3000 automatically visualizes it immediately.
    """
    def _worker():
        try:
            import urllib.request
            url = "http://127.0.0.1:5000/api/prediction"
            boundary = "----WebKitFormBoundaryBananaInsight7MA4YWxkTrZu0gW"

            with open(image_path, "rb") as f:
                img_data = f.read()

            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="temperature"\r\n\r\n'
                f"{temperature}\r\n"
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="humidity"\r\n\r\n'
                f"{humidity}\r\n"
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="image"; filename="{image_path.name}"\r\n'
                f"Content-Type: image/jpeg\r\n\r\n"
            ).encode("utf-8") + img_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=4) as response:
                if response.status == 200 or response.status == 201:
                    print(f"[Backend Sync] Automatically recorded {image_path.name} to Web App Dashboard (Port 5000)!")
        except Exception:
            pass

    t = threading.Thread(target=_worker, daemon=True)
    t.start()


def draw_capture_toast(frame: np.ndarray, status_msg: str = ""):
    """
    Shows only a clean, minimal status notification on the photo without
    any prediction scores, confidence percentages, or freshness status cards.
    """
    if not status_msg:
        return
    h, w = frame.shape[:2]
    text = status_msg
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.55
    thickness = 2
    (t_w, t_h), _ = cv2.getTextSize(text, font, scale, thickness)
    p_x1 = max(10, (w - t_w) // 2 - 16)
    p_y1 = h - 50
    p_x2 = min(w - 10, p_x1 + t_w + 32)
    p_y2 = h - 15

    overlay = frame.copy()
    cv2.rectangle(overlay, (p_x1, p_y1), (p_x2, p_y2), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    cv2.putText(frame, text, (p_x1 + 16, p_y2 - 11), font, scale, (0, 240, 255), thickness, cv2.LINE_AA)


def open_best_camera(preferred_index=None):
    """
    Opens the USB camera using DirectShow on Windows with sensor warm-up.
    Default camera index is 0.
    """
    camera_index = preferred_index if preferred_index is not None else 0
    print(f"Connecting to USB camera (index={camera_index})...")

    if sys.platform.startswith("win"):
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap.release()
            cap = cv2.VideoCapture(camera_index)
    else:
        cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        return cap, camera_index

    # Sensor warm-up
    print("Warming up camera sensor and auto-exposure (12 frames)...")
    for _ in range(12):
        cap.read()
        time.sleep(0.04)

    return cap, camera_index


def print_food_insight_result(result: dict):
    """Prints the exact clean Food Insight summary specified in Section 17."""
    print("\n--------------------------------")
    print("Food Insight")
    print("--------------------------------")
    print("Food: Banana\n")
    print(f"CNN Prediction: {result['class']}")
    print(f"CNN Confidence: {result['confidence']:.2f}%\n")
    print(f"Temperature: {result['temperature']:.1f} °C ({result.get('sensorSource', 'Ambient')})")
    print(f"Humidity: {result['humidity']:.1f} % RH ({result.get('sensorSource', 'Ambient')})\n")
    print("Remaining Shelf Life:")
    print(f"{result['adjustedRemainingDays']:.1f} days\n")
    print("Status:")
    print(f"{result['status']}")
    print("--------------------------------\n")


def main():
    args = parse_args()

    print("\n" + "=" * 60)
    print("  Banana Food Insight - Real-Time Webcam + Arduino Pipeline")
    print("=" * 60)

    # 1. Load trained CNN model
    try:
        resolved_path = resolve_model_path(args.model)
        print(f"Loading trained CNN model from:\n  {resolved_path}")
        cnn_model = load_cnn_model(args.model)
        print("Resnet121 model loaded successfully and set to eval() mode.")
    except Exception as e:
        print(f"ERROR: Could not load CNN model: {e}")
        sys.exit(1)

    # 2. Load trained LSTM model & StandardScaler
    lstm_model = None
    scaler = None
    try:
        lstm_model, scaler = load_lstm_and_scaler()
        print("LSTM shelf life model and feature scaler loaded successfully!")
    except Exception as e:
        print(f"WARNING: LSTM model could not be loaded: {e}")

    # 3. Initialize Arduino UNO DHT22 Sensor Reader
    sensor_reader = None
    arduino_port = args.port
    if not args.no_sensor:
        if args.auto_sensor:
            detected = auto_detect_arduino_port()
            if detected:
                arduino_port = detected
                print(f"[SENSOR] Auto-detected Arduino port: {arduino_port}")
        sensor_reader = DHT22SensorReader(
            port=arduino_port,
            baud_rate=args.baud,
            fallback_temp=args.temp,
            fallback_hum=args.humidity,
            enable_bridge=True
        )
        sensor_reader.connect()
        # Start non-blocking background sensor thread
        sensor_reader.start_background_reader()
    else:
        print(f"[SENSOR] Manual mode: Using fixed {args.temp}°C, {args.humidity}% RH.")

    # 4. Handle static image test if provided
    if args.image:
        image_path = Path(args.image)
        if not image_path.exists():
            print(f"ERROR: Image file not found: {image_path}")
            sys.exit(1)
        frame = cv2.imread(str(image_path))
        if frame is None:
            print(f"ERROR: Could not read image: {image_path}")
            sys.exit(1)

        temp = args.temp
        hum = args.humidity
        source = "Manual"
        if sensor_reader:
            s = sensor_reader.get_latest_reading()
            temp, hum = s["temperature"], s["humidity"]
            source = s["source"]

        result = run_full_pipeline(cnn_model, lstm_model, scaler, frame, temp, hum, source)
        print_food_insight_result(result)
        if sensor_reader:
            sensor_reader.stop()
        return

    # 5. Setup captured images output directory
    captured_dir = current_dir / "captured_images"
    captured_dir.mkdir(parents=True, exist_ok=True)

    # 6. Open USB camera
    cap, camera_index = open_best_camera(args.camera)

    if not cap.isOpened():
        print("ERROR: USB camera could not be opened.")
        print(f"Please check the USB connection or change CAMERA_INDEX (current: {camera_index}).")
        if sensor_reader:
            sensor_reader.stop()
        sys.exit(1)

    print("Camera stream ready.")
    print("Press 'C' to capture image and run complete ML pipeline.")
    print("Press 'Q' to quit.\n")

    window_name = f"Banana Food Insight - Camera {camera_index}"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 960, 640)

    status_message = ""
    status_timer = 0.0
    last_title_update = 0.0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None or frame.mean() < 3.0:
                time.sleep(0.02)
                continue

            now = time.time()
            if sensor_reader and (now - last_title_update >= 1.0):
                last_title_update = now
                s_preview = sensor_reader.get_latest_reading()
                if s_preview.get("is_live"):
                    t_val = s_preview['temperature']
                    h_val = s_preview['humidity']
                    time_str = datetime.now().strftime("%H:%M:%S")
                    cv2.setWindowTitle(
                        window_name,
                        f"Banana Food Insight - Camera {camera_index} | Live DHT22: {t_val:.1f}°C, {h_val:.1f}% RH [1s Live]"
                    )
                    sys.stdout.write(f"\r[LIVE SENSOR {time_str}] Temperature: {t_val:.1f} °C  |  Humidity: {h_val:.1f} % RH  (COM3)  ")
                    sys.stdout.flush()

            if status_message and (now - status_timer > 1.8):
                status_message = ""

            display_frame = frame.copy()
            if status_message:
                draw_capture_toast(display_frame, status_message)
            cv2.imshow(window_name, display_frame)

            key = cv2.waitKey(1) & 0xFF

            # Key 'Q' to exit
            if key in [ord('q'), ord('Q'), 27]:
                sys.stdout.write("\n")
                sys.stdout.flush()
                print("Quit signal received. Exiting...")
                break

            # Key 'C' to capture and run the full ML pipeline
            if key in [ord('c'), ord('C')]:
                sys.stdout.write("\n")
                sys.stdout.flush()
                timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"banana_{timestamp_str}.jpg"
                save_path = captured_dir / filename

                cv2.imwrite(str(save_path), frame)
                print("=" * 60)
                print("Image captured successfully!")
                print(f"File: {filename}")
                print(f"Saved to: {save_path}")

                # Read current Arduino DHT22 sensor readings
                curr_temp = args.temp
                curr_hum = args.humidity
                sensor_source = "Manual"
                if sensor_reader:
                    s_data = sensor_reader.get_latest_reading()
                    curr_temp = s_data["temperature"]
                    curr_hum = s_data["humidity"]
                    sensor_source = s_data["source"]
                    if s_data["is_live"]:
                        print(f"[SENSOR] Temperature: {curr_temp:.1f} °C  |  Humidity: {curr_hum:.1f} % RH  (Live: {sensor_source})")
                    else:
                        print(f"[SENSOR] {s_data['error']} (Using {curr_temp:.1f} °C, {curr_hum:.1f} % RH)")

                print("\nExecuting Complete ML Pipeline:")
                print("  1. Resnet121 Preprocessing & 1024-dim Spatial Embeddings")
                print("  2. Color Moments & Texture GLCM Extraction (38 Features)")
                print("  3. SequenceManager: 8-Timestep Temporal Progression")
                print("  4. LSTM Shelf Life Prediction")
                print("  5. Kinetic Environmental Temperature & Humidity Adjustment...")

                try:
                    full_result = run_full_pipeline(
                        cnn_model=cnn_model,
                        lstm_model=lstm_model,
                        scaler=scaler,
                        frame_bgr=frame,
                        temperature=curr_temp,
                        humidity=curr_hum,
                        sensor_source=sensor_source
                    )

                    print_food_insight_result(full_result)

                    # Optional async sync to Web backend
                    sync_to_backend_async(save_path, curr_temp, curr_hum)

                    status_message = f"[ Photo Captured: {filename} ]"
                    status_timer = time.time()

                except Exception as e:
                    print(f"ERROR during ML pipeline: {e}")
                    status_message = "[ Error during ML inference ]"
                    status_timer = time.time()

    except KeyboardInterrupt:
        print("\nInterrupted by user.")
    finally:
        if sensor_reader:
            sensor_reader.stop()
        cap.release()
        cv2.destroyAllWindows()
        print("Camera released. Sensor reader stopped. Clean exit completed.")


if __name__ == "__main__":
    main()
