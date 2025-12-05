const Airport = require("../models/airport.js");

/** Generate a single date chunk for the past N days */
exports.generateDailyChunk = (daysBack) => {
  const now = new Date();
  const endDate = now;
  let startDate = new Date(now);
  startDate.setDate(now.getDate() - daysBack);

  const chunks = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const start = new Date(current);
    const next = new Date(current);
    next.setDate(current.getDate() + 14); // 14-day chunk

    // make sure we don't go beyond "now"
    const end = next > endDate ? endDate : next;

    chunks.push({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });

    current = next;
  }

  return chunks;
};

/** Generate monthly chunks going backward from today */
exports.generateDynamicYearChunks = (yearsBack) => {
  const now = new Date();
  const endDate = now;
  const startDate = new Date(now);
  startDate.setFullYear(now.getFullYear() - yearsBack);

  const chunks = [];
  let current = new Date(startDate);

  while (current < endDate) {
    const start = new Date(current);
    const next = new Date(current);
    next.setMonth(current.getMonth() + 12); // move forward 12 months

    // make sure we don't go beyond "now"
    const end = next > endDate ? endDate : next;

    chunks.push({
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    });

    current = next;
  }

  return chunks;
};

exports.allAirportsICAOCodeInDB = async () => {
  try {
    const icaoCodes = await Airport.findAll({
      attributes: ["icao_code"],
      raw: true,
    });
    const results = icaoCodes.map((a) => a.icao_code);
    return results;
  } catch (err) {
    console.error("Error fetching ICAO codes", err);
  }
};

exports.allAirportsIATACodeInDB = async () => {
  try {
    const iataCodes = await Airport.findAll({
      attributes: ["iata_code"],
      raw: true,
    });
    const results = iataCodes.map((a) => a.iata_code);
    return results;
  } catch (err) {
    console.error("Error fetching IATA codes", err);
  }
};
