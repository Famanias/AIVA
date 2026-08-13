import os
import uuid
import tempfile
from typing import Callable, Any
from app.models.composition import CompositionModel, CompositionResult, MediaReference
from app.core.composition.validator import CompositionValidator
from app.core.composition.subtitle_generator import SubtitleGenerator
from app.core.composition.graph_builder import FilterGraphBuilder
from app.core.composition.encoder import Encoder

class CompositionEngine:
    """
    Orchestrates the Composition Pipeline.
    Passes data between isolated, single-responsibility services.
    """

    @staticmethod
    def run(model: CompositionModel, emit_progress: Callable[[str, int], Any] = None) -> CompositionResult:
        def log_progress(msg: str, pct: int):
            print(f"[CompositionEngine] {msg} ({pct}%)")
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
            print(f"[CompositionEngine] Persisted final video to {target_mp4}")

            target_srt = os.path.join(storage_dir, "subtitles.srt")
            SubtitleGenerator.generate_srt(model.word_timings, target_srt)
            
            # 6. Result
            log_progress("Composition Finished", 100)
            
            # Calculate final duration based on inputs (simplified for MVP)
            final_duration = max(t.duration for t in model.background_tracks) if model.background_tracks else 0
            if model.overlay_track and model.overlay_track.duration > final_duration:
                final_duration = model.overlay_track.duration
            
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
            print(f"[CompositionEngine] Fatal Error: {e}")
            raise e
