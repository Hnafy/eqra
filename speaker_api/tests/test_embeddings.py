import numpy as np
import pytest

from app.embedding_extractor import EmbeddingExtractor


class FakeModel:
    def load_audio(self, audio_path):
        import torch

        return torch.zeros(1, 16000)

    def encode_batch(self, signal):
        import torch

        return torch.tensor([[[1.0, 2.0, 3.0, 4.0]]])


def test_extract_embedding_is_l2_normalized(tmp_path):
    extractor = EmbeddingExtractor()
    extractor.model = FakeModel()

    emb = extractor.extract_embedding(str(tmp_path / "dummy.wav"))

    assert len(emb) == 4
    assert np.isclose(np.linalg.norm(emb), 1.0, atol=1e-6)


def test_extract_embedding_without_model_raises(tmp_path):
    extractor = EmbeddingExtractor()
    with pytest.raises(RuntimeError):
        extractor.extract_embedding(str(tmp_path / "dummy.wav"))
