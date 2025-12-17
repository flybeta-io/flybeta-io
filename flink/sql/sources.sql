-- Raw Flights Stream
DROP TABLE IF EXISTS raw_flights;
CREATE TABLE raw_flights (
    flightID STRING,
    airlineName STRING,
    airlineIcaoCode STRING,
    airlineIataCode STRING,
    scheduledDepartureTime STRING,
    actualDepartureTime STRING,
    scheduledArrivalTime STRING,
    actualArrivalTime STRING,
    originAirportIata STRING,
    destinationAirportIata STRING,
    delay INT,
    status STRING,

    -- COMPUTED COLUMNS
    -- 1. Parse '2025-12-10T06:30:00.000Z' -> '2025-12-10 06:30:00.000'
    ts_dep AS TO_TIMESTAMP(REPLACE(REPLACE(scheduledDepartureTime, 'T', ' '), 'Z', '')),
    ts_arr AS TO_TIMESTAMP(REPLACE(REPLACE(scheduledArrivalTime, 'T', ' '), 'Z', '')),

    -- 2. Define Watermark (CRITICAL for Streaming Joins)
    WATERMARK FOR ts_dep AS ts_dep - INTERVAL "1" MINUTE,
) WITH (
    'connector' = 'kafka',
    'topic' = 'flight_data_topic',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink_consumer_group',
    'format' = 'json',
    'scan.startup.mode' = 'earliest-offset'
);


-- Raw Weather Stream
DROP TABLE IF EXISTS raw_weather;
CREATE TABLE raw_weather (
    location STRING,
    icao_code STRING,
    iata_code STRING,
    datetime STRING,
    visibility FLOAT,
    precipitation FLOAT,
    wind_speed FLOAT,
    wind_direction INT,
    temperature FLOAT,
    humidity FLOAT,
    pressure FLOAT,
    cloud_cover FLOAT,

    -- COMPUTED COLUMNS
    -- 1. Parse '2025-12-10T06:00:00.000Z' -> '2025-12-10 06:00:00.000'
    ts AS TO_TIMESTAMP(REPLACE(REPLACE(datetime, 'T', ' '), 'Z', '')),
) WITH (
    'connector' = 'kafka',
    'topic' = 'weather_data_topic',
    'properties.bootstrap.servers' = 'kafka:9092',
    'properties.group.id' = 'flink_consumer_group',
    'format' = 'json',
    'scan.startup.mode' = 'earliest-offset'
);
