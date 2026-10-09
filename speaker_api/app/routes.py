import json

import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import List, Optional

from app.schemas import (
    VoiceprintResponse,
    BuildVoiceprintResponse,
    ComparisonRequest,
    ComparisonResponse,
    SpeakerCandidate,
    IdentificationResponse,
    AyahSearchRequest,
    AyahSearchResponse,
    TranscriptionResponse,
    YouTubeSearchRequest,
    YouTubeSearchResponse,
)
from app.audio_processor import AudioProcessor
from app.embedding_extractor import EmbeddingExtractor
from app.speaker_matcher import SpeakerMatcher
from app.quran_search import QuranSearch
from app.transcription import TranscriptionService
from app.youtube import YouTubeService
from app.config import settings

router = APIRouter(prefix="/api/v1")

# Global state shared with main.py lifespan
app_state = {}

quran_search = QuranSearch()
transcription_service = TranscriptionService()
youtube_service = YouTubeService()


def get_extractor() -> EmbeddingExtractor:
    return app_state["extractor"]


def get_matcher() -> SpeakerMatcher:
    return SpeakerMatcher()


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": app_state["extractor"].model is not None,
        "model_id": settings.MODEL_ID,
    }


@router.post("/voiceprints/extract", response_model=VoiceprintResponse)
async def extract_voiceprint(
    file: UploadFile = File(...),
    extractor: EmbeddingExtractor = Depends(get_extractor),
):
    temp_path, duration, quality = AudioProcessor.preprocess_audio(file)
    try:
        embedding = extractor.extract_embedding(temp_path)
        return {
            "embedding": embedding,
            "embedding_dimension": len(embedding),
            "model_id": settings.MODEL_ID,
            "model_version": settings.MODEL_VERSION,
            "audio_duration": duration,
            "audio_quality": quality,
            "processing_status": "success",
        }
    finally:
        AudioProcessor.cleanup(temp_path)


@router.post("/voiceprints/build", response_model=BuildVoiceprintResponse)
async def build_voiceprint(
    files: List[UploadFile] = File(...),
    extractor: EmbeddingExtractor = Depends(get_extractor),
):
    matcher = SpeakerMatcher()
    accepted_embs = []
    rejected_reasons = []

    for file in files:
        temp_path = None
        try:
            temp_path, _, _ = AudioProcessor.preprocess_audio(file)
            emb = extractor.extract_embedding(temp_path)
            accepted_embs.append(emb)
        except HTTPException as e:
            rejected_reasons.append(f"{file.filename}: {e.detail}")
        except Exception:
            rejected_reasons.append(f"{file.filename}: Unexpected error")
        finally:
            if temp_path:
                AudioProcessor.cleanup(temp_path)

    if not accepted_embs:
        raise HTTPException(status_code=400, detail="No valid audio samples provided")

    prototype, references = matcher.build_voiceprint(accepted_embs)

    return {
        "prototype_embedding": prototype,
        "reference_embeddings": references,
        "accepted_samples": len(accepted_embs),
        "rejected_samples": len(rejected_reasons),
        "rejection_reasons": rejected_reasons,
        "model_id": settings.MODEL_ID,
        "model_version": settings.MODEL_VERSION,
    }


@router.post("/voiceprints/compare", response_model=ComparisonResponse)
async def compare_embeddings(
    req: ComparisonRequest,
    matcher: SpeakerMatcher = Depends(get_matcher),
):
    scores = [matcher.compare_embeddings(req.source_embedding, ref) for ref in req.reference_embeddings]
    sorted_indices = np.argsort(scores)[::-1].tolist()
    return {"scores": scores, "sorted_indices": sorted_indices}


@router.post("/speakers/identify", response_model=IdentificationResponse)
async def identify_speaker(
    file: UploadFile = File(...),
    speakers_data: str = Form(..., description="JSON string with the speakers list"),
    threshold: Optional[float] = None,
    extractor: EmbeddingExtractor = Depends(get_extractor),
    matcher: SpeakerMatcher = Depends(get_matcher),
):
    try:
        data = json.loads(speakers_data)
        candidates = [SpeakerCandidate(**s) for s in data.get("speakers", [])]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid speakers JSON format")

    temp_path, _, _ = AudioProcessor.preprocess_audio(file)
    try:
        target_emb = extractor.extract_embedding(temp_path)
        return matcher.identify_speaker(target_emb, candidates, threshold)
    finally:
        AudioProcessor.cleanup(temp_path)


@router.post("/ayahs/search", response_model=AyahSearchResponse)
async def search_ayah(req: AyahSearchRequest):
    try:
        results = quran_search.search(req.query, req.limit)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"query": req.query, "count": len(results), "results": results}


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
):
    convertible = {"flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm"}
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    extension = (file.filename or "").rsplit(".", 1)[-1].lower()
    if extension and extension not in convertible:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format '{extension}'. Supported: {sorted(convertible)}",
        )

    try:
        result = transcription_service.transcribe(
            filename=file.filename or "audio.wav",
            content=content,
            language=language,
            prompt=prompt,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")

    return {
        "text": result.get("text", ""),
        "language": result.get("language"),
        "duration": result.get("duration"),
        "segments": result.get("segments"),
        "model_id": settings.GROQ_WHISPER_MODEL,
    }


@router.post("/youtube/search", response_model=YouTubeSearchResponse)
async def youtube_search(req: YouTubeSearchRequest):
    try:
        results = youtube_service.search(req.query, req.max_results)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"YouTube search failed: {e}")

    return {"query": req.query, "count": len(results), "results": results}
