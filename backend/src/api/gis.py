# ============================================================
# AQUASENTINEL AI
# GIS & FLOOD MAPPING API
# ============================================================

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from src.auth.models import User
from src.auth.dependencies import get_current_user
from src.database.db import get_db

from src.prediction.models import Prediction

from src.gis.zones import get_flood_zones
from src.gis.zones import get_flood_zone

from src.gis.inundation import generate_inundation_zone
from src.gis.maps import create_map_response


router = APIRouter(
    prefix="/api/gis",
    tags=["GIS & Flood Mapping"]
)


# ============================================================
# GET ALL FLOOD ZONES
# ============================================================

@router.get("/zones")
def get_zones(
    user: User = Depends(get_current_user)
):
    zones = get_flood_zones()

    return {
        "success": True,
        "count": len(zones),
        "zones": zones
    }


# ============================================================
# GET SINGLE FLOOD ZONE
# ============================================================

@router.get("/zones/{zone_id}")
def get_zone(
    zone_id: str,
    user: User = Depends(get_current_user)
):
    zone = get_flood_zone(zone_id)

    if zone is None:
        raise HTTPException(
            status_code=404,
            detail="Flood zone not found"
        )

    return {
        "success": True,
        "zone": zone
    }


# ============================================================
# GET FLOOD MAP FOR PREDICTION
# ============================================================

@router.get("/flood-map/{prediction_id}")
def get_flood_map(
    prediction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prediction = (
        db.query(Prediction)
        .filter(
            Prediction.prediction_id
            == prediction_id
        )
        .first()
    )

    if prediction is None:
        raise HTTPException(
            status_code=404,
            detail="Prediction not found"
        )

    zones = get_flood_zones()

    if not zones:
        raise HTTPException(
            status_code=500,
            detail="No GIS flood zones configured"
        )

    # Select a demonstration zone.
    # Later this will come from the actual
    # prediction location/GIS data.
    zone = zones[
        (prediction_id - 1) % len(zones)
    ]

    inundation = generate_inundation_zone(
        latitude=zone["latitude"],
        longitude=zone["longitude"],
        inundation_area_km2=(
            prediction.inundation_area
        ),
        risk_level=prediction.risk_level
    )

    map_data = create_map_response(
        zone,
        inundation
    )

    return {
        "success": True,
        "prediction_id": (
            prediction.prediction_id
        ),
        "scenario_name": (
            prediction.scenario_name
        ),
        "mode": prediction.mode,
        "rainfall_mm": prediction.rainfall,
        "flood_probability": (
            prediction.flood_probability
        ),
        "risk_level": prediction.risk_level,
        "map": map_data
    }