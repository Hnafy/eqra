# Eqra — Quran Reciter & Ayah Recognition Platform

Eqra identifies **who** is reciting a Quran passage, **which ayah** is being recited,
and links a **related YouTube recitation**, from a single audio upload.

The platform is split into three independent parts:

| Layer | Tech | Location | Responsibility |
|-------|------|----------|----------------|
| ML service | Python + FastAPI + SpeechBrain | `speaker_api/` | Speaker embeddings, identification, Quran ayah search, Groq Whisper transcription, YouTube search |
| API backend | Node.js + Express + Mongoose | `backend/` | Auth, speaker/voiceprint management, orchestration, caching, rate limiting |
| Web frontend | React + Vite | `frontend/` *(planned, Phase 3)* | Upload UI and results display |

> The ML logic is **only** in the Python service. The Node backend never
> re-implements inference — it forwards audio to `speaker_api` and shapes the
> response.

---

## How it works

1. An admin uploads reference audio to register a reciter. The Python service
   extracts a 192-D ECAPA-TDNN speaker embedding; the backend stores it
   (normalized-mean prototype + `model_id` / `model_version` / dimension).
2. A user uploads a recitation. The backend forwards it to `speaker_api` for:
   - **reciter identification** — cosine similarity against registered speakers,
   - **transcription** — Groq Whisper,
   - **ayah search** — fuzzy match against `speaker_api/data/quran.json`,
   - **YouTube search** — cached per query.
3. The backend assembles the result; the frontend opens the chosen video in a
   new tab (the original YouTube link, never an embedded iframe).

Scores are **cosine similarities** (dot product of L2-normalized embeddings),
not probabilities. The default identification threshold is `0.25`.

---

## Prerequisites

- Node.js 20+ (tested on v24) and npm
- Python 3.10+ (tested on 3.14) with the packages in `speaker_api/requirements.txt`
- MongoDB running locally (default `mongodb://127.0.0.1:27017/eqra`)
- `ffmpeg` — either on `PATH` or provided via the bundled `imageio-ffmpeg`
- A Groq API key (for transcription) and a YouTube search endpoint

---

## Setup

### 1. ML service (`speaker_api`)

```powershell
cd speaker_api
python -m pip install -r requirements.txt
copy .env.example .env      # then fill in the values
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Key variables in `speaker_api/.env`:

| Variable | Purpose |
|----------|---------|
| `GROQ_API_KEY` | Groq Whisper transcription |
| `API_KEY` | Optional shared secret for the Python API |
| `YOUTUBE_SEARCH_URL` | YouTube search provider |
| `MONGO_URI` | Optional Mongo connection for the Python service |
| `FFMPEG_BINARY` | Override the ffmpeg binary path |
| `TRANSCRIBE_CHUNK_SECONDS` | Chunk size for long audio (default 60) |

### 2. Backend (`backend`)

```powershell
cd backend
npm install
copy .env.example .env      # then fill in the values
npm run seed:admin          # create the first admin (or bootstrap on start)
npm start                   # or: npm run dev
```

Backend variables (see `backend/.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | HTTP port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/eqra` | Mongo connection |
| `JWT_SECRET` | — | Signing secret (required) |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `PYTHON_API_URL` | `http://127.0.0.1:8000` | ML service base URL |
| `PYTHON_API_TIMEOUT_MS` | `180000` | ML request timeout |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin (credentials enabled) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | First-admin bootstrap |
| `MAX_UPLOAD_MB` | `20` | Upload size limit |
| `MIN_ANALYSIS_SECONDS` | `5` | Minimum audio length for analysis |
| `YOUTUBE_CACHE_TTL_HOURS` | `24` | YouTube result cache TTL |

### 3. Start/verify workflow

`backend/scripts/verify-startup.ps1` starts the server only if it is not already
healthy, then polls `/api/health/live` every second for up to 30s:

```powershell
powershell -ExecutionPolicy Bypass -File backend\scripts\verify-startup.ps1
```

Exit codes: `0` = STARTED, `1` = FAILED, `2` = TIMEOUT. stdout/stderr are
written to `%TEMP%\eqra-backend\`.

---

## API reference

### Backend (Express) — base `http://127.0.0.1:5000`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health/live` | — | Liveness (no dependencies) |
| `GET` | `/api/analysis/health` | — | Readiness: MongoDB + Python API |
| `POST` | `/api/auth/login` | — | Admin login; sets an httpOnly cookie |
| `POST` | `/api/auth/logout` | — | Clear the auth cookie |
| `GET` | `/api/auth/me` | admin | Current admin |
| `GET` | `/api/speakers` | admin | List speakers |
| `POST` | `/api/speakers` | admin | Create speaker (multipart `name`, `file`) |
| `GET` | `/api/speakers/:id` | admin | Speaker detail |
| `DELETE` | `/api/speakers/:id` | admin | Delete speaker |
| `GET` | `/api/speakers/:id/references` | admin | List reference embeddings |
| `POST` | `/api/speakers/:id/references` | admin | Add reference (multipart `file`) |
| `DELETE` | `/api/speakers/:id/references/:referenceId` | admin | Remove a reference |
| `POST` | `/api/analysis` | public* | Upload `file` → reciter + ayah + YouTube |

\* Public, protected by a per-IP rate limit.

### ML service (FastAPI) — base `http://127.0.0.1:8000/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Model/status check |
| `POST` | `/voiceprints/extract` | Audio → embedding (+ model id/version, duration, quality) |
| `POST` | `/voiceprints/build` | Many audio files → prototype voiceprint |
| `POST` | `/voiceprints/build-from-embeddings` | Existing embeddings → prototype |
| `POST` | `/voiceprints/compare` | Cosine compare a source vs references |
| `POST` | `/speakers/identify` | Audio + candidates → ranked identification |
| `POST` | `/ayahs/search` | Text → matching ayah(s) (with `surah_number`) |
| `POST` | `/transcribe` | Audio → text (Groq Whisper, chunked) |
| `POST` | `/youtube/search` | Query → related recitation videos |

---

## Data model (MongoDB)

- **Admin** — email, bcrypt password hash, role.
- **Speaker** — `name`, `normalizedName`, `prototypeEmbedding` (192-D),
  embedded `referenceEmbeddings` (embedding + source metadata),
  `modelId`, `modelVersion`, `embeddingDimension`.
  There is deliberately **no image field** — a reciter image, if any, comes only
  from the YouTube result.
- **YouTubeCache** — query → results, with TTL expiry.

Auth uses a signed JWT stored in an httpOnly, `sameSite=lax` cookie
(`secure` in production).

---

## Security notes

- Secrets live only in `.env` files (gitignored) and are never sent to the
  frontend or committed.
- The frontend must not embed YouTube via iframe; it opens the original link in
  a new tab with `rel="noopener noreferrer"`.
- No fake/static results, thumbnails, or links are ever generated — every result
  originates from a real service call.

---

## Project status

- **Phase 1 — Audit:** complete.
- **Phase 2 — Backend & Database:** in progress (models, services, controllers,
  routes, auth, and startup verification implemented).
- **Phase 3 — Frontend (React/Vite):** planned.
- **Phase 4 — Integration:** pending.
- **Phase 5 — Deployment:** pending.

### Tests

```powershell
cd speaker_api
python -m pytest
```

---

## Notes on the ML service

- The Python service loads the SpeechBrain `spkrec-ecapa-voxceleb` model
  (`speaker_api/pretrained_models/`). On Windows the loader uses
  `LocalStrategy.COPY_SKIP_CACHE` to avoid symlink issues.
- Embeddings are 192-dimensional; stored vectors must share the same
  `model_id`, `model_version`, and dimension, otherwise they are skipped during
  identification.
