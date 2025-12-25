import json
import os
from kafka import KafkaProducer, KafkaConsumer
from pyflink.table import StreamTableEnvironment
from dotenv import load_dotenv
from job.settings import FLAG_PATH


BOOTSTRAP = "kafka:9092"
# FLAG_PATH = os.getenv("FLAG_PATH")


# -------------------------
# Producer
# -------------------------
def get_producer():
    return KafkaProducer(
        bootstrap_servers=BOOTSTRAP,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda v: v.encode("utf-8") if v else None
    )


# -------------------------
# Consumer
# -------------------------
def get_consumer(topic, group_id="flink-consumer"):
    return KafkaConsumer(
        topic,
        bootstrap_servers=BOOTSTRAP,
        group_id=group_id,
        auto_offset_reset="latest",
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
    )


# -------------------------
# Send helper
# -------------------------
# def send_message(producer, topic, message, key=None):
#     producer.send(topic, key=key, value=message)
#     producer.flush()



# -------------------------
# Read batch timestamp from flag
# -------------------------
def get_batch_timestamp(buffer_minutes=2):
    """
    Read the batch timestamp from the flag file.
    Returns timestamp in milliseconds with a buffer applied.

    Args:
        buffer_minutes: Minutes to subtract from timestamp (default 2)

    Returns:
        int: Timestamp in milliseconds (with buffer), or None if file not found
    """
    try:
        if not os.path.exists(FLAG_PATH):
            print(f"[WARNING] Flag file not found at {FLAG_PATH}")
            return None

        with open(FLAG_PATH, "r") as f:
            batch_timestamp = int(f.read().strip())

        # Apply buffer (subtract minutes to catch messages slightly before timestamp)
        buffer_ms = buffer_minutes * 60 * 1000
        start_timestamp = batch_timestamp - buffer_ms

        print(f"[INFO] Batch timestamp: {batch_timestamp}")
        print(
            f"[INFO] Reading from: {start_timestamp} (with {buffer_minutes}min buffer)"
        )

        return start_timestamp

    except (ValueError, IOError) as e:
        print(f"[ERROR] Could not read timestamp from flag: {e}")
        return None


# -------------------------
# Flink Kafka Table Source
# -------------------------
def flink_read(t_env: StreamTableEnvironment, topic, group_id="flink-batch-consumer"):

    """
    Create a Kafka source table using SQL DDL (modern PyFlink approach)
    """
    table_name = f"{topic}_table"

    # Get batch timestamp from flag file
    start_timestamp = get_batch_timestamp(buffer_minutes=2)

    if start_timestamp is not None:
        startup_config = f"""
            'scan.startup.mode' = 'timestamp',
            'scan.startup.timestamp-millis' = '{start_timestamp}'
        """
        print(f"[INFO] Topic '{topic}': Reading from timestamp {start_timestamp}")
    else:
        # Fallback: read from earliest if no timestamp available
        startup_config = "'scan.startup.mode' = 'earliest-offset'"
        print(f"[WARNING] Topic '{topic}': No timestamp found, reading from earliest")

    # Create Kafka source table with SQL DDL
    kafka_ddl = f"""
        CREATE TABLE {table_name} (
            `data` STRING
        ) WITH (
            'connector' = 'kafka',
            'topic' = '{topic}',
            'properties.bootstrap.servers' = '{BOOTSTRAP}',
            'properties.group.id' = '{group_id}',
            'format' = 'raw',
            {startup_config},
            'scan.bounded.mode' = 'latest-offset'
        )
    """

    t_env.execute_sql(kafka_ddl)
    return t_env.from_path(f"{topic}_table")
