const mongoose = require("mongoose");
const config = require("../config");

const youTubeCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  results: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

youTubeCacheSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: config.youtubeCacheTtlHours * 3600 }
);

module.exports = mongoose.model("YouTubeCache", youTubeCacheSchema);
