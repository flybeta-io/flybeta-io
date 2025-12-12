import json
import pandas as pd
from utils.logger import get_logger

logger = get_logger("FLINK_UTILS")

def flatten_json_column(df):
    """
    Flatten a nested JSON column in a DataFrame if it exists.

    Args:
        df (pd.DataFrame): Input DataFrame

    Returns:
        pd.DataFrame: DataFrame with flattened JSON column

    """

    if "data" in df.columns:
        logger.info("Flattening 'data' column...")

        # Convert JSON string to list of dicts if necessary
        if isinstance(df["data"].iloc[0], str):
            df["data"] = df["data"].apply(json.loads)

        # Explode the list so each dict becomes its own row
        df = df.explode("data")

        # Flatten each dict into columns
        df = pd.json_normalize(df["data"])

    elif "value" in df.columns:
        logger.info("Flattening 'value' column...")
        if isinstance(df["value"].iloc[0], str):
            df["value"] = df["value"].apply(json.loads)
        df = df.explode("value")
        df = pd.json_normalize(df["value"])

    elif "f0" in df.columns:
        logger.info("Flattening 'f0' column...")
        df = pd.json_normalize(df["f0"])

    return df
