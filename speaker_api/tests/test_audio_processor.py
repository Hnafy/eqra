import io
import os

import numpy as np
import pytest
import soundfile as sf
from fastapi import HTTPException

from app.audio_processor import AudioProcessor


class FakeUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.file = io.BytesIO(content)


def make_wav_bytes(duration: float = 2.0, sr: int = 16000, amplitude: float = 0.3) -> bytes:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    audio = (amplitude * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    buffer = io.BytesIO()
    sf.write(buffer, audio, sr, format="WAV")
    return buffer.getvalue()


def test_preprocess_valid_audio(tmp_path):
    upload = FakeUploadFile("sample.wav", make_wav_bytes())
    path, duration, quality = AudioProcessor.preprocess_audio(upload)
    try:
        assert os.path.exists(path)
        assert duration >= 1.0
        assert quality["sample_rate"] == 16000
        assert quality["rms"] > 0.001
    finally:
        AudioProcessor.cleanup(path)
        assert not os.path.exists(path)


def test_preprocess_too_short_audio():
    upload = FakeUploadFile("short.wav", make_wav_bytes(duration=0.3))
    with pytest.raises(HTTPException) as exc:
        AudioProcessor.preprocess_audio(upload)
    assert exc.value.status_code == 400
    assert "too short" in exc.value.detail


def test_preprocess_silent_audio():
    upload = FakeUploadFile("silent.wav", make_wav_bytes(amplitude=0.0))
    with pytest.raises(HTTPException) as exc:
        AudioProcessor.preprocess_audio(upload)
    assert exc.value.status_code == 400
    assert "silent" in exc.value.detail


def test_cleanup_missing_file_is_noop():
    AudioProcessor.cleanup("/nonexistent/file.wav")
    AudioProcessor.cleanup(None)
