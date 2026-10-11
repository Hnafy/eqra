function serializeReference(reference) {
  return {
    id: reference._id.toString(),
    sourceFilename: reference.sourceFilename,
    audioDuration: reference.audioDuration,
    audioQuality: reference.audioQuality,
    createdAt: reference.createdAt,
  };
}

function serializeSpeaker(speaker, { includeReferences = false } = {}) {
  const base = {
    id: speaker._id.toString(),
    name: speaker.name,
    normalizedName: speaker.normalizedName,
    modelId: speaker.modelId,
    modelVersion: speaker.modelVersion,
    embeddingDimension: speaker.embeddingDimension,
    referenceCount: speaker.referenceEmbeddings ? speaker.referenceEmbeddings.length : 0,
    createdAt: speaker.createdAt,
    updatedAt: speaker.updatedAt,
  };

  if (includeReferences) {
    base.references = (speaker.referenceEmbeddings || []).map(serializeReference);
  }

  return base;
}

function speakerEmbeddings(speaker) {
  return (speaker.referenceEmbeddings || []).map((ref) => ref.embedding);
}

module.exports = { serializeSpeaker, serializeReference, speakerEmbeddings };
