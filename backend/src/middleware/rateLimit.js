const rateLimit = require("express-rate-limit");
const config = require("../config");

const loginLimiter = rateLimit({
  windowMs: config.loginRateWindowMinutes * 60 * 1000,
  max: config.loginRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

const analysisLimiter = rateLimit({
  windowMs: config.analysisRateWindowMinutes * 60 * 1000,
  max: config.analysisRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Analysis rate limit reached, please try again later" },
});

module.exports = { loginLimiter, analysisLimiter };
