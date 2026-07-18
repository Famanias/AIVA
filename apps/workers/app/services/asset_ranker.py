from typing import List
from app.models.asset import RankedCandidate

class AssetRanker:
    """
    Semantic evaluation via sentence-transformers, returning fully enriched
    RankedCandidate objects for the Operations Dashboard.
    """

    def __init__(self):
        # We lazily load sentence_transformers to avoid massive overhead on startup
        # if the worker isn't performing asset ranking right away.
        self._model = None

    def _get_model(self):
        if self._model is None:
            try:
                from sentence_transformers import SentenceTransformer
                print("[AssetRanker] Loading all-MiniLM-L6-v2...")
                self._model = SentenceTransformer('all-MiniLM-L6-v2')
            except ImportError:
                print("[AssetRanker] WARNING: sentence_transformers not installed. Falling back to dummy ranker.")
                self._model = "dummy"
        return self._model

    def rank(self, scene_text: str, candidates: List[RankedCandidate]) -> List[RankedCandidate]:
        if not candidates:
            return []

        model = self._get_model()
        if model == "dummy":
            # If the library isn't available, we just return them in their original order with a fake score
            for c in candidates:
                c.score = 0.5
                c.reason = "Dummy ranker fallback"
            return candidates

        from sentence_transformers import util

        # Encode the target scene
        scene_embedding = model.encode(scene_text)

        # Build candidate texts
        # We rely on the raw_metadata 'description' populated by the provider
        candidate_texts = [
            str(c.raw_metadata.get("description", "")) for c in candidates
        ]

        # Encode candidates
        candidate_embeddings = model.encode(candidate_texts)

        # Compute cosine similarities
        cosine_scores = util.cos_sim(scene_embedding, candidate_embeddings)[0]

        # Update candidates
        for i, candidate in enumerate(candidates):
            candidate.score = float(cosine_scores[i])
            candidate.reason = f"Cosine similarity to scene text"

        # Sort descending by score
        candidates.sort(key=lambda x: x.score, reverse=True)
        return candidates
