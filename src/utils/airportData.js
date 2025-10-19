const fs = require("fs");
const csv = require("csv-parser");
const Airport = require("../models/Airport");

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

// uploadAirport function to handle file upload and parsing
exports.uploadAirportsToDB = async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) throw new Error("No file uploaded");

  const fileExtension = req.file.originalname.toLowerCase().split(".").pop();
  const results = [];
  const errors = [];

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
        } else {
          errors.push({ data: airportData, errors: validationErrors });
        }
      }
    } else {
      throw new Error("Unsupported file format");
    }

    // Save valid airports to the database
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
    return { savedAirports, errors };
  } catch (error) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    // throw new Error(error.message);
    console.error("Error processing airport data: ", error);
    return res
      .status(500)
      .json({ message: "Error saving airport data", error });
  }
};

//Fetch Airport ICAO codes and IATA codes from the database
exports.fetchAllAirportsICAOandIATAcodesfromDB = async () => {
  try {
    const airports = await Airport.findAll({
      attributes: ["icao_code", "iata_code"],
    });
    return airports.map((a) => ({
      icao_code: a.icao_code,
      iata_code: a.iata_code,
    }));
  } catch (error) {
    console.error("Error fetching ICAO codes: ", error);
    return [];
  }
};

// Fetch Airport Coordinates from the database by ICAO codes
exports.fetchAirportCoordinatesByICAO = async (icao_codes) => {
  //Pass in an array of multiple icao_codes and return an array - Query Data
  try {
    if (!Array.isArray(icao_codes) || icao_codes.length === 0) {
      console.log("No ICAO codes provided");
      return [];
    }

    const airports = await Airport.findAll({
      where: {
        icao_code: icao_codes,
      },
      attributes: ["icao_code", "latitude_deg", "longitude_deg"],
    });

    if (!airports.length) {
      console.log("No airports found");
      return [];
    }

    const result = airports.map((a) => a.dataValues);
    return result;
  } catch (error) {
    console.error("Error fetching coordinates: ", error);
  }
};

//Fetch Airport Coordinates from the database by IATA codes
exports.fetchAirportCoordinatesByIATA = async (iata_codes) => {
  //Pass in an array of multiple iata_codes and return an array - Query Data
  try {
    if (!Array.isArray(iata_codes) || iata_codes.length === 0) {
      console.log("No IATA codes provided");
      return [];
    }

    const airports = await Airport.findAll({
      where: {
        iata_code: {
          [Op.in]: iata_codes,
        },
      },
      attributes: ["iata_code", "latitude_deg", "longitude_deg"],
    });

    if (!airports.length) {
      console.log("No airports found");
      return [];
    }

    const result = airports.map((a) => a.dataValues);
    console.log(result);
    return result;
  } catch (error) {
    console.error("Error fetching coordinates: ", error);
  }
};

// Save all fetched airport records in bulk
exports.saveAirportData = async (airportData) => {
  try {
    const savedAirports = await Airport.bulkCreate(airportData, {
      validate: true,
    });
    console.log(`Successfully saved ${savedAirports.length} airports.`);
    return savedAirports;
  } catch (error) {
    console.error("Error saving airport data: ", error);
    throw new Error("Error saving airport data");
  }
};
