"""Pexels stock video provider."""
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.providers.stock.base import IStockProvider, StockClip

logger = structlog.get_logger(__name__)
PEXELS_API_BASE = "https://api.pexels.com/videos"


class PexelsProvider(IStockProvider):
    def __init__(self, api_key: str) -> None:
        self._headers = {"Authorization": api_key}

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=2, max=60))
    async def search(self, keywords: str, min_duration_sec: float = 5.0) -> list[StockClip]:
        logger.debug("pexels_search", keywords=keywords)
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{PEXELS_API_BASE}/search",
                headers=self._headers,
                params={"query": keywords, "per_page": 15, "orientation": "landscape"},
            )
            response.raise_for_status()
            data = response.json()

        clips = []
        for video in data.get("videos", []):
            duration = video.get("duration", 0)
            if duration < min_duration_sec:
                continue

            # Pick the best quality file (1080p preferred, otherwise highest available)
            files = sorted(
                video.get("video_files", []),
                key=lambda f: f.get("width", 0),
                reverse=True,
            )
            best = next((f for f in files if f.get("width", 0) >= 1920), files[0] if files else None)
            if not best:
                continue

            clips.append(StockClip(
                id=str(video.get("id", "")),
                url=best.get("link", ""),
                preview_url=video.get("image", ""),
                duration_sec=float(duration),
                width=best.get("width", 0),
                height=best.get("height", 0),
                tags=[t.get("title", "") for t in video.get("tags", [])],
                provider="pexels",
            ))

        logger.info("pexels_search_complete", keywords=keywords, results=len(clips))
        return clips
