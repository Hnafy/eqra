require("dotenv").config();

function required(name, fallback) {
  const value = process.env[name] || fallback;
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),

  mongoUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/eqra"),

  jwtSecret: required("JWT_SECRET", "change-me-in-production"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  cookieName: process.env.COOKIE_NAME || "eqra_token",

  pythonApiUrl: process.env.PYTHON_API_URL || "http://127.0.0.1:8000",
  pythonApiTimeoutMs: parseInt(process.env.PYTHON_API_TIMEOUT_MS || "180000", 10),

  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",

  maxUploadMb: parseInt(process.env.MAX_UPLOAD_MB || "20", 10),
  minAnalysisSeconds: parseFloat(process.env.MIN_ANALYSIS_SECONDS || "5"),
  // Minimum ayah match score (0-100) required to report a recognized ayah.
  ayahMinScore: parseFloat(process.env.AYAH_MIN_SCORE || "70"),

  youtubeCacheTtlHours: parseInt(process.env.YOUTUBE_CACHE_TTL_HOURS || "24", 10),

  loginRateMax: parseInt(process.env.LOGIN_RATE_MAX || "10", 10),
  loginRateWindowMinutes: parseInt(process.env.LOGIN_RATE_WINDOW_MINUTES || "15", 10),
  analysisRateMax: parseInt(process.env.ANALYSIS_RATE_MAX || "30", 10),
  analysisRateWindowMinutes: parseInt(process.env.ANALYSIS_RATE_WINDOW_MINUTES || "60", 10),
};

config.isProduction = config.env === "production";
config.maxUploadBytes = config.maxUploadMb * 1024 * 1024;

module.exports = config;
