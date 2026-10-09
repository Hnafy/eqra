import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app, app_state
from app.embedding_extractor import EmbeddingExtractor


class FakeExtractor:
    model = object()

    def extract_embedding(self, audio_path: str):
        return [1.0, 0.0, 0.0]


@pytest.fixture(scope="module")
def client():
    app_state["extractor"] = FakeExtractor()
    with TestClient(app) as c:
        app_state["extractor"] = FakeExtractor()
        yield c
    app_state.clear()


def test_health(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["model_loaded"] is True


def test_extract_voiceprint(client):
    from tests.test_audio_processor import make_wav_bytes

    resp = client.post(
        "/api/v1/voiceprints/extract",
        files={"file": ("voice.wav", make_wav_bytes(), "audio/wav")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["embedding_dimension"] == 3
    assert body["processing_status"] == "success"


def test_compare_embeddings(client):
    resp = client.post(
        "/api/v1/voiceprints/compare",
        json={"source_embedding": [1.0, 0.0], "reference_embeddings": [[0.0, 1.0], [1.0, 0.0]]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["sorted_indices"][0] == 1
    assert np.isclose(body["scores"][1], 1.0)


def test_identify_speaker(client):
    import json

    from tests.test_audio_processor import make_wav_bytes

    speakers = {
        "speakers": [
            {
                "speaker_id": "user_123",
                "speaker_name": "John Doe",
                "prototype_embedding": [1.0, 0.0, 0.0],
                "reference_embeddings": [],
            },
            {
                "speaker_id": "user_456",
                "speaker_name": "Jane Smith",
                "prototype_embedding": [0.0, 1.0, 0.0],
                "reference_embeddings": [],
            },
        ]
    }
    resp = client.post(
        "/api/v1/speakers/identify",
        files={"file": ("voice.wav", make_wav_bytes(), "audio/wav")},
        data={"speakers_data": json.dumps(speakers), "threshold": "0.25"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["identified"] is True
    assert body["speaker_id"] == "user_123"


def test_identify_invalid_json(client):
    from tests.test_audio_processor import make_wav_bytes

    resp = client.post(
        "/api/v1/speakers/identify",
        files={"file": ("voice.wav", make_wav_bytes(), "audio/wav")},
        data={"speakers_data": "not-json"},
    )
    assert resp.status_code == 400
