import io
import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image

# ImageNet standard normalization for Resnet121
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

def preprocess_image(image_bytes: bytes):
    """
    Preprocess raw image bytes (e.g. from FastAPI file upload).
    """
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    tensor = transform(image).unsqueeze(0)  # Shape: (1, 3, 224, 224)
    return tensor, image

def preprocess_cv2_frame(frame_bgr: np.ndarray):
    """
    Preprocess OpenCV BGR frame from webcam for Resnet121 inference:
    1. Convert BGR to RGB
    2. Convert to PIL Image
    3. Apply identical training transforms: Resize(224, 224) -> ToTensor() -> Normalize
    4. Unsqueeze batch dimension -> (1, 3, 224, 224)
    """
    if frame_bgr is None or frame_bgr.size == 0:
        raise ValueError("Invalid or empty frame received for preprocessing.")
    
    rgb_frame = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(rgb_frame)
    tensor = transform(pil_image).unsqueeze(0)  # Shape: (1, 3, 224, 224), torch.float32
    return tensor, pil_image
