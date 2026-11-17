import numpy as np
from PIL import Image

def extract_color_features(pil_image: Image.Image) -> np.ndarray:
    """
    Extracts statistical color features from RGB and HSV representations.
    """
    # Resize to standard analysis resolution
    img = pil_image.resize((224, 224))
    rgb_arr = np.array(img, dtype=np.float32)
    
    # RGB statistics
    r = rgb_arr[:, :, 0]
    g = rgb_arr[:, :, 1]
    b = rgb_arr[:, :, 2]
    
    r_mean, r_std = np.mean(r), np.std(r)
    g_mean, g_std = np.mean(g), np.std(g)
    b_mean, b_std = np.mean(b), np.std(b)
    
    # Convert to HSV
    hsv_img = img.convert('HSV')
    hsv_arr = np.array(hsv_img, dtype=np.float32)
    h = hsv_arr[:, :, 0]
    s = hsv_arr[:, :, 1]
    v = hsv_arr[:, :, 2]
    
    h_mean, h_std = np.mean(h), np.std(h)
    s_mean, s_std = np.mean(s), np.std(s)
    v_mean, v_std = np.mean(v), np.std(v)
    
    # Browning / ripening indices
    # Yellow ratio: high R & G, low B
    yellow_idx = np.mean((r + g) / (2.0 * (b + 1.0)))
    # Brown index: browning spots increase darker, low brightness & low hue
    brown_spot_ratio = np.mean((v < 100) & (s > 40))
    
    features = np.array([
        r_mean, r_std,
        g_mean, g_std,
        b_mean, b_std,
        h_mean, h_std,
        s_mean, s_std,
        v_mean, v_std,
        yellow_idx, brown_spot_ratio
    ], dtype=np.float32)
    
    return features
