from typing import List
from app.models.asset import RankedCandidate
from app.providers.asset_providers import IAssetProvider

class AssetSearchService:
    """
    Provider-agnostic search execution.
    Only interfaces with IAssetProvider, knowing nothing about Pexels or SDXL specifically.
    """
    
    @staticmethod
    async def search(provider: IAssetProvider, query: str, limit: int = 25) -> List[RankedCandidate]:
        print(f"[AssetSearchService] Searching provider '{provider.name}' for query: {query}")
        
        # Determine if it's a generation provider or search provider dynamically.
        # This can be handled better with capabilities, but for now we fallback.
        try:
            candidates = await provider.search(query, limit)
            return candidates
        except NotImplementedError:
            try:
                candidates = await provider.generate(query)
                return candidates
            except NotImplementedError:
                return []
