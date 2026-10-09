from typing import Any, Dict, List

from app.config import settings


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
