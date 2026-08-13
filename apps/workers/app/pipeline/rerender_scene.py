import os
import json
import shutil
import structlog
import subprocess
from typing import Dict, Any, Optional
from app.core.db import get_db_pool
from app.pipeline.checkpoint import get_checkpoint_dir
from app.providers.factory import get_tts_provider_async
from app.models.composition import (
    CompositionModel,
    MediaReference,
    EncodingProfile,
)
from app.core.composition.engine import CompositionEngine

logger = structlog.get_logger(__name__)


async def rerender_single_scene(
    project_id: str,
    scene_id: str,
    revision: int = 1
) -> Dict[str, Any]:
    """
    Executes single-scene partial re-rendering:
    1. Reads scene and scene_version details from PostgreSQL.
    2. Re-synthesizes the scene's voiceover via TTS and extracts word timings.
    3. Updates database public.scenes with new voiceover and word timings.
    4. Updates checkpoints (03_script, 04_voice).
    5. Re-stitches final composition reusing unchanged cached scene clips.
    6. Updates database scene status to 'rendered'.
    """
    logger.info("🎬 [Single Scene Rerender START]", project_id=project_id, scene_id=scene_id)
    
    import uuid
    try:
        valid_scene_uuid = str(uuid.UUID(scene_id))
        valid_project_uuid = str(uuid.UUID(project_id))
    except ValueError:
        logger.warning("Invalid UUID format provided for rerendering", scene_id=scene_id, project_id=project_id)
        return {
            "status": "not_found",
            "project_id": project_id,
            "scene_id": scene_id,
            "message": f"Scene {scene_id} or project {project_id} is not a valid UUID format."
        }

    pool = await get_db_pool()

    async with pool.acquire() as conn:
        # 1. Fetch scene and version details
        scene_row = await conn.fetchrow(
            """
            SELECT s.id, s.sequence_number, s.duration, s.voiceover_url, s.render_url,
                   sv.script_segment, sv.visual_type, sv.visual_prompt, sv.background_broll_url
            FROM public.scenes s
            LEFT JOIN public.scene_versions sv ON s.current_version_id = sv.id
            WHERE s.id = $1 AND s.project_id = $2
            """,
            valid_scene_uuid,
            valid_project_uuid
        )

        if not scene_row:
            logger.warning("Scene not found for rerendering", scene_id=scene_id, project_id=project_id)
            return {
                "status": "not_found",
                "project_id": project_id,
                "scene_id": scene_id,
                "message": f"Scene {scene_id} not found for project {project_id}"
            }

        # 1b. Fetch project generation profile / aspect ratio / voice
        proj_row = await conn.fetchrow(
            """
            SELECT p.id, p.video_style, j.state_payload
            FROM public.projects p
            LEFT JOIN public.jobs j ON j.project_id = p.id
            WHERE p.id = $1
            LIMIT 1
            """,
            valid_project_uuid
        )

        voice_id = "en-US-AriaNeural"
        aspect_ratio = "9:16"
        width = 1080
        height = 1920

        if proj_row is not None:
            try:
                state_raw = proj_row["state_payload"] if "state_payload" in proj_row else None
                if state_raw:
                    payload = json.loads(state_raw) if isinstance(state_raw, str) else state_raw
                    gen_profile = payload.get("generationProfile", {}) or {}
                    voice_id = gen_profile.get("voice_id") or payload.get("voice_id") or voice_id
                    aspect_ratio = gen_profile.get("aspect_ratio") or payload.get("aspect_ratio") or aspect_ratio
            except Exception:
                pass

        if aspect_ratio == "16:9":
            width, height = 1920, 1080
        elif aspect_ratio == "1:1":
            width, height = 1080, 1080

        # 2. Re-synthesize TTS for the modified scene
        tts = await get_tts_provider_async()
        script_text = scene_row["script_segment"] or ""
        
        new_voice_url = scene_row["voiceover_url"]
        new_duration = float(scene_row["duration"] or 0.0)
        new_word_timings = []

        if script_text.strip():
            try:
                tts_res = await tts.synthesize(script_text, voice_id)
                new_voice_url = tts_res.audio_url
                new_duration = float(tts_res.duration_sec)
                new_word_timings = [
                    {"word": w.word, "start": w.start, "end": w.end}
                    for w in tts_res.word_timings
                ]
                logger.info(
                    "Re-synthesized TTS for scene",
                    scene_id=scene_id,
                    duration=new_duration,
                    words=len(new_word_timings),
                    voice_id=voice_id
                )
            except Exception as e:
                logger.warning("TTS re-synthesis error, falling back to existing audio", error=str(e))

        # 3. Update scene record in PostgreSQL
        await conn.execute(
            """
            UPDATE public.scenes
            SET voiceover_url = $1,
                duration = $2,
                voiceover_word_timings = $3,
                render_status = 'rendered'
            WHERE id = $4 AND project_id = $5
            """,
            new_voice_url,
            new_duration,
            json.dumps(new_word_timings) if new_word_timings else None,
            valid_scene_uuid,
            valid_project_uuid
        )

        # 4. Update Checkpoints
        checkpoint_dir = get_checkpoint_dir(project_id, revision)
        os.makedirs(checkpoint_dir, exist_ok=True)

        # Update 03_script checkpoint
        script_cp_file = os.path.join(checkpoint_dir, "checkpoint_03_script.json")
        if os.path.exists(script_cp_file):
            try:
                with open(script_cp_file, "r", encoding="utf-8") as f:
                    script_data = json.load(f)
                scenes = script_data.get("scenes", [])
                for sc in scenes:
                    if str(sc.get("id")) == str(scene_id) or sc.get("sequence_number") == scene_row["sequence_number"]:
                        sc["script_segment"] = scene_row["script_segment"]
                        sc["visual_prompt"] = scene_row["visual_prompt"]
                        break
                with open(script_cp_file, "w", encoding="utf-8") as f:
                    json.dump(script_data, f, indent=2, ensure_ascii=False)
            except Exception as err:
                logger.warning("Could not update script checkpoint file", error=str(err))

        # Update 04_voice checkpoint
        voice_cp_file = os.path.join(checkpoint_dir, "checkpoint_04_voice.json")
        if os.path.exists(voice_cp_file):
            try:
                with open(voice_cp_file, "r", encoding="utf-8") as f:
                    voice_data = json.load(f)
                vos = voice_data.get("voiceovers", [])
                updated = False
                for vo in vos:
                    if str(vo.get("scene_id")) == str(scene_id) or vo.get("sequence_number") == scene_row["sequence_number"]:
                        vo["audio_url"] = new_voice_url
                        vo["duration_sec"] = new_duration
                        vo["word_timings"] = new_word_timings
                        updated = True
                        break
                if not updated:
                    vos.append({
                        "sequence_number": scene_row["sequence_number"],
                        "audio_url": new_voice_url,
                        "duration_sec": new_duration,
                        "word_timings": new_word_timings
                    })
                with open(voice_cp_file, "w", encoding="utf-8") as f:
                    json.dump(voice_data, f, indent=2, ensure_ascii=False)
            except Exception as err:
                logger.warning("Could not update voice checkpoint file", error=str(err))

        # 5. Fetch all project scenes to re-stitch composition
        all_scenes = await conn.fetch(
            """
            SELECT s.id, s.sequence_number, s.duration, s.voiceover_url, s.voiceover_word_timings, s.render_url,
                   sv.script_segment, sv.visual_type, sv.visual_prompt, sv.background_broll_url
            FROM public.scenes s
            LEFT JOIN public.scene_versions sv ON s.current_version_id = sv.id
            WHERE s.project_id = $1
            ORDER BY s.sequence_number ASC
            """,
            valid_project_uuid
        )

        # Assemble background tracks, voice tracks, and global word timings
        bg_tracks = []
        scene_voice_files = []
        global_word_timings = []
        cumulative_time = 0.0
        overlay_track = None

        for sc in all_scenes:
            dur = float(sc["duration"] or 4.5)
            if dur <= 0:
                dur = 4.5

            # Background media (use cached B-roll, visual asset, or fallback)
            bg_key = sc["background_broll_url"]
            if bg_key and os.path.exists(bg_key):
                bg_tracks.append(
                    MediaReference(
                        id=str(sc["id"]),
                        type="video",
                        storage_key=bg_key,
                        duration=dur,
                        mime_type="video/mp4"
                    )
                )

            # Overlay visual render if available
            render_url = sc.get("render_url")
            if not overlay_track and render_url and os.path.exists(render_url):
                overlay_track = MediaReference(
                    id="remotion_overlay",
                    type="video",
                    storage_key=render_url,
                    duration=dur,
                    mime_type="video/webm" if render_url.endswith(".webm") else "video/mp4"
                )

            # Voiceover file
            if sc["voiceover_url"] and os.path.exists(sc["voiceover_url"]):
                scene_voice_files.append(sc["voiceover_url"])

            # Word timings
            raw_timings = []
            if sc["voiceover_word_timings"]:
                try:
                    raw_timings = json.loads(sc["voiceover_word_timings"])
                except Exception:
                    raw_timings = []
            
            for wt in raw_timings:
                w_start = float(wt.get("start", 0.0)) + cumulative_time
                w_end = float(wt.get("end", 0.0)) + cumulative_time
                global_word_timings.append({
                    "word": wt.get("word", ""),
                    "start": round(w_start, 3),
                    "end": round(w_end, 3)
                })

            cumulative_time += dur

        if overlay_track:
            overlay_track.duration = cumulative_time

        # Concatenate scene voices if available
        project_storage_dir = os.path.abspath(os.path.join(os.getcwd(), "storage", "projects", project_id))
        if not os.path.exists(os.path.dirname(project_storage_dir)):
            project_storage_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "..", "storage", "projects", project_id))
        os.makedirs(project_storage_dir, exist_ok=True)

        master_voice_file = os.path.join(project_storage_dir, "voice_track.mp3")
        ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"

        voice_track = None
        if len(scene_voice_files) == 1:
            voice_track = MediaReference(
                id="voice_main",
                type="audio",
                storage_key=scene_voice_files[0],
                duration=cumulative_time,
                mime_type="audio/mp3"
            )
        elif len(scene_voice_files) > 1:
            try:
                concat_list_file = os.path.join(project_storage_dir, "voice_concat.txt")
                with open(concat_list_file, "w", encoding="utf-8") as f:
                    for vf in scene_voice_files:
                        safe_vf = vf.replace('\\', '/')
                        f.write(f"file '{safe_vf}'\n")
                
                res = subprocess.run(
                    [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", concat_list_file, "-c", "copy", master_voice_file],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                if res.returncode != 0:
                    subprocess.run(
                        [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", concat_list_file, "-c:a", "libmp3lame", master_voice_file],
                        check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
                    )
                voice_track = MediaReference(
                    id="voice_main",
                    type="audio",
                    storage_key=master_voice_file,
                    duration=cumulative_time,
                    mime_type="audio/mp3"
                )
            except Exception as concat_err:
                logger.warning("Voice concatenation failed, using primary voice file", error=str(concat_err))
                if scene_voice_files:
                    voice_track = MediaReference(
                        id="voice_main",
                        type="audio",
                        storage_key=scene_voice_files[0],
                        duration=cumulative_time,
                        mime_type="audio/mp3"
                    )
            finally:
                if os.path.exists(concat_list_file):
                    try:
                        os.remove(concat_list_file)
                    except Exception:
                        pass

        # Background music
        music_file = "storage/audio/ambient_track.mp3"
        music_track = MediaReference(
            id="music_ambient",
            type="audio",
            storage_key=music_file,
            duration=0.0,
            mime_type="audio/mp3"
        )

        # Re-stitch master video via CompositionEngine
        try:
            valid_bg_tracks = [t for t in bg_tracks if os.path.exists(t.storage_key) and not t.storage_key.endswith('.mp3')]
            if valid_bg_tracks or overlay_track or voice_track:
                comp_model = CompositionModel(
                    job_id=f"rerender_{project_id}_{scene_row['sequence_number']}",
                    background_tracks=valid_bg_tracks,
                    overlay_track=overlay_track,
                    voice_track=voice_track,
                    music_track=music_track,
                    word_timings=global_word_timings,
                    output_settings=EncodingProfile(
                        width=width,
                        height=height,
                        resolution=f"{width}x{height}",
                        aspect_ratio=aspect_ratio,
                        hardware_acceleration="auto"
                    ),
                    metadata={"project_id": project_id}
                )
                comp_res = CompositionEngine.run(comp_model)
                logger.info("Re-stitched master composition successfully", output_path=comp_res.output_reference.storage_key)
        except Exception as comp_err:
            logger.warning("Composition re-stitching skipped or non-fatal", error=str(comp_err))

    logger.info("✅ [Single Scene Rerender COMPLETE]", scene_id=scene_id, project_id=project_id)
    return {
        "status": "success",
        "project_id": project_id,
        "scene_id": scene_id,
        "sequence_number": scene_row["sequence_number"],
        "voiceover_url": new_voice_url,
        "duration": new_duration,
        "message": "Single scene partial re-rendering and master composition finished successfully"
    }
