import os
import json
import asyncio
import structlog
from typing import Callable, Any, Dict, Optional

from app.core.storage import get_storage_root

logger = structlog.get_logger(__name__)


def get_checkpoint_dir(project_id: str, revision: int = 1) -> str:
    # Resolve root storage directory (storage/projects/{project_id}/revisions/v{revision})
    base_dir = get_storage_root()
    rev_dir = os.path.join(base_dir, "projects", project_id, "revisions", f"v{revision}")
    os.makedirs(rev_dir, exist_ok=True)
    return rev_dir


def get_checkpoint_filepath(stage_name: str, project_id: str, revision: int = 1) -> str:
    checkpoint_dir = get_checkpoint_dir(project_id, revision)
    return os.path.join(checkpoint_dir, f"checkpoint_{stage_name}.json")


async def load_checkpoint_or_run(
    stage_name: str,
    project_id: str,
    revision: int,
    generator_fn: Callable[[], Any]
) -> Dict[str, Any]:
    """
    Stage Checkpoint Recovery Wrapper:
    Checks if a saved checkpoint file exists on disk for the given stage and revision.
    - If found: returns cached output instantly ($0.00 repeated LLM/TTS cost on crash retry).
    - If missing: executes `generator_fn()`, saves result to disk atomically, and returns result.
    """
    filepath = get_checkpoint_filepath(stage_name, project_id, revision)

    if os.path.exists(filepath):
        try:
            logger.info("⚡ [Checkpoint HIT] Loading stage state from disk cache", stage=stage_name, path=filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data
        except Exception as err:
            logger.warning("Failed to parse checkpoint file, re-running stage generator", path=filepath, error=str(err))

    logger.info("🔄 [Checkpoint MISS] Executing stage generator", stage=stage_name, project_id=project_id)
    
    if asyncio.iscoroutinefunction(generator_fn):
        result = await generator_fn()
    else:
        result = generator_fn()

    try:
        tmp_filepath = f"{filepath}.tmp"
        with open(tmp_filepath, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        os.replace(tmp_filepath, filepath)
        logger.info("💾 [Checkpoint SAVED] Stage checkpoint written to disk", stage=stage_name, path=filepath)
    except Exception as err:
        logger.error("Failed to write stage checkpoint file", path=filepath, error=str(err))

    return result
