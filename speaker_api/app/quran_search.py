import json
import os
import re
import unicodedata
from typing import Any, Dict, List, Optional, Set

import numpy as np

from app.config import settings

try:
    from rapidfuzz import fuzz, process
except ImportError:  # pragma: no cover - optional dependency
    fuzz = process = None

# Candidates must be at least as long as the query (so they can contain the
# whole recording) and at most this multiple of it (so we don't score the many
# long windows that merely happen to fit the query as a substring).
LENGTH_BAND = 1.8

# When more than this many length-compatible windows exist, a cheap full-string
# `ratio` pass first keeps this many candidates which are then scored precisely
# with `partial_ratio`. This keeps worst-case latency low without changing the
# ranked order for typical (few-candidate) recitations.
COARSE_TOPK = 400


# ------------------------------------------------------------------ numbers
# In this dataset surah 1 (Al-Fatiha) keeps its numbers (bismillah = 0, "الحمد
# لله" = 1); every other surah is numbered from 0, so the real ayah number is
# `number + 1`.
SHOW_REAL_NUMBER = True


def real_number(surah_number: int, number: int) -> int:
    return number if surah_number == 1 else number + 1


# ------------------------------------------------------------- normalization
# Diacritics + Quranic marks + tatweel.
_MARKS = re.compile("[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]")
_LETTER_MAP = str.maketrans({
    "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
    "ى": "ي", "ئ": "ي", "ة": "ه", "ؤ": "و",
})


def normalize(text: str) -> str:
    """Strip diacritics/spaces/hamzas and drop the alef (it is written
    inconsistently: العالمين / العٰلمين), keeping only the core letters. Works
    the same on vocalized and unvocalized text."""
    text = unicodedata.normalize("NFC", text)
    text = _MARKS.sub("", text)
    text = text.translate(_LETTER_MAP)
    text = text.replace("ا", "").replace("ء", "")
    return re.sub(r"[^\u0621-\u064A]", "", text)


def _trigrams(text: str) -> Set[str]:
    return {text[i:i + 3] for i in range(len(text) - 2)} if len(text) >= 3 else {text}


class _Window:
    __slots__ = ("surah", "start", "end", "text", "grams")

    def __init__(self, surah: int, start: int, end: int, text: str):
        self.surah = surah
        self.start = start
        self.end = end
        self.text = text
        self.grams: Optional[Set[str]] = None


class QuranSearch:
    """Fuzzy search over the Quran that matches a recording covering one or
    several consecutive ayahs, even with transcription errors.

    It indexes every window of up to ``QURAN_MAX_WINDOW`` consecutive ayahs and
    scores the query against each using rapidfuzz (with a trigram fallback)."""

    def __init__(self, path: str = None, max_window: int = None):
        self.path = path or settings.QURAN_JSON_PATH
        self.max_window = max_window or settings.QURAN_MAX_WINDOW
        self.data: List[Dict[str, Any]] = []
        self.windows: List[_Window] = []
        self.lens: Optional[np.ndarray] = None
        self._loaded = False

    # ------------------------------------------------------------------ load
    def load(self) -> None:
        if self._loaded:
            return
        if not os.path.exists(self.path):
            raise FileNotFoundError(f"Quran dataset not found at: {self.path}")

        with open(self.path, "r", encoding="utf-8") as file:
            data = json.load(file)

        windows: List[_Window] = []
        for surah_index, surah in enumerate(data, start=1):
            keys = [normalize(ayah["ayah"]) for ayah in surah["ayahs"]]
            count = len(keys)
            for start in range(count):
                for size in range(1, self.max_window + 1):
                    if start + size > count:
                        break
                    text = "".join(keys[start:start + size])
                    if text:
                        window = _Window(surah_index - 1, start, start + size - 1, text)
                        if fuzz is None:
                            window.grams = _trigrams(text)
                        windows.append(window)

        self.data = data
        self.windows = windows
        self.lens = np.fromiter((len(w.text) for w in windows), dtype=np.int32, count=len(windows))
        self._loaded = True

    # ---------------------------------------------------------------- scoring
    @staticmethod
    def _score(query: str, query_grams: Set[str], window: _Window) -> float:
        # Fallback used only when rapidfuzz is unavailable: fraction of query
        # trigrams present in the window.
        if query in window.text:
            return 100.0
        if not query_grams:
            return 0.0
        return 100.0 * len(query_grams & (window.grams or set())) / len(query_grams)

    def _rank(self, query: str, query_grams: Set[str], qlen: int) -> List:
        if fuzz is None:
            return [(self._score(query, query_grams, w), w) for w in self.windows]

        # Only windows long enough to contain the whole recording can be the
        # passage. Capping the upper bound drops the many long windows that fit
        # the query only as a substring, keeping scoring fast.
        hi = max(qlen + 1, int(qlen * LENGTH_BAND))
        idx = np.nonzero((self.lens >= qlen) & (self.lens <= hi))[0]

        if idx.size == 0:
            # Recording longer than the widest indexed window: compare full text
            # against the widest windows.
            idx = np.nonzero(np.array([(w.end - w.start + 1) == self.max_window for w in self.windows]))[0]
            if idx.size == 0:
                idx = np.arange(len(self.windows))
            texts = [self.windows[i].text for i in idx]
            scores = process.cdist([query], texts, scorer=fuzz.ratio, workers=-1)[0]
            return [(float(scores[k]), self.windows[i]) for k, i in enumerate(idx)]

        # Two-stage scoring. When many windows are length-compatible a cheap
        # full-string ratio keeps the best COARSE_TOPK candidates, which are then
        # scored precisely with partial_ratio. This cuts the worst-case latency
        # ~50x while still ranking the correct passage first; small candidate
        # sets (short/typical recordings) skip the prefilter and stay exact.
        if idx.size > COARSE_TOPK:
            coarse = process.cdist(
                [query], [self.windows[i].text for i in idx], scorer=fuzz.ratio, workers=-1
            )[0]
            top = np.argpartition(coarse, -COARSE_TOPK)[-COARSE_TOPK:]
            idx = idx[top]

        texts = [self.windows[i].text for i in idx]
        scores = process.cdist([query], texts, scorer=fuzz.partial_ratio, workers=-1)[0]
        return [(float(scores[k]), self.windows[i]) for k, i in enumerate(idx)]

    # ----------------------------------------------------------------- search
    def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        self.load()

        normalized = normalize(query)
        if len(normalized) < 3:
            return []
        query_grams = _trigrams(normalized)

        scored = self._rank(normalized, query_grams, len(normalized))
        # Best match first, then fewest ayahs, then shortest text (tightest).
        scored.sort(key=lambda item: (-item[0], item[1].end - item[1].start, len(item[1].text)))

        results: List[Dict[str, Any]] = []
        taken: List[_Window] = []
        for score, window in scored:
            # Skip windows that overlap an already-accepted (better) result.
            if any(
                other.surah == window.surah and not (window.end < other.start or window.start > other.end)
                for other in taken
            ):
                continue
            taken.append(window)
            results.append(self._to_result(score, window))
            if len(results) >= limit:
                break

        return results

    def _to_result(self, score: float, window: _Window) -> Dict[str, Any]:
        surah = self.data[window.surah]
        ayahs = surah["ayahs"][window.start:window.end + 1]
        surah_number = window.surah + 1

        numbers = [ayah["number"] for ayah in ayahs]
        if SHOW_REAL_NUMBER:
            numbers = [real_number(surah_number, number) for number in numbers]

        text = " ".join(ayah["ayah"].strip() for ayah in ayahs)

        return {
            "surah": surah["name"],
            "surah_number": surah_number,
            "number": numbers[0],
            "end_surah": surah["name"],
            "end_surah_number": surah_number,
            "end_number": numbers[-1],
            "verse_count": window.end - window.start + 1,
            "text": text,
            "score": round(float(score), 2),
        }
