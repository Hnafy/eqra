import os
import subprocess
import shutil
import numpy as np
import soundfile as sf
import tempfile
from fastapi import HTTPException
from app.config import settings


def resolve_ffmpeg() -> str:
    """Return an ffmpeg executable path.

    Priority: config override > system PATH > bundled imageio-ffmpeg binary.
    """
    if settings.FFMPEG_BINARY and os.path.exists(settings.FFMPEG_BINARY):
        return settings.FFMPEG_BINARY

    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


class AudioProcessor:
    @staticmethod
    def preprocess_audio(upload_file) -> tuple[str, float, dict]:
        """
        Validates and converts audio to 16kHz Mono WAV using FFmpeg.
        Returns: (temp_file_path, duration, quality_metrics)
        """
        # 1. Create temporary files
        suffix = f"_{upload_file.filename}.wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_in:
            content = upload_file.file.read()
            temp_in.write(content)
            temp_in_path = temp_in.name

        temp_out_path = temp_in_path + ".processed.wav"

        try:
            # 2. FFmpeg Conversion: Mono, 16kHz, PCM 16-bit
            cmd = [
                resolve_ffmpeg(), '-y', '-i', temp_in_path,
                '-ac', '1', '-ar', str(settings.SAMPLE_RATE),
                '-acodec', 'pcm_s16le', temp_out_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise HTTPException(status_code=400, detail=f"Audio decoding failed: {result.stderr}")

            # 3. Load and Analyze
            audio, sr = sf.read(temp_out_path)
            duration = len(audio) / sr

            if duration < settings.MIN_AUDIO_DURATION:
                raise HTTPException(status_code=400, detail=f"Audio too short. Min: {settings.MIN_AUDIO_DURATION}s")
            if duration > settings.MAX_AUDIO_DURATION:
                raise HTTPException(status_code=400, detail=f"Audio too long. Max: {settings.MAX_AUDIO_DURATION}s")

            # 4. Quality Checks
            rms = np.sqrt(np.mean(audio ** 2))
            peak = np.max(np.abs(audio))

            if rms < 0.001:
                raise HTTPException(status_code=400, detail="Audio is too silent/empty")

            clipping = np.sum(np.abs(audio) >= 0.99) / len(audio)

            quality = {
                "rms": float(rms),
                "peak": float(peak),
                "clipping_ratio": float(clipping),
                "sample_rate": sr
            }

            return temp_out_path, duration, quality

        finally:
            # Clean up input temp file immediately
            if os.path.exists(temp_in_path):
                os.remove(temp_in_path)

    @staticmethod
    def cleanup(file_path: str):
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
