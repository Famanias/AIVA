import os
import json
import time
import shutil
from typing import Dict, Any, Optional
from datetime import datetime, timezone

class ArtifactRepository:
    """
    Manages deterministic, versioned Project Artifact Packages.
    Persists stage outputs, raw LLM responses, and metadata under
    storage/projects/{project_id}/revisions/v{revision}/
    """

    def __init__(self, base_storage_dir: Optional[str] = None):
        if not base_storage_dir:
            # Resolve workspace root (storage/projects)
            workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
            base_storage_dir = os.path.join(workspace_root, "storage", "projects")
        
        self.base_dir = base_storage_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_revision_dir(self, project_id: str, revision: int = 1) -> str:
        rev_dir = os.path.join(self.base_dir, project_id, "revisions", f"v{revision}")
        os.makedirs(rev_dir, exist_ok=True)
        return rev_dir

    def ensure_meta(
        self,
        project_id: str,
        revision: int = 1,
        generation_profile: Optional[Dict[str, Any]] = None,
        provenance: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        rev_dir = self._get_revision_dir(project_id, revision)
        meta_path = os.path.join(rev_dir, "meta.json")

        if os.path.exists(meta_path):
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)

        meta = {
            "schema_version": "1.0.0",
            "pipeline_version": "0.2.0",
            "revision": revision,
            "project_id": project_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "generation_profile": generation_profile or {
                "target_aspect_ratio": "9:16",
                "target_duration_range": [30, 120],
                "pacing": "high_retention"
            },
            "provenance": provenance or {}
        }

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return meta

    def save_stage_artifact(
        self,
        project_id: str,
        stage_name: str,
        normalized_data: Dict[str, Any],
        raw_response: Optional[Dict[str, Any]] = None,
        revision: int = 1
    ) -> str:
        self.ensure_meta(project_id, revision)
        rev_dir = self._get_revision_dir(project_id, revision)
        file_path = os.path.join(rev_dir, f"{stage_name}.json")

        payload = {
            "normalized": normalized_data,
            "raw_response": raw_response
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)

        return file_path

    def load_stage_artifact(
        self,
        project_id: str,
        stage_name: str,
        revision: int = 1
    ) -> Optional[Dict[str, Any]]:
        rev_dir = self._get_revision_dir(project_id, revision)
        file_path = os.path.join(rev_dir, f"{stage_name}.json")

        if not os.path.exists(file_path):
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
