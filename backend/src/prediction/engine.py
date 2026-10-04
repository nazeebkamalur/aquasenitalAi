# ============================================================
# AQUASENTINEL AI
#
# PREDICTION ENGINE
# ============================================================


from src.data.loader import (
    load_seeded_data,
    load_scenario
)

from src.prediction.risk import (
    determine_risk_level,
    calculate_risk_score
)


# ============================================================
# LOAD ALL SCENARIOS
# ============================================================

def load_scenarios():

    return load_seeded_data()


# ============================================================
# GET ONE SCENARIO
# ============================================================

def get_scenario(
    scenario_id: int
):

    return load_scenario(
        scenario_id
    )


# ============================================================
# RAINFALL FEATURE FUSION
# ============================================================

def calculate_fused_rainfall(
    open_meteo_rainfall,
    satellite_rainfall=None
):
    """
    Combine Open-Meteo and NASA GPM rainfall
    without simply adding the two measurements.

    Open-Meteo weight: 60%
    NASA GPM weight:   40%

    If NASA GPM is unavailable, Open-Meteo
    rainfall is used directly.
    """

    open_meteo_rainfall = float(
        open_meteo_rainfall
    )

    # NASA unavailable
    if satellite_rainfall is None:

        return round(
            open_meteo_rainfall,
            2
        )

    try:

        satellite_rainfall = float(
            satellite_rainfall
        )

    except (
        TypeError,
        ValueError
    ):

        return round(
            open_meteo_rainfall,
            2
        )

    # Invalid NASA value
    if satellite_rainfall < 0:

        return round(
            open_meteo_rainfall,
            2
        )

    # Weighted fusion
    fused_rainfall = (

        open_meteo_rainfall * 0.60

        +

        satellite_rainfall * 0.40

    )

    return round(
        fused_rainfall,
        2
    )


# ============================================================
# FLOOD PROBABILITY
# ============================================================

def calculate_flood_probability(

    rainfall,

    humidity,

    soil_moisture,

    river_level,

    drainage_capacity

):

    rainfall_score = min(
        rainfall / 220,
        1
    )

    humidity_score = (
        humidity / 100
    )

    soil_score = (
        soil_moisture / 100
    )

    river_score = (
        river_level / 100
    )

    drainage_score = (

        1

        -

        (
            drainage_capacity / 100
        )

    )

    probability = (

        rainfall_score * 0.35

        +

        humidity_score * 0.10

        +

        soil_score * 0.20

        +

        river_score * 0.20

        +

        drainage_score * 0.15

    )

    return round(

        min(
            probability * 100,
            99
        ),

        2

    )


# ============================================================
# INUNDATION AREA
# ============================================================

def calculate_inundation_area(

    flood_probability,

    rainfall,

    drainage_capacity

):

    base_area = (
        rainfall / 100
    )

    drainage_factor = (

        1

        +

        (
            100 - drainage_capacity
        ) / 100

    )

    risk_factor = (
        flood_probability / 100
    )

    area = (

        base_area

        *

        drainage_factor

        *

        risk_factor

        *

        2.5

    )

    return round(

        max(
            area,
            0.1
        ),

        2

    )


# ============================================================
# CONFIDENCE
# ============================================================

def calculate_confidence(

    rainfall,

    humidity,

    soil_moisture

):

    data_quality = (

        0.40

        +

        min(
            rainfall / 250,
            0.25
        )

        +

        min(
            humidity / 400,
            0.15
        )

        +

        min(
            soil_moisture / 400,
            0.20
        )

    )

    return round(

        min(
            data_quality * 100,
            98
        ),

        2

    )


# ============================================================
# MAIN SEEDED PREDICTION FUNCTION
# ============================================================

def run_prediction(
    scenario_id: int
):

    scenario = get_scenario(
        scenario_id
    )

    rainfall = float(
        scenario["rainfall_24h"]
    )

    humidity = float(
        scenario["humidity"]
    )

    soil_moisture = float(
        scenario["soil_moisture"]
    )

    river_level = float(
        scenario["river_level"]
    )

    drainage_capacity = float(
        scenario["drainage_capacity"]
    )

    # --------------------------------------------------------
    # FLOOD PROBABILITY
    # --------------------------------------------------------

    flood_probability = (

        calculate_flood_probability(

            rainfall,

            humidity,

            soil_moisture,

            river_level,

            drainage_capacity

        )

    )

    # --------------------------------------------------------
    # INUNDATION
    # --------------------------------------------------------

    inundation_area = (

        calculate_inundation_area(

            flood_probability,

            rainfall,

            drainage_capacity

        )

    )

    # --------------------------------------------------------
    # RISK
    # --------------------------------------------------------

    risk_level = (

        determine_risk_level(

            flood_probability

        )

    )

    risk_score = (

        calculate_risk_score(

            rainfall,

            flood_probability,

            river_level

        )

    )

    # --------------------------------------------------------
    # CONFIDENCE
    # --------------------------------------------------------

    confidence = (

        calculate_confidence(

            rainfall,

            humidity,

            soil_moisture

        )

    )

    # --------------------------------------------------------
    # FINAL RESULT
    # --------------------------------------------------------

    return {

        "scenario_id": int(
            scenario["scenario_id"]
        ),

        "scenario_name": str(
            scenario["scenario_name"]
        ),

        "predicted_rainfall_mm": round(
            rainfall,
            2
        ),

        "flood_probability": (
            flood_probability
        ),

        "inundation_area_km2": (
            inundation_area
        ),

        "risk_level": (
            risk_level
        ),

        "risk_score": (
            risk_score
        ),

        "confidence": (
            confidence
        )

    }