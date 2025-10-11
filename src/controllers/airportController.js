const Airport = require("../models/airport");
const {
  fetchAirportCoordinatesByICAO,
  convertCoordinatesToArray,
  uploadAirport,
} = require("../utils/airportData");
const { saveWeatherDataByCoordinates } = require("./weatherController");



// --- Upload File + Fetch 5 year Weather Data ---
exports.uploadAirportsByFile = async (req, res) => {
  try {
    const { errors, icaoCodes, iataCodes } = await uploadAirport(req);

    if (!icaoCodes.length) {
      return res.status(400).json({
        success: false,
        message: "No valid airports found in file.",
        errors,
      });
    }

    console.log("ICAO codes parsed:", icaoCodes);
    console.log("IATA codes parsed:", iataCodes);

    const end_date = new Date();
    const start_date = new Date();
    start_date.setFullYear(end_date.getFullYear() - 5);

    const BATCH_SIZE = 1; // API-friendly batch size

    for (let i = 0; i < icaoCodes.length; i += BATCH_SIZE) {
      const batchICAO = icaoCodes.slice(i, i + BATCH_SIZE);
      const batchIATA = iataCodes.slice(i, i + BATCH_SIZE);

      // Fetch coordinates for the batch
      const retrievedCoordinates = await fetchAirportCoordinatesByICAO(
        batchICAO
      );

      if (!retrievedCoordinates || !retrievedCoordinates.length) {
        console.warn("No coordinates found for batch:", batchICAO);
        continue;
      }

      // Convert to locations string for API
      const locations = (
        await convertCoordinatesToArray(retrievedCoordinates)
      ).join(";");

      // Fetch weather for each airport in batch
      for (let j = 0; j < batchICAO.length; j++) {
        const icao_code = batchICAO[j];
        const iata_code = batchIATA[j];

        try {
          console.log(`Saving weather data for ${icao_code}/${iata_code}...`);
          await saveWeatherDataByCoordinates(
            locations,
            start_date,
            end_date,
            icao_code,
            iata_code
          );

          // Rate-limit: 3 sec per airport
          await new Promise((r) => setTimeout(r, 3000));
        } catch (err) {
          console.error(`Weather fetch failed for ${icao_code}:`, err.message);
        }
      }

      // Optional: delay between batches
      await new Promise((r) => setTimeout(r, 2000));
    }

    console.log("Completed weather data fetch for all ICAO codes.");
    res.json({
      success: true,
      message: "Airports and weather data saved successfully.",
      totalAirports: icaoCodes.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error("Error in uploadAirportsByFile:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};



// Fetch weather data by coordinates by taking latitude and longitude
