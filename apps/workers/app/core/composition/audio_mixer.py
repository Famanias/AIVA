from typing import List, Tuple
from app.models.composition import CompositionModel

class AudioMixer:
    """
    Constructs the audio filter graph string for FFmpeg, primarily handling ducking.
    """
    
    @staticmethod
    def build_audio_graph(model: CompositionModel, input_offset: int) -> Tuple[str, str, int]:
        """
        Returns:
            - graph: The filter_complex string for audio.
            - output_pad: The final audio pad name (e.g., "[outa]").
            - next_input_idx: The updated input index counter.
        """
        filters = []
        audio_pads = []
        
        voice_idx = -1
        music_idx = -1
        
        # 1. Map Inputs
        if model.voice_track:
            voice_idx = input_offset
            input_offset += 1
            audio_pads.append(f"[{voice_idx}:a]")
            
        if model.music_track:
            music_idx = input_offset
            input_offset += 1
            audio_pads.append(f"[{music_idx}:a]")
            
        # 2. Build Ducking Logic
        if voice_idx >= 0 and music_idx >= 0:
            # We have both voice and music. Apply a ducking filter (sidechaincompress)
            # Voice is the control signal, music is the carrier.
            filters.append(f"[{music_idx}:a]volume=0.3[music_low]")
            filters.append(f"[{voice_idx}:a]asplit=2[voice_out][voice_ctrl]")
            filters.append(f"[music_low][voice_ctrl]sidechaincompress=threshold=0.08:ratio=4:attack=50:release=300[music_ducked]")
            filters.append(f"[voice_out][music_ducked]amix=inputs=2:duration=first:dropout_transition=2[outa]")
            return ";".join(filters), "[outa]", input_offset
            
        elif voice_idx >= 0:
            # Only voice
            return "", f"[{voice_idx}:a]", input_offset
            
        elif music_idx >= 0:
            # Only music
            return "", f"[{music_idx}:a]", input_offset
            
        # No audio
        return "", "", input_offset
