"""IStockProvider — Abstract base class for stock media providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class StockClip:
    id: str
    url: str
    preview_url: str
    duration_sec: float
    width: int
    height: int
    tags: list[str] = field(default_factory=list)
    provider: str = ""


class IStockProvider(ABC):
    @abstractmethod
    async def search(self, keywords: str, min_duration_sec: float = 5.0) -> list[StockClip]:
        """Search for stock video clips. Returns clips sorted by relevance."""
        ...
