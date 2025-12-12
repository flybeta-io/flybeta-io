import pandas as pd
import numpy as np

# 1. Categorize rainfall intensity
def categorize_rain(mm: float) -> str:
    """Categorize rainfall intensity by mm."""
    if pd.isna(mm):
        return "none"

    if mm <= 0.2:
        return "none"
    elif mm <= 2.5:
        return "light"
    elif mm <= 7.6:
        return "moderate"
    elif mm <= 50.0:
        return "heavy"
    else:
        return "very_heavy"

# 2. Transform Weather Data for Serving
def transform_weather_data_serving(df: pd.DataFrame, logger) -> pd.DataFrame:
    """
    Clean, enrich, and engineer features from weather data for INFERENCE.
    This function is adapted for serving, ensuring no data leakage and handling
    potential missing columns or different data distributions.
    """
    df = df.copy()
    logger.info("Sorting data and handling outliers...")


    df = df.rename(
        columns={
            "icao_code": "airport_icao",
            "iata_code": "airport_iata",
            "datetime": "datetime",
            "visibility": "visibility_km",
            "precipitation": "precip_mm",
            "precipitation_probability": "precip_prob_pct",
            "wind_speed": "wind_speed_kmph",
            "wind_direction": "wind_dir_deg",
            "temperature": "temp_c",
            "humidity": "humidity_pct",
            "pressure": "pressure_mb",
            "cloud_cover": "cloud_cover_pct",
        }
    )


    # Ensure datetime format
    df["datetime"] = pd.to_datetime(df["datetime"])

    # Sort is critical for shift/rolling to work correctly
    df = df.sort_values(["airport_iata", "datetime"]).reset_index(drop=True)

    # Handle outliers BEFORE filling
    df.loc[df["wind_speed_kmph"] > 100, "wind_speed_kmph"] = np.nan

    logger.info("Forward-filling missing values using historical context...")


    if "airport_icao" in df.columns:
        df = df.groupby("airport_icao", group_keys=False).ffill()
    else:
        # Fallback if ICAO is missing
        df = df.groupby("airport_iata", group_keys=False).ffill()

    # Create Grouper for rolling ops
    grouped = df.groupby("airport_iata", group_keys=False)

    logger.info("Creating rolling and lag features...")
    # 1-hour lag
    df["wind_speed_prev1h"] = grouped["wind_speed_kmph"].shift(1)

    # 3-hour moving average
    df["wind_speed_3h_mean"] = (
        grouped["wind_speed_kmph"]
        .rolling(3, min_periods=1)
        .mean()
        .round(3)
        .reset_index(level=0, drop=True)
    )

    # 3-hour precip sum
    df["precip_3h_sum"] = (
        grouped["precip_mm"]
        .rolling(3, min_periods=1)
        .sum()
        .reset_index(level=0, drop=True)
    )

    # 3-hour visibility mean
    df["visibility_3h_mean"] = (
        grouped["visibility_km"]
        .rolling(3, min_periods=1)
        .mean()
        .round(3)
        .reset_index(level=0, drop=True)
    )

    logger.info("Deriving categorical and flag features...")
    # Fill NA before categorization to prevent errors, defaulting to 0/None
    df["precip_mm"] = df["precip_mm"].fillna(0)
    df["rain_intensity"] = df["precip_mm"].apply(categorize_rain)

    # Normalize wind direction
    df["wind_dir_deg"] = df["wind_dir_deg"] % 360

    # Compute wind vectors
    theta = np.deg2rad(df["wind_dir_deg"])
    df["wind_u"] = -df["wind_speed_kmph"] * np.sin(theta)
    df["wind_v"] = -df["wind_speed_kmph"] * np.cos(theta)

    # Flags
    df["low_visibility_flag"] = (df["visibility_km"] < 2).astype(int)
    df["high_wind_flag"] = (df["wind_speed_kmph"] > 50).astype(int)
    df["high_humidity_flag"] = (df["humidity_pct"] > 60).astype(int)

    logger.info("Weather data transformation complete.")
    return df
