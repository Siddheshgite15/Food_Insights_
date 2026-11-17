import math
from .baseline import (
    BASELINE_TEMPERATURE,
    BASELINE_HUMIDITY,
    REFERENCE_SHELF_LIFE_DAYS,
    Q10_FACTOR
)

def calculate_environmental_adjustment(
    base_remaining_days: float,
    current_temp: float,
    current_humidity: float
):
    """
    Computes scientific environmental adjustment on base shelf life
    using kinetic Arrhenius/Q10 model for temperature and moisture degradation factors.
    """
    # Temperature effect: rate of deterioration increases by Q10 for each 10 C rise
    # Degradation Rate Factor = Q10 ^ ((T - T_base) / 10)
    delta_t = current_temp - BASELINE_TEMPERATURE
    temp_rate_factor = math.pow(Q10_FACTOR, delta_t / 10.0)
    temp_factor = 1.0 / max(temp_rate_factor, 0.01)
    
    # Humidity effect: deviations from baseline (60% RH)
    # Excessively high humidity (>75%) accelerates fungal mold spores
    # Very dry air (<45%) causes peel dehydration and accelerated browning
    delta_h = current_humidity - BASELINE_HUMIDITY
    if current_humidity > BASELINE_HUMIDITY:
        # High humidity accelerates surface fungal decay
        humidity_factor = 1.0 - 0.006 * delta_h
    else:
        # Lower humidity slightly retards microbial activity but increases desiccation
        humidity_factor = 1.0 - 0.003 * abs(delta_h)
        
    humidity_factor = max(0.65, min(1.25, humidity_factor))
    
    # Combined environmental factor
    environmental_factor = round(temp_factor * humidity_factor, 3)
    
    # Adjusted remaining days
    adjusted_days = round(max(0.0, base_remaining_days * environmental_factor), 1)
    
    # Freshness Index (0 - 100 scale)
    # Based on adjusted remaining days relative to fresh reference shelf life
    if REFERENCE_SHELF_LIFE_DAYS > 0:
        freshness_index = round(min(100.0, max(0.0, (adjusted_days / REFERENCE_SHELF_LIFE_DAYS) * 100.0)), 1)
    else:
        freshness_index = 0.0
        
    # Categorical status determination
    if freshness_index >= 75.0:
        status = "Fresh"
    elif freshness_index >= 45.0:
        status = "Ripe"
    elif freshness_index >= 20.0:
        status = "Overripe"
    else:
        status = "Rotten"
        
    return {
        "environmentalFactor": environmental_factor,
        "adjustedRemainingDays": adjusted_days,
        "freshnessIndex": freshness_index,
        "status": status,
        "baselineTemperature": BASELINE_TEMPERATURE,
        "baselineHumidity": BASELINE_HUMIDITY
    }
