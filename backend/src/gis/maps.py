# ============================================================
# AQUASENTINEL AI
# GIS MAP GENERATOR
# ============================================================


def create_map_point(
    zone_id: str,
    zone_name: str,
    latitude: float,
    longitude: float
):
    return {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "latitude": latitude,
        "longitude": longitude
    }


def create_map_response(
    zone,
    inundation
):
    return {
        "zone": {
            "zone_id": zone["zone_id"],
            "zone_name": zone["zone_name"]
        },
        "center": {
            "latitude": zone["latitude"],
            "longitude": zone["longitude"]
        },
        "inundation": inundation
    }