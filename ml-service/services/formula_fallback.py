"""
Internal Reliability Mechanism — Formula-based RSL Calculation
================================================================
This module is an INTERNAL implementation detail and must never be
exposed to end users.  The prediction service uses it transparently
to produce shelf-life estimates.

Formula
-------
    RSL = SL_base × (FI / 100) × C_T × C_H

    C_T = exp(-k_T × |T - T_opt|)
    C_H = exp(-k_H × |H - H_opt|)

Under optimal conditions (T = T_opt, H = H_opt):
    C_T = C_H = 1  →  RSL = SL_base × (FI / 100)

Rotten rule:
    FI < 10  →  RSL = 0

Reference storage conditions:
    Engineering ToolBox – Fruits & Vegetables Storage Conditions
    https://www.engineeringtoolbox.com/fruits-vegetables-storage-d_964.html
"""

import math
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

# ── Fruit reference parameters ────────────────────────────────────────────────
#
# sl_base : practical maximum shelf life (days)
# T_opt   : optimal storage temperature  (°C)
# H_opt   : optimal relative humidity    (%)
# k_T     : temperature decay coefficient (per °C)  — C_T=1 at T_opt
# k_H     : humidity decay coefficient   (per %RH)  — C_H=1 at H_opt
#
# Banana      13–15 °C / 80–95 % RH  → T_opt=14.0, H_opt=87.5, SL=14 d
# Bitter gourd 12 °C  / 85 % RH      → T_opt=12.0, H_opt=85.0, SL=21 d
# Tomato      12.5 °C / 90 % RH      → T_opt=12.5, H_opt=90.0, SL=14 d

_FRUIT_PARAMS: dict = {
    "banana": {
        "sl_base": 14.0,
        "T_opt":   14.0,
        "H_opt":   87.5,
        "k_T":      0.05,
        "k_H":      0.025,
    },
    "bittergourd": {
        "sl_base": 10.0,
        "T_opt":   12.0,
        "H_opt":   85.0,
        "k_T":      0.05,
        "k_H":      0.025,
    },
    "tomato": {
        "sl_base": 25.0,
        "T_opt":   12.5,
        "H_opt":   90.0,
        "k_T":      0.05,
        "k_H":      0.025,
    },
}

# Normalised aliases so callers can pass e.g. "bitter gourd", "bitter_gourd"
_ALIASES: dict = {
    "bitter gourd":  "bittergourd",
    "bitter_gourd":  "bittergourd",
    "karela":        "bittergourd",
    "tomatoes":      "tomato",
    "bananas":       "banana",
}

_DEFAULT_FRUIT = "banana"


def _resolve(fruit: str) -> str:
    """Normalise fruit name to a canonical key."""
    key = fruit.lower().strip()
    return _ALIASES.get(key, key)


def _get_params(fruit: str) -> dict:
    """Return parameter dict for the given fruit (case-insensitive)."""
    key = _resolve(fruit)
    return _FRUIT_PARAMS.get(key, _FRUIT_PARAMS[_DEFAULT_FRUIT])


def _correction_factor(delta: float, k: float) -> float:
    """
    C = exp(-k × |delta|)
    Returns exactly 1.0 when delta == 0 (optimal condition).
    Always in (0, 1].
    """
    return math.exp(-k * abs(delta))


def calculate_rsl(
    freshness_index: float,
    temperature: float,
    humidity: float,
    fruit: str = "banana",
) -> Tuple[float, float, float]:
    """
    Compute Remaining Shelf Life using the deterministic formula.

    Parameters
    ----------
    freshness_index : float  [0, 100]
    temperature     : float  °C
    humidity        : float  % RH
    fruit           : str    "banana" | "bittergourd" | "tomato"

    Returns
    -------
    rsl  : float – remaining shelf life in days, rounded to 2 d.p.
    c_T  : float – temperature correction factor
    c_H  : float – humidity correction factor
    """
    params  = _get_params(fruit)
    sl_base = params["sl_base"]
    T_opt   = params["T_opt"]
    H_opt   = params["H_opt"]
    k_T     = params["k_T"]
    k_H     = params["k_H"]

    fi = min(max(float(freshness_index), 0.0), 100.0)

    # Rotten rule
    if fi < 10.0:
        logger.debug("RSL: FI=%.2f < 10 → RSL=0 [%s]", fi, fruit)
        return 0.0, 1.0, 1.0

    c_T = _correction_factor(temperature - T_opt, k_T)
    c_H = _correction_factor(humidity    - H_opt, k_H)

    rsl_raw = sl_base * (fi / 100.0) * c_T * c_H
    rsl     = round(min(max(rsl_raw, 0.0), sl_base), 2)

    logger.debug(
        "RSL: fruit=%s FI=%.2f T=%.1f H=%.1f "
        "C_T=%.4f C_H=%.4f → RSL=%.2f",
        fruit, fi, temperature, humidity, c_T, c_H, rsl,
    )

    return rsl, round(c_T, 6), round(c_H, 6)


def calculate_freshness_index(confidence: float, label: str) -> float:
    """
    Derive Freshness Index (0–100) from CNN output.

        C = confidence ∈ [0, 1]

        Fresh  → FI = C × 100
        Rotten → FI = (1 − C) × 100

    Parameters
    ----------
    confidence : float  CNN confidence score in [0, 1]
    label      : str    "Fresh" or "Rotten" (case-insensitive)

    Returns
    -------
    float  Freshness Index in [0, 100], rounded to 2 d.p.
    """
    c = min(max(float(confidence), 0.0), 1.0)
    fi = c * 100.0 if label.lower() == "fresh" else (1.0 - c) * 100.0
    return round(min(max(fi, 0.0), 100.0), 2)


def get_fruit_params(fruit: str = "banana") -> dict:
    """
    Return a copy of the reference parameters for a fruit.
    Useful for tests and documentation.
    """
    return dict(_get_params(fruit))


def supported_fruits() -> list:
    """Return the list of supported fruit keys."""
    return list(_FRUIT_PARAMS.keys())
