def validate_region(
    region: str,
    latitude: float,
    longitude: float
):
    if not region or not region.strip():
        raise ValueError(
            "Region name is required"
        )

    if latitude < -90 or latitude > 90:
        raise ValueError(
            "Latitude must be between -90 and 90"
        )

    if longitude < -180 or longitude > 180:
        raise ValueError(
            "Longitude must be between -180 and 180"
        )

    return True


def preprocess_dynamic_data(data: dict):
    required_fields = [
        "rainfall_24h",
        "humidity",
        "temperature",
        "wind_speed",
        "soil_moisture",
        "elevation",
        "drainage_capacity",
        "river_level"
    ]

    for field in required_fields:
        if field not in data:
            raise ValueError(
                f"Missing dynamic data field: {field}"
            )

    processed = {
        "rainfall_24h": float(
            data["rainfall_24h"]
        ),
        "humidity": float(
            data["humidity"]
        ),
        "temperature": float(
            data["temperature"]
        ),
        "wind_speed": float(
            data["wind_speed"]
        ),
        "soil_moisture": float(
            data["soil_moisture"]
        ),
        "elevation": float(
            data["elevation"]
        ),
        "drainage_capacity": float(
            data["drainage_capacity"]
        ),
        "river_level": float(
            data["river_level"]
        )
    }

    return processed