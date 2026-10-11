const axios = require("axios");
const FormData = require("form-data");
const config = require("../config");
const AppError = require("../utils/AppError");

const client = axios.create({
  baseURL: config.pythonApiUrl.replace(/\/$/, ""),
  timeout: config.pythonApiTimeoutMs,
  maxBodyLength: Infinity,
  maxContentLength: Infinity,
});

function toAppError(err, fallbackMessage) {
  if (err.response) {
    const detail =
      (err.response.data && (err.response.data.detail || err.response.data.error)) ||
      fallbackMessage;
    return new AppError(
      err.response.status >= 400 && err.response.status < 600 ? err.response.status : 502,
      typeof detail === "string" ? detail : fallbackMessage
    );
  }
  if (err.code === "ECONNABORTED") {
    return new AppError(504, "Python API request timed out");
  }
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return new AppError(503, "Python API is unavailable");
  }
  return new AppError(502, fallbackMessage);
}

function audioForm(file, extra = {}) {
  const form = new FormData();
  form.append("file", file.buffer, {
    filename: file.originalname || "audio",
    contentType: file.mimetype || "application/octet-stream",
  });
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      form.append(key, String(value));
    }
  });
  return form;
}

const pythonApi = {
  async health() {
    try {
      const { data } = await client.get("/api/v1/health", { timeout: 5000 });
      return data;
    } catch (err) {
      throw toAppError(err, "Python API health check failed");
    }
  },

  async extractVoiceprint(file) {
    try {
      const form = audioForm(file);
      const { data } = await client.post("/api/v1/voiceprints/extract", form, {
        headers: form.getHeaders(),
      });
      return data;
    } catch (err) {
      throw toAppError(err, "Voiceprint extraction failed");
    }
  },

  async buildPrototypeFromEmbeddings(embeddings) {
    try {
      const { data } = await client.post("/api/v1/voiceprints/build-from-embeddings", {
        embeddings,
      });
      return data;
    } catch (err) {
      throw toAppError(err, "Prototype build failed");
    }
  },

  async identify(file, speakers, threshold) {
    try {
      const form = audioForm(file, {
        speakers_data: JSON.stringify({ speakers }),
        threshold: threshold === undefined || threshold === null ? undefined : threshold,
      });
      const { data } = await client.post("/api/v1/speakers/identify", form, {
        headers: form.getHeaders(),
      });
      return data;
    } catch (err) {
      throw toAppError(err, "Speaker identification failed");
    }
  },

  async searchAyah(query, limit = 5) {
    try {
      const { data } = await client.post("/api/v1/ayahs/search", { query, limit });
      return data;
    } catch (err) {
      throw toAppError(err, "Ayah search failed");
    }
  },

  async transcribe(file, language, prompt) {
    try {
      const form = audioForm(file, { language, prompt });
      const { data } = await client.post("/api/v1/transcribe", form, {
        headers: form.getHeaders(),
      });
      return data;
    } catch (err) {
      throw toAppError(err, "Transcription failed");
    }
  },

  async searchYouTube(query, maxResults = 5) {
    try {
      const { data } = await client.post("/api/v1/youtube/search", {
        query,
        max_results: maxResults,
      });
      return data;
    } catch (err) {
      throw toAppError(err, "YouTube search failed");
    }
  },
};

module.exports = pythonApi;
