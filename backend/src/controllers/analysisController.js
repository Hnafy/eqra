const config = require("../config");
const Speaker = require("../models/Speaker");
const pythonApi = require("../services/pythonApi");
const { getOrFetch } = require("../services/youtubeCache");
const { speakerEmbeddings } = require("../utils/serializeSpeaker");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

function toCandidates(speakers) {
  return speakers.map((speaker) => ({
    speaker_id: speaker._id.toString(),
    speaker_name: speaker.name,
    prototype_embedding: speaker.prototypeEmbedding,
    reference_embeddings: speakerEmbeddings(speaker),
    model_id: speaker.modelId,
    model_version: speaker.modelVersion,
  }));
}

function buildYouTubeQuery(reciterName, ayah) {
  const parts = [];
  if (reciterName) parts.push(reciterName);
  if (ayah && ayah.surah) parts.push(`سورة ${ayah.surah}`);
  if (parts.length === 0) parts.push("تلاوة قرآن");
  return parts.join(" ");
}

const analyze = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "An audio file is required");
  }

  const speakers = await Speaker.find();
  const candidates = toCandidates(speakers);

  const [identifyOutcome, transcribeOutcome] = await Promise.allSettled([
    candidates.length > 0 ? pythonApi.identify(req.file, candidates) : Promise.resolve(null),
    pythonApi.transcribe(req.file),
  ]);

  const response = {
    success: true,
    errors: {},
    speaker: null,
    ayah: null,
    youtube: null,
  };

  // --- Duration / minimum length validation -------------------------------
  let duration = null;
  if (identifyOutcome.status === "fulfilled" && identifyOutcome.value) {
    duration = identifyOutcome.value.audio_duration ?? null;
  }
  if (duration == null && transcribeOutcome.status === "fulfilled" && transcribeOutcome.value) {
    duration = transcribeOutcome.value.duration ?? null;
  }
  if (duration != null && duration < config.minAnalysisSeconds) {
    throw new AppError(
      422,
      `Audio is too short (${duration.toFixed(1)}s). Minimum is ${config.minAnalysisSeconds}s`
    );
  }

  // --- Section A: Reciter identification ----------------------------------
  let reciterName = null;
  if (identifyOutcome.status === "fulfilled") {
    if (identifyOutcome.value) {
      const id = identifyOutcome.value;
      response.speaker = {
        available: true,
        identified: id.identified,
        speakerId: id.speaker_id,
        speakerName: id.speaker_name,
        top1Score: id.top1_score,
        top2Score: id.top2_score,
        scoreMargin: id.score_margin,
        candidates: id.candidates,
        decisionReason: id.decision_reason,
        audioDuration: id.audio_duration ?? duration,
      };
      reciterName = id.identified ? id.speaker_name : null;
    } else {
      response.speaker = {
        available: false,
        error: "No speakers are registered yet",
        candidateCount: 0,
      };
    }
  } else {
    response.speaker = { available: false, error: identifyOutcome.reason.message };
    response.errors.speaker = identifyOutcome.reason.message;
  }

  // --- Section B: Ayah detection ------------------------------------------
  const transcription =
    transcribeOutcome.status === "fulfilled" && transcribeOutcome.value
      ? transcribeOutcome.value
      : null;

  if (transcription && transcription.text && transcription.text.trim()) {
    try {
      const search = await pythonApi.searchAyah(transcription.text.trim(), 5);
      const matches = (search.results || []).filter(
        (item) => Number(item.score) >= config.ayahMinScore
      );
      const best = matches[0] || null;
      response.ayah = {
        available: Boolean(best),
        threshold: config.ayahMinScore,
        transcription: {
          text: transcription.text,
          language: transcription.language ?? null,
          duration: transcription.duration ?? null,
        },
        best,
        alternatives: matches.slice(1, 3),
      };
      if (!best) {
        response.ayah.message = "لم يتم التعرف على الآية";
      }
    } catch (err) {
      response.ayah = {
        available: false,
        transcription: { text: transcription.text },
        error: err.message,
      };
      response.errors.ayah = err.message;
    }
  } else {
    const reason =
      transcribeOutcome.status === "rejected"
        ? transcribeOutcome.reason.message
        : "No speech was detected in the audio";
    response.ayah = {
      available: false,
      transcription: transcription ? { text: transcription.text || "" } : null,
      error: reason,
    };
    response.errors.transcription = reason;
  }

  // --- Section C: Related YouTube recitation ------------------------------
  const bestAyah = response.ayah && response.ayah.best ? response.ayah.best : null;
  const query = buildYouTubeQuery(reciterName, bestAyah);
  try {
    const { results, cached } = await getOrFetch(query, 5, () =>
      pythonApi.searchYouTube(query, 5)
    );
    const list = results.results || results || [];
    response.youtube = {
      available: list.length > 0,
      query,
      cached: Boolean(cached),
      result: list[0] || null,
      alternatives: list.slice(1, 4),
    };
    if (list.length === 0) {
      response.youtube.message = "No related video was found";
    }
  } catch (err) {
    response.youtube = { available: false, query, error: err.message };
    response.errors.youtube = err.message;
  }

  res.json(response);
});

module.exports = { analyze };
