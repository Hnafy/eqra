const mongoose = require("mongoose");

const referenceSchema = new mongoose.Schema(
  {
    embedding: { type: [Number], required: true },
    sourceFilename: { type: String, default: null },
    audioDuration: { type: Number, default: null },
    audioQuality: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const speakerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },

    // Embeddings from the model in `modelId`/`modelVersion` only. Embeddings
    // from other models/versions must never be mixed.
    prototypeEmbedding: { type: [Number], required: true },
    referenceEmbeddings: { type: [referenceSchema], default: [] },

    modelId: { type: String, required: true },
    modelVersion: { type: String, required: true },
    embeddingDimension: { type: Number, required: true },
  },
  { timestamps: true }
);

speakerSchema.index({ normalizedName: 1 }, { unique: false });

speakerSchema.virtual("referenceCount").get(function referenceCount() {
  return this.referenceEmbeddings ? this.referenceEmbeddings.length : 0;
});

speakerSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Speaker", speakerSchema);
