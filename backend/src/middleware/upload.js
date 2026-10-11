const multer = require("multer");
const config = require("../config");
const AppError = require("../utils/AppError");

const ALLOWED_EXTENSIONS = new Set([
  "wav",
  "mp3",
  "m4a",
  "ogg",
  "opus",
  "webm",
  "mp4",
  "mpeg",
  "mpga",
  "flac",
]);

function fileExtension(filename) {
  const parts = String(filename || "").split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  const ext = fileExtension(file.originalname);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new AppError(
        400,
        `Unsupported audio format "${ext || "unknown"}". Supported: ${[...ALLOWED_EXTENSIONS].join(", ")}`
      )
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxUploadBytes },
});

module.exports = { upload, ALLOWED_EXTENSIONS, fileExtension };
