import os
import shutil
import hashlib
from typing import Optional, Dict, Any
from app.models.asset import AssetReference

class IAssetRepository:
    def save(self, temp_file_path: str, mime_type: str, metadata: Dict[str, Any], origin: str) -> AssetReference:
        raise NotImplementedError

    def find_by_checksum(self, checksum: str) -> Optional[AssetReference]:
        raise NotImplementedError

class LocalCacheRepository(IAssetRepository):
    """
    Persists valid files and avoids any cross-project duplication.
    """
    def __init__(self, base_dir: str = ".cache/assets"):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        # In MVP, we use an in-memory or tiny local JSON store for metadata queries
        self._metadata_db: Dict[str, AssetReference] = {}

    def _compute_sha256(self, file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def save(self, temp_file_path: str, mime_type: str, metadata: Dict[str, Any], origin: str) -> AssetReference:
        checksum = self._compute_sha256(temp_file_path)
        
        # Check if we already have it
        existing = self.find_by_checksum(checksum)
        if existing:
            print(f"[LocalCacheRepository] Asset already exists (cache hit): {checksum}")
            # Clean up the temp file
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
            return existing

        # Move to persistent storage
        extension = mime_type.split("/")[-1]
        if extension == "jpeg":
            extension = "jpg"

        storage_key = f"{checksum}.{extension}"
        final_path = os.path.join(self.base_dir, storage_key)
        
        shutil.move(temp_file_path, final_path)
        print(f"[LocalCacheRepository] Saved new asset to {final_path}")

        ref = AssetReference(
            id=f"asset_{checksum[:8]}",
            storage_key=final_path, # In local mode, the storage key is the absolute path
            mime_type=mime_type,
            duration=metadata.get("duration"),
            width=metadata.get("width"),
            height=metadata.get("height"),
            checksum=checksum,
            status="ready",
            origin=origin,
            metadata=metadata
        )
        
        self._metadata_db[checksum] = ref
        return ref

    def find_by_checksum(self, checksum: str) -> Optional[AssetReference]:
        return self._metadata_db.get(checksum)
