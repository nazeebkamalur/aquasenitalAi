# ============================================================
# AQUASENTINEL AI
# SEEDED DATA
# ============================================================

SEEDED_SCENARIOS = [

    {
        "scenario_id": 1,
        "scenario_name": "Normal Rainfall",

        "rainfall_24h": 25.0,
        "humidity": 62.0,
        "temperature": 29.0,
        "wind_speed": 12.0,

        "soil_moisture": 35.0,
        "elevation": 540.0,

        "drainage_capacity": 85.0,
        "river_level": 32.0
    },

    {
        "scenario_id": 2,
        "scenario_name": "Heavy Rainfall",

        "rainfall_24h": 75.0,
        "humidity": 78.0,
        "temperature": 27.0,
        "wind_speed": 18.0,

        "soil_moisture": 52.0,
        "elevation": 520.0,

        "drainage_capacity": 65.0,
        "river_level": 48.0
    },

    {
        "scenario_id": 3,
        "scenario_name": "Very Heavy Rainfall",

        "rainfall_24h": 110.0,
        "humidity": 86.0,
        "temperature": 25.0,
        "wind_speed": 22.0,

        "soil_moisture": 68.0,
        "elevation": 500.0,

        "drainage_capacity": 50.0,
        "river_level": 61.0
    },

    {
        "scenario_id": 4,
        "scenario_name": "Extreme Rainfall",

        "rainfall_24h": 150.0,
        "humidity": 92.0,
        "temperature": 24.0,
        "wind_speed": 28.0,

        "soil_moisture": 82.0,
        "elevation": 480.0,

        "drainage_capacity": 35.0,
        "river_level": 78.0
    },

    {
        "scenario_id": 5,
        "scenario_name": "Cloudburst",

        "rainfall_24h": 220.0,
        "humidity": 96.0,
        "temperature": 23.0,
        "wind_speed": 35.0,

        "soil_moisture": 94.0,
        "elevation": 450.0,

        "drainage_capacity": 20.0,
        "river_level": 92.0
    }

]


def get_seeded_scenarios():

    return SEEDED_SCENARIOS


def get_seeded_scenario(
    scenario_id: int
):

    for scenario in SEEDED_SCENARIOS:

        if scenario["scenario_id"] == scenario_id:

            return scenario

    return None