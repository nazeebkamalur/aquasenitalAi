from fastapi import APIRouter
from fastapi import HTTPException

from src.alerts.alert_engine import generate_alert
from src.alerts.alert_engine import should_send_alert
from src.alerts.notifications import create_role_notifications
from src.prediction.models import Prediction
from src.database.db import SessionLocal


# ============================================================
# ALERT ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/alerts",
    tags=["Alerts"]
)


# ============================================================
# HELPER FUNCTION
# ============================================================

def build_alert_response(
    prediction: Prediction
):
    """
    Build an alert and role notifications
    from a database prediction.
    """

    prediction_data = {
        "rainfall_mm": prediction.rainfall,
        "flood_probability": (
            prediction.flood_probability
        ),
        "inundation_area_km2": (
            prediction.inundation_area
        ),
        "risk_level": (
            str(prediction.risk_level)
            .strip()
            .upper()
        ),
    }

    alert = generate_alert(
        prediction_data,
        region=prediction.scenario_name
    )

    # Use the normalized risk level from
    # the generated alert.
    risk_level = (
        str(alert["risk_level"])
        .strip()
        .upper()
    )

    notifications = []

    if should_send_alert(
        risk_level
    ):
        notifications = (
            create_role_notifications(
                alert
            )
        )

    return {
        "status": "success",
        "alert_generated": True,
        "alert": alert,
        "notifications": notifications,
    }


# ============================================================
# LATEST ALERT
# ============================================================

@router.get("/latest")
def get_latest_alert():

    db = SessionLocal()

    try:

        prediction = (
            db.query(Prediction)
            .order_by(
                Prediction.created_at.desc()
            )
            .first()
        )

        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="No predictions available"
            )

        return build_alert_response(
            prediction
        )

    finally:

        db.close()


# ============================================================
# ALERT FOR SPECIFIC PREDICTION
# ============================================================

@router.get(
    "/prediction/{prediction_id}"
)
def get_prediction_alert(
    prediction_id: int
):

    db = SessionLocal()

    try:

        prediction = (
            db.query(Prediction)
            .filter(
                Prediction.prediction_id
                == prediction_id
            )
            .first()
        )

        if not prediction:
            raise HTTPException(
                status_code=404,
                detail="Prediction not found"
            )

        return build_alert_response(
            prediction
        )

    finally:

        db.close()