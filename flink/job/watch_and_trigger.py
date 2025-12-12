import os
import time
import subprocess

FLAG_PATH = "/opt/flags/batch_done.txt"
FLINK_JOB_PATH = "/opt/flink/job/flink_job.py"
INTERVAL = 5


def watch_and_trigger():
    print("Watching for Kafka completion flag...")
    while True:
        if os.path.exists(FLAG_PATH):
            print("Flag detected. Triggering Flink batch job...")

            subprocess.run(["/opt/flink/venv/bin/python3", FLINK_JOB_PATH])

            os.remove(FLAG_PATH)  # clean up
            print("Flink job finished and flag removed.")
            break
        time.sleep(INTERVAL)  # check every 5 seconds


if __name__ == "__main__":
    watch_and_trigger()
