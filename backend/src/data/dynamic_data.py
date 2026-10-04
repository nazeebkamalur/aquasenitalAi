# ============================================================
# AQUASENTINEL AI
# REAL DYNAMIC WEATHER DATA PROVIDER
# ============================================================

from datetime import datetime, timezone

import requests


OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
)


def get_dynamic_data(
    region: str,
    latitude: float,
    longitude: float
):
    """
    Fetch real weather data for the selected region.

    The selected latitude and longitude are sent directly
    to the weather provider.

    This keeps Dynamic Mode region-specific.
    """

    params = {
        "latitude": latitude,
        "longitude": longitude,

        "current": ",".join([
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "rain",
            "wind_speed_10m",
            "soil_moisture_0_to_1cm"
        ]),

        "hourly": ",".join([
            "precipitation",
            "rain",
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "soil_moisture_0_to_1cm"
        ]),

        "past_hours": 24,
        "forecast_hours": 24,

        "timezone": "auto"
    }

    try:
        response = requests.get(
            OPEN_METEO_URL,
            params=params,
            timeout=15
        )

        response.raise_for_status()

        weather = response.json()

    except requests.RequestException as error:
        raise RuntimeError(
            f"Unable to fetch live weather data: {error}"
        )

    current = weather.get("current", {})
    hourly = weather.get("hourly", {})

    precipitation_values = (
        hourly.get("precipitation", [])
    )

    rain_values = (
        hourly.get("rain", [])
    )

    humidity_values = (
        hourly.get("relative_humidity_2m", [])
    )

    temperature_values = (
        hourly.get("temperature_2m", [])
    )

    wind_values = (
        hourly.get("wind_speed_10m", [])
    )

    soil_values = (
        hourly.get("soil_moisture_0_to_1cm", [])
    )

    # Last 24 hourly precipitation values
    recent_precipitation = [
        value
        for value in precipitation_values[-24:]
        if value is not None
    ]

    recent_rain = [
        value
        for value in rain_values[-24:]
        if value is not None
    ]

    # Prefer rain when available.
    # Otherwise use total precipitation.
    rainfall_24h = sum(
        recent_rain
    )

    if rainfall_24h <= 0:
        rainfall_24h = sum(
            recent_precipitation
        )

    humidity_values = [
        value
        for value in humidity_values
        if value is not None
    ]

    temperature_values = [
        value
        for value in temperature_values
        if value is not None
    ]

    wind_values = [
        value
        for value in wind_values
        if value is not None
    ]

    soil_values = [
        value
        for value in soil_values
        if value is not None
    ]

    humidity = (
        humidity_values[-1]
        if humidity_values
        else current.get(
            "relative_humidity_2m",
            0
        )
    )

    temperature = (
        temperature_values[-1]
        if temperature_values
        else current.get(
            "temperature_2m",
            0
        )
    )

    wind_speed = (
        wind_values[-1]
        if wind_values
        else current.get(
            "wind_speed_10m",
            0
        )
    )

    soil_moisture_raw = (
        soil_values[-1]
        if soil_values
        else current.get(
            "soil_moisture_0_to_1cm",
            0
        )
    )

    # Open-Meteo soil moisture is volumetric
    # water content in m³/m³.
    # Convert approximately to a 0-100 scale.
    soil_moisture = min(
        max(float(soil_moisture_raw) * 100, 0),
        100
    )

    # These two values are not directly supplied
    # by this first weather provider.
    #
    # We keep them explicit so the pipeline can
    # later receive DEM/hydrological data.
    elevation = 0.0
    drainage_capacity = 60.0
    river_level = 0.0

    timestamp = (
        current.get("time")
        or datetime.now(
            timezone.utc
        ).isoformat()
    )

    return {
        "mode": "DYNAMIC",

        "region": region,

        "latitude": latitude,
        "longitude": longitude,

        "timestamp": timestamp,

        "rainfall_24h": round(
            rainfall_24h,
            2
        ),

        "humidity": round(
            float(humidity),
            2
        ),

        "temperature": round(
            float(temperature),
            2
        ),

        "wind_speed": round(
            float(wind_speed),
            2
        ),

        "soil_moisture": round(
            soil_moisture,
            2
        ),

        "elevation": elevation,

        "drainage_capacity": (
            drainage_capacity
        ),

        "river_level": river_level,

        "provider": "Open-Meteo",

        "provider_status": "LIVE"
    }
    