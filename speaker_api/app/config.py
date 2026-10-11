import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load speaker_api/.env (or the nearest .env found upward, e.g. the project root).
load_dotenv()

_APP_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    MODEL_ID: str = os.getenv("MODEL_ID", "speechbrain/spkrec-ecapa-voxceleb")
    MODEL_VERSION: str = os.getenv("MODEL_VERSION", "1.0")
    MODEL_SAVEDIR: str = os.getenv("MODEL_SAVEDIR", "pretrained_models/spkrec-ecapa-voxceleb")
    # LocalStrategy for SpeechBrain/HF downloads. On Windows, symlinks require
    # special privileges, so we default to COPY_SKIP_CACHE (direct download).
    LOCAL_STRATEGY: str = os.getenv("LOCAL_STRATEGY", "copy_skip_cache")
    SAMPLE_RATE: int = int(os.getenv("SAMPLE_RATE", 16000))
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", 10))
    MIN_AUDIO_DURATION: float = float(os.getenv("MIN_AUDIO_DURATION", 1.0))
    MAX_AUDIO_DURATION: float = float(os.getenv("MAX_AUDIO_DURATION", 60.0))
    DEFAULT_SIMILARITY_THRESHOLD: float = float(os.getenv("DEFAULT_SIMILARITY_THRESHOLD", 0.25))
    # Optional explicit path to the ffmpeg executable. When empty, the system
    # ffmpeg is used, falling back to the bundled imageio-ffmpeg binary.
    FFMPEG_BINARY: str = os.getenv("FFMPEG_BINARY", "")

    # Transcription (Groq Whisper)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_WHISPER_MODEL: str = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
    DEFAULT_LANGUAGE: str = os.getenv("DEFAULT_LANGUAGE", "ar")
    # Audio longer than this is split into chunks before transcription to stay
    # within Groq's per-request limits.
    TRANSCRIBE_CHUNK_SECONDS: int = int(os.getenv("TRANSCRIBE_CHUNK_SECONDS", 60))
    TRANSCRIBE_MAX_MB: int = int(os.getenv("TRANSCRIBE_MAX_MB", 24))

    # YouTube Data API
    YOUTUBE_API_KEY: str = os.getenv("API_KEY", os.getenv("YOUTUBE_API_KEY", ""))
    YOUTUBE_SEARCH_URL: str = os.getenv(
        "YOUTUBE_SEARCH_URL", "https://www.googleapis.com/youtube/v3/search"
    )
    YOUTUBE_TIMEOUT: int = int(os.getenv("YOUTUBE_TIMEOUT", 15))

    # Quran dataset
    QURAN_JSON_PATH: str = os.getenv(
        "QURAN_JSON_PATH", os.path.join(_APP_ROOT, "data", "quran.json")
    )
    # Quran search: maximum number of consecutive ayahs a single match may span.
    QURAN_MAX_WINDOW: int = int(os.getenv("QURAN_MAX_WINDOW", "8"))


settings = Settings()