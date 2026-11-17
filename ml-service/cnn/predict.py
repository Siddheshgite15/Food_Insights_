"""
FoodInsight — ResNet50 inference.

Parses 6-class output into:
    fruit_type    : "Banana" | "Bittergourd" | "Tomato"
    expiry_status : "Fresh"  | "Rotten"
    cnn_confidence: float 0-100
"""

import logging

import numpy as np
import torch
import torch.nn as nn

from .model import CLASS_NAMES

logger = logging.getLogger(__name__)

# Map class name → (fruit_type, expiry_status)
_CLASS_MAP = {
    "fresh_banana":      ("Banana",      "Fresh"),
    "fresh_bittergourd": ("Bittergourd", "Fresh"),
    "fresh_tomato":      ("Tomato",      "Fresh"),
    "rotten_banana":     ("Banana",      "Rotten"),
    "rotten_bittergourd":("Bittergourd", "Rotten"),
    "rotten_tomato":     ("Tomato",      "Rotten"),
}


def extract_features_and_predict(model: nn.Module, tensor: torch.Tensor) -> dict:
    """
    Run ResNet50 inference.

    Parameters
    ----------
    model  : loaded ResNet50 (eval mode)
    tensor : (1, 3, 224, 224) pre-processed image tensor

    Returns
    -------
    dict with keys:
        class            str   e.g. "Fresh"
        confidence       float 0-1
        probabilities    dict  {"Fresh": p, "Rotten": 1-p}
        fruit_type       str   "Banana" | "Bittergourd" | "Tomato"
        expiry_status    str   "Fresh" | "Rotten"
        predicted_class  str   raw class name e.g. "fresh_banana"
        class_probs      dict  {class_name: probability}
        cnn_features     np.ndarray  2048-d feature vector
    """
    with torch.no_grad():
        # ── 2048-d feature vector from the backbone ───────────────────────────
        # Strip the FC head to get pooled features
        backbone = nn.Sequential(*list(model.children())[:-1])
        feat_map = backbone(tensor)                         # (1, 2048, 1, 1)
        cnn_features = feat_map.view(feat_map.size(0), -1) # (1, 2048)

        # ── Full forward pass for classification ──────────────────────────────
        logits = model(tensor)                              # (1, 6)
        probs  = torch.softmax(logits, dim=1)[0]           # (6,)

    probs_np  = probs.cpu().numpy()
    class_idx = int(np.argmax(probs_np))
    pred_name = CLASS_NAMES[class_idx]
    confidence = float(probs_np[class_idx])

    fruit_type, expiry_status = _CLASS_MAP.get(pred_name, ("Unknown", "Unknown"))

    # Aggregate per-status probabilities
    fresh_prob  = sum(
        float(probs_np[i])
        for i, n in enumerate(CLASS_NAMES)
        if n.startswith("fresh_")
    )
    rotten_prob = 1.0 - fresh_prob

    class_probs = {
        name: round(float(p), 4)
        for name, p in zip(CLASS_NAMES, probs_np)
    }

    logger.debug(
        "CNN: %s (%.1f%%)  fruit=%s  status=%s",
        pred_name, confidence * 100, fruit_type, expiry_status,
    )

    return {
        # Legacy fields kept for backward compatibility
        "class":           expiry_status,          # "Fresh" or "Rotten"
        "confidence":      round(confidence, 4),   # 0-1
        "probabilities":   {
            "Fresh":  round(fresh_prob, 4),
            "Rotten": round(rotten_prob, 4),
        },
        # New fields
        "fruit_type":      fruit_type,
        "expiry_status":   expiry_status,
        "predicted_class": pred_name,
        "cnn_confidence":  round(confidence * 100, 2),
        "class_probs":     class_probs,
        "cnn_features":    cnn_features.cpu().numpy()[0],  # (2048,)
    }
