
## 1. System Architecture

**Architect:** Olabode Egbinola

FlyBeta is a **real-time, event-driven microservices system** designed to process high-velocity flight and weather data. The architecture leverages **Apache Kafka** for asynchronous data streaming and **Apache Flink** for stateful stream processing.

By strictly decoupling data ingestion, intelligence (ML), and user interaction, the system ensures high scalability and fault tolerance.

### 🔄 High-Level Data Flow

The system follows a linear pipeline: **Ingest → Process → Intelligence → Serve**.

1. **Ingestion:** Independent fetcher scripts pull live data from external APIs and produce events into **Kafka** hot storage topics.
2. **Stream Processing:** **Apache Flink** consumes concurrent streams (flight + weather), managing time-windows and orchestrating decision logic.
3. **Intelligence:** The ML service consumes processed streams to detect anomalies and predict potential disruptions.
4. **Delivery:** The WhatsApp Bot acts as a final consumer, serving alerts to users via **Redis** for high-speed session management.

```mermaid
graph TD
    subgraph Ingestion
    A[External APIs] -->|Fetcher Scripts| B(Kafka: Hot Storage)
    end

    subgraph Intelligence
    B -->|Consume Streams| C{Apache Flink}
    C -- 1. Detect Delay --> D[ML Stage 1]
    D -- If Delay Detected --> E[ML Stage 2]
    E -->|Duration Prediction| C
    C -->|Final Result| F(Kafka: Predictions)
    end

    subgraph Serving
    F -->|Persist| G[(PostgreSQL)]
    H[WhatsApp Bot] <-->|Session State| I[(Redis)]
    H -->|Query Results| G
    H <-->|Alerts| J((End User))
    end

```

### 🛠 Component Breakdown

| Service | Tech Stack | Role |
| --- | --- | --- |
| **Core Backend** | Node.js / Express | Central ingestion engine; manages cron jobs and Kafka production. |
| **Flink Service** | Apache Flink (PyFlink) | Real-time computation engine; handles windowing and ML orchestration. |
| **Bot Service** | Node.js / Express | Manages WhatsApp webhooks and user sessions via Redis. |
| **Data Storage** | PostgreSQL | The "Single Source of Truth" accessed via Cloud SQL Proxy. |

**Key Infrastructure:**

* **Kafka Strategy:** Utilizes distinct topics for "Hot" (Live Data) and "Cold" (Historical Training Data) storage.
* **Networking:** All services communicate via a private Docker bridge (`flybeta-network`); only the Bot port is exposed publicly via Ngrok.

📄 **[Read the Full System Architecture Documentation](https://docs.google.com/document/d/1SVVZyTbmWBaaYzIKT556GBqYDPqOM-0v0d-iAosl4D0/edit?usp=sharing)**



## 2. Model Development

**Lead Data Scientist:** [Name]

The core intelligence of FlyBeta relies on a **Two-Stage Classification Pipeline** powered by **XGBoost**, designed to predict flight disruptions in the noisy Nigerian aviation market. The model prioritizes **Recall (76.4%)** to minimize the risk of missing actual delays.

### 🧠 The ML Pipeline

| Stage | Objective | Logic |
| --- | --- | --- |
| **Stage 1: Detection** | Binary Classification | Determines if a flight will be **Delayed (>15 mins)** or **On-Time**. |
| **Stage 2: Severity** | Severity Classification | Triggered *only* if Stage 1 predicts a delay. Determines if the delay is **Severe (>30 mins)**. |

### ⚙️ Key Technical Features

* **Champion Model:** **XGBoost** was selected over Random Forest for its superior handling of tabular data and low inference latency (**0.03s**), essential for real-time user queries.
* **Feature Engineering:**
* **Leakage-Proof Encoding:** Custom "Time-Aware" Target Encoding ensures the model learns from historical airline performance without peeking into the future.
* **Network Stress:** Features like `origin_stress` and `concurrent_departures` capture the ripple effects of airport congestion.
* **Weather Integration:** Flight schedules are merged with hourly weather data (Wind, Rain Intensity) using a 5-hour lookback window.


* **Training Strategy:** Models are trained on a **Chronological Split** (Oct 2024 – Oct 2025) rather than random sampling to simulate real-world production conditions and strictly avoid look-ahead bias.



## 3. Configuration

### Environment Variables

Create a `.env` file in the root directory using the following template:

```bash
# CORE BACKEND
BACKEND_PORT=5000
VISUAL_CROSSING_API_KEY=your_key
AVIATION_EDGE_API_KEY=your_key

# DATABASE (Cloud SQL Proxy)
CLOUD_SQL_INSTANCE_NAME=project:region:instance
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=cloudsql_proxy
DB_PORT=5432
DB_NAME=flybeta
POSTGRES_DB_URL=postgresql://postgres:password@cloudsql_proxy:5432/flybeta

# MACHINE LEARNING
ML_PORT=6000

# WHATSAPP BOT
WHATSAPP_BOT_PORT=3000
PHONE_NUMBER_ID=your_id
WHATSAPP_ACCESS_TOKEN=your_token

# NGROK
NGROK_AUTH_TOKEN=your_ngrok_token

# REDIS
REDIS_HOST=redis
REDIS_PORT=6379

```

### Secrets & Cloud SQL Proxy

The system uses **Google Cloud SQL Proxy** to securely connect to the production database. You must place your service account key in the `./secrets/` directory and save it as `service-account-key.json`.
