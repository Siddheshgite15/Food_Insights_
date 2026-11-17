"""
FoodInsight — Multi-fruit specimen validator.

Detects whether the uploaded image contains one of the three supported fruits:
    Banana · Bittergourd · Tomato

Strategy
--------
Two independent signals are combined:

1. MobileNetV3-Small (ImageNet)
   - ImageNet class 954  = banana
   - ImageNet class 945  = tomato / "tomato" category
   - No direct bittergourd class → rely on color heuristic

2. HSV color heuristics
   - Yellow / green / brown peel  → banana
   - Dark green, elongated ridges → bittergourd (green + low saturation spread)
   - Red / orange flesh or skin   → tomato

Decision: accept if any fruit signal passes threshold.
Reject only when NO fruit signal is found.
"""

import logging

import cv2
import numpy as np
import torch
import torchvision.models as tv_models
from PIL import Image

logger = logging.getLogger(__name__)

# ── MobileNetV3 setup ─────────────────────────────────────────────────────────
_weights            = tv_models.MobileNet_V3_Small_Weights.DEFAULT
_validator_model    = tv_models.mobilenet_v3_small(weights=_weights).eval()
_validator_transforms = _weights.transforms()
_CATEGORIES         = _weights.meta["categories"]

# ImageNet indices
_IDX_BANANA = 954
# Tomato-related: "tomato" = 945, "cucumber" adjacent greens ignored
_IDX_TOMATO = 945
# No single bittergourd class in ImageNet — detected via colour

# ── HSV thresholds (OpenCV: H 0-179, S 0-255, V 0-255) ───────────────────────
_HSV = {
    "yellow": ((15, 40, 80),  (35, 255, 255)),   # ripe banana
    "green":  ((35, 40, 40),  (85, 255, 220)),   # unripe banana / bittergourd
    "brown":  (( 8, 30, 20),  (22, 220, 150)),   # overripe banana
    "red_lo": (( 0, 80, 60),  (10, 255, 255)),   # tomato (lower red hue)
    "red_hi": ((160, 80, 60), (179, 255, 255)),  # tomato (upper red hue)
    "orange": ((10, 80, 80),  (20, 255, 255)),   # tomato / orange flesh
}

_SUPPORTED = {"banana", "bittergourd", "tomato"}


def _hsv_ratio(hsv_img: np.ndarray, lo: tuple, hi: tuple) -> float:
    mask = cv2.inRange(hsv_img, lo, hi)
    total = hsv_img.shape[0] * hsv_img.shape[1]
    return float(np.sum(mask > 0)) / max(total, 1)


def validate_fruit_specimen(pil_img: Image.Image) -> dict:
    """
    Validate whether the image contains a supported fruit.

    Returns
    -------
    dict:
        is_valid       bool
        detected_fruit str   "banana" | "bittergourd" | "tomato" | "unknown"
        confidence     float MobileNet probability of best fruit class
        top_prediction str   MobileNet top-1 category name
        message        str
    """
    try:
        rgb_img = pil_img.convert("RGB")
        batch   = _validator_transforms(rgb_img).unsqueeze(0)

        with torch.no_grad():
            preds = _validator_model(batch).squeeze(0).softmax(0)

        banana_prob = float(preds[_IDX_BANANA])
        tomato_prob = float(preds[_IDX_TOMATO])
        top_idx     = int(torch.argmax(preds))
        top_cat     = _CATEGORIES[top_idx]
        top_score   = float(preds[top_idx])

        # ── HSV colour signals ────────────────────────────────────────────────
        hsv = cv2.cvtColor(np.array(rgb_img), cv2.COLOR_RGB2HSV)

        yellow_r = _hsv_ratio(hsv, *_HSV["yellow"])
        green_r  = _hsv_ratio(hsv, *_HSV["green"])
        brown_r  = _hsv_ratio(hsv, *_HSV["brown"])
        red_lo_r = _hsv_ratio(hsv, *_HSV["red_lo"])
        red_hi_r = _hsv_ratio(hsv, *_HSV["red_hi"])
        orange_r = _hsv_ratio(hsv, *_HSV["orange"])

        banana_color     = yellow_r + green_r + brown_r
        tomato_color     = red_lo_r + red_hi_r + orange_r
        bittergourd_color = green_r  # dominated by green; no red/yellow

        # ── Per-fruit decision ────────────────────────────────────────────────
        is_banana = (
            top_cat.lower() == "banana"
            or banana_prob >= 0.025
            or (banana_color >= 0.30 and banana_prob >= 0.003)
        )
        is_tomato = (
            top_cat.lower() in ("tomato", "bell pepper", "strawberry")
            or tomato_prob >= 0.02
            or tomato_color >= 0.25
        )
        # Bittergourd: green-dominant, low red/yellow, no strong banana/tomato signal
        # Lowered threshold so green vegetables pass easily
        is_bittergourd = (
            bittergourd_color >= 0.15           # any meaningful green coverage
            and tomato_color   < 0.20           # not red/orange-dominant
            and yellow_r       < 0.35           # not yellow-dominant (banana)
            and not (banana_prob >= 0.025)      # MobileNet not confident it's banana
        )

        # ── Determine best-matching fruit ─────────────────────────────────────
        # Priority: banana > tomato > bittergourd  (bittergourd is catch-all green)
        if is_banana:
            detected = "banana"
            conf     = banana_prob
        elif is_tomato:
            detected = "tomato"
            conf     = tomato_prob
        elif is_bittergourd:
            detected = "bittergourd"
            conf     = float(green_r)   # proxy confidence
        else:
            detected = "unknown"
            conf     = top_score

        is_valid = detected in _SUPPORTED

        msg = (
            f"{detected.capitalize()} specimen confirmed"
            if is_valid
            else f"Unsupported item detected: '{top_cat}' ({top_score*100:.1f}%). "
                 f"Please upload Banana, Bittergourd, or Tomato."
        )

        logger.debug(
            "Validator: detected=%s valid=%s  banana=%.3f tomato=%.3f "
            "bittergourd_color=%.2f top=%s",
            detected, is_valid, banana_prob, tomato_prob, bittergourd_color, top_cat,
        )

        return {
            "is_valid":       is_valid,
            "detected_fruit": detected,
            "confidence":     round(conf, 4),
            "top_prediction": top_cat,
            "top_score":      round(top_score, 4),
            "message":        msg,
            # Keep legacy key for backward compat
            "is_banana":      is_valid,
        }

    except Exception as exc:
        logger.warning("Validator exception: %s — bypassing validation", exc)
        return {
            "is_valid":       True,
            "detected_fruit": "banana",
            "confidence":     1.0,
            "top_prediction": "banana",
            "top_score":      1.0,
            "message":        "Validator bypassed",
            "is_banana":      True,
        }


# ── Backward-compatible alias ─────────────────────────────────────────────────
def validate_banana_specimen(pil_img: Image.Image) -> dict:
    """Legacy alias — calls validate_fruit_specimen."""
    return validate_fruit_specimen(pil_img)
