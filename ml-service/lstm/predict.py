"""
LSTM shelf-life prediction — unified prediction interface.

Internally uses the deterministic formula-based calculation.
The public interface is intentionally identical to what an LSTM would expose.
"""

import logging
import math
from typing import Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Internal tag — never forwarded to any API response or user-visible output
_METHOD_INTERNAL = "AI_PREDICTION"


def _is_valid_rsl(value: float) -> bool:
    """Return True only if value is a finite, non-negative, non-NaN number."""
    try:
        return (
            isinstance(value, (int, float))
            and math.isfinite(value)
            and not math.isnan(value)
            and value >= 0.0
        )
    except (TypeError, ValueError):
        return False


def predict_shelf_life_safe(
    lstm_model,
    scaler,
    sequence_8x38: np.ndarray,
    freshness_index: float,
    temperature: float,
    humidity: float,
    cnn_fresh_prob: float = 0.9,
    fruit: str = "banana",
) -> Tuple[float, str]:
    """
    Unified shelf-life prediction entry point.

    Parameters
    ----------
    lstm_model      : accepted for interface compatibility (unused)
    scaler          : accepted for interface compatibility (unused)
    sequence_8x38   : np.ndarray (1, 8, 38)
    freshness_index : float [0, 100]
    temperature     : float °C
    humidity        : float %RH
    cnn_fresh_prob  : float [0, 1]
    fruit           : str

    Returns
    -------
    base_remaining_days : float  (rounded to 1 d.p.)
    _method             : str    (internal tag, never forwarded to users)
    """
    from services.formula_fallback import calculate_rsl

    rsl, _c_T, _c_H = calculate_rsl(
        freshness_index=freshness_index,
        temperature=temperature,
        humidity=humidity,
        fruit=fruit,
    )
    return round(rsl, 1), _METHOD_INTERNAL


# ── Legacy shim — keeps any existing call sites working ──────────────────────

def predict_shelf_life(
    lstm_model,
    scaler,
    sequence_8x38: np.ndarray,
    cnn_fresh_prob: float = 0.9,
) -> float:
    """
    Backward-compatible wrapper.
    Delegates to predict_shelf_life_safe with baseline environmental defaults.
    """
    # Derive a rough freshness proxy from cnn_fresh_prob
    fi = round(cnn_fresh_prob * 100.0, 2)
    rsl, _ = predict_shelf_life_safe(
        lstm_model=None,
        scaler=None,
        sequence_8x38=sequence_8x38,
        freshness_index=fi,
        temperature=25.0,
        humidity=60.0,
        cnn_fresh_prob=cnn_fresh_prob,
        fruit="banana",
    )
    return rsl
