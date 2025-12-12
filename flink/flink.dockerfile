FROM apache/flink:2.2.0-scala_2.12

# Install Python + pip
USER root
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv wget && \
    apt-get clean

# Create venv for Python packages
RUN python3 -m venv /opt/flink/venv

# Copy requirements first (for Docker caching)
COPY requirements.txt /opt/flink/requirements.txt

# Install Python dependencies INSIDE the venv
RUN /opt/flink/venv/bin/pip install --upgrade pip && \
    /opt/flink/venv/bin/pip install -r /opt/flink/requirements.txt

# Create flags directory
RUN mkdir -p /opt/flags && chmod -R 777 /opt/flags

# Copy job and preprocessors
COPY . /opt/flink/

# Give flink user permission to run Python + read/write everything
RUN chown -R flink:flink /opt/flink

# Download Kafka connector to lib directory (NOT plugins)
RUN wget -P /opt/flink/lib/ \
    https://repo.maven.apache.org/maven2/org/apache/flink/flink-sql-connector-kafka/4.0.1-2.0/flink-sql-connector-kafka-4.0.1-2.0.jar

# Verify the connector was downloaded
RUN ls -la /opt/flink/lib/ | grep kafka

# Set working directory
WORKDIR /opt/flink

# Tell Flink to use the venv Python
ENV FLINK_PYTHON_EXECUTABLE=/opt/flink/venv/bin/python

# Ensure venv site-packages is visible
ENV PYTHONPATH="/opt/flink:/opt/flink/venv/lib/python3.12/site-packages:${PYTHONPATH}"

# Switch back to flink user (recommended)
USER flink

# Run watcher (this triggers batch process when Kafka is done)
CMD ["/opt/flink/venv/bin/python", "-u", "job/watch_and_trigger.py"]
