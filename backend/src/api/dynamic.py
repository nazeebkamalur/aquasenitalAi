# ============================================================
# AQUASENTINEL AI
#
# DYNAMIC LOCATION PREDICTION API
# ============================================================

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from pydantic import BaseModel

from sqlalchemy.orm import Session


# ============================================================
# AUTHENTICATION
# ============================================================

from src.auth.models import User
from src.auth.dependencies import get_current_user


# ============================================================
# DATABASE
# ============================================================

from src.database.db import get_db


# ============================================================
# LIVE DATA SOURCES
# ============================================================

from src.data.dynamic_data import get_dynamic_data

from src.data.elevation_data import get_elevation

from src.data.river_data import get_river_data

from src.data.satellite_half_hourly import (
    get_latest_24h_rainfall
)


# ============================================================
# PREPROCESSING
# ============================================================

from src.preprocessing.dynamic_processor import (
    preprocess_dynamic_data
)


# ============================================================
# PREDICTION ENGINE
# ============================================================

from src.prediction.engine import (
    calculate_flood_probability,
    calculate_inundation_area,
    calculate_confidence,
    calculate_fused_rainfall
)


# ============================================================
# RISK ENGINE
# ============================================================

from src.prediction.risk import (
    determine_risk_level,
    calculate_risk_score
)


# ============================================================
# DATABASE MODEL
# ============================================================

from src.prediction.models import Prediction


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api/dynamic",
    tags=["Dynamic Prediction"]
)


# ============================================================
# REQUEST SCHEMA
# ============================================================

class DynamicPredictionRequest(BaseModel):

    region: str

    latitude: float

    longitude: float


# ============================================================
# DYNAMIC LOCATION PREDICTION
# ============================================================

@router.post("/predict")
def dynamic_prediction(

    request: DynamicPredictionRequest,

    user: User = Depends(
        get_current_user
    ),

    db: Session = Depends(
        get_db
    )

):

    try:

        # ====================================================
        # 1. Validate selected location
        # ====================================================

        region = request.region.strip()

        latitude = float(
            request.latitude
        )

        longitude = float(
            request.longitude
        )


        if not region:

            raise ValueError(
                "Location name cannot be empty."
            )


        if not (
            -90 <= latitude <= 90
        ):

            raise ValueError(
                "Latitude must be between -90 and 90."
            )


        if not (
            -180 <= longitude <= 180
        ):

            raise ValueError(
                "Longitude must be between -180 and 180."
            )


        # ====================================================
        # 2. Get LIVE Open-Meteo weather
        #
        # Uses the exact coordinates selected by the user.
        # ====================================================

        raw_data = get_dynamic_data(

            region=region,

            latitude=latitude,

            longitude=longitude

        )


        # ====================================================
        # 3. Get LIVE elevation
        #
        # Uses the exact selected coordinates.
        # ====================================================

        elevation = get_elevation(

            latitude,

            longitude

        )


        raw_data["elevation"] = elevation


        # ====================================================
        # 4. Get LIVE NASA GPM IMERG
        #
        # IMERG Early Half-Hourly
        #
        # Approximately 48 observations = 24 hours.
        # ====================================================

        satellite_data = (
            get_latest_24h_rainfall(

                latitude=latitude,

                longitude=longitude,

                end_date=raw_data.get(
                    "timestamp",
                    ""
                )[:10]

                if raw_data.get(
                    "timestamp"
                )

                else "2026-09-26"

            )
        )


        # ====================================================
        # 5. Get river / hydrological information
        #
        # No artificial river level is generated.
        # ====================================================

        river_data = get_river_data(

            region=region,

            latitude=latitude,

            longitude=longitude

        )


        # ====================================================
        # 6. Preprocess weather + terrain data
        # ====================================================

        data = preprocess_dynamic_data(

            raw_data

        )


        # ====================================================
        # 7. Extract prediction features
        # ====================================================

        open_meteo_rainfall = float(

            data["rainfall_24h"]

        )


        humidity = float(

            data["humidity"]

        )


        soil_moisture = float(

            data["soil_moisture"]

        )


        drainage_capacity = float(

            data["drainage_capacity"]

        )


        # ====================================================
        # 8. Extract NASA rainfall
        # ====================================================

        nasa_rainfall = (

            satellite_data.get(

                "rainfall_24h_mm"

            )

        )


        # ====================================================
        # 9. Fuse Open-Meteo + NASA rainfall
        #
        # Open-Meteo: 60%
        # NASA IMERG: 40%
        #
        # If NASA is unavailable,
        # Open-Meteo is used directly.
        # ====================================================

        rainfall = calculate_fused_rainfall(

            open_meteo_rainfall,

            nasa_rainfall

        )


        # ====================================================
        # 10. River level
        # ====================================================

        river_level = river_data.get(

            "river_level_m"

        )


        # ====================================================
        # The prediction engine requires
        # a numeric river value.
        #
        # 0.0 means no official observation
        # is currently available.
        # ====================================================

        if river_level is None:

            river_level_for_model = 0.0

        else:

            river_level_for_model = float(

                river_level

            )


        # ====================================================
        # 11. Calculate flood probability
        # ====================================================

        flood_probability = (

            calculate_flood_probability(

                rainfall,

                humidity,

                soil_moisture,

                river_level_for_model,

                drainage_capacity

            )

        )


        # ====================================================
        # 12. Calculate inundation area
        # ====================================================

        inundation_area = (

            calculate_inundation_area(

                flood_probability,

                rainfall,

                drainage_capacity

            )

        )


        # ====================================================
        # 13. Determine risk level
        # ====================================================

        risk_level = (

            determine_risk_level(

                flood_probability

            )

        )


        # ====================================================
        # 14. Calculate risk score
        # ====================================================

        risk_score = (

            calculate_risk_score(

                rainfall,

                flood_probability,

                river_level_for_model

            )

        )


        # ====================================================
        # 15. Calculate confidence
        # ====================================================

        confidence = (

            calculate_confidence(

                rainfall,

                humidity,

                soil_moisture

            )

        )


        # ====================================================
        # 16. Save prediction to SQLite
        # ====================================================

        prediction = Prediction(

            scenario_id=0,

            scenario_name=region,

            rainfall=rainfall,

            flood_probability=(

                flood_probability

            ),

            inundation_area=(

                inundation_area

            ),

            risk_level=risk_level,

            risk_score=risk_score,

            confidence=confidence,

            mode="DYNAMIC"

        )


        db.add(prediction)

        db.commit()

        db.refresh(prediction)


        # ====================================================
        # 17. Return complete result
        # ====================================================

        return {

            "success": True,

            "mode": "DYNAMIC",

            "region": region,

            "location": {

                "latitude": latitude,

                "longitude": longitude

            },


            # =================================================
            # DATA SOURCES
            # =================================================

            "data_sources": {

                # ---------------------------------------------
                # Weather
                # ---------------------------------------------

                "weather_provider": (

                    raw_data.get(

                        "provider",

                        "Open-Meteo"

                    )

                ),

                "weather_status": (

                    raw_data.get(

                        "provider_status",

                        "LIVE"

                    )

                ),


                # ---------------------------------------------
                # NASA
                # ---------------------------------------------

                "satellite_provider": (

                    satellite_data.get(

                        "provider",

                        "NASA GPM IMERG"

                    )

                ),

                "satellite_status": (

                    satellite_data.get(

                        "status",

                        "UNAVAILABLE"

                    )

                ),

                "satellite_product": (

                    satellite_data.get(

                        "product",

                        "IMERG Early Half-Hourly"

                    )

                ),

                "satellite_observations_used": (

                    satellite_data.get(

                        "observations_used",

                        0

                    )

                ),

                "satellite_latest_timestamp": (

                    satellite_data.get(

                        "latest_timestamp"

                    )

                ),

                "satellite_message": (

                    satellite_data.get(

                        "message"

                    )

                ),


                # ---------------------------------------------
                # Elevation
                # ---------------------------------------------

                "elevation_provider": (

                    "Open-Meteo Elevation"

                ),

                "elevation_status": "LIVE",


                # ---------------------------------------------
                # River
                # ---------------------------------------------

                "river_status": (

                    river_data.get(

                        "status",

                        "NOT_AVAILABLE"

                    )

                ),

                "river_message": (

                    river_data.get(

                        "message"

                    )

                )

            },


            # =================================================
            # MODEL FEATURES
            # =================================================

            "model_features": {

                "rainfall_source": (

                    "Open-Meteo + "

                    "NASA GPM IMERG "

                    "Early Half-Hourly"

                ),

                "rainfall_fusion": {

                    "open_meteo_weight": 0.60,

                    "nasa_gpm_weight": 0.40,

                    "nasa_available": (

                        nasa_rainfall

                        is not None

                    )

                }

            },


            # =================================================
            # ENVIRONMENT
            # =================================================

            "environment": {

                # ---------------------------------------------
                # Open-Meteo rainfall
                # ---------------------------------------------

                "open_meteo_rainfall_24h_mm": (

                    open_meteo_rainfall

                ),


                # ---------------------------------------------
                # NASA rainfall
                # ---------------------------------------------

                "satellite_rainfall_24h_mm": (

                    nasa_rainfall

                ),

                "satellite_rainfall_units": (

                    "mm"

                ),

                "satellite_observations_used": (

                    satellite_data.get(

                        "observations_used",

                        0

                    )

                ),

                "satellite_latest_timestamp": (

                    satellite_data.get(

                        "latest_timestamp"

                    )

                ),

                "satellite_grid_latitude": (

                    satellite_data.get(

                        "grid_latitude"

                    )

                ),

                "satellite_grid_longitude": (

                    satellite_data.get(

                        "grid_longitude"

                    )

                ),


                # ---------------------------------------------
                # Fused rainfall
                # ---------------------------------------------

                "fused_rainfall_24h_mm": rainfall,


                # ---------------------------------------------
                # Weather
                # ---------------------------------------------

                "humidity_percent": humidity,

                "temperature_c": data[

                    "temperature"

                ],

                "wind_speed_kmh": data[

                    "wind_speed"

                ],

                "soil_moisture_percent": (

                    soil_moisture

                ),


                # ---------------------------------------------
                # Elevation
                # ---------------------------------------------

                "elevation_m": elevation,


                # ---------------------------------------------
                # River
                # ---------------------------------------------

                "river_level_m": river_level,


                # ---------------------------------------------
                # Drainage
                # ---------------------------------------------

                "drainage_capacity": (

                    drainage_capacity

                )

            },


            # =================================================
            # DATABASE PREDICTION ID
            # =================================================

            "prediction_id": (

                prediction.prediction_id

            ),


            # =================================================
            # PREDICTION RESULTS
            # =================================================

            "prediction": {

                "rainfall_mm": rainfall,

                "flood_probability": (

                    flood_probability

                ),

                "inundation_area_km2": (

                    inundation_area

                ),

                "risk_level": risk_level,

                "risk_score": risk_score,

                "confidence": confidence

            }

        }


    # ========================================================
    # VALIDATION ERRORS
    # ========================================================

    except ValueError as error:

        db.rollback()

        raise HTTPException(

            status_code=400,

            detail=str(error)

        )


    # ========================================================
    # EXTERNAL PROVIDER ERRORS
    # ========================================================

    except RuntimeError as error:

        db.rollback()

        raise HTTPException(

            status_code=502,

            detail=str(error)

        )


    # ========================================================
    # UNEXPECTED ERRORS
    # ========================================================

    except Exception as error:

        db.rollback()

        raise HTTPException(

            status_code=500,

            detail=(

                "Dynamic prediction failed: "

                f"{str(error)}"

            )

        )