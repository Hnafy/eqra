const multer = require("multer");
const AppError = require("../utils/AppError");
const config = require("../config");

function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || "Internal server error";

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      status = 413;
      message = `File too large. Maximum size is ${config.maxUploadMb}MB`;
    } else {
      status = 400;
      message = `Upload error: ${err.message}`;
    }
  }

  if (status >= 500) {
    console.error("[error]", err);
    message = config.isProduction ? "Internal server error" : message;
  }

  const body = { error: message };
  if (err.details) body.details = err.details;

  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
