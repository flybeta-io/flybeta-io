const express = require("express");
const multer = require("multer");
const airportController = require("../controllers/airportController");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["text/csv", "application/json", "text/plain"];
    const allowedExtensions = [".csv", ".json"];
    const isAllowedType = allowedTypes.includes(file.mimetype);
    const isAllowedExt = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext)
    );
    cb(
      isAllowedType || isAllowedExt ? null : new Error("Invalid file type"),
      true
    );
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// router.post(
//   "/upload",
//   upload.single("file"),
//   airportController.uploadAirportsByFile
// );

// module.exports = router;
