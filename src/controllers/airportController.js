const fs = require("fs");
const csv = require("csv-parser");
const Airport = require("../models/airport");
const {
  fetchAirportCoordinatesByICAO,
  convertCoordinatesToArray,
} = require("../utils/fetchAirportData");
const { saveWeatherDataByCoordinates } = require("./weatherController");

// --- Validation ---
const validateAirportData = (airportData) => {
  const errors = [];
  const { name, icao_code, iata_code, latitude_deg, longitude_deg, type } =
    airportData;

  if (!name?.trim()) errors.push("Name is required");
  if (!icao_code?.trim()) errors.push("ICAO code is required");
  if (!iata_code?.trim()) errors.push("IATA code is required");

  if (latitude_deg === undefined || latitude_deg === null)
    errors.push("Latitude is required");
  else if (latitude_deg < -90 || latitude_deg > 90)
    errors.push("Latitude must be between -90 and 90");

  if (longitude_deg === undefined || longitude_deg === null)
    errors.push("Longitude is required");
  else if (longitude_deg < -180 || longitude_deg > 180)
    errors.push("Longitude must be between -180 and 180");

  if (!type?.trim()) errors.push("Type is required");

  return errors;
};

// --- Ensure uploads folder exists ---
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// --- Upload + Parse Airport File ---
const uploadAirport = async (req) => {
  const filePath = req.file?.path;
  if (!filePath) throw new Error("No file uploaded");

  const fileExtension = req.file.originalname.toLowerCase().split(".").pop();
  const results = [];
  const errors = [];

  const icaoCodes = [];
  const iataCodes = [];

  try {
    if (fileExtension === "csv") {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(
            csv({
              mapHeaders: ({ header }) =>
                header.toLowerCase().trim().replace(/\s+/g, "_"),
            })
          )
          .on("data", (data) => {
            const airportData = {
              name: data.name?.trim(),
              icao_code: data.icao_code?.trim(),
              iata_code: data.iata_code?.trim(),
              latitude_deg: parseFloat(data.latitude_deg),
              longitude_deg: parseFloat(data.longitude_deg),
              type: data.type?.trim(),
            };

            const validationErrors = validateAirportData(airportData);
            if (validationErrors.length === 0) {
              results.push(airportData);
              if (airportData.icao_code) icaoCodes.push(airportData.icao_code);
              if (airportData.iata_code) iataCodes.push(airportData.iata_code);
            } else {
              errors.push({ data: airportData, errors: validationErrors });
            }
          })
          .on("end", resolve)
          .on("error", reject);
      });
    } else if (fileExtension === "json") {
      const jsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      for (const data of dataArray) {
        const airportData = {
          name: data.name?.trim(),
          icao_code: data.icao_code?.trim(),
          iata_code: data.iata_code?.trim(),
          latitude_deg: parseFloat(data.latitude_deg),
          longitude_deg: parseFloat(data.longitude_deg),
          type: data.type?.trim(),
        };
        const validationErrors = validateAirportData(airportData);
        if (validationErrors.length === 0) {
          results.push(airportData);
          if (airportData.icao_code) icaoCodes.push(airportData.icao_code);
          if (airportData.iata_code) iataCodes.push(airportData.iata_code);
        } else {
          errors.push({ data: airportData, errors: validationErrors });
        }
      }
    } else {
      throw new Error("Unsupported file format");
    }

    // Save valid airports to DB
    const savedAirports = [];
    for (const airport of results) {
      try {
        const saved = await Airport.create(airport);
        savedAirports.push(saved);
      } catch (dbError) {
        console.warn(`Skipping ${airport.name}: ${dbError.message}`);
      }
    }

    fs.unlinkSync(filePath);
    return { savedAirports, errors, icaoCodes, iataCodes };
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw new Error(error.message);
  }
};

// --- Upload File + Fetch Weather Data ---
const uploadAirportsByFile = async (req, res) => {
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

module.exports = { uploadAirportsByFile };
