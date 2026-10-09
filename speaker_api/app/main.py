from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routes import router, app_state
from app.embedding_extractor import EmbeddingExtractor


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load Model
    print("Loading Speaker Recognition Model...")
    extractor = EmbeddingExtractor()
    extractor.load_model()
    app_state["extractor"] = extractor
    print("Model loaded successfully.")
    yield
    # Shutdown: Cleanup if necessary
    app_state.clear()


app = FastAPI(
    title="Speaker Recognition API",
    description="Stateless API for Speaker Embedding Extraction and Identification",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(router)
