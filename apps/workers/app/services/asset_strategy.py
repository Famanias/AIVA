from typing import List, Optional
from app.models.asset import RankedCandidate, AssetConfig
from app.providers.asset_providers import IAssetProvider, PexelsProvider, PixabayProvider, PollinationsProvider, SDXLProvider
from app.providers.fallback_provider import LocalSolidFallbackProvider
from app.services.asset_search import AssetSearchService
from app.services.asset_ranker import AssetRanker
from app.services.asset_downloader import AssetDownloader
from app.services.asset_validator import AssetValidator
from app.repositories.asset_repository import IAssetRepository

class AssetSelectionStrategy:
    """
    The sole owner of provider ordering. Loops through a dynamic chain.
    """
    def __init__(self, repository: IAssetRepository):
        self.repository = repository
        self.ranker = AssetRanker()
        
        # Multi-Tier Provider Chain Definition
        self.chain: List[IAssetProvider] = [
            PexelsProvider(),
            PixabayProvider(),
            PollinationsProvider(),
            SDXLProvider(),
            LocalSolidFallbackProvider(),
        ]

    async def resolve_for_scene(self, scene_text: str, query: str, config: AssetConfig) -> Optional[RankedCandidate]:
        for provider in self.chain:
            try:
                # 1. Search / Generate
                candidates = await AssetSearchService.search(provider, query, limit=config.max_candidates)
                
                if not candidates:
                    continue
                    
                # 2. Rank
                ranked = self.ranker.rank(scene_text, candidates)
                if not ranked:
                    continue
                    
                best_candidate = ranked[0]
                
                # Check semantic threshold (unless it's a generated or fallback asset which always scores 1.0)
                is_generated = provider.name in ("pollinations", "sdxl", "local_fallback")
                if best_candidate.score < config.semantic_threshold and not is_generated:
                    print(f"[AssetSelectionStrategy] Best match for '{query}' on {provider.name} scored {best_candidate.score}, which is below threshold {config.semantic_threshold}. Skipping provider.")
                    continue

                # 3. Download
                temp_file = await AssetDownloader.download(best_candidate.raw_metadata.get("url", ""))
                
                # 4. Validate
                mime_type = best_candidate.raw_metadata.get("mime_type", "video/mp4")
                validation = AssetValidator.validate(temp_file, mime_type)
                
                # 5. Persist
                origin = "generated" if provider.name == "sdxl" else "stock"
                asset_ref = self.repository.save(
                    temp_file, 
                    mime_type, 
                    metadata=best_candidate.raw_metadata, 
                    origin=origin
                )
                
                # Assign the reference to the candidate and return
                best_candidate.reference = asset_ref
                return best_candidate
                
            except Exception as e:
                print(f"[AssetSelectionStrategy] Provider {provider.name} failed for query '{query}': {e}")
                # Continue to the next provider in the chain
                continue
                
        # If we fall through the entire chain without returning, resolution failed
        print(f"[AssetSelectionStrategy] All providers failed for scene: '{scene_text}'")
        return None
