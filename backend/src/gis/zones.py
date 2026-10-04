# ============================================================
# AQUASENTINEL AI
# SEEDED GIS FLOOD ZONES
# ============================================================

FLOOD_ZONES = [
    {
        "zone_id": "ZONE-A",
        "zone_name": "Hyderabad Central",
        "latitude": 17.3850,
        "longitude": 78.4867,
        "base_radius_km": 1.0
    },
    {
        "zone_id": "ZONE-B",
        "zone_name": "Hyderabad East",
        "latitude": 17.4156,
        "longitude": 78.5500,
        "base_radius_km": 1.2
    },
    {
        "zone_id": "ZONE-C",
        "zone_name": "Hyderabad West",
        "latitude": 17.4000,
        "longitude": 78.4000,
        "base_radius_km": 1.1
    },
    {
        "zone_id": "ZONE-D",
        "zone_name": "Hyderabad North",
        "latitude": 17.4500,
        "longitude": 78.4800,
        "base_radius_km": 1.3
    }
]


def get_flood_zones():
    return FLOOD_ZONES


def get_flood_zone(zone_id: str):
    for zone in FLOOD_ZONES:
        if zone["zone_id"] == zone_id:
            return zone

    return None