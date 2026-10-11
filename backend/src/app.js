const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const config = require("./config");
const authRoutes = require("./routes/authRoutes");
const speakerRoutes = require("./routes/speakerRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (!config.isProduction) {
  app.use(morgan("dev"));
}

// Lightweight root health check (does not touch external services).
app.get("/api/health/live", (_req, res) => {
  res.json({ ok: true, service: "eqra-backend", env: config.env });
});

app.use("/api/auth", authRoutes);
app.use("/api/speakers", speakerRoutes);
app.use("/api/analysis", analysisRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
