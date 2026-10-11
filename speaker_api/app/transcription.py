import os
import subprocess
import tempfile
from typing import Any, Dict, List

from app.config import settings
from app.audio_processor import resolve_ffmpeg


class TranscriptionService:
    """Wraps the Groq Whisper transcription client (Arabic by default)."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if not settings.GROQ_API_KEY:
                raise RuntimeError("GROQ_API_KEY is not configured")
            from groq import Groq

            self._client = Groq(api_key=settings.GROQ_API_KEY)
        return self._client

    def transcribe(
        self,
        filename: str,
        content: bytes,
        language: str = None,
        prompt: str = None,
        response_format: str = "verbose_json",
    ) -> Dict[str, Any]:
        transcription = self.client.audio.transcriptions.create(
            file=(filename, content),
            model=settings.GROQ_WHISPER_MODEL,
            language=language or settings.DEFAULT_LANGUAGE,
            temperature=0,
            response_format=response_format,
            **({"prompt": prompt} if prompt else {}),
        )

        return self._to_dict(transcription)

    def transcribe_file(
        self,
        path: str,
        filename: str = None,
        language: str = None,
        prompt: str = None,
    ) -> Dict[str, Any]:
        """Transcribe an audio file, splitting it into chunks when it is longer
        than ``TRANSCRIBE_CHUNK_SECONDS`` to stay within Groq size limits.
        """
        import soundfile as sf

        filename = filename or os.path.basename(path)
        wav_path = self._to_wav(path)
        try:
            try:
                duration = float(sf.info(wav_path).duration)
            except Exception:
                duration = None

            chunk_seconds = max(10, settings.TRANSCRIBE_CHUNK_SECONDS)

            if duration is not None and duration > chunk_seconds:
                return self._transcribe_chunked(
                    wav_path, filename, duration, chunk_seconds, language, prompt
                )

            with open(wav_path, "rb") as handle:
                content = handle.read()
            result = self.transcribe(filename, content, language, prompt)
            if duration is not None:
                result["duration"] = duration
            return result
        finally:
            if os.path.exists(wav_path):
                os.remove(wav_path)

    def _transcribe_chunked(
        self,
        wav_path: str,
        filename: str,
        duration: float,
        chunk_seconds: int,
        language: str,
        prompt: str,
    ) -> Dict[str, Any]:
        chunk_paths = self._split(wav_path, chunk_seconds)
        texts: List[str] = []
        segments: List[Dict[str, Any]] = []

        try:
            offset = 0.0
            for index, chunk_path in enumerate(chunk_paths):
                with open(chunk_path, "rb") as handle:
                    content = handle.read()
                result = self.transcribe(f"{filename}_part{index}", content, language, prompt)
                texts.append((result.get("text") or "").strip())

                for seg in result.get("segments") or []:
                    seg = self.segments_to_list([seg])[0]
                    if "start" in seg:
                        seg["start"] = float(seg["start"]) + offset
                    if "end" in seg:
                        seg["end"] = float(seg["end"]) + offset
                    segments.append(seg)

                offset += chunk_seconds
        finally:
            for chunk_path in chunk_paths:
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)

        return {
            "text": " ".join(t for t in texts if t).strip(),
            "language": language or settings.DEFAULT_LANGUAGE,
            "duration": duration,
            "segments": segments,
        }

    @staticmethod
    def _to_wav(path: str) -> str:
        out_path = path + ".transcribe.wav"
        cmd = [
            resolve_ffmpeg(), "-y", "-i", path,
            "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le", out_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Audio conversion failed: {result.stderr}")
        return out_path

    @staticmethod
    def _split(wav_path: str, chunk_seconds: int) -> List[str]:
        out_dir = tempfile.mkdtemp(prefix="transcribe_")
        pattern = os.path.join(out_dir, "part_%03d.wav")
        cmd = [
            resolve_ffmpeg(), "-y", "-i", wav_path,
            "-f", "segment", "-segment_time", str(chunk_seconds),
            "-ac", "1", "-ar", "16000", "-acodec", "pcm_s16le", pattern,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Audio splitting failed: {result.stderr}")
        return sorted(
            os.path.join(out_dir, name)
            for name in os.listdir(out_dir)
            if name.endswith(".wav")
        )

    @staticmethod
    def _to_dict(transcription: Any) -> Dict[str, Any]:
        # Groq returns a pydantic-like object; normalize it to a plain dict.
        if hasattr(transcription, "model_dump"):
            return transcription.model_dump()
        if isinstance(transcription, dict):
            return transcription
        return {"text": getattr(transcription, "text", "")}

    @staticmethod
    def segments_to_list(segments: List[Any]) -> List[Dict[str, Any]]:
        result = []
        for seg in segments or []:
            if hasattr(seg, "model_dump"):
                result.append(seg.model_dump())
            elif isinstance(seg, dict):
                result.append(seg)
        return result
