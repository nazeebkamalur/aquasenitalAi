# ============================================================
# AQUASENTINEL AI
# RISK ENGINE
# ============================================================


def determine_risk_level(
    flood_probability: float
):

    if flood_probability >= 80:

        return "CRITICAL"


    if flood_probability >= 60:

        return "HIGH"


    if flood_probability >= 40:

        return "MODERATE"


    if flood_probability >= 20:

        return "LOW"


    return "MINIMAL"


def calculate_risk_score(
    rainfall,
    flood_probability,
    river_level
):

    rainfall_score = min(
        rainfall / 220,
        1
    )


    flood_score = (
        flood_probability / 100
    )


    river_score = (
        river_level / 100
    )


    risk_score = (

        rainfall_score * 0.35

        + flood_score * 0.45

        + river_score * 0.20

    )


    return round(
        risk_score * 100,
        2
    )