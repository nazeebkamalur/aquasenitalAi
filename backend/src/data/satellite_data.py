from pathlib import Path
from typing import Optional

import numpy as np
import xarray as xr


# ============================================================
# BASE PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[3]

SATELLITE_DIR = (
    BASE_DIR
    / "data"
    / "satellite"
)

# ============================================================
# FIND LATEST IMERG FILE
# ============================================================

def find_latest_imerg_file() -> Optional[Path]:
    """
    Find the latest locally cached NASA GPM IMERG
    Early 1-Day NetCDF file.

    Expected filename format:

    3B-DAY-E.MS.MRG.3IMERG.YYYYMMDD-S000000-E235959.V07C.nc4
    """

    if not SATELLITE_DIR.exists():
        return None

    files = sorted(
        SATELLITE_DIR.glob(
            "3B-DAY-E.MS.MRG.3IMERG.*.nc4"
        )
    )

    if not files:
        return None

    return files[-1]


# ============================================================
# EXTRACT NASA GPM IMERG PRECIPITATION
# ============================================================

def extract_satellite_precipitation(
    latitude: float,
    longitude: float
):
    """
    Extract NASA GPM IMERG precipitation for
    the nearest satellite grid point.

    Parameters
    ----------
    latitude : float
        Selected region latitude.

    longitude : float
        Selected region longitude.

    Returns
    -------
    dict
        Satellite precipitation information.
    """

    # --------------------------------------------------------
    # Find latest cached satellite file
    # --------------------------------------------------------

    file_path = find_latest_imerg_file()

    if file_path is None:

        return {
            "provider": "NASA GPM IMERG",
            "status": "UNAVAILABLE",
            "product": "IMERG Early 1-Day",
            "precipitation_1d_mm": None,
            "grid_latitude": None,
            "grid_longitude": None,
            "dataset_date": None,
            "units": None,
            "file": None,
            "message": (
                "No cached NASA GPM IMERG "
                "NetCDF file was found."
            )
        }

    # --------------------------------------------------------
    # Open NetCDF file
    # --------------------------------------------------------

    try:

        with xr.open_dataset(file_path) as ds:

            # ------------------------------------------------
            # Check precipitation variable
            # ------------------------------------------------

            if "precipitation" not in ds:

                return {
                    "provider": "NASA GPM IMERG",
                    "status": "UNAVAILABLE",
                    "product": "IMERG Early 1-Day",
                    "precipitation_1d_mm": None,
                    "grid_latitude": None,
                    "grid_longitude": None,
                    "dataset_date": None,
                    "units": None,
                    "file": file_path.name,
                    "message": (
                        "The precipitation variable "
                        "was not found in the IMERG file."
                    )
                }

            precipitation = ds["precipitation"]

            # ------------------------------------------------
            # Extract nearest grid point
            #
            # IMPORTANT:
            # Use latitude/longitude labels instead of
            # manually calculating array indexes.
            # ------------------------------------------------

            selected = precipitation.sel(
                lat=latitude,
                lon=longitude,
                method="nearest"
            )

            # Remove time dimension if present
            selected = selected.squeeze()

            value = selected.item()

            # ------------------------------------------------
            # Read variable attributes
            # ------------------------------------------------

            attrs = precipitation.attrs

            units = attrs.get("units")

            fill_value = attrs.get(
                "_FillValue"
            )

            # ------------------------------------------------
            # Check missing/fill value
            # ------------------------------------------------

            if fill_value is not None:

                try:

                    if np.isclose(
                        value,
                        fill_value
                    ):
                        value = None

                except (TypeError, ValueError):
                    pass

            # ------------------------------------------------
            # Check NaN / invalid value
            # ------------------------------------------------

            if value is not None:

                try:

                    value = float(value)

                    if not np.isfinite(value):
                        value = None

                except (
                    TypeError,
                    ValueError
                ):

                    value = None

            # ------------------------------------------------
            # Get actual satellite grid coordinates
            # ------------------------------------------------

            grid_latitude = float(
                selected["lat"].item()
            )

            grid_longitude = float(
                selected["lon"].item()
            )

            # ------------------------------------------------
            # Dataset date
            # ------------------------------------------------

            dataset_date = ds.attrs.get(
                "BeginDate"
            )

            # ------------------------------------------------
            # Return successful result
            # ------------------------------------------------

            return {
                "provider": "NASA GPM IMERG",
                "status": "LIVE",
                "product": "IMERG Early 1-Day",
                "precipitation_1d_mm": value,
                "grid_latitude": grid_latitude,
                "grid_longitude": grid_longitude,
                "dataset_date": dataset_date,
                "units": units,
                "file": file_path.name,
                "message": (
                    "NASA GPM IMERG precipitation "
                    "extracted successfully."
                )
            }

    # --------------------------------------------------------
    # Handle unexpected errors
    # --------------------------------------------------------

    except Exception as error:

        return {
            "provider": "NASA GPM IMERG",
            "status": "ERROR",
            "product": "IMERG Early 1-Day",
            "precipitation_1d_mm": None,
            "grid_latitude": None,
            "grid_longitude": None,
            "dataset_date": None,
            "units": None,
            "file": file_path.name,
            "message": str(error)
        }


# ============================================================
# TEST / HEALTH INFORMATION
# ============================================================

def get_satellite_status():
    """
    Return information about the locally available
    NASA GPM IMERG dataset.
    """

    file_path = find_latest_imerg_file()

    if file_path is None:

        return {
            "provider": "NASA GPM IMERG",
            "status": "UNAVAILABLE",
            "product": "IMERG Early 1-Day",
            "file": None,
            "message": (
                "No IMERG satellite file is currently "
                "available in the satellite data directory."
            )
        }

    return {
        "provider": "NASA GPM IMERG",
        "status": "AVAILABLE",
        "product": "IMERG Early 1-Day",
        "file": file_path.name,
        "path": str(file_path),
        "message": (
            "Latest locally cached IMERG "
            "satellite dataset is available."
        )
    }