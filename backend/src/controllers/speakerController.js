const Speaker = require("../models/Speaker");
const pythonApi = require("../services/pythonApi");
const normalizeName = require("../utils/normalizeName");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { serializeSpeaker } = require("../utils/serializeSpeaker");

const listSpeakers = asyncHandler(async (_req, res) => {
  const speakers = await Speaker.find().sort({ createdAt: -1 });
  res.json({ speakers: speakers.map((s) => serializeSpeaker(s)) });
});

const getSpeaker = asyncHandler(async (req, res) => {
  const speaker = await Speaker.findById(req.params.id);
  if (!speaker) {
    throw new AppError(404, "Speaker not found");
  }
  res.json({ speaker: serializeSpeaker(speaker, { includeReferences: true }) });
});

const createSpeaker = asyncHandler(async (req, res) => {
  const name = (req.body && req.body.name ? String(req.body.name) : "").trim();
  if (!name) {
    throw new AppError(400, "Speaker name is required");
  }
  if (!req.file) {
    throw new AppError(400, "An audio file is required");
  }

  const extraction = await pythonApi.extractVoiceprint(req.file);
  const embedding = extraction.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new AppError(502, "Voiceprint extraction returned an empty embedding");
  }

  const prototype = await pythonApi.buildPrototypeFromEmbeddings([embedding]);

  const speaker = await Speaker.create({
    name,
    normalizedName: normalizeName(name),
    prototypeEmbedding: prototype.prototype_embedding,
    referenceEmbeddings: [
      {
        embedding,
        sourceFilename: req.file.originalname || null,
        audioDuration: extraction.audio_duration ?? null,
        audioQuality: extraction.audio_quality ?? null,
      },
    ],
    modelId: extraction.model_id,
    modelVersion: extraction.model_version,
    embeddingDimension: extraction.embedding_dimension,
  });

  res.status(201).json({ speaker: serializeSpeaker(speaker, { includeReferences: true }) });
});

const deleteSpeaker = asyncHandler(async (req, res) => {
  const speaker = await Speaker.findByIdAndDelete(req.params.id);
  if (!speaker) {
    throw new AppError(404, "Speaker not found");
  }
  res.json({ success: true, id: speaker._id.toString() });
});

module.exports = { listSpeakers, getSpeaker, createSpeaker, deleteSpeaker };
