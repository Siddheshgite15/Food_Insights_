import numpy as np

TIMESTEPS = 8
FEATURE_DIM = 38

def create_sequence_from_single_feature(feature_38: np.ndarray, fresh_prob: float = 0.9) -> np.ndarray:
    """
    Constructs an 8-timestep progression matrix (1, 8, 38) from a single feature vector.
    Simulates temporal visual progression (Day 0 to Day 7) based on freshness confidence.
    """
    seq = np.zeros((TIMESTEPS, FEATURE_DIM), dtype=np.float32)
    
    # Degradation rate per day: fresh bananas degrade slower, rotten degrade faster
    decay_rate = 0.05 + 0.12 * (1.0 - fresh_prob)
    
    for t in range(TIMESTEPS):
        # Time step progression factor
        factor = float(t) * decay_rate
        vec = feature_38.copy()
        
        # Color degradation: R & G drop slightly, brown spots / darkness increases
        vec[4] = max(0.0, vec[4] - factor * 3.5)  # R channel
        vec[5] = max(0.0, vec[5] - factor * 4.0)  # G channel (yellow to dark)
        
        # Texture degradation: contrast & entropy increase over time (more speckles/spots)
        vec[1] += factor * 0.8  # GLCM contrast increases
        vec[2] += factor * 0.3  # GLCM entropy increases
        
        seq[t] = vec
        
    return np.expand_dims(seq, axis=0)  # Shape: (1, 8, 38)

def create_sequence_from_history(history_features: list) -> np.ndarray:
    """
    If multiple previous observation points exist, aligns them to an 8-timestep sequence.
    """
    seq = np.zeros((TIMESTEPS, FEATURE_DIM), dtype=np.float32)
    n = len(history_features)
    
    if n == 0:
        return np.expand_dims(seq, axis=0)
    elif n >= TIMESTEPS:
        # Take the most recent 8
        seq[:] = np.array(history_features[-TIMESTEPS:], dtype=np.float32)
    else:
        # Pad beginning with the earliest observation
        first = np.array(history_features[0], dtype=np.float32)
        for i in range(TIMESTEPS - n):
            seq[i] = first
        for i in range(n):
            seq[TIMESTEPS - n + i] = np.array(history_features[i], dtype=np.float32)
            
    return np.expand_dims(seq, axis=0)
