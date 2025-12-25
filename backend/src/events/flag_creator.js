const fs = require("fs");
require("dotenv").config();
const { flagPath } = require("../../config/env");


const createDoneFlag = (batchTimeStart) => {
  fs.writeFileSync(flagPath, batchTimeStart.toString());
  console.log(`Batch DONE flag created at ${flagPath}`);
};

module.exports = { createDoneFlag };
