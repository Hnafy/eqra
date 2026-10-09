# Speaker Recognition API

Stateless FastAPI service for speaker embedding extraction and speaker identification using
SpeechBrain's ECAPA-TDNN (`speechbrain/spkrec-ecapa-voxceleb`).

## Project Structure

```
speaker_api/
├── app/
│   ├── __init__.py
│   ├── main.py              # Application entry and Lifespan (Model Loading)
│   ├── config.py            # Environment settings
│   ├── routes.py            # API Endpoints
│   ├── audio_processor.py   # FFmpeg processing, VAD, and validation
│   ├── embedding_extractor.py # SpeechBrain Wrapper
│   ├── speaker_matcher.py   # Cosine Similarity & Identification Logic
│   ├── quran_search.py      # Quran verse fuzzy search (data/quran.json)
│   ├── transcription.py     # Groq Whisper transcription wrapper
│   ├── youtube.py           # YouTube Data API search wrapper
│   └── schemas.py           # Pydantic Request/Response models
├── data/
│   └── quran.json           # Quran dataset used by the ayah search
├── tests/
│   ├── __init__.py
│   ├── test_audio_processor.py
│   ├── test_embeddings.py
│   ├── test_matching.py
│   └── test_api.py
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

## 1. Installation

### System Requirements

FFmpeg is required for audio pre-processing. It is **optional** to install it
yourself: if no system `ffmpeg` is found, the bundled `imageio-ffmpeg` binary is
used automatically. You can force a specific binary with the `FFMPEG_BINARY`
environment variable.

- **Ubuntu:** `sudo apt update && sudo apt install ffmpeg`
- **Mac:** `brew install ffmpeg`
- **Windows:** Download from [ffmpeg.org](https://ffmpeg.org) and add to `PATH`.

### Python Setup

```bash
# Create environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Run server
uvicorn app.main:app --reload
```

## 2. How to extract an Embedding

**Endpoint:** `POST /api/v1/voiceprints/extract`
**Payload:** `multipart/form-data` → `file`: (your_audio.wav)

**Response:**

```json
{
  "embedding": [0.012, -0.045],
  "embedding_dimension": 192,
  "model_id": "speechbrain/spkrec-ecapa-voxceleb",
  "model_version": "1.0",
  "audio_duration": 4.5,
  "audio_quality": { "rms": 0.05, "peak": 0.8, "clipping_ratio": 0.0, "sample_rate": 16000 },
  "processing_status": "success"
}
```

## 3. How to Identify a Speaker (Integrating with MongoDB)

Your external application (Node.js/Python/etc.) should fetch the user's stored embeddings
from MongoDB and send them to this API.

**Endpoint:** `POST /api/v1/speakers/identify`
**Payload:** `multipart/form-data`

- `file`: The new audio file to identify
- `speakers_data`: A JSON string containing the candidates

**Example `speakers_data` field:**

```json
{
  "speakers": [
    {
      "speaker_id": "user_123",
      "speaker_name": "John Doe",
      "prototype_embedding": [0.1, -0.2],
      "reference_embeddings": [[0.11, -0.19], [0.09, -0.21]]
    },
    {
      "speaker_id": "user_456",
      "speaker_name": "Jane Smith",
      "prototype_embedding": [-0.5, 0.1],
      "reference_embeddings": []
    }
  ]
}
```

**Final Identification JSON Response:**

```json
{
  "identified": true,
  "speaker_id": "user_123",
  "speaker_name": "John Doe",
  "top1_score": 0.42,
  "top2_score": 0.15,
  "score_margin": 0.27,
  "candidates": [
    { "speaker_id": "user_123", "speaker_name": "John Doe", "score": 0.42 },
    { "speaker_id": "user_456", "speaker_name": "Jane Smith", "score": 0.15 }
  ],
  "decision_reason": "Score above threshold"
}
```

## 4. Search an Ayah (Quran verse)

**Endpoint:** `POST /api/v1/ayahs/search`
**Payload:** `application/json`

```json
{ "query": "قل اعوذ برب الفلق", "limit": 5 }
```

**Response:**

```json
{
  "query": "قل اعوذ برب الفلق",
  "count": 1,
  "results": [
    { "surah": "الفلق", "number": 0, "text": "قُلۡ أَعُوذُ بِرَبِّ ٱلۡفَلَقِ", "score": 100.0 }
  ]
}
```

## 5. Transcribe Arabic Audio

Uses Groq Whisper (`whisper-large-v3-turbo`) and requires `GROQ_API_KEY`.

**Endpoint:** `POST /api/v1/transcribe`
**Payload:** `multipart/form-data`

- `file`: audio file (`wav`, `mp3`, `m4a`, `ogg`, `flac`, `webm`, ...)
- `language`: optional (default `ar`)
- `prompt`: optional context to guide transcription

**Response:**

```json
{
  "text": "قل أعوذ برب الفلق",
  "language": "ar",
  "duration": 3.4,
  "segments": [ { "start": 0.0, "end": 3.4, "text": "قل أعوذ برب الفلق" } ],
  "model_id": "whisper-large-v3-turbo"
}
```

## 6. Search YouTube

Requires `API_KEY` (YouTube Data API v3).

**Endpoint:** `POST /api/v1/youtube/search`
**Payload:** `application/json`

```json
{ "query": "سورة الفلق", "max_results": 5 }
```

**Response:**

```json
{
  "query": "سورة الفلق",
  "count": 1,
  "results": [
    {
      "video_id": "abc123",
      "title": "سورة الفلق",
      "description": "...",
      "channel_title": "Channel",
      "published_at": "2024-01-01T00:00:00Z",
      "thumbnail": "https://...",
      "url": "https://www.youtube.com/watch?v=abc123"
    }
  ]
}
```

## Running Tests
```bash
pytest
```
