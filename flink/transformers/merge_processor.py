import pandas as pd
from utils.logger import get_logger

logger = get_logger("MERGE_PROCESSOR")

def create_route(df: pd.DataFrame, logger) -> pd.DataFrame:
    """Combines origin and dest to create route"""
    logger.info("Creating route column...")

    df["route"] = df["originIata"] + "-" + df["destIata"]
    return df


def merge_weather_forecast_serving(
    flights_df: pd.DataFrame,
    weather_df: pd.DataFrame,
    logger
) -> pd.DataFrame:
    """
    Merges flight data with a SINGLE forecast weather table.

    1. Origin Weather      -> Joined on Scheduled Departure Time
    2. Destination Weather -> Joined on Scheduled Arrival Time
    """

    # --- 1. PREPARATION ---
    logger.info("Preparing data for forecast merge...")

    # Ensure Datetime Types
    flights_df['sched_dep_time'] = pd.to_datetime(flights_df['sched_dep_time'], errors='coerce')
    flights_df['sched_arr_time'] = pd.to_datetime(flights_df['sched_arr_time'], errors='coerce')
    weather_df['datetime'] = pd.to_datetime(weather_df['datetime'], errors='coerce')

    # Sort for merge_asof (Required)
    weather_df = weather_df.sort_values('datetime')
    flights_df = flights_df.sort_values('sched_dep_time')

    # --- 2. ORIGIN MERGE (Departure Time) ---
    logger.info("Merging ORIGIN weather (using Departure Time)...")

    flights_with_origin = pd.merge_asof(
        flights_df,
        weather_df.rename(columns=lambda x: f"origin_{x}" if x not in ['datetime', 'airport_iata'] else x),
        left_on='sched_dep_time',
        right_on='datetime',
        left_by='originIata',
        right_by='airport_iata',
        direction='nearest',
        tolerance=pd.Timedelta('2h')
    )

    # --- 3. DESTINATION MERGE (Arrival Time) ---
    logger.info("Merging DESTINATION weather (using Arrival Time)...")

    flights_with_origin = flights_with_origin.sort_values('sched_arr_time')

    flights_with_both = pd.merge_asof(
        flights_with_origin,
        weather_df.rename(columns=lambda x: f"dest_{x}" if x not in ['datetime', 'airport_iata'] else x),
        left_on='sched_arr_time',
        right_on='datetime',
        left_by='destIata',
        right_by='airport_iata',
        direction='nearest',
        tolerance=pd.Timedelta('2h')
    )

    merged_data = flights_with_both.copy()

    # --- 4. CLEANUP ---
    logger.info("Dropping redundant columns...")
    drop_cols = ['airport_iata_x', 'airport_iata_y', 'datetime_x', 'datetime_y']
    merged_data = merged_data.drop(columns=[c for c in drop_cols if c in merged_data.columns])

    merged_data["unique_key"] = (
        merged_data["airline_iata_code"].astype(str)
        + "_"
        + merged_data["sched_dep_time"].dt.strftime("%Y-%m-%d")
        + "_"
        + merged_data["originIata"].astype(str)
        + "_"
        + merged_data["destIata"].astype(str)
    )

    merged_data = create_route(merged_data, logger)

    logger.info(f"Final merged dataset shape: {merged_data.shape}")

    return merged_data
