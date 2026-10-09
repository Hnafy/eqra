import json
import os
import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Dict, List

from app.config import settings


def normalize(text: str) -> str:
    """Normalize Arabic text by removing diacritics and unifying letter forms."""
    text = unicodedata.normalize("NFKC", text)

    # Remove Arabic diacritics and Quranic marks
    text = re.sub(r"[\u064B-\u065F\u0670\u06D6-\u06ED]", "", text)

    # Normalize Alif variations
    text = re.sub(r"[أإآٱ]", "ا", text)

    # Normalize Alif Maqsura
    text = text.replace("ى", "ي")

    # Remove extra spaces
    text = re.sub(r"\s+", " ", text).strip()

    return text


class QuranSearch:
    """Loads quran.json and searches verses by fuzzy text match."""

    def __init__(self, path: str = None):
        self.path = path or settings.QURAN_JSON_PATH
        self.verses: List[Dict[str, Any]] = []
        self._loaded = False

    def load(self) -> None:
        if self._loaded:
            return
        if not os.path.exists(self.path):
            raise FileNotFoundError(f"Quran dataset not found at: {self.path}")

        with open(self.path, "r", encoding="utf-8") as file:
            quran = json.load(file)

        for surah in quran:
            for ayah in surah["ayahs"]:
                self.verses.append({
                    "surah": surah["name"],
                    "number": ayah["number"],
                    "text": ayah["ayah"].strip(),
                    "normalized": normalize(ayah["ayah"]),
                })

        self._loaded = True

    def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        self.load()

        normalized_query = normalize(query)
        if not normalized_query:
            return []

        results = []

        for verse in self.verses:
            text = verse["normalized"]

            # Exact substring match
            if normalized_query in text:
                score = 100.0
            else:
                # Compare against sliding windows of the verse
                words = text.split()
                query_words = normalized_query.split()
                size = len(query_words)

                best_score = 0.0

                for i in range(len(words) - size + 1):
                    part = " ".join(words[i:i + size])
                    score_part = SequenceMatcher(None, normalized_query, part).ratio() * 100
                    best_score = max(best_score, score_part)

                # Also compare against the full verse
                full_score = SequenceMatcher(None, normalized_query, text).ratio() * 100

                score = max(best_score, full_score)

            results.append({
                "surah": verse["surah"],
                "number": verse["number"],
                "text": verse["text"],
                "score": score,
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
