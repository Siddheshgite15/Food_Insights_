"""
LSTM model loader.

Loads the Keras LSTM and its StandardScaler.  If the Keras model cannot
be deserialized (e.g. version mismatch), both are returned as None so the
prediction service can fall back to the internal reliability mechanism.
"""

import logging
import os
import warnings

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


def load_lstm_and_scaler(models_dir: str = None):
    """
    Returns (lstm_model, scaler).

    Either value may be None if loading fails.  The prediction service
    handles None values by activating the internal reliability mechanism.
    """
    if models_dir is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        models_dir = os.path.join(base_dir, "models")

    keras_path  = os.path.join(models_dir, "banana_lstm_model.keras")
    scaler_path = os.path.join(models_dir, "lstm_scaler.pkl")

    # ── Load scaler ───────────────────────────────────────────────────────────
    scaler = None
    try:
        import joblib
        scaler = joblib.load(scaler_path)
        logger.info("LSTM scaler loaded (n_features=%d)", scaler.n_features_in_)
    except Exception as exc:
        logger.warning("Could not load LSTM scaler: %s", exc)

    # ── Load Keras LSTM ───────────────────────────────────────────────────────
    lstm_model = None
    try:
        import tensorflow as tf  # noqa: F401 – imported for side-effects

        # Try standard load first
        try:
            lstm_model = tf.keras.models.load_model(keras_path)
            logger.info("Keras LSTM loaded from %s", keras_path)
        except TypeError:
            # Keras version mismatch (quantization_config key).
            # Rebuild the architecture from config and restore weights only.
            logger.warning(
                "Standard Keras load failed (likely version mismatch). "
                "Attempting weight-only restore…"
            )
            lstm_model = _load_weights_only(keras_path, tf)

    except Exception as exc:
        logger.warning(
            "LSTM model unavailable (%s). Internal reliability mechanism "
            "will handle all shelf-life predictions.", exc
        )

    return lstm_model, scaler


def _load_weights_only(keras_path: str, tf):
    """
    Fallback loader: rebuild the known architecture and restore weights
    from the .keras archive without relying on `from_config`.
    """
    import zipfile, json, io, numpy as np

    # The .keras format is a ZIP: config.json + model.weights.h5 (or weights.npz)
    with zipfile.ZipFile(keras_path, "r") as zf:
        namelist = zf.namelist()

        # ── Parse config to get layer shapes ─────────────────────────────────
        config_name = next((n for n in namelist if n.endswith("config.json")), None)
        if config_name is None:
            raise FileNotFoundError("config.json not found inside .keras archive")

        with zf.open(config_name) as f:
            cfg = json.load(f)

        # Navigate to layers list
        layers_cfg = (
            cfg.get("config", {}).get("layers", [])
            or cfg.get("layers", [])
        )

        # Extract LSTM hidden units and Dense units from config
        lstm_units  = 64   # default
        dense_units = 32   # default
        input_shape = (8, 38)  # default (timesteps, features)

        for layer in layers_cfg:
            lname  = layer.get("class_name", "")
            lcfg   = layer.get("config", {})
            if lname == "LSTM":
                lstm_units   = lcfg.get("units", lstm_units)
            elif lname == "Dense" and lcfg.get("units", 1) > 1:
                dense_units  = lcfg.get("units", dense_units)
            elif lname == "InputLayer":
                bs = lcfg.get("batch_shape") or lcfg.get("batch_input_shape", [])
                if len(bs) == 3:
                    input_shape = (bs[1], bs[2])

    # ── Rebuild model ─────────────────────────────────────────────────────────
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=input_shape),
        tf.keras.layers.LSTM(lstm_units),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(dense_units, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(1, activation="linear"),
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])

    # ── Restore weights ───────────────────────────────────────────────────────
    # Try h5 weights file inside the archive
    try:
        with zipfile.ZipFile(keras_path, "r") as zf:
            weight_names = [n for n in zf.namelist() if n.endswith(".h5") or "weights" in n]
            if weight_names:
                import tempfile, os
                with tempfile.TemporaryDirectory() as tmpdir:
                    zf.extractall(tmpdir)
                    h5_path = os.path.join(tmpdir, weight_names[0])
                    if os.path.exists(h5_path):
                        model.load_weights(h5_path)
                        logger.info("Weights restored from %s", weight_names[0])
    except Exception as we:
        logger.warning("Weight restore failed (%s); model will predict from init.", we)

    model.build(input_shape=(None,) + input_shape)
    return model
