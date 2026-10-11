const express = require("express");
const { analyze } = require("../controllers/analysisController");
const { analysisLimiter } = require("../middleware/rateLimit");
const { upload } = require("../middleware/upload");
const pythonApi = require("../services/pythonApi");
const { dbState } = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Public analysis endpoint, protected by a per-IP rate limit.
router.post("/", analysisLimiter, upload.single("file"), analyze);

// Combined health of the MongoDB connection and the Python API.
router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    let python = { ok: false, error: null };
    try {
      const data = await pythonApi.health();
      python = { ok: true, ...data };
    } catch (err) {
      python = { ok: false, error: err.message };
    }
    res.json({
      ok: python.ok,
      mongo: dbState(),
      python,
    });
  })
);

module.exports = router;
