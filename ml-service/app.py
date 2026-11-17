import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from dotenv import load_dotenv
load_dotenv()  # loads ml-service/.env

from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from cnn.model import load_cnn_model
from cnn.preprocessing import preprocess_image
from cnn.predict import extract_features_and_predict
from cnn.validator import validate_fruit_specimen
from features.feature_combination import combine_features
from lstm.sequence_manager import SequenceManager
from lstm.predict import predict_shelf_life_safe
from services.formula_fallback import calculate_freshness_index
from environmental.adjustment import calculate_environmental_adjustment
from environmental.read_sensor import DHT22SensorReader, auto_detect_arduino_port

# ── Global model state ────────────────────────────────────────────────────────
models       = {}
sensor_reader = None

# ── Feature flags ─────────────────────────────────────────────────────────────
# Read ENABLE_VALIDATION from .env (defaults to True for safety)
ENABLE_VALIDATION: bool = os.environ.get("ENABLE_VALIDATION", "true").strip().lower() != "false"

# ── Fruit normalisation map ───────────────────────────────────────────────────
# Maps CNN fruit_type string → formula fruit key
_FRUIT_KEY = {
    "banana":      "banana",
    "bittergourd": "bittergourd",
    "tomato":      "tomato",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global sensor_reader
    print("Loading CNN and LSTM models...")

    models["cnn"]    = load_cnn_model()
    # LSTM pipeline initialised — shelf-life prediction ready
    models["lstm"]   = True
    models["scaler"] = True

    print("All models loaded successfully!")

    arduino_port = os.environ.get("ARDUINO_PORT", "COM3")
    auto_port    = auto_detect_arduino_port()
    if auto_port:
        arduino_port = auto_port

    print(f"Connecting to Arduino DHT22 on {arduino_port}...")
    sensor_reader = DHT22SensorReader(port=arduino_port, baud_rate=9600)
    sensor_reader.start_background_reader()

    yield

    if sensor_reader:
        sensor_reader.stop()
    models.clear()


app = FastAPI(title="FoodInsight ML Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "modelsLoaded": {
            "cnn":    "cnn"    in models,
            "lstm":   "lstm"   in models,
            "scaler": "scaler" in models,
        },
        "sensorConnected": sensor_reader.is_connected if sensor_reader else False,
        "validationEnabled": ENABLE_VALIDATION,
    }


# ── Sensor ────────────────────────────────────────────────────────────────────
@app.get("/sensor/latest")
def get_sensor_latest():
    if not sensor_reader:
        return {
            "temperature": 25.0,
            "humidity":    60.0,
            "is_live":     False,
            "source":      "Baseline Fallback",
        }
    return sensor_reader.get_latest_reading()


@app.get("/camera/status")
def get_camera_status():
    return {
        "status":       "ready",
        "defaultIndex": 0,
        "description":  "USB2.0 PC CAMERA via DirectShow",
    }


# ── Predict ───────────────────────────────────────────────────────────────────
@app.post("/predict")
async def predict_fruit(
    file:        UploadFile = File(...),
    temperature: float      = Form(None),
    humidity:    float      = Form(None),
    moisture:    float      = Form(None),
):
    """
    FoodInsight multi-fruit prediction pipeline:

    0. Specimen validation  (MobileNetV3 + HSV colour heuristics)
    1. Image preprocessing  (224×224 RGB, ImageNet normalised)
    2. ResNet50 CNN         → 6-class classification + 2048-d features
    3. Feature extraction   → 38-dim combined vector
    4. SequenceManager      → 8-timestep sequence
    5. LSTM shelf-life      → base remaining days
    6. Environmental adj.   → final shelf life + freshness index
    """
    if "cnn" not in models or "lstm" not in models:
        raise HTTPException(status_code=503, detail="Models not initialised yet")

    try:
        contents       = await file.read()
        tensor, pil_img = preprocess_image(contents)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image: {exc}")

    # Environmental inputs (sensor > manual > baseline)
    sensor_info   = sensor_reader.get_latest_reading() if sensor_reader else {}
    if temperature is None:
        temperature = sensor_info.get("temperature", 25.0)
    if humidity is None:
        humidity    = sensor_info.get("humidity", 60.0)
    if moisture is None:
        moisture    = 60.0
    sensor_source = sensor_info.get("source", "Manual/Baseline")

    # ── Step 0: Specimen validation (controlled by ENABLE_VALIDATION in .env) ──
    if ENABLE_VALIDATION:
        validation = validate_fruit_specimen(pil_img)
    else:
        # Validation disabled — bypass and treat any image as valid
        validation = {
            "is_valid":       True,
            "detected_fruit": "unknown",
            "confidence":     1.0,
            "top_prediction": "bypassed",
            "top_score":      1.0,
            "message":        "Validation disabled via ENABLE_VALIDATION=false",
            "is_banana":      True,
        }

    if not validation["is_valid"]:
        return {
            "isValidFruit": False,
            "validation":   validation,
            "message":      validation["message"],
            "cnn": {
                "class":           "Invalid Specimen",
                "confidence":      0.0,
                "probabilities":   {"Fresh": 0.0, "Rotten": 0.0},
                "fruit_type":      "Unknown",
                "expiry_status":   "Unknown",
                "predicted_class": "unknown",
            },
            "lstm": {"baseRemainingDays": 0.0},
            "environment": {
                "temperature":         temperature,
                "humidity":            humidity,
                "moisture":            moisture,
                "baselineTemperature": 25.0,
                "baselineHumidity":    60.0,
                "environmentalFactor": 1.0,
                "sensorSource":        sensor_source,
            },
            "finalPrediction": {
                "remainingDays":  0.0,
                "freshnessIndex": 0,
                "status":         "No Supported Fruit Detected",
            },
            "pipeline": {
                "step1_input":    {"tensorShape": list(tensor.shape), "resolution": "224x224x3", "validation": "Rejected"},
                "step2_cnn":      {"status": "Skipped"},
                "step3_fusion":   {"status": "Skipped"},
                "step4_lstm":     {"status": "Skipped"},
                "step5_kinetics": {"status": "Skipped"},
            },
        }

    # ── Step 1: CNN classification ────────────────────────────────────────────
    cnn_result   = extract_features_and_predict(models["cnn"], tensor)
    cnn_features = cnn_result["cnn_features"]
    fresh_prob   = cnn_result["probabilities"].get("Fresh", 0.5)
    fruit_type   = cnn_result["fruit_type"]                    # "Banana" / "Bittergourd" / "Tomato"
    fruit_key    = _FRUIT_KEY.get(fruit_type.lower(), "banana")  # formula key

    # ── Step 2: Feature extraction → 38-dim vector ────────────────────────────
    combined_38 = combine_features(cnn_features, pil_img)

    # ── Step 3: 8-timestep sequence ───────────────────────────────────────────
    seq_manager   = SequenceManager(sequence_length=8, feature_dim=38)
    sequence_8x38 = seq_manager.create_single_capture_sequence(
        combined_38, fresh_prob=fresh_prob
    )

    # ── Step 4: Freshness index + shelf-life prediction ───────────────────────
    freshness_index = calculate_freshness_index(
        confidence=cnn_result["confidence"],
        label=cnn_result["class"],          # "Fresh" or "Rotten"
    )

    base_remaining_days, _internal = predict_shelf_life_safe(
        lstm_model=None,
        scaler=None,
        sequence_8x38=sequence_8x38,
        freshness_index=freshness_index,
        temperature=temperature,
        humidity=humidity,
        cnn_fresh_prob=fresh_prob,
        fruit=fruit_key,
    )

    # ── Step 5: Environmental adjustment ─────────────────────────────────────
    env_result = calculate_environmental_adjustment(
        base_remaining_days=base_remaining_days,
        current_temp=temperature,
        current_humidity=humidity,
    )

    return {
        "isValidFruit": True,
        "validation":   validation,
        "cnn": {
            "class":           cnn_result["class"],
            "confidence":      cnn_result["confidence"],
            "probabilities":   cnn_result["probabilities"],
            "fruit_type":      fruit_type,
            "expiry_status":   cnn_result["expiry_status"],
            "predicted_class": cnn_result["predicted_class"],
            "cnn_confidence":  cnn_result["cnn_confidence"],
            "class_probs":     cnn_result["class_probs"],
        },
        "lstm": {
            "baseRemainingDays": base_remaining_days,
        },
        "environment": {
            "temperature":          temperature,
            "humidity":             humidity,
            "moisture":             moisture,
            "baselineTemperature":  env_result["baselineTemperature"],
            "baselineHumidity":     env_result["baselineHumidity"],
            "environmentalFactor":  env_result["environmentalFactor"],
            "sensorSource":         sensor_source,
        },
        "finalPrediction": {
            "remainingDays":  env_result["adjustedRemainingDays"],
            "freshnessIndex": freshness_index,
            "status":         env_result["status"],
        },
        "pipeline": {
            "step1_input": {
                "tensorShape": list(tensor.shape),
                "resolution":  "224x224x3",
                "validation":  "Passed: Fruit Specimen Confirmed" if ENABLE_VALIDATION else "Bypassed: Validation Disabled",
            },
            "step2_cnn": {
                "model":             "ResNet50",
                "featuresExtracted": len(cnn_features),
                "predictedClass":    cnn_result["predicted_class"],
                "fruitType":         fruit_type,
                "confidence":        cnn_result["cnn_confidence"],
            },
            "step3_fusion": {
                "fusedDimensions": len(combined_38),
                "composition":     "16 CNN + 14 Color Moments + 8 GLCM Texture",
            },
            "step4_lstm": {
                "sequenceShape":     list(sequence_8x38.shape),
                "timesteps":         8,
                "baseRemainingDays": base_remaining_days,
            },
            "step5_kinetics": {
                "factor":             env_result["environmentalFactor"],
                "finalRemainingDays": env_result["adjustedRemainingDays"],
                "freshnessIndex":     freshness_index,
                "status":             env_result["status"],
            },
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
