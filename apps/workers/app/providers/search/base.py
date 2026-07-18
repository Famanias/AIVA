"""ISearchProvider — Abstract base class for web search providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SearchResult:
    title: str
    url: str
    excerpt: str
    score: float = 0.0


class ISearchProvider(ABC):
    @abstractmethod
    async def search(self, query: str, max_results: int = 5) -> list[SearchResult]:
        """Search the web. Returns ranked results."""
        ...
