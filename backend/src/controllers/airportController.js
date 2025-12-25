const {
  uploadAirportsToDB,
  fetchandSaveAirportsToDB,
  fetchAirportsDatafromDB,
  saveAirportsCities
} = require("../utils/airportData");
const { getAirportsCache } = require("../utils/cache");

exports.uploadAirportsByFile = async (req, res) => {
  const { savedAirports, errors } = await uploadAirportsToDB(req, res);

  if (savedAirports.length != 0) {
    console.log(`Successfully saved ${savedAirports.length} airports.`);
    res.status(201).json({
      message: `Successfully saved ${savedAirports.length} airports.`,
      savedAirports,
      errors,
    });
  } else if (errors.length > 0) {
    console.log(`Unable to save ${errors.length} airports`);
    res.status(400).json({
      message: "Errors occurred while processing the file",
      errors,
    });
  }
};

exports.fetchAirportsbyISOandSavetoDB = async (req, res) => {
  const { ISOCodes } = req.body;
  if (ISOCodes.length === 0) {
    return res.status(403).json({ message: "ISO Code cannot be empty" });
  }

  console.log(`Fetching Airports Data for Flights Operation`);
  const airports = await getAirportsCache(fetchAirportsDatafromDB());

  if (!airports.length) {
    console.warn(" No airport found in database.");
    return;
  }

  const iataCodesInDB = new Set(airports.map((a) => a.iata_code));
  console.log(`Loaded ${iataCodesInDB.size} IATA codes into memory.`);
  const icaoCodesInDB = new Set(airports.map((a) => a.icao_code));
  console.log(`Loaded ${icaoCodesInDB.size} ICAO codes into memory.`);

  // console.log('Iso Codes: ', ISOCodes)
  try {
    for (iso of ISOCodes) {
      await fetchandSaveAirportsToDB(iso, iataCodesInDB, icaoCodesInDB);
    }
    console.log(`✅ Airports fetching operation completed successfully`);
    return res.status(200).json({
      message: `Airports in countries ${ISOCodes} retrieved successfully`,
    });
  } catch (error) {
    console.error(`Unable to retrieved Airports, ${error}`);
    return res.status(500).json({ message: `Internal Server Error` });
  }
};

exports.uploadAirportCities = async (req, res) => {
  try {
    const savedAirports = await saveAirportsCities(req, res);
    console.log(`${savedAirports.length} airports updated successfully`);
    res
      .status(200)
      .json({
        message: `${savedAirports.length} airports updated successfully`,
      });
  } catch (err) {
    console.error(`An error occurred: ${err.message}`);
    res.status(500).json({ message: "Internal Server Error" });
  }

}
