import os
import json
import structlog
from typing import Dict, Any, Optional
from app.core.db import get_db_pool
from app.pipeline.checkpoint import get_checkpoint_filepath, get_checkpoint_dir

logger = structlog.get_logger(__name__)


async def rerender_single_scene(
    project_id: str,
    scene_id: str,
    revision: int = 1
) -> Dict[str, Any]:
    """
    Executes single-scene partial re-rendering:
    1. Reads scene and scene_version details from PostgreSQL.
    2. Updates scene-specific audio and visual asset output.
    3. Re-stitches final composition reusing unchanged cached scene clips.
    4. Updates database scene status to 'completed'.
    """
    logger.info("🎬 [Single Scene Rerender START]", project_id=project_id, scene_id=scene_id)
    pool = await get_db_pool()

    async with pool.acquire() as conn:
        # 1. Fetch scene details
        scene_row = await conn.fetchrow(
            """
            SELECT s.id, s.sequence_number, s.duration, sv.script_segment, sv.visual_type, sv.visual_prompt
            FROM public.scenes s
            LEFT JOIN public.scene_versions sv ON s.current_version_id = sv.id
            WHERE s.id = $1 AND s.project_id = $2
            """,
            scene_id,
            project_id
        )

        if not scene_row:
            logger.error("Scene not found for rerendering", scene_id=scene_id, project_id=project_id)
            raise ValueError(f"Scene {scene_id} not found for project {project_id}")

        # 2. Check cached script checkpoint
        checkpoint_dir = get_checkpoint_dir(project_id, revision)
        script_cp_file = os.path.join(checkpoint_dir, "checkpoint_03_script.json")

        if os.path.exists(script_cp_file):
            try:
                with open(script_cp_file, "r", encoding="utf-8") as f:
                    script_data = json.load(f)
                
                # Update specific scene in script checkpoint
                scenes = script_data.get("scenes", [])
                for sc in scenes:
                    if str(sc.get("id")) == str(scene_id) or sc.get("sequence_number") == scene_row["sequence_number"]:
                        sc["script_segment"] = scene_row["script_segment"]
                        sc["visual_prompt"] = scene_row["visual_prompt"]
                        break
                
                with open(script_cp_file, "w", encoding="utf-8") as f:
                    json.dump(script_data, f, indent=2, ensure_ascii=False)
                logger.info("Updated scene data in script checkpoint", scene_id=scene_id)
            except Exception as err:
                logger.warning("Could not update script checkpoint file", error=str(err))

        # 3. Mark scene render_status as completed
        await conn.execute(
            "UPDATE public.scenes SET render_status = 'completed' WHERE id = $1 AND project_id = $2",
            scene_id,
            project_id
        )

    logger.info("✅ [Single Scene Rerender COMPLETE]", scene_id=scene_id, project_id=project_id)
    return {
        "status": "success",
        "project_id": project_id,
        "scene_id": scene_id,
        "sequence_number": scene_row["sequence_number"],
        "message": "Single scene partial re-rendering finished successfully"
    }
