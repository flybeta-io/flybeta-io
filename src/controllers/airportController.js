const {
  uploadAirportsToDB,
  fetchandSaveAirportsToDB,
} = require("../utils/airportData");

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
    return res.status(403).json({ message: 'ISO Code cannot be empty' });
  }
  // console.log('Iso Codes: ', ISOCodes)
  try {
    for (code of ISOCodes) {
      await fetchandSaveAirportsToDB(code);
    }
    console.log(`✅ All airports Saved Successfully`);
    return res.status(200).json({
      message: `Airports in countries ${ISOCodes} retrieved successfully`,
    });
  } catch (error) {
    console.error(`Unable to retrieved Airports, ${error}`);
    return res.status(500).json({ message: `Internal Server Error` });
  }
};
