import numpy as np
from PIL import Image
from .color_features import extract_color_features
from .texture_features import extract_texture_features

TARGET_FEATURE_COUNT = 38

def combine_features(cnn_1024: np.ndarray, pil_image: Image.Image) -> np.ndarray:
    """
    Combines 1024 CNN features, color features, and texture features
    into a calibrated 38-dimensional feature vector.
    """
    color_feats = extract_color_features(pil_image)    # 14 features
    texture_feats = extract_texture_features(pil_image) # 8 features
    
    # Handcrafted feature vector (22 features)
    handcrafted = np.concatenate([color_feats, texture_feats])
    
    # Select 16 representative features from the 1024 CNN feature vector
    # using adaptive chunk pooling across the 1024 dimensions
    chunk_size = len(cnn_1024) // 16
    cnn_reduced = np.array([
        np.mean(cnn_1024[i * chunk_size : (i + 1) * chunk_size])
        for i in range(16)
    ], dtype=np.float32)
    
    # Order to match the feature distribution:
    # 1. Texture / GLCM features (entropy, contrast, dissimilarity)
    # 2. Color means (R, G, B, H, S, V)
    # 3. CNN reduced embeddings
    # 4. Color variance / ripening indices
    combined = np.zeros(TARGET_FEATURE_COUNT, dtype=np.float32)
    
    # Place texture & color metrics into primary positions
    combined[0] = float(texture_feats[3])      # GLCM energy
    combined[1] = float(texture_feats[0])      # GLCM contrast
    combined[2] = float(texture_feats[5])      # GLCM entropy
    combined[3] = float(texture_feats[1])      # GLCM dissimilarity
    combined[4] = float(color_feats[0])        # R mean (~85)
    combined[5] = float(color_feats[2])        # G mean (~110)
    combined[6] = float(texture_feats[2])      # Homogeneity
    combined[7] = float(texture_feats[4])      # Correlation
    
    # Fill next 16 slots with CNN spatial features
    combined[8:24] = cnn_reduced
    
    # Fill remaining 14 slots with color moments and browning metrics
    remaining_count = TARGET_FEATURE_COUNT - 24
    combined[24:] = handcrafted[:remaining_count]
    
    return combined
