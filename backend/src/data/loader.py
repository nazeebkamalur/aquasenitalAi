# ============================================================
# AQUASENTINEL AI
# DATA LOADER
# ============================================================

from src.data.seeded_data import (
    get_seeded_scenarios,
    get_seeded_scenario
)


def load_seeded_data():

    return get_seeded_scenarios()


def load_scenario(
    scenario_id: int
):

    scenario = get_seeded_scenario(
        scenario_id
    )

    if scenario is None:

        raise ValueError(
            f"Scenario {scenario_id} not found"
        )

    return scenario