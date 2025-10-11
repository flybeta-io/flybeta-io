const axios = require("axios");
const Weather = require("../models/weather");
require("dotenv").config();

const API_KEY = process.env.VISUAL_CROSSING_API_KEY;
const BASE_URL =
  "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";

const DB_BATCH_SIZE = 500; // Adjust based on performance testing

/**
 * Generate 6-month chunks between start and end dates
 */
const generateChunks = (startDate, endDate) => {
  const chunks = [];
  let chunkStart = new Date(startDate);
  chunkStart.setHours(0, 0, 0, 0);

  const finalEnd = new Date(endDate);
  finalEnd.setHours(23, 59, 59, 999);

  while (chunkStart <= finalEnd) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setMonth(chunkEnd.getMonth() + 6);

    if (chunkEnd > finalEnd) chunkEnd.setTime(finalEnd.getTime());

    chunks.push({ start: new Date(chunkStart), end: new Date(chunkEnd) });

    // Move start to next chunk
    chunkStart.setDate(chunkEnd.getDate() + 1);
    chunkStart.setMonth(chunkEnd.getMonth() + 1);
  }

  return chunks;
};

exports.saveWeatherDataByCoordinates = async (
  locations,
  start_date,
  end_date,
  icao_code,
  iata_code
) => {
  try {
    if (!API_KEY) throw new Error("Visual Crossing API key is missing.");

    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    const elements =
      "datetime,visibility,precip,windspeed,winddir,temp,pressure,cloudceiling,cloudcover";

    const chunks = generateChunks(startDate, endDate);

    for (const chunk of chunks) {
      const start = chunk.start.toISOString().split("T")[0];
      const end = chunk.end.toISOString().split("T")[0];

      // Rate-limit per chunk (3 seconds)
      await new Promise((r) => setTimeout(r, 3000));

      try {
        console.log(`Fetching data for ${locations} from ${start} to ${end}`);
        const url = `${BASE_URL}/${locations}/${start}/${end}?unitGroup=metric&key=${API_KEY}&include=hours&elements=${elements}`;
        const { data } = await axios.get(url);

        console.log(
          `Weather Data retrieved for ${locations} from ${start} to ${end}`
      );
      console.log(data);
      } catch (error) {
        console.warn(`Unable to Fetch Weatheter Data for ${locations} from ${start} to ${end}:`, error.message);
        continue;
      }


      const locationsData = Array.isArray(data) ? data : [data];

      for (const locationData of locationsData) {
        const { resolvedAddress, days = [] } = locationData;
        if (!days.length) continue;

        const allWeatherRecords = days.flatMap((day) =>
          (day.hours || [])
            .map((hour) => {
              if (hour.datetime == null) return null;

              const dtString = `${day.datetime}T${hour.datetime
                .toString()
                .padStart(2, "0")}:00:00Z`;
              const dt = new Date(dtString);
              if (isNaN(dt)) return null;

              return {
                location: resolvedAddress,
                iata_code,
                icao_code,
                datetime: dt,
                visibility: hour.visibility ?? null,
                precipitation: hour.precip ?? null,
                wind_speed: hour.windspeed ?? null,
                wind_direction: hour.winddir ?? null,
                temperature: hour.temp ?? null,
                pressure: hour.pressure ?? null,
                cloud_ceiling: hour.cloudceiling ?? null,
                cloud_cover: hour.cloudcover ?? null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            })
            .filter(Boolean)
        );

        // Batch insert
        for (let i = 0; i < allWeatherRecords.length; i += DB_BATCH_SIZE) {
          const batch = allWeatherRecords.slice(i, i + DB_BATCH_SIZE);
          await Weather.bulkCreate(batch, { ignoreDuplicates: true });
        }
      }
    }
  } catch (error) {
    console.error(
      `Error saving weather data for ${locations} (${icao_code}/${iata_code}):`,
      error.message
    );
  }
};
