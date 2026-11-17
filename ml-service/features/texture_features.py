import numpy as np
from PIL import Image

def compute_glcm_features(gray_arr: np.ndarray) -> np.ndarray:
    """
    Computes Gray Level Co-occurrence Matrix (GLCM) based texture features:
    contrast, dissimilarity, homogeneity, energy, correlation, and entropy.
    """
    # Quantize 0-255 grayscale into 16 levels for efficient, robust GLCM
    levels = 16
    quantized = (gray_arr / 256.0 * levels).astype(np.int32)
    
    # Compute horizontal co-occurrence matrix (dx=1, dy=0)
    h, w = quantized.shape
    row1 = quantized[:, :-1]
    row2 = quantized[:, 1:]
    
    glcm = np.zeros((levels, levels), dtype=np.float32)
    for i in range(h):
        for j in range(w - 1):
            glcm[row1[i, j], row2[i, j]] += 1
            
    # Normalize GLCM
    total = np.sum(glcm)
    if total > 0:
        glcm /= total
    else:
        glcm = np.ones((levels, levels), dtype=np.float32) / (levels * levels)
        
    i_idx, j_idx = np.indices((levels, levels))
    diff = np.abs(i_idx - j_idx)
    
    contrast = np.sum(glcm * (diff ** 2))
    dissimilarity = np.sum(glcm * diff)
    homogeneity = np.sum(glcm / (1.0 + diff))
    energy = np.sum(glcm ** 2)
    
    # Marginal means and standard deviations for correlation
    i_mean = np.sum(i_idx * glcm)
    j_mean = np.sum(j_idx * glcm)
    i_var = np.sum(((i_idx - i_mean) ** 2) * glcm)
    j_var = np.sum(((j_idx - j_mean) ** 2) * glcm)
    
    i_std = np.sqrt(max(i_var, 1e-6))
    j_std = np.sqrt(max(j_var, 1e-6))
    
    correlation = np.sum((i_idx - i_mean) * (j_idx - j_mean) * glcm) / (i_std * j_std)
    
    # Shannon entropy
    non_zero = glcm[glcm > 0]
    entropy = -np.sum(non_zero * np.log2(non_zero)) if len(non_zero) > 0 else 0.0
    
    return np.array([contrast, dissimilarity, homogeneity, energy, correlation, entropy], dtype=np.float32)

def extract_texture_features(pil_image: Image.Image) -> np.ndarray:
    """
    Extracts spatial and GLCM texture features from a PIL image.
    """
    gray_img = pil_image.convert('L').resize((128, 128))
    gray_arr = np.array(gray_img, dtype=np.float32)
    
    # 6 GLCM features
    glcm_feats = compute_glcm_features(gray_arr)
    
    # Spatial gradient/edge energy (Laplacian variance approximation for sharpness/blemish texture)
    dx = np.diff(gray_arr, axis=1)
    dy = np.diff(gray_arr, axis=0)
    edge_density = float(np.mean(np.abs(dx)) + np.mean(np.abs(dy)))
    texture_variance = float(np.var(gray_arr))
    
    return np.concatenate([glcm_feats, np.array([edge_density, texture_variance], dtype=np.float32)])
