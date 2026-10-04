from datetime import datetime


ALERT_RULES = {
    "MINIMAL": {
        "severity": "INFO",
        "title": "Minimal Flood Risk",
        "message": "Current conditions indicate minimal flood risk.",
    },
    "LOW": {
        "severity": "LOW",
        "title": "Low Flood Risk",
        "message": "Current conditions indicate a low flood risk.",
    },
    "MODERATE": {
        "severity": "MEDIUM",
        "title": "Moderate Flood Risk",
        "message": "Moderate flood risk detected. Monitor local conditions.",
    },
    "HIGH": {
        "severity": "HIGH",
        "title": "High Flood Risk",
        "message": "High flood risk detected. Authorities should monitor the affected area.",
    },
    "CRITICAL": {
        "severity": "CRITICAL",
        "title": "Critical Flood Risk",
        "message": "Critical flood risk detected. Immediate attention is required.",
    },
}


def generate_alert(
    prediction: dict,
    region: str = "Unknown"
):
    """
    Generate an alert from a prediction result.
    """

    risk_level = str(
        prediction.get(
            "risk_level",
            "MINIMAL"
        )
    ).upper()

    rule = ALERT_RULES.get(
        risk_level,
        ALERT_RULES["MINIMAL"]
    )

    flood_probability = float(
        prediction.get(
            "flood_probability",
            0
        )
    )

    rainfall = float(
        prediction.get(
            "rainfall_mm",
            prediction.get(
                "predicted_rainfall_mm",
                0
            )
        )
    )

    inundation_area = float(
        prediction.get(
            "inundation_area_km2",
            0
        )
    )

    return {
        "alert_id": (
            f"ALERT-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
        ),
        "timestamp": datetime.utcnow().isoformat(),
        "region": region,
        "risk_level": risk_level,
        "severity": rule["severity"],
        "title": rule["title"],
        "message": rule["message"],
        "flood_probability": flood_probability,
        "rainfall_mm": rainfall,
        "inundation_area_km2": inundation_area,
        "requires_immediate_attention": (
            risk_level == "CRITICAL"
        ),
    }


def should_send_alert(
    risk_level: str
) -> bool:
    """
    Decide whether an alert should be generated.
    """

    return str(
        risk_level
    ).upper() in {
        "MODERATE",
        "HIGH",
        "CRITICAL",
    }