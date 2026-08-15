import asyncio
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from app.models.asset import AssetConfig, AssetManifest
from app.repositories.asset_repository import LocalCacheRepository
from app.services.asset_strategy import AssetSelectionStrategy

router = APIRouter()

# Instantiate Singletons
asset_repository = LocalCacheRepository()
asset_strategy = AssetSelectionStrategy(repository=asset_repository)

async def resolve_scene(scene: Dict[str, Any], config: AssetConfig) -> Dict[str, Any]:
    """
    Idempotent scene resolver.
    """
    # 1. Idempotency Check
    # If the scene already has a valid asset manifest, skip entirely.
    if "asset_manifest" in scene:
        print(f"[AssetRouter] Skipping scene {scene.get('id')} - already has manifest.")
        return scene

    scene_text = scene.get("text") or scene.get("scriptSegment", "")
    query = scene.get("assetQuery") or scene.get("visualPrompt") or scene_text

    # 2. Strategy Execution
    candidate = await asset_strategy.resolve_for_scene(scene_text, query, config)

    # 3. Build Immutable Manifest
    manifest = AssetManifest(
        asset_slots={},
        alternatives=[]
    )
    
    if candidate and candidate.reference:
        # Default assignment to the 'background' slot
        manifest.asset_slots["background"] = candidate.reference
        # You could also append the rejected candidates to `alternatives` here if the strategy passed them back

    # 4. Return new state snapshot for the scene
    # We do not mutate the incoming dict directly for safety, we return a merged copy
    new_scene = scene.copy()
    new_scene["asset_manifest"] = manifest.dict()
    if candidate and candidate.reference:
        new_scene["assetUrl"] = candidate.reference.storage_key
        new_scene["asset_url"] = candidate.reference.storage_key
        new_scene["asset_ref"] = candidate.reference.dict()
    return new_scene

@router.post("/resolve")
async def resolve_assets(state: Dict[str, Any]):
    """
    Parallelized, idempotent asset resolution endpoint.
    Accepts the full PipelineState and returns an updated copy.
    """
    try:
        scenes = state.get("scenes", [])
        if not scenes:
            return state

        config = AssetConfig()
        
        print(f"[AssetRouter] Resolving assets for {len(scenes)} scenes concurrently...")
        
        # Parallel Execution (asyncio.gather)
        # Using a semaphore if concurrency_limit is needed, but for MVP asyncio.gather is fine
        tasks = [resolve_scene(scene, config) for scene in scenes]
        resolved_scenes = await asyncio.gather(*tasks)

        # Build updated state
        new_state = state.copy()
        new_state["scenes"] = resolved_scenes
        
        return {"status": "success", "result": new_state}
        
    except Exception as e:
        print(f"[AssetRouter] Error resolving assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))
