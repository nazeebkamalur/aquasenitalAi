# ============================================================
# AQUASENTINEL AI
# RIVER / HYDROLOGICAL DATA PROVIDER
# ============================================================

from math import radians
from math import sin
from math import cos
from math import sqrt
from math import atan2


# Prototype station registry.
#
# IMPORTANT:
# These are station metadata placeholders until we connect
# an official live CWC/WIMS feed.
#
# Do NOT use a fabricated water level.
RIVER_STATIONS = []


def calculate_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
):
    """
    Calculate approximate distance between two
    latitude/longitude coordinates.
    """

    earth_radius_km = 6371.0

    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)

    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(d_lon / 2) ** 2
    )

    c = 2 * atan2(
        sqrt(a),
        sqrt(1 - a)
    )

    return earth_radius_km * c


def find_nearest_station(
    latitude: float,
    longitude: float
):
    """
    Find the nearest configured hydrological
    station to the selected region.

    Returns None if no official station has
    been configured yet.
    """

    if not RIVER_STATIONS:
        return None

    nearest_station = None
    nearest_distance = float("inf")

    for station in RIVER_STATIONS:

        distance = calculate_distance_km(
            latitude,
            longitude,
            station["latitude"],
            station["longitude"]
        )

        if distance < nearest_distance:
            nearest_distance = distance
            nearest_station = station

    if nearest_station is None:
        return None

    return {
        **nearest_station,
        "distance_km": round(
            nearest_distance,
            2
        )
    }


def get_river_data(
    region: str,
    latitude: float,
    longitude: float
):
    """
    Get hydrological information for the
    selected region.

    Until an official live CWC/WIMS endpoint
    is connected, this function deliberately
    returns NOT_AVAILABLE rather than fake data.
    """

    station = find_nearest_station(
        latitude,
        longitude
    )

    if station is None:
        return {
            "region": region,
            "latitude": latitude,
            "longitude": longitude,

            "status": "NOT_AVAILABLE",

            "station": None,

            "river_level_m": None,

            "discharge_m3s": None,

            "message": (
                "No official hydrological "
                "station is currently configured "
                "for this region."
            )
        }

    return {
        "region": region,
        "latitude": latitude,
        "longitude": longitude,

        "status": "NOT_CONNECTED",

        "station": station,

        "river_level_m": None,

        "discharge_m3s": None,

        "message": (
            "Station identified, but live "
            "CWC/WIMS observation is not "
            "connected yet."
        )
    }