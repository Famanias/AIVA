"""
Certifier Runner — CLI entrypoint for End-to-End Pipeline Certification.
Enables TypeScript certifier to invoke real Python worker stages (TTS, Subtitles, FFmpeg Composition, Rerender) deterministically.
"""
import sys
import os

# Ensure apps/workers is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

import json
import asyncio
import subprocess
import shutil
import tempfile

from app.pipelines.stage_handlers import handle_voiceover_stage, handle_subtitle_extraction_stage
from app.models.composition import CompositionModel, MediaReference, EncodingProfile
from app.core.composition.engine import CompositionEngine
from app.pipeline.rerender_scene import rerender_single_scene


async def run_voiceover_stage_cli(project_id: str, scenes: list[dict], voice_id: str = "en-US-AriaNeural"):
    vo_result = await handle_voiceover_stage(
        job_id=f"cert_{project_id}",
        scenes=scenes,
        voice_id=voice_id,
        project_id=project_id,
    )
    
    sub_result = await handle_subtitle_extraction_stage(
        job_id=f"cert_{project_id}",
        scene_voiceovers=vo_result.get("voiceovers", []),
    )

    return {
        "voiceovers": vo_result.get("voiceovers", []),
        "master_audio_url": vo_result.get("master_audio_url"),
        "subtitles": sub_result.get("subtitles", []),
        "global_word_timings": sub_result.get("global_word_timings", []),
    }


def run_composition_stage_cli(project_id: str, scenes: list[dict], voice_url: str, word_timings: list[dict]):
    from app.core.storage import get_project_storage_dir
    storage_dir = get_project_storage_dir(project_id)
    
    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    bg_video = os.path.join(storage_dir, "test_bg.mp4")
    
    # Calculate total duration from scenes
    total_duration = max(3.0, sum(float(s.get("duration", 3.0) or 3.0) for s in scenes))
    
    # Generate background visual asset via FFmpeg lavfi color generator
    if not os.path.exists(bg_video) or os.path.getsize(bg_video) == 0:
        subprocess.run([
            ffmpeg_bin, "-y", "-f", "lavfi",
            "-i", f"color=c=0x1a1a2e:s=1080x1920:d={total_duration}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            bg_video
        ], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    music_file = os.path.abspath(os.path.join(os.getcwd(), "storage", "audio", "ambient_track.mp3"))

    comp_model = CompositionModel(
        job_id=f"cert_{project_id}",
        background_tracks=[
            MediaReference(
                id="bg_track_1",
                type="video",
                storage_key=bg_video,
                duration=total_duration,
                mime_type="video/mp4"
            )
        ],
        voice_track=MediaReference(
            id="voice_main",
            type="audio",
            storage_key=voice_url,
            duration=total_duration,
            mime_type="audio/mp3"
        ) if voice_url and os.path.exists(voice_url) else None,
        music_track=MediaReference(
            id="music_ambient",
            type="audio",
            storage_key=music_file,
            duration=0.0,
            mime_type="audio/mp3"
        ) if os.path.exists(music_file) else None,
        word_timings=word_timings,
        output_settings=EncodingProfile(
            width=1080,
            height=1920,
            resolution="1080x1920",
            aspect_ratio="9:16",
            hardware_acceleration="auto"
        ),
        metadata={"project_id": project_id}
    )

    result = CompositionEngine.run(comp_model)
    return {
        "composition_mp4": result.output_reference.storage_key,
        "subtitles_srt": os.path.join(storage_dir, "subtitles.srt"),
        "render_time_ms": result.render_time_ms,
    }


async def run_rerender_stage_cli(project_id: str, scene_id: str):
    res = await rerender_single_scene(project_id, scene_id)
    return res


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing command argument"}))
        sys.exit(1)

    command = sys.argv[1]
    raw_input = sys.stdin.read()
    payload = json.loads(raw_input) if raw_input.strip() else {}

    if command == "voiceover":
        project_id = payload.get("project_id", "")
        scenes = payload.get("scenes", [])
        voice_id = payload.get("voice_id", "en-US-AriaNeural")
        out = asyncio.run(run_voiceover_stage_cli(project_id, scenes, voice_id))
        print("__JSON_START__")
        print(json.dumps({"status": "success", "data": out}))
        print("__JSON_END__")

    elif command == "composition":
        project_id = payload.get("project_id", "")
        scenes = payload.get("scenes", [])
        voice_url = payload.get("voice_url", "")
        word_timings = payload.get("word_timings", [])
        out = run_composition_stage_cli(project_id, scenes, voice_url, word_timings)
        print("__JSON_START__")
        print(json.dumps({"status": "success", "data": out}))
        print("__JSON_END__")

    elif command == "rerender":
        project_id = payload.get("project_id", "")
        scene_id = payload.get("scene_id", "")
        out = asyncio.run(run_rerender_stage_cli(project_id, scene_id))
        print("__JSON_START__")
        print(json.dumps({"status": "success", "data": out}))
        print("__JSON_END__")

    else:
        print("__JSON_START__")
        print(json.dumps({"error": f"Unknown command {command}"}))
        print("__JSON_END__")
        sys.exit(1)


if __name__ == "__main__":
    main()
