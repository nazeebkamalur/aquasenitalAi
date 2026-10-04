# ============================================================
# AQUASENTINEL AI
# LIVE ELEVATION DATA PROVIDER
# ============================================================

import requests


OPEN_METEO_ELEVATION_URL = (
    "https://api.open-meteo.com/v1/elevation"
)


def get_elevation(
    latitude: float,
    longitude: float
):
    """
    Fetch elevation for the selected region
    using its latitude and longitude.
    """

    params = {
        "latitude": latitude,
        "longitude": longitude
    }

    try:
        response = requests.get(
            OPEN_METEO_ELEVATION_URL,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        data = response.json()

    except requests.RequestException as error:
        raise RuntimeError(
            f"Unable to fetch elevation data: {error}"
        )

    elevations = data.get("elevation", [])

    if not elevations:
        raise RuntimeError(
            "Elevation data was not returned"
        )

    return float(elevations[0])