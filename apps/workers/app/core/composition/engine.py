import os
import uuid
import tempfile
from typing import Callable, Any
import structlog
from app.models.composition import CompositionModel, CompositionResult, MediaReference
from app.core.composition.validator import CompositionValidator
from app.core.composition.subtitle_generator import SubtitleGenerator
from app.core.composition.graph_builder import FilterGraphBuilder
from app.core.composition.encoder import Encoder

logger = structlog.get_logger(__name__)

class CompositionEngine:
    """
    Orchestrates the Composition Pipeline.
    Passes data between isolated, single-responsibility services.
    """

    @staticmethod
    def run(model: CompositionModel, emit_progress: Callable[[str, int], Any] = None) -> CompositionResult:
        def log_progress(msg: str, pct: int):
            logger.info("composition_progress", stage=msg, progress_pct=pct, job_id=model.job_id)
            if emit_progress:
                emit_progress(msg, pct)
                
        warnings = []
        
        try:
            # 1. Validation
            log_progress("Validating Media Assets", 10)
            validation_errors = CompositionValidator.validate(model)
            warnings.extend(validation_errors)
            
            # 2. Subtitles
            log_progress("Generating Subtitle .ass file", 20)
            subtitle_path = SubtitleGenerator.generate(model.word_timings, model.job_id)
            
            # 3. Filter Graph
            log_progress("Building FFmpeg Filter Graph", 30)
            inputs, filter_complex, v_pad, a_pad = FilterGraphBuilder.build(model, subtitle_path)
            
            # 4. Encoding
            log_progress("Encoding Video", 50)
            out_dir = os.path.join(tempfile.gettempdir(), "aiva_composition_out")
            os.makedirs(out_dir, exist_ok=True)
            output_path = os.path.join(out_dir, f"master_{model.job_id}.mp4")
            
            render_time_ms = Encoder.encode(model, inputs, filter_complex, v_pad, a_pad, output_path)
            
            # 5. Persist output files to project storage
            from app.core.storage import get_project_storage_dir
            project_id = model.metadata.get("project_id", model.job_id)
            storage_dir = get_project_storage_dir(project_id)
            
            target_mp4 = os.path.join(storage_dir, "composition.mp4")
            import shutil
            shutil.copy2(output_path, target_mp4)
            logger.info("persisted_final_video", target_path=target_mp4, job_id=model.job_id)

            target_srt = os.path.join(storage_dir, "subtitles.srt")
            SubtitleGenerator.generate_srt(model.word_timings, target_srt)
            
            # 6. Result
            log_progress("Composition Finished", 100)
            
            # Calculate final duration based on inputs
            bg_dur = sum(t.duration for t in model.background_tracks if t.duration) if model.background_tracks else 0.0
            overlay_dur = model.overlay_track.duration if (model.overlay_track and model.overlay_track.duration) else 0.0
            voice_dur = model.voice_track.duration if (model.voice_track and model.voice_track.duration) else 0.0
            final_duration = max(bg_dur, overlay_dur, voice_dur)
            if final_duration <= 0.0:
                final_duration = 10.0
            
            return CompositionResult(
                output_reference=MediaReference(
                    id=str(uuid.uuid4()),
                    type="video",
                    storage_key=target_mp4,
                    duration=final_duration,
                    codec=model.output_settings.codec,
                    mime_type="video/mp4"
                ),
                render_time_ms=render_time_ms,
                warnings=warnings,
                manifest_url=output_path.replace(".mp4", "_manifest.json")
            )
            
        except Exception as e:
            logger.error("composition_fatal_error", error=str(e), job_id=model.job_id)
            raise e
