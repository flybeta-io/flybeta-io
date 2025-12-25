import os
import time
import subprocess
from settings import FLAG_PATH

FLINK_JOB_PATH = "/opt/flink/job/flink_job.py"
INTERVAL = 10       #10 seconds


def watch_and_trigger():
    print("Watching for Kafka completion flag...")
    while True:
        # print("Watching for Kafka completion flag...")
        if os.path.exists(FLAG_PATH):
            print("\n\n\nFlag detected. Triggering Flink batch job...")

            subprocess.run(["/opt/flink/venv/bin/python3", FLINK_JOB_PATH])


            os.remove(FLAG_PATH)  # clean up
            print("Flink job finished and flag removed.")
        time.sleep(INTERVAL)  # check every 10 seconds


if __name__ == "__main__":
    watch_and_trigger()
