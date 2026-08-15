import os
import time
import json
import subprocess
from typing import List
import structlog
from app.models.composition import CompositionModel, MediaReference

logger = structlog.get_logger(__name__)

class Encoder:
    """
    Stateless FFmpeg runner. Executes the pre-built graph, handles NVENC gracefully 
    falling back to CPU encoding if unavailable, and emits composition_manifest.json.
    """

    @staticmethod
    def encode(
        model: CompositionModel, 
        inputs: List[str], 
        filter_complex: str, 
        video_pad: str, 
        audio_pad: str, 
        output_path: str
    ) -> float:
        """
        Runs the FFmpeg process and returns the render time in ms.
        """
        start_time = time.time()
        
        # Determine Encoder
        vcodec = "libx264"
        if model.output_settings.hardware_acceleration in ["nvenc", "auto"]:
            # Simple check if NVENC is available
            try:
                # We do a quick check to see if h264_nvenc exists
                # For MVP, we assume it's available or fallback
                # This could be more robust using ffmpeg -encoders
                vcodec = "h264_nvenc"
            except:
                vcodec = "libx264"
                logger.info("nvenc_unavailable_fallback", msg="NVENC unavailable, falling back to libx264")

        import shutil
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin and os.name == 'nt':
            # Fallback for Windows if winget installed it but PATH isn't refreshed
            winget_path = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe")
            if os.path.exists(winget_path):
                ffmpeg_bin = winget_path
        
        if not ffmpeg_bin:
            ffmpeg_bin = "ffmpeg" # Let subprocess fail with WinError 2 if really not found

        cmd = [ffmpeg_bin, "-y"]
        
        for bg in model.background_tracks:
            inp = bg.storage_key
            is_image = bg.type == "image" or any(inp.lower().endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".webp"]) or "picsum.photos" in inp.lower()
            if is_image:
                dur = str(bg.duration or 4.5)
                cmd.extend(["-loop", "1", "-t", dur])
            cmd.extend(["-i", inp])

        if model.overlay_track:
            cmd.extend(["-i", model.overlay_track.storage_key])

        if model.voice_track:
            cmd.extend(["-i", model.voice_track.storage_key])
            
        if model.music_track:
            cmd.extend(["-i", model.music_track.storage_key])
            
        if filter_complex:
            cmd.extend(["-filter_complex", filter_complex])
        else:
            # If no filter_complex exists, pads must be raw stream indices (e.g. 0:v instead of [0:v])
            if video_pad:
                video_pad = video_pad.strip("[]")
            if audio_pad:
                audio_pad = audio_pad.strip("[]")
            
        # Map outputs
        if video_pad:
            cmd.extend(["-map", video_pad])
        if audio_pad:
            cmd.extend(["-map", audio_pad])
            
        # Encoding Settings
        cmd.extend([
            "-c:v", vcodec,
            "-preset", model.output_settings.preset,
            "-b:v", model.output_settings.bitrate,
            "-r", str(model.output_settings.fps)
        ])
        
        # Audio Codec
        if audio_pad:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])
            
        cmd.append(output_path)
        
        # Execute
        logger.info("ffmpeg_execution_start", command=" ".join(cmd), job_id=model.job_id)
        
        try:
            # We capture stderr because ffmpeg logs output to stderr
            result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        except subprocess.CalledProcessError as e:
            if vcodec == "h264_nvenc":
                logger.warning("nvenc_encoding_failed_retry_cpu", error=str(e), job_id=model.job_id)
                for i, arg in enumerate(cmd):
                    if arg == "-c:v" and i + 1 < len(cmd):
                        cmd[i + 1] = "libx264"
                try:
                    result = subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                except subprocess.CalledProcessError as err2:
                    logger.error("ffmpeg_cpu_fallback_failed", stderr=err2.stderr, job_id=model.job_id)
                    raise RuntimeError(f"FFmpeg encoding failed: {err2}")
            else:
                logger.error("ffmpeg_failed", stderr=e.stderr, job_id=model.job_id)
                raise RuntimeError(f"FFmpeg encoding failed: {e}")

        # Emit Manifest
        manifest_path = output_path.replace(".mp4", "_manifest.json")
        render_time = int((time.time() - start_time) * 1000)
        Encoder._write_manifest(model, manifest_path, output_path, render_time)

        return render_time

    @staticmethod
    def _write_manifest(model: CompositionModel, manifest_path: str, output_path: str, render_time_ms: float):
        manifest = {
            "job_id": model.job_id,
            "inputs": {
                "background_tracks": [t.model_dump() if hasattr(t, "model_dump") else t.dict() for t in model.background_tracks],
                "overlay_track": (model.overlay_track.model_dump() if hasattr(model.overlay_track, "model_dump") else model.overlay_track.dict()) if model.overlay_track else None,
                "voice_track": (model.voice_track.model_dump() if hasattr(model.voice_track, "model_dump") else model.voice_track.dict()) if model.voice_track else None,
                "music_track": (model.music_track.model_dump() if hasattr(model.music_track, "model_dump") else model.music_track.dict()) if model.music_track else None,
                "word_timings_count": len(model.word_timings)
            },
            "output": {
                "file": output_path,
                "codec": model.output_settings.codec,
                "bitrate": model.output_settings.bitrate,
                "resolution": model.output_settings.resolution,
                "fps": model.output_settings.fps,
                "render_time_ms": render_time_ms
            }
        }
        
        with open(manifest_path, "w") as f:
            json.dump(manifest, f, indent=2)
            
        logger.info("manifest_persisted", path=manifest_path, job_id=model.job_id)
