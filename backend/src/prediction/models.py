from datetime import datetime

from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Float
from sqlalchemy import Integer
from sqlalchemy import String

from src.database.db import Base


class Prediction(Base):
    __tablename__ = "predictions"

    prediction_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    scenario_id = Column(
        Integer,
        nullable=False
    )

    scenario_name = Column(
        String(100),
        nullable=False
    )

    rainfall = Column(
        Float,
        nullable=False
    )

    flood_probability = Column(
        Float,
        nullable=False
    )

    inundation_area = Column(
        Float,
        nullable=False
    )

    risk_level = Column(
        String(20),
        nullable=False
    )

    risk_score = Column(
        Float,
        nullable=False
    )

    confidence = Column(
        Float,
        nullable=False
    )

    mode = Column(
        String(20),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )