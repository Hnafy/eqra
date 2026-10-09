import numpy as np

from app.schemas import SpeakerCandidate
from app.speaker_matcher import SpeakerMatcher


def normalize(vec):
    arr = np.array(vec, dtype=float)
    return (arr / np.linalg.norm(arr)).tolist()


A = normalize([1.0, 0.0, 0.0])
A_NOISY = normalize([0.95, 0.1, 0.05])
B = normalize([0.0, 1.0, 0.0])


def test_identical_embeddings_score_one():
    assert np.isclose(SpeakerMatcher.compare_embeddings(A, A), 1.0)


def test_orthogonal_embeddings_score_zero():
    assert np.isclose(SpeakerMatcher.compare_embeddings(A, B), 0.0)


def test_identify_finds_correct_speaker():
    matcher = SpeakerMatcher()
    candidates = [
        SpeakerCandidate(speaker_id="u1", speaker_name="John", prototype_embedding=A, reference_embeddings=[A_NOISY]),
        SpeakerCandidate(speaker_id="u2", speaker_name="Jane", prototype_embedding=B, reference_embeddings=[]),
    ]
    result = matcher.identify_speaker(A_NOISY, candidates, custom_threshold=0.5)

    assert result["identified"] is True
    assert result["speaker_id"] == "u1"
    assert result["top1_score"] > result["top2_score"]
    assert len(result["candidates"]) == 2


def test_identify_below_threshold_returns_unknown():
    matcher = SpeakerMatcher()
    candidates = [
        SpeakerCandidate(speaker_id="u2", speaker_name="Jane", prototype_embedding=B, reference_embeddings=[]),
    ]
    result = matcher.identify_speaker(A, candidates, custom_threshold=0.9)

    assert result["identified"] is False
    assert result["speaker_id"] is None
    assert result["speaker_name"] == "Unknown Speaker"
    assert result["decision_reason"] == "Insufficient similarity score"


def test_build_voiceprint_prototype_is_normalized():
    matcher = SpeakerMatcher()
    prototype, references = matcher.build_voiceprint([A, A_NOISY])

    assert np.isclose(np.linalg.norm(prototype), 1.0, atol=1e-6)
    assert len(references) == 2
