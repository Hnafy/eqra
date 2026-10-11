from typing import List

import torch
import numpy as np
from speechbrain.inference.speaker import EncoderClassifier
from speechbrain.utils.fetching import LocalStrategy
from app.config import settings


class EmbeddingExtractor:
    def __init__(self):
        self.model = None
        self.model_id = settings.MODEL_ID
        self.model_version = settings.MODEL_VERSION

    @staticmethod
    def _local_strategy() -> LocalStrategy:
        strategy = (settings.LOCAL_STRATEGY or "").strip().lower()
        return {
            "symlink": LocalStrategy.SYMLINK,
            "copy": LocalStrategy.COPY,
            "copy_skip_cache": LocalStrategy.COPY_SKIP_CACHE,
            "no_link": LocalStrategy.NO_LINK,
        }.get(strategy, LocalStrategy.COPY_SKIP_CACHE)

    def load_model(self):
        """Load the ECAPA-TDNN model from SpeechBrain.

        Using ``local_strategy=COPY_SKIP_CACHE`` downloads the model files
        directly into ``savedir`` instead of creating symlinks, which fails on
        Windows without elevated privileges (WinError 1314).
        """
        self.model = EncoderClassifier.from_hparams(
            source=self.model_id,
            savedir=settings.MODEL_SAVEDIR,
            local_strategy=self._local_strategy(),
        )

    def extract_embedding(self, audio_path: str) -> List[float]:
        """Extracts L2-normalized speaker embedding from audio file"""
        if self.model is None:
            raise RuntimeError("Model not loaded")

        # SpeechBrain's load_audio() runs the path through split_path()/fetch(),
        # which only understands "/" separators. On Windows an absolute path
        # such as "C:\\Users\\..." is otherwise treated as a filename in the
        # current working directory and fails to load. Normalize to forward
        # slashes before handing it to SpeechBrain.
        normalized_path = str(audio_path).replace("\\", "/")

        # SpeechBrain loads and normalizes the waveform to the model's expected
        # sample rate (16 kHz). In SpeechBrain >= 1.1 this returns a single
        # tensor [time].
        signal = self.model.load_audio(normalized_path)

        with torch.no_grad():
            embeddings = self.model.encode_batch(signal)
            # embeddings shape: [batch, 1, dimension]
            embedding = embeddings[0].squeeze().numpy()

        # L2 Normalization
        norm = np.linalg.norm(embedding)
        if norm == 0:
            raise ValueError("Zero vector produced during embedding extraction")

        normalized_embedding = embedding / norm

        if np.isnan(normalized_embedding).any() or np.isinf(normalized_embedding).any():
            raise ValueError("Invalid embedding produced (NaN/Inf)")

        return normalized_embedding.tolist()
