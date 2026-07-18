"""Tavily web search provider."""
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.providers.search.base import ISearchProvider, SearchResult

logger = structlog.get_logger(__name__)


class TavilyProvider(ISearchProvider):
    def __init__(self, api_key: str) -> None:
        try:
            from tavily import TavilyClient
            self._client = TavilyClient(api_key=api_key)
        except ImportError as e:
            raise ImportError("tavily-python package not installed") from e

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=2, max=60))
    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        logger.debug("tavily_search", query=query, max_results=max_results)
        try:
            response = self._client.search(
                query=query,
                max_results=max_results,
                search_depth="advanced",
                include_raw_content=False,
            )
            return [
                SearchResult(
                    title=r.get("title", ""),
                    url=r.get("url", ""),
                    excerpt=r.get("content", ""),
                    score=r.get("score", 0.0),
                )
                for r in response.get("results", [])
            ]
        except Exception as e:
            logger.error("tavily_search_failed", error=str(e))
            raise
