from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class AssetReference(BaseModel):
    id: str
    storage_key: str
    mime_type: str
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    checksum: str
    status: str = Field(description="'pending', 'ready', 'failed', 'deleted'")
    origin: str = Field(description="'stock', 'generated', 'uploaded', 'cached'")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RankedCandidate(BaseModel):
    score: float
    reason: str
    provider: str
    reference: Optional[AssetReference] = None
    raw_metadata: Dict[str, Any] = Field(default_factory=dict)

class AssetManifest(BaseModel):
    # Slots like "background", "overlay", "character" for future-proofing
    asset_slots: Dict[str, AssetReference] = Field(default_factory=dict)
    alternatives: List[RankedCandidate] = Field(default_factory=dict)

class AssetConfig(BaseModel):
    semantic_threshold: float = 0.20
    max_candidates: int = 25
    fallback_enabled: bool = True
    concurrency_limit: int = 5

