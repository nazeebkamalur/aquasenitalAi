from pathlib import Path
from datetime import datetime, timedelta
import os
import re

import h5py
import numpy as np
import requests
from dotenv import load_dotenv


# ---------------------------------------------------------
# ENVIRONMENT
# ---------------------------------------------------------

load_dotenv()

NASA_TOKEN = os.getenv(
    "NASA_EARTHDATA_TOKEN"
)


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

BASE_DIR = (
    Path(__file__)
    .resolve()
    .parents[3]
)

SATELLITE_DIR = (
    BASE_DIR
    / "data"
    / "satellite"
    / "half_hourly"
)

SATELLITE_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# ---------------------------------------------------------
# NASA URLS
# ---------------------------------------------------------

CMR_BASE_URL = (
    "https://cmr.earthdata.nasa.gov"
)

DATA_BASE_URL = (
    "https://data.gesdisc.earthdata.nasa.gov"
)


# ---------------------------------------------------------
# GET NASA IMERG FILES
# ---------------------------------------------------------

def get_cmr_files(
    date_string: str
):
    """
    Get all NASA GPM IMERG Early
    half-hourly files for a UTC date.

    NASA organizes the temporal directory
    using year/month/day.
    """

    date_obj = datetime.strptime(
        date_string,
        "%Y-%m-%d"
    )

    year = date_obj.strftime("%Y")
    month = date_obj.strftime("%m")
    day = date_obj.strftime("%d")

    url = (
        f"{CMR_BASE_URL}/virtual-directory/"
        f"collections/C2723758340-GES_DISC/"
        f"temporal/{year}/{month}/{day}"
    )

    response = requests.get(
        url,
        timeout=30
    )

    response.raise_for_status()

    html = response.text

    pattern = re.compile(
        r'https://data\.gesdisc\.earthdata\.nasa\.gov'
        r'/data/GPM_L3/GPM_3IMERGHHE\.07/'
        r'[^"]+\.HDF5'
    )

    files = pattern.findall(
        html
    )

    return sorted(
        set(files)
    )


# ---------------------------------------------------------
# DOWNLOAD NASA FILE
# ---------------------------------------------------------

def download_file(
    url: str
):
    """
    Download one NASA IMERG
    half-hourly HDF5 file.

    Already downloaded files are reused.
    """

    filename = url.split("/")[-1]

    output_path = (
        SATELLITE_DIR
        / filename
    )

    if output_path.exists():
        return output_path

    if not NASA_TOKEN:
        raise RuntimeError(
            "NASA_EARTHDATA_TOKEN is not configured."
        )

    headers = {
        "Authorization": (
            f"Bearer {NASA_TOKEN}"
        )
    }

    response = requests.get(
        url,
        headers=headers,
        timeout=120
    )

    response.raise_for_status()

    output_path.write_bytes(
        response.content
    )

    return output_path


# ---------------------------------------------------------
# EXTRACT PRECIPITATION
# ---------------------------------------------------------

def extract_precipitation(
    file_path: Path,
    latitude: float,
    longitude: float
):
    """
    Extract NASA IMERG precipitation
    at the nearest 0.1-degree grid cell.

    NASA HDF5 structure:

        precipitation:
        (time, longitude, latitude)

    Example:

        (1, 3600, 1800)
    """

    with h5py.File(
        file_path,
        "r"
    ) as hdf:

        grid = hdf["Grid"]

        precipitation = (
            grid["precipitation"][:]
        )

        latitudes = (
            grid["lat"][:]
        )

        longitudes = (
            grid["lon"][:]
        )

        # ---------------------------------------------
        # Find nearest latitude
        # ---------------------------------------------

        lat_index = int(
            np.abs(
                latitudes - latitude
            ).argmin()
        )

        # ---------------------------------------------
        # Find nearest longitude
        # ---------------------------------------------

        lon_index = int(
            np.abs(
                longitudes - longitude
            ).argmin()
        )

        # ---------------------------------------------
        # NASA precipitation shape:
        #
        # (time, longitude, latitude)
        #
        # Therefore:
        #
        # precipitation[
        #     0,
        #     lon_index,
        #     lat_index
        # ]
        # ---------------------------------------------

        value = float(
            precipitation[
                0,
                lon_index,
                lat_index
            ]
        )

        # ---------------------------------------------
        # Invalid / missing value
        # ---------------------------------------------

        if value < 0:
            return None

        grid_latitude = float(
            latitudes[
                lat_index
            ]
        )

        grid_longitude = float(
            longitudes[
                lon_index
            ]
        )

        return {
            "precipitation_mm_hr": value,
            "grid_latitude": grid_latitude,
            "grid_longitude": grid_longitude
        }


# ---------------------------------------------------------
# GET LATEST 24-HOUR RAINFALL
# ---------------------------------------------------------

def get_latest_24h_rainfall(
    latitude: float,
    longitude: float,
    end_date: str
):
    """
    Calculate 24-hour rainfall using
    NASA GPM IMERG Early half-hourly data.

    Each observation represents 30 minutes.

    Therefore:

        rainfall_mm =
            precipitation_mm_hr * 0.5

    For 48 observations:

        48 × 30 minutes = 24 hours
    """

    end = datetime.strptime(
        end_date,
        "%Y-%m-%d"
    )

    # -----------------------------------------------------
    # We need two dates because a 24-hour window can cross
    # midnight.
    # -----------------------------------------------------

    dates = {
        (
            end - timedelta(days=i)
        ).strftime("%Y-%m-%d")
        for i in range(2)
    }

    all_files = []

    # -----------------------------------------------------
    # Get NASA files for both dates
    # -----------------------------------------------------

    for date_string in sorted(
        dates
    ):

        try:

            urls = get_cmr_files(
                date_string
            )

            all_files.extend(
                urls
            )

        except Exception as error:

            print(
                f"NASA CMR error for "
                f"{date_string}: {error}"
            )

    # -----------------------------------------------------
    # Remove duplicate URLs
    # -----------------------------------------------------

    all_files = sorted(
        set(all_files)
    )

    if not all_files:

        return {
            "provider": "NASA GPM IMERG",
            "product": (
                "IMERG Early Half-Hourly"
            ),
            "status": "UNAVAILABLE",
            "observations_used": 0,
            "rainfall_24h_mm": 0.0,
            "latest_timestamp": None,
            "grid_latitude": None,
            "grid_longitude": None,
            "message": (
                "No NASA IMERG half-hourly "
                "files were found."
            )
        }

    observations = []

    # -----------------------------------------------------
    # Process every NASA granule
    # -----------------------------------------------------

    for url in all_files:

        filename = (
            url.split("/")[-1]
        )

        # Example:
        #
        # 3B-HHR-E.MS.MRG.3IMERG.
        # 20260926-S123000-
        # E125959.0750.V07C.HDF5
        #
        match = re.search(
            r"3IMERG\.(\d{8})-S(\d{6})",
            filename
        )

        if not match:
            continue

        date_part = match.group(1)

        time_part = match.group(2)

        try:

            timestamp = datetime.strptime(
                date_part + time_part,
                "%Y%m%d%H%M%S"
            )

        except ValueError:

            continue

        # -------------------------------------------------
        # Download file
        # -------------------------------------------------

        try:

            file_path = download_file(
                url
            )

        except Exception as error:

            print(
                f"NASA download error "
                f"for {filename}: {error}"
            )

            continue

        # -------------------------------------------------
        # Extract precipitation
        # -------------------------------------------------

        try:

            result = (
                extract_precipitation(
                    file_path,
                    latitude,
                    longitude
                )
            )

        except Exception as error:

            print(
                f"NASA extraction error "
                f"for {filename}: {error}"
            )

            continue

        if result is None:
            continue

        observations.append(
            {
                "timestamp": timestamp,
                **result
            }
        )

    # -----------------------------------------------------
    # Sort observations chronologically
    # -----------------------------------------------------

    observations = sorted(
        observations,
        key=lambda item:
        item["timestamp"]
    )

    # -----------------------------------------------------
    # No valid observations
    # -----------------------------------------------------

    if not observations:

        return {
            "provider": "NASA GPM IMERG",
            "product": (
                "IMERG Early Half-Hourly"
            ),
            "status": "UNAVAILABLE",
            "observations_used": 0,
            "rainfall_24h_mm": 0.0,
            "latest_timestamp": None,
            "grid_latitude": None,
            "grid_longitude": None,
            "message": (
                "NASA IMERG files were found, "
                "but no valid precipitation "
                "observations could be extracted."
            )
        }

    # -----------------------------------------------------
    # Use the latest observation as the end of the
    # 24-hour window.
    # -----------------------------------------------------

    latest_timestamp = (
        observations[-1]["timestamp"]
    )

    cutoff = (
        latest_timestamp
        - timedelta(hours=24)
    )

    observations = [
        item
        for item in observations
        if (
            item["timestamp"]
            >= cutoff
        )
    ]

    # -----------------------------------------------------
    # Calculate rainfall accumulation
    #
    # IMERG precipitation is mm/hour.
    #
    # Each file represents 30 minutes.
    #
    # Therefore:
    #
    # mm/hour × 0.5 hour = mm
    # -----------------------------------------------------

    rainfall_mm = sum(
        item[
            "precipitation_mm_hr"
        ] * 0.5
        for item in observations
    )

    # -----------------------------------------------------
    # Latest valid observation
    # -----------------------------------------------------

    latest = observations[-1]

    # -----------------------------------------------------
    # Return result
    # -----------------------------------------------------

    return {
        "provider": "NASA GPM IMERG",
        "product": (
            "IMERG Early Half-Hourly"
        ),
        "status": "LIVE",
        "observations_used": len(
            observations
        ),
        "rainfall_24h_mm": round(
            rainfall_mm,
            2
        ),
        "latest_timestamp": (
            latest[
                "timestamp"
            ].isoformat()
        ),
        "grid_latitude": (
            latest[
                "grid_latitude"
            ]
        ),
        "grid_longitude": (
            latest[
                "grid_longitude"
            ]
        ),
        "message": (
            "NASA GPM IMERG Early "
            "half-hourly rainfall "
            "was extracted successfully."
        )
    }