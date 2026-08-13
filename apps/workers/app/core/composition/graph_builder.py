from typing import Tuple, List
from app.models.composition import CompositionModel
from app.core.composition.audio_mixer import AudioMixer

class FilterGraphBuilder:
    """
    Deterministically constructs the FFmpeg filter graph (filter_complex) string 
    based purely on the CompositionModel. No FFmpeg commands are built here, only the graph.
    """

    @staticmethod
    def build(model: CompositionModel, subtitle_path: str = None) -> Tuple[List[str], str, str, str]:
        """
        Returns:
            - inputs: List of input file paths matching the indexes used in the graph.
            - filter_complex: The fully constructed graph string.
            - video_pad: The final video output pad.
            - audio_pad: The final audio output pad.
        """
        inputs = []
        filters = []
        
        # 1. Map Inputs
        # We must add inputs in the exact order we reference them.
        bg_idx_start = len(inputs)
        for bg in model.background_tracks:
            inputs.append(bg.storage_key)
            
        overlay_idx = -1
        if model.overlay_track:
            overlay_idx = len(inputs)
            inputs.append(model.overlay_track.storage_key)
            
        # Audio inputs
        audio_idx_start = len(inputs)
        audio_graph, audio_out_pad, next_idx = AudioMixer.build_audio_graph(model, audio_idx_start)
        
        if model.voice_track:
            inputs.append(model.voice_track.storage_key)
        if model.music_track:
            inputs.append(model.music_track.storage_key)
            
        # 2. Build Video Graph driven by dynamic CanvasConfig geometry
        video_out_pad = ""
        width = model.output_settings.width or 1080
        height = model.output_settings.height or 1920
        
        # If we have multiple backgrounds, we scale and concatenate them
        if len(model.background_tracks) > 1:
            for i in range(len(model.background_tracks)):
                idx = bg_idx_start + i
                filters.append(f"[{idx}:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1[v_scaled_{i}]")
            concat_inputs = "".join([f"[v_scaled_{i}]" for i in range(len(model.background_tracks))])
            filters.append(f"{concat_inputs}concat=n={len(model.background_tracks)}:v=1:a=0[bg_concat]")
            current_bg = "[bg_concat]"
        elif len(model.background_tracks) == 1:
            filters.append(f"[{bg_idx_start}:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1[bg_scaled]")
            current_bg = "[bg_scaled]"
        else:
            current_bg = ""

        # Overlay Remotion visual layer onto background
        if overlay_idx >= 0 and current_bg:
            filters.append(f"{current_bg}[{overlay_idx}:v]overlay=0:0:shortest=1[v_mixed]")
            video_out_pad = "[v_mixed]"
        elif overlay_idx >= 0:
            video_out_pad = f"[{overlay_idx}:v]"
        elif current_bg:
            video_out_pad = current_bg
            
        # Subtitle Burn-in
        if subtitle_path and video_out_pad:
            # Escape the path for FFmpeg filter syntax on Windows
            safe_sub_path = subtitle_path.replace('\\', '/').replace(':', '\\:')
            # Apply subtitles filter with quoted filename
            filters.append(f"{video_out_pad}subtitles='{safe_sub_path}'[v_subbed]")
            video_out_pad = "[v_subbed]"
            
        # Combine Audio and Video graphs
        final_graph = []
        if filters:
            final_graph.append(";".join(filters))
        if audio_graph:
            final_graph.append(audio_graph)

        filter_complex = ";".join(final_graph)
        
        return inputs, filter_complex, video_out_pad, audio_out_pad
