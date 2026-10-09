from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class VoiceprintResponse(BaseModel):
    embedding: List[float]
    embedding_dimension: int
    model_id: str
    model_version: str
    audio_duration: float
    audio_quality: Dict[str, Any]
    processing_status: str


class BuildVoiceprintResponse(BaseModel):
    prototype_embedding: List[float]
    reference_embeddings: List[List[float]]
    accepted_samples: int
    rejected_samples: int
    rejection_reasons: List[str]
    model_id: str
    model_version: str


class ComparisonRequest(BaseModel):
    source_embedding: List[float]
    reference_embeddings: List[List[float]]


class ComparisonResponse(BaseModel):
    scores: List[float]
    sorted_indices: List[int]


class SpeakerCandidate(BaseModel):
    speaker_id: str
    speaker_name: str
    prototype_embedding: List[float]
    reference_embeddings: Optional[List[List[float]]] = []


class IdentifyRequest(BaseModel):
    speakers: List[SpeakerCandidate]
    threshold: Optional[float] = None


class IdentificationResponse(BaseModel):
    identified: bool
    speaker_id: Optional[str] = None
    speaker_name: Optional[str] = "Unknown Speaker"
    top1_score: float
    top2_score: float
    score_margin: float
    candidates: List[Dict[str, Any]]
    decision_reason: str


class AyahSearchRequest(BaseModel):
    query: str = Field(..., description="A part/verse of Quran text to search for")
    limit: int = Field(5, ge=1, le=50, description="Maximum number of matches to return")


class AyahResult(BaseModel):
    surah: str
    number: int
    text: str
    score: float


class AyahSearchResponse(BaseModel):
    query: str
    count: int
    results: List[AyahResult]


class TranscriptionResponse(BaseModel):
    text: str
    language: Optional[str] = None
    duration: Optional[float] = None
    segments: Optional[List[Dict[str, Any]]] = None
    model_id: str


class YouTubeSearchRequest(BaseModel):
    query: str = Field(..., description="Search keywords")
    max_results: int = Field(5, ge=1, le=50, description="Maximum number of videos")


class YouTubeVideo(BaseModel):
    video_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    channel_title: Optional[str] = None
    published_at: Optional[str] = None
    thumbnail: Optional[str] = None
    url: Optional[str] = None


class YouTubeSearchResponse(BaseModel):
    query: str
    count: int
    results: List[YouTubeVideo]
