from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from src.auth.models import User
from src.auth.dependencies import require_role
from src.database.db import get_db
from src.prediction.models import Prediction


router = APIRouter(
    prefix="/api",
    tags=["Dashboards"]
)


# ============================================================
# USER DASHBOARD
# ============================================================

@router.get("/user/dashboard")
def user_dashboard(
    user: User = Depends(require_role("USER"))
):
    return {
        "success": True,
        "dashboard": "USER",
        "message": "Welcome to AquaSentinel AI",
        "user": {
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


# ============================================================
# GOVERNMENT DASHBOARD
# ============================================================

@router.get("/government/dashboard")
def government_dashboard(
    user: User = Depends(require_role("GOVERNMENT")),
    db: Session = Depends(get_db)
):
    latest_prediction = (
        db.query(Prediction)
        .order_by(
            Prediction.created_at.desc()
        )
        .first()
    )

    if latest_prediction is None:
        return {
            "success": True,
            "dashboard": "GOVERNMENT",
            "message": "No predictions available yet",
            "user": {
                "name": user.name,
                "email": user.email,
                "role": user.role
            },
            "current_status": {
                "risk_level": "NO_DATA",
                "flood_probability": 0,
                "rainfall_mm": 0,
                "inundation_area_km2": 0
            }
        }

    return {
        "success": True,
        "dashboard": "GOVERNMENT",
        "message": "Government monitoring dashboard",
        "user": {
            "name": user.name,
            "email": user.email,
            "role": user.role
        },
        "current_status": {
            "prediction_id": latest_prediction.prediction_id,
            "scenario_name": latest_prediction.scenario_name,
            "risk_level": latest_prediction.risk_level,
            "flood_probability": (
                latest_prediction.flood_probability
            ),
            "rainfall_mm": latest_prediction.rainfall,
            "inundation_area_km2": (
                latest_prediction.inundation_area
            ),
            "risk_score": latest_prediction.risk_score,
            "confidence": latest_prediction.confidence,
            "mode": latest_prediction.mode,
            "updated_at": (
                latest_prediction.created_at.isoformat()
            )
        }
    }


# ============================================================
# ADMIN DASHBOARD
# ============================================================

@router.get("/admin/dashboard")
def admin_dashboard(
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    total_predictions = (
        db.query(Prediction)
        .count()
    )

    minimal_count = (
        db.query(Prediction)
        .filter(
            Prediction.risk_level == "MINIMAL"
        )
        .count()
    )

    low_count = (
        db.query(Prediction)
        .filter(
            Prediction.risk_level == "LOW"
        )
        .count()
    )

    moderate_count = (
        db.query(Prediction)
        .filter(
            Prediction.risk_level == "MODERATE"
        )
        .count()
    )

    high_count = (
        db.query(Prediction)
        .filter(
            Prediction.risk_level == "HIGH"
        )
        .count()
    )

    critical_count = (
        db.query(Prediction)
        .filter(
            Prediction.risk_level == "CRITICAL"
        )
        .count()
    )

    seeded_count = (
        db.query(Prediction)
        .filter(
            Prediction.mode == "SEEDED"
        )
        .count()
    )

    dynamic_count = (
        db.query(Prediction)
        .filter(
            Prediction.mode == "DYNAMIC"
        )
        .count()
    )

    latest_prediction = (
        db.query(Prediction)
        .order_by(
            Prediction.created_at.desc()
        )
        .first()
    )

    latest_status = None

    if latest_prediction:
        latest_status = {
            "scenario_name": (
                latest_prediction.scenario_name
            ),
            "risk_level": (
                latest_prediction.risk_level
            ),
            "flood_probability": (
                latest_prediction.flood_probability
            ),
            "rainfall_mm": (
                latest_prediction.rainfall
            ),
            "inundation_area_km2": (
                latest_prediction.inundation_area
            ),
            "mode": latest_prediction.mode,
            "created_at": (
                latest_prediction.created_at.isoformat()
            )
        }

    return {
        "success": True,
        "dashboard": "ADMIN",
        "message": (
            "AquaSentinel AI administration dashboard"
        ),
        "user": {
            "name": user.name,
            "email": user.email,
            "role": user.role
        },
        "statistics": {
            "total_predictions": total_predictions,
            "risk_levels": {
                "MINIMAL": minimal_count,
                "LOW": low_count,
                "MODERATE": moderate_count,
                "HIGH": high_count,
                "CRITICAL": critical_count
            },
            "prediction_modes": {
                "SEEDED": seeded_count,
                "DYNAMIC": dynamic_count
            }
        },
        "latest_prediction": latest_status
    }