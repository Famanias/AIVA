"""
Brave Search provider implementation.
"""
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.providers.search.base import ISearchProvider, SearchResult

logger = structlog.get_logger(__name__)

class BraveProvider(ISearchProvider):
    def __init__(self, api_key: str) -> None:
        self._headers = {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": api_key,
        }

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=2, max=60))
    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        logger.debug("brave_search", query=query, max_results=max_results)
        
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                headers=self._headers,
                params={"q": query, "count": max_results},
            )
            response.raise_for_status()
            data = response.json()

        results = []
        for item in data.get("web", {}).get("results", []):
            results.append(SearchResult(
                title=item.get("title", ""),
                url=item.get("url", ""),
                excerpt=item.get("description", ""),
                score=item.get("profile", {}).get("score", 0.0), # Brave specific scoring if available
            ))

        logger.info("brave_search_complete", query=query, results=len(results))
        return results[:max_results]
