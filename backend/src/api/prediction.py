from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from src.auth.models import User
from src.auth.dependencies import get_current_user
from src.auth.dependencies import require_role

from src.database.db import get_db

from src.prediction.models import Prediction
from src.prediction.schemas import PredictionRequest

from src.prediction.engine import run_prediction
from src.prediction.engine import load_scenarios


router = APIRouter(
    prefix="/api/prediction",
    tags=["AI Prediction"]
)


@router.get("/scenarios")
def get_scenarios(
    user: User = Depends(require_role("ADMIN"))
):
    try:
        data = load_scenarios()

        scenarios = []

        for row in data:
            scenarios.append({
                "scenario_id": int(row["scenario_id"]),
                "scenario_name": str(row["scenario_name"]),
                "rainfall_24h": float(row["rainfall_24h"]),
                "humidity": float(row["humidity"]),
                "temperature": float(row["temperature"]),
                "wind_speed": float(row["wind_speed"]),
                "soil_moisture": float(row["soil_moisture"]),
                "elevation": float(row["elevation"]),
                "drainage_capacity": float(
                    row["drainage_capacity"]
                ),
                "river_level": float(row["river_level"])
            })

        return {
            "success": True,
            "mode": "SEEDED",
            "count": len(scenarios),
            "scenarios": scenarios
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to load seeded scenarios: "
                f"{str(error)}"
            )
        )


@router.post("/seeded")
def seeded_prediction(
    request: PredictionRequest,
    user: User = Depends(require_role("ADMIN")),
    db: Session = Depends(get_db)
):
    try:
        result = run_prediction(
            request.scenario_id
        )

        prediction_record = Prediction(
            scenario_id=result["scenario_id"],
            scenario_name=result["scenario_name"],
            rainfall=result["predicted_rainfall_mm"],
            flood_probability=result["flood_probability"],
            inundation_area=result["inundation_area_km2"],
            risk_level=result["risk_level"],
            risk_score=result["risk_score"],
            confidence=result["confidence"],
            mode="SEEDED"
        )

        db.add(prediction_record)
        db.commit()
        db.refresh(prediction_record)

        return {
            "success": True,
            "mode": "SEEDED",
            "message": (
                "Seeded AI prediction "
                "completed successfully"
            ),
            "result": result,
            "prediction_id": (
                prediction_record.prediction_id
            )
        }

    except ValueError as error:
        db.rollback()

        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except Exception as error:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )


@router.get("/history")
def prediction_history(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user.role not in ["ADMIN", "GOVERNMENT"]:
        raise HTTPException(
            status_code=403,
            detail=(
                "Only ADMIN and GOVERNMENT "
                "users can access prediction history"
            )
        )

    predictions = (
        db.query(Prediction)
        .order_by(
            Prediction.created_at.desc()
        )
        .all()
    )

    history = []

    for prediction in predictions:
        history.append({
            "prediction_id": prediction.prediction_id,
            "scenario_id": prediction.scenario_id,
            "scenario_name": prediction.scenario_name,
            "rainfall": prediction.rainfall,
            "flood_probability": (
                prediction.flood_probability
            ),
            "inundation_area_km2": (
                prediction.inundation_area
            ),
            "risk_level": prediction.risk_level,
            "risk_score": prediction.risk_score,
            "confidence": prediction.confidence,
            "mode": prediction.mode,
            "created_at": (
                prediction.created_at.isoformat()
            )
        })

    return {
        "success": True,
        "count": len(history),
        "history": history
    }


@router.get("/latest")
def latest_prediction(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    prediction = (
        db.query(Prediction)
        .order_by(Prediction.created_at.desc())
        .first()
    )

    if prediction is None:
        return {
            "success": True,
            "prediction": None
        }

    return {
        "success": True,
        "prediction": {
            "prediction_id": prediction.prediction_id,
            "scenario_name": prediction.scenario_name,
            "rainfall": prediction.rainfall,
            "flood_probability": prediction.flood_probability,
            "inundation_area_km2": prediction.inundation_area,
            "risk_level": prediction.risk_level,
            "risk_score": prediction.risk_score,
            "confidence": prediction.confidence,
            "mode": prediction.mode,
            "created_at": prediction.created_at.isoformat()
        }
    }