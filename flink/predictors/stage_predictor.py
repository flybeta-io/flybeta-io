import json
import joblib
import asyncio
import aiohttp
import numpy as np
import pandas as pd
from typing import Dict, Any, List



# Load preprocessors
preprocessor1 = joblib.load("/opt/flink/preprocessors/stage1_preprocessor.joblib")
preprocessor2 = joblib.load("/opt/flink/preprocessors/stage2_preprocessor.joblib")

ML_API_STAGE1 = "http://ml:6000/predict"
ML_API_STAGE2 = "http://ml:6000/predict/stage2"


# -----------------------------
# API CALLER
# -----------------------------
async def call_api(url: str, data: Dict[str, Any]):
    """Call ML API with proper error handling"""
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(
                url,
                json=data,
                headers={"Content-Type": "application/json"},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as resp:
                response_text = await resp.text()

                if resp.status != 200:
                    print(f"[API ERROR] Status {resp.status}: {response_text}")
                    return {"error": f"HTTP {resp.status}", "detail": response_text}

                return await resp.json()
        except asyncio.TimeoutError:
            print(f"[API ERROR] Request timeout")
            return {"error": "Timeout"}
        except Exception as e:
            print(f"[API ERROR] {type(e).__name__}: {e}")
            return {"error": str(e)}

# -----------------------------
# HELPER: CLEAN VALUES
# -----------------------------
def clean_value(v):
    """Convert numpy/pandas types to native Python types for JSON serialization"""
    # Handle numpy types
    if isinstance(v, (np.integer, np.int64, np.int32)):
        return int(v)
    if isinstance(v, (np.floating, np.float64, np.float32)):
        # Convert to float and handle NaN/Inf
        val = float(v)
        if np.isnan(val) or np.isinf(val):
            return 0.0  # Replace NaN/Inf with 0
        return val
    if isinstance(v, np.bool_):
        return bool(v)
    if isinstance(v, np.ndarray):
        return v.tolist()

    # Handle pandas types
    if pd.isna(v):
        return 0.0  # Replace NaN with 0

    # Handle datetime
    if hasattr(v, "isoformat"):
        return v.isoformat()

    return v


# -----------------------------
# PREPARE PAYLOAD FOR API
# -----------------------------
def prepare_payload(transformed_df: pd.DataFrame, expected_cols: List[str]) -> Dict[str, Any]:
    """
    Convert transformed DataFrame to API-ready payload

    Args:
        transformed_df: DataFrame after preprocessing (single row)
        expected_cols: List of column names in correct order

    Returns:
        Dictionary ready for JSON serialization
    """
    # Get the single row as dict
    row_dict = transformed_df.iloc[0].to_dict()

    # Reorder according to expected columns
    ordered_dict = {}
    for col in expected_cols:
        if col in row_dict:
            ordered_dict[col] = clean_value(row_dict[col])
        else:
            print(f"[WARNING] Missing column '{col}', setting to 0.0")
            ordered_dict[col] = 0.0

    return ordered_dict


# -----------------------------
# MAIN PROCESSOR
# -----------------------------
async def process_record(
    payload: Dict[str, Any],
    expected_cols_stage1: List[str],
    expected_cols_stage2: List[str]
) -> Dict[str, Any]:
    """
    Process a single record through the 2-stage ML pipeline

    Args:
        payload: Raw flight/weather data dictionary
        expected_cols_stage1: Feature names for stage 1 model
        expected_cols_stage2: Feature names for stage 2 model

    Returns:
        Dictionary with prediction results
    """

    try:
        # -------------------------
        # 1. STAGE 1 PREPROCESSING
        # -------------------------
        # Convert to DataFrame (preprocessors expect DataFrames)
        payload_df = pd.DataFrame([payload])

        # Apply stage 1 preprocessing
        X1_transformed = preprocessor1.transform(payload_df)

        # Prepare API payload
        stage1_payload = prepare_payload(X1_transformed, expected_cols_stage1)

        # -------------------------
        # 2. STAGE 1 PREDICTION
        # -------------------------
        result1 = await call_api(ML_API_STAGE1, stage1_payload)

        # Check for errors
        if result1 is None or "error" in result1:
            return {
                "stage": 1,
                "error": "Stage 1 API failed",
                "stage1_raw": result1
            }

        # Check prediction result
        prediction_stage1 = result1.get("prediction")

        if prediction_stage1 == 0:
            # Flight predicted ON-TIME, no need for stage 2
            return {
                "stage": 1,
                "prediction": "ON_TIME",
                "confidence": "high",
                "stage1_raw": result1
            }

        # -------------------------
        # 3. STAGE 2 PREPROCESSING
        # -------------------------
        # Apply stage 2 preprocessing
        X2_transformed = preprocessor2.transform(payload_df)

        # Prepare API payload
        stage2_payload = prepare_payload(X2_transformed, expected_cols_stage2)

        # -------------------------
        # 4. STAGE 2 PREDICTION
        # -------------------------
        result2 = await call_api(ML_API_STAGE2, stage2_payload)

        # Check for errors
        if result2 is None or "error" in result2:
            return {
                "stage": 2,
                "error": "Stage 2 API failed",
                "stage1_raw": result1,
                "stage2_raw": result2
            }

        # Get final prediction from stage 2
        prediction_stage2 = result2.get("prediction_2")

        # Determine final prediction label
        if prediction_stage2 == 1:
            prediction_label = "DELAY"
        else:
            prediction_label = "ON_TIME"

        return {
            "stage": 2,
            "prediction": prediction_label,
            "stage1_raw": result1,
            "stage2_raw": result2
        }

    except Exception as e:
        print(f"[PROCESS ERROR] {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "error_type": type(e).__name__
        }
