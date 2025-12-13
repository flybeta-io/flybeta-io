import json
import asyncio
import pandas as pd
import httpx

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment, EnvironmentSettings

from utils.kafka_utils import flink_read, get_producer
from utils.flink_utils import flatten_json_column
from utils.logger import get_logger

from transformers.flight_topic_processor import transform_flights_data_serving
from transformers.weather_topic_processor import transform_weather_data_serving
from transformers.merge_processor import merge_weather_forecast_serving
from transformers.custom_transformers import (
    DelayMinSmoother,
    FeatureEngineeringTransformer,
    OrdinalEncoderTransformer,
)

from predictors.stage_predictor import process_record

from settings import WEATHER_TOPIC, FLIGHT_TOPIC, PREDICTION_TOPIC, feature_order

semaphore = asyncio.Semaphore(10)

async def safe_process_record(payload, expected_cols_stage1, expected_cols_stage2, retries=2):
    """Call process_record safely with concurrency limit and retry on failure."""
    for attempt in range(retries + 1):
        try:
            async with semaphore:
                return await process_record(
                    payload,
                    expected_cols_stage1=expected_cols_stage1,
                    expected_cols_stage2=expected_cols_stage2,
                )
        except httpx.RequestError as e:  # timeout or network errors
            if attempt == retries:
                raise
            await asyncio.sleep(1.5)  # brief delay before retry


# ==================================================
#   FLINK MAIN PIPELINE
# ==================================================


async def run_pipeline():
    logger = get_logger("FLINK")

    # -----------------------------
    #  FLINK ENV (IN BATCH MODE)
    # -----------------------------
    env = StreamExecutionEnvironment.get_execution_environment()
    settings = EnvironmentSettings.new_instance().in_streaming_mode().build()
    t_env = StreamTableEnvironment.create(env, environment_settings=settings)

    logger.info("Starting Flink Job...")

    # -----------------------------
    #  READ BOTH TOPICS
    # -----------------------------
    weather_tbl = flink_read(t_env, WEATHER_TOPIC)
    flight_tbl = flink_read(t_env, FLIGHT_TOPIC)

    # Convert Table → Pandas
    weather_pdf = weather_tbl.to_pandas()
    flight_pdf = flight_tbl.to_pandas()

    logger.info(f"Weather topic rows: {len(weather_pdf)}")
    logger.info(f"Flight topic rows: {len(flight_pdf)}")


    if weather_pdf.empty or flight_pdf.empty:
        logger.warning("One or both topics returned no data. Skipping processing.")
        return

    # Flatten JSON columns if needed
    weather_pdf = flatten_json_column(weather_pdf)
    flight_pdf = flatten_json_column(flight_pdf)

    # -----------------------------
    #  APPLY TRANSFORMERS
    # -----------------------------
    logger.info("Transforming WEATHER data...")
    weather_df = transform_weather_data_serving(weather_pdf, logger)

    logger.info("Transforming FLIGHT data...")
    flights_df = transform_flights_data_serving(flight_pdf, logger)

    # Merge
    merged_df = merge_weather_forecast_serving(flights_df, weather_df, logger)


    # -----------------------------
    #  RUN ML PREDICTIONS
    # -----------------------------

    logger.info("Running ML predictions and writing to Kafka...")

    producer = get_producer()

    coros = []
    rows = []
    for _, row in merged_df.iterrows():
        payload = row.to_dict()

        unique_key = row["unique_key"]

        rows.append({"unique_key": unique_key})

        coros.append(
            safe_process_record(
                payload,
                expected_cols_stage1=feature_order,
                expected_cols_stage2=feature_order,
            )
        )


    # Run all ML predictions concurrently
    results = await asyncio.gather(*coros)

    logger.info(f"Writing prediction results to Kafka {PREDICTION_TOPIC}...")

    success_count = 0
    error_count = 0

    for meta, result in zip(rows, results):
        message = {
            "unique_key": meta["unique_key"],
            "prediction_result": result,
            "timestamp": pd.Timestamp.now().isoformat()
        }
        # send_message(producer, PREDICTION_TOPIC, message)
        try:
            producer.send(PREDICTION_TOPIC, value=message)

            # Track success/errors
            if "error" not in result:
                success_count += 1
            else:
                error_count += 1
                print(f"[ERROR] {meta['unique_key']}: {result.get('error')}")

        except Exception as e:
            error_count += 1
            print(f"[KAFKA ERROR] Failed to send {meta['unique_key']}: {e}")

    logger.info("Finished sending predictions.")

    producer.flush()
    producer.close()

    print(f"\n[BATCH] Complete:")
    print(f"  ✓ Success: {success_count}")
    print(f"  ✗ Errors: {error_count}")
    print(f"  Total: {len(results)}")

    logger.info("Flink Job completed successfully.")


if __name__ == "__main__":
    asyncio.run(run_pipeline())
