const { uploadAirportsToDB } = require("../utils/airportData");

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
