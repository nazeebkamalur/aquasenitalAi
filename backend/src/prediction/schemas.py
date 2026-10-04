from pydantic import BaseModel


class PredictionRequest(BaseModel):

    scenario_id: int


class PredictionResult(BaseModel):

    scenario_id: int

    scenario_name: str

    predicted_rainfall_mm: float

    flood_probability: float

    inundation_area_km2: float

    risk_level: str

    confidence: float