import pandas as pd
from typing import cast

# --- TRANSFORMATIONS (Use for Serving) ---

def convert_to_datetime(df: pd.DataFrame, logger) -> pd.DataFrame:
    """
    Convert relevant columns to datetime.
    For serving, we do NOT have actual_dep_time, so we handle it accordingly.
    """
    df = df.copy()
    logger.info("Converting datetime columns...")

    cols_to_convert = ["sched_dep_time", "sched_arr_time"]

    for col in cols_to_convert:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce")

    logger.info("Sorting by scheduled departure time...")
    df = df.sort_values("sched_dep_time").reset_index(drop=True)
    return df

def clean_airlines(df: pd.DataFrame, logger) -> pd.DataFrame:
    """
    Remove private and charter airlines.
    CRITICAL: This filters the rows to predict on.
    """
    df = df.copy()
    logger.info("Cleaning airline names...")
    exclude = ["PRIVATE OWNER", "ANAP JETS"]
    mask = ~df["airline_name"].isin(exclude)
    df = cast(pd.DataFrame, df.loc[mask, :]).reset_index(drop=True)
    logger.info(f"Removed private/charter airlines. Remaining: {df.shape[0]:,} records.")
    return df

# List of Nigerian airport IATA codes
NG_AIRPORTS = {
    "ABV",    "PHC",    "KAN",    "BNI",    "IBA",    "QRW",    "KAD",
    "MIU",    "ABB",    "ENU",    "ILR",    "GMO",    "MDI",    "QUO",
    "MXJ",    "DKA",    "SKO",    "YOL",    "AKR",    "PHG",    "JOS",
    "QOW",    "BCU",    "ZAR",    "LOS",    "CBQ",
}


def select_ng_airports(df: pd.DataFrame, logger) -> pd.DataFrame:
    """Filter to only Nigerian airports."""
    logger.info(f"Filtering {df.shape[0]:,} records to Nigerian airports...")

    mask = df["originIata"].isin(NG_AIRPORTS) & df["destIata"].isin(NG_AIRPORTS)

    df = cast(pd.DataFrame, df.loc[mask, :].reset_index(drop=True))
    logger.info(f"Filtered to Nigerian airports. ({df.shape[0]:,} records left)")
    return df

def remove_same_origin_destination(df: pd.DataFrame, logger) -> pd.DataFrame:
    """Remove records where origin and destination airports are the same."""
    logger.info("Removing records with same origin and destination airports...")
    mask = df["originIata"] == df["destIata"]
    removed = int(mask.sum())
    df = cast(pd.DataFrame, df.loc[~mask, :].reset_index(drop=True))
    logger.info(f"Removed {removed} records with same origin and destination.")
    return df

def add_time_features(df: pd.DataFrame, logger) -> pd.DataFrame:
    """Add time-based features (derived only from SCHEDULED time)."""
    logger.info("Adding time-based features...")

    # Ensure sched_dep_time is not null before processing
    df = df.dropna(subset=["sched_dep_time"]).reset_index(drop=True)

    month_order = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December']
    dow_order = ['Monday', 'Tuesday', 'Wednesday',
                 'Thursday', 'Friday', 'Saturday', 'Sunday']

    df["sched_dep_dow"] = df["sched_dep_time"].dt.day_name()
    df["sched_dep_month"] = df["sched_dep_time"].dt.month_name()

    df['sched_dep_month'] = pd.Categorical(df['sched_dep_month'], categories=month_order, ordered=True)
    df['sched_dep_dow'] = pd.Categorical(df['sched_dep_dow'], categories=dow_order, ordered=True)

    df["sched_dep_hour"] = df["sched_dep_time"].dt.hour
    df["sched_dep_time_block"] = pd.cut(
            df["sched_dep_hour"],
            bins=[0, 5, 11, 17, 23],
            labels=["Night", "Morning", "Afternoon", "Evening"]
        )
    return df

def drop_unnecessary_columns_serving(df: pd.DataFrame, logger) -> pd.DataFrame:
    """
    Drop columns not needed for inference.
    """
    logger.info("Dropping unnecessary columns for serving...")
    possible_artifacts = ["status", "delay", "actual_dep_time"]
    df = df.drop(columns=[c for c in possible_artifacts if c in df.columns], errors='ignore')
    return df

# --- PIPELINE RUNNER ---

def transform_flights_data_serving(df: pd.DataFrame, logger) -> pd.DataFrame:
    """
    Runs the BATCH SERVING data transformation pipeline.
    Excludes label generation and ground-truth filtering.
    """
    logger.info("--- Starting Flight Data Transformation (SERVING) ---")

    df = df.rename(
        columns={
            "flightID": "flight_id",
            "airlineName": "airline_name",
            "airlineIataCode": "airline_iata_code",
            "scheduledDepartureTime": "sched_dep_time",
            "acutalDepartureTime": "actual_dep_time",
            "scheduledArrivalTime": "sched_arr_time",
            "originAirportIata": "originIata",
            "destinationAirportIata": "destIata",
            "airlineIcaoCode": "airline_icao_Code",
        }
    )

    # 1. Convert Types
    df = convert_to_datetime(df, logger)

    # 2. Clean Airlines
    df = clean_airlines(df, logger)

    df = select_ng_airports(df, logger)

    # 3. Remove Same Origin/Destination
    df = remove_same_origin_destination(df, logger)

    # 4. Add Features
    df = add_time_features(df, logger)

    # 5. Drop Columns
    df = drop_unnecessary_columns_serving(df, logger)

    df = df.reset_index(drop=True)
    logger.info("--- Flight Data Serving Transformation Complete ---")

    return df
