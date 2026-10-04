# ============================================================
# AQUASENTINEL AI
# INUNDATION CALCULATION
# ============================================================

import math


def calculate_flood_radius(
    inundation_area_km2: float
):
    """
    Calculate an approximate flood radius
    from the predicted inundation area.

    This is a prototype approximation.
    Real deployment should use DEM,
    hydrological and GIS models.
    """

    if inundation_area_km2 <= 0:
        return 0.0

    radius = math.sqrt(
        inundation_area_km2 / math.pi
    )

    return round(radius, 3)


def generate_inundation_zone(
    latitude: float,
    longitude: float,
    inundation_area_km2: float,
    risk_level: str
):
    radius = calculate_flood_radius(
        inundation_area_km2
    )

    return {
        "geometry_type": "CIRCLE_APPROXIMATION",
        "center": {
            "latitude": latitude,
            "longitude": longitude
        },
        "inundation_area_km2": round(
            inundation_area_km2,
            2
        ),
        "estimated_radius_km": radius,
        "risk_level": risk_level
    }