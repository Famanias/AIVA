import os
from typing import List
from app.models.composition import CompositionModel

class CompositionValidator:
    """
    Pre-flight media and codec checks.
    Fails fast before invoking the expensive FFmpeg process.
    """
    
    @staticmethod
    def validate(model: CompositionModel) -> List[str]:
        errors = []
        
        # 1. Check required base tracks
        if not model.overlay_track and not model.background_tracks:
            errors.append("Composition must have at least one visual track (overlay or background).")
            
        # 2. Verify media exists
        # In a real environment, this might check S3 object existence.
        # For local execution, we check local paths.
        
        def check_media(ref, name):
            if ref and ref.storage_key:
                if ref.storage_key.startswith("http"):
                    return
                if not os.path.exists(ref.storage_key):
                    # Check relative to repo root or cwd
                    repo_path = os.path.abspath(os.path.join(os.getcwd(), "..", "..", ref.storage_key))
                    if os.path.exists(repo_path):
                        ref.storage_key = repo_path
                        return
                    cwd_path = os.path.abspath(os.path.join(os.getcwd(), ref.storage_key))
                    if os.path.exists(cwd_path):
                        ref.storage_key = cwd_path
                        return
                    errors.append(f"Media missing for {name}: {ref.storage_key}")

        check_media(model.overlay_track, "Overlay Track")
        check_media(model.voice_track, "Voice Track")
        check_media(model.music_track, "Music Track")
        
        for i, bg in enumerate(model.background_tracks):
            check_media(bg, f"Background Track {i}")
            
        # 3. Codec checks (stubbed for MVP)
        # e.g., ensure we don't try to NVENC encode a codec NVENC doesn't support
        if model.output_settings.codec not in ["h264", "h265"]:
            errors.append(f"Unsupported output codec requested: {model.output_settings.codec}")

        if errors:
            raise ValueError(f"Composition Validation Failed: {'; '.join(errors)}")
            
        return errors
