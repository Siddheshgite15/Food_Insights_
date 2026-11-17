import numpy as np
from collections import deque
import time

TIMESTEPS = 8
FEATURE_DIM = 38


class SequenceManager:
    """
    Manages 8-timestep sequences of 38-dimensional feature vectors for LSTM inference.
    Supports both:
      1. LIVE MODE: Accumulates multi-day or distinct periodic observations over time.
      2. DEMO/SIMULATED MODE: Projects a single-observation feature vector into an
         8-timestep degradation trajectory matching the training distribution.
    """

    def __init__(self, sequence_length: int = TIMESTEPS, feature_dim: int = FEATURE_DIM):
        self.sequence_length = sequence_length
        self.feature_dim = feature_dim
        self.buffer = deque(maxlen=sequence_length)
        self.timestamps = deque(maxlen=sequence_length)

    def validate_feature_dim(self, feature_vector: np.ndarray):
        """Verifies strict feature vector compatibility according to Section 22."""
        actual_len = len(feature_vector.flatten())
        if actual_len != self.feature_dim:
            raise ValueError(
                f"ERROR: LSTM input feature mismatch.\n"
                f"Expected: {self.feature_dim}\n"
                f"Received: {actual_len}"
            )

    def add_observation(self, feature_vector: np.ndarray, timestamp: float = None):
        """Adds a single verified observation to the temporal buffer."""
        self.validate_feature_dim(feature_vector)
        vec_38 = np.array(feature_vector, dtype=np.float32).flatten()
        self.buffer.append(vec_38)
        self.timestamps.append(timestamp or time.time())

    def is_full(self) -> bool:
        """Returns True if the buffer has reached the required sequence length (8)."""
        return len(self.buffer) == self.sequence_length

    def get_sequence_from_buffer(self) -> np.ndarray:
        """
        Builds a (1, 8, 38) numpy array from the history buffer.
        If fewer than 8 observations exist, pads the earlier timesteps with the first observation.
        """
        if len(self.buffer) == 0:
            raise ValueError("ERROR: Sequence buffer is empty. Cannot build sequence.")

        seq = np.zeros((self.sequence_length, self.feature_dim), dtype=np.float32)
        n = len(self.buffer)
        buf_arr = np.array(self.buffer, dtype=np.float32)

        if n >= self.sequence_length:
            seq[:] = buf_arr[-self.sequence_length:]
        else:
            # Pad beginning with the earliest observation
            first = buf_arr[0]
            for i in range(self.sequence_length - n):
                seq[i] = first
            for i in range(n):
                seq[self.sequence_length - n + i] = buf_arr[i]

        return np.expand_dims(seq, axis=0)  # Shape: (1, 8, 38)

    def create_single_capture_sequence(self, feature_38: np.ndarray, fresh_prob: float = 0.9) -> np.ndarray:
        """
        Constructs an 8-timestep progression matrix (1, 8, 38) from a single observation
        using the learned degradation dynamics (peel color darkening, GLCM texture contrast/entropy).
        """
        self.validate_feature_dim(feature_38)
        seq = np.zeros((self.sequence_length, self.feature_dim), dtype=np.float32)
        decay_rate = 0.05 + 0.12 * (1.0 - fresh_prob)

        for t in range(self.sequence_length):
            factor = float(t) * decay_rate
            vec = feature_38.copy().flatten()

            # Color degradation: R & G drop slightly over time
            vec[4] = max(0.0, vec[4] - factor * 3.5)  # R channel
            vec[5] = max(0.0, vec[5] - factor * 4.0)  # G channel

            # Texture degradation: GLCM contrast and entropy increase
            vec[1] += factor * 0.8  # Contrast
            vec[2] += factor * 0.3  # Entropy

            seq[t] = vec

        return np.expand_dims(seq, axis=0)  # Shape: (1, 8, 38)

    def clear(self):
        """Resets the observation buffer."""
        self.buffer.clear()
        self.timestamps.clear()
