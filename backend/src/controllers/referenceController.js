const Speaker = require("../models/Speaker");
const pythonApi = require("../services/pythonApi");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const {
  serializeSpeaker,
  serializeReference,
  speakerEmbeddings,
} = require("../utils/serializeSpeaker");

function assertCompatible(speaker, extraction) {
  if (extraction.model_id !== speaker.modelId) {
    throw new AppError(
      400,
      `Model mismatch: reference was produced by "${extraction.model_id}" but the speaker uses "${speaker.modelId}"`
    );
  }
  if (extraction.model_version !== speaker.modelVersion) {
    throw new AppError(
      400,
      `Model version mismatch: reference is "${extraction.model_version}" but the speaker uses "${speaker.modelVersion}"`
    );
  }
  if (extraction.embedding_dimension !== speaker.embeddingDimension) {
    throw new AppError(
      400,
      `Embedding dimension mismatch: reference is ${extraction.embedding_dimension} but the speaker uses ${speaker.embeddingDimension}`
    );
  }
}

const listReferences = asyncHandler(async (req, res) => {
  const speaker = await Speaker.findById(req.params.id);
  if (!speaker) {
    throw new AppError(404, "Speaker not found");
  }
  res.json({ references: (speaker.referenceEmbeddings || []).map(serializeReference) });
});

const addReference = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "An audio file is required");
  }

  const speaker = await Speaker.findById(req.params.id);
  if (!speaker) {
    throw new AppError(404, "Speaker not found");
  }

  const extraction = await pythonApi.extractVoiceprint(req.file);
  assertCompatible(speaker, extraction);

  speaker.referenceEmbeddings.push({
    embedding: extraction.embedding,
    sourceFilename: req.file.originalname || null,
    audioDuration: extraction.audio_duration ?? null,
    audioQuality: extraction.audio_quality ?? null,
  });

  const prototype = await pythonApi.buildPrototypeFromEmbeddings(speakerEmbeddings(speaker));
  speaker.prototypeEmbedding = prototype.prototype_embedding;
  await speaker.save();

  res.status(201).json({ speaker: serializeSpeaker(speaker, { includeReferences: true }) });
});

const deleteReference = asyncHandler(async (req, res) => {
  const speaker = await Speaker.findById(req.params.id);
  if (!speaker) {
    throw new AppError(404, "Speaker not found");
  }

  const reference = speaker.referenceEmbeddings.id(req.params.referenceId);
  if (!reference) {
    throw new AppError(404, "Reference not found");
  }

  if (speaker.referenceEmbeddings.length <= 1) {
    throw new AppError(
      400,
      "Cannot remove the last reference. Delete the speaker instead."
    );
  }

  reference.deleteOne();

  const prototype = await pythonApi.buildPrototypeFromEmbeddings(speakerEmbeddings(speaker));
  speaker.prototypeEmbedding = prototype.prototype_embedding;
  await speaker.save();

  res.json({ speaker: serializeSpeaker(speaker, { includeReferences: true }) });
});

module.exports = { listReferences, addReference, deleteReference };
