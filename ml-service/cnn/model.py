"""
FoodInsight — ResNet50 CNN model loader.

Architecture
------------
    ResNet50 backbone (ImageNet pre-trained)
    → Linear(2048, 512) → ReLU → Dropout(0.4) → Linear(512, 6)

Output classes (6):
    fresh_banana, fresh_bittergourd, fresh_tomato,
    rotten_banana, rotten_bittergourd, rotten_tomato
"""

import logging
from pathlib import Path

import torch
import torch.nn as nn
import torchvision.models as tv_models

logger = logging.getLogger(__name__)

# Expected classes — must match checkpoint
CLASS_NAMES = [
    "fresh_banana",
    "fresh_bittergourd",
    "fresh_tomato",
    "rotten_banana",
    "rotten_bittergourd",
    "rotten_tomato",
]


def _build_resnet50(num_classes: int = 6) -> nn.Module:
    """Construct ResNet50 with the custom classification head."""
    model = tv_models.resnet50(weights=None)
    in_features = model.fc.in_features          # 2048
    model.fc = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(p=0.4),
        nn.Linear(512, num_classes),
    )
    return model


def _resolve_model_path(model_path=None) -> Path:
    """Find the checkpoint file."""
    if model_path:
        p = Path(model_path)
        if p.exists():
            return p
        raise FileNotFoundError(f"CNN checkpoint not found: {p}")

    current_dir = Path(__file__).resolve().parent
    candidates = [
        current_dir.parent / "models" / "resnet50_best.pth",
        Path.cwd() / "models" / "resnet50_best.pth",
    ]
    for c in candidates:
        if c.exists():
            return c

    raise FileNotFoundError(
        "resnet50_best.pth not found. Searched:\n"
        + "\n".join(f"  {c}" for c in candidates)
    )


def load_cnn_model(model_path=None) -> nn.Module:
    """
    Load the ResNet50 checkpoint from disk.

    The checkpoint must contain:
        model_state_dict : OrderedDict
        class_names      : list[str]
    """
    path = _resolve_model_path(model_path)
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)

    ckpt_classes = checkpoint.get("class_names", CLASS_NAMES)
    if ckpt_classes != CLASS_NAMES:
        logger.warning(
            "CNN checkpoint class_names differ from expected.\n"
            "  Checkpoint : %s\n  Expected   : %s",
            ckpt_classes, CLASS_NAMES,
        )

    num_classes = len(ckpt_classes)
    model = _build_resnet50(num_classes=num_classes)
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    model.load_state_dict(state_dict)
    model.eval()

    logger.info(
        "ResNet50 loaded from %s  (classes=%d, val_acc=%.4f)",
        path.name,
        num_classes,
        checkpoint.get("val_accuracy", float("nan")),
    )
    return model
