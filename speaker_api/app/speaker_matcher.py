from typing import List, Dict, Any, Tuple

import numpy as np

from app.config import settings


class SpeakerMatcher:
    @staticmethod
    def compare_embeddings(emb1: List[float], emb2: List[float]) -> float:
        """Calculate Cosine Similarity between two embeddings"""
        v1 = np.array(emb1)
        v2 = np.array(emb2)
        # Since we apply L2 normalization during extraction,
        # cosine similarity is simply the dot product
        return float(np.dot(v1, v2))

    def identify_speaker(self,
                         target_emb: List[float],
                         candidates: List[Any],
                         custom_threshold: float = None) -> Dict[str, Any]:
        """
        Compares target embedding against a list of candidates.
        Returns top 3 and the identification decision.
        """
        threshold = custom_threshold or settings.DEFAULT_SIMILARITY_THRESHOLD
        results = []

        for candidate in candidates:
            # Strategy: Compare against prototype AND all reference embeddings
            scores = []
            if candidate.prototype_embedding:
                scores.append(self.compare_embeddings(target_emb, candidate.prototype_embedding))

            if candidate.reference_embeddings:
                for ref in candidate.reference_embeddings:
                    scores.append(self.compare_embeddings(target_emb, ref))

            if not scores:
                continue

            # Use the maximum similarity found for this person (Max-Pooling Strategy)
            best_score = max(scores)
            results.append({
                "speaker_id": candidate.speaker_id,
                "speaker_name": candidate.speaker_name,
                "score": best_score
            })

        # Sort by score descending
        results.sort(key=lambda x: x["score"], reverse=True)

        top1 = results[0] if len(results) > 0 else {"score": 0.0, "speaker_id": None, "speaker_name": "Unknown Speaker"}
        top2 = results[1] if len(results) > 1 else {"score": 0.0}

        score_margin = top1["score"] - top2["score"]

        identified = False
        decision_reason = "Insufficient similarity score"

        if top1["score"] >= threshold:
            identified = True
            decision_reason = "Score above threshold"
            if score_margin < 0.05:
                decision_reason += " (Low margin between candidates)"

        return {
            "identified": identified,
            "speaker_id": top1["speaker_id"] if identified else None,
            "speaker_name": top1["speaker_name"] if identified else "Unknown Speaker",
            "top1_score": top1["score"],
            "top2_score": top2["score"],
            "score_margin": score_margin,
            "candidates": results[:3],
            "decision_reason": decision_reason
        }

    def build_voiceprint(self, embeddings: List[List[float]]) -> Tuple[List[float], List[List[float]]]:
        """
        Implements Strategy A: Normalized Mean Embedding
        And Strategy B: Return all reference embeddings
        """
        # Strategy A: Mean
        matrix = np.array(embeddings)
        mean_emb = np.mean(matrix, axis=0)
        # L2 Normalize the result
        norm = np.linalg.norm(mean_emb)
        prototype = (mean_emb / norm).tolist()

        # Strategy B: Keep originals
        references = [emb for emb in embeddings]

        return prototype, references
