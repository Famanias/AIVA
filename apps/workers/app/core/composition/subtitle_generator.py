import os
import tempfile
from typing import List, Dict, Any

class SubtitleGenerator:
    """
    Generates styled .ass (Advanced SubStation Alpha) subtitle files from word timings.
    Never invokes FFmpeg directly.
    """

    # Basic ASS header template
    ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,64,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,3,2,2,10,10,200,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    @staticmethod
    def _format_time(seconds: float) -> str:
        """Converts seconds float to ASS time format: H:MM:SS.cs"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = seconds % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    @staticmethod
    def generate(word_timings: List[Dict[str, Any]], job_id: str) -> str:
        if not word_timings:
            return ""

        temp_dir = os.path.join(tempfile.gettempdir(), "aiva_composition")
        os.makedirs(temp_dir, exist_ok=True)
        
        out_path = os.path.join(temp_dir, f"{job_id}_subs.ass")

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(SubtitleGenerator.ASS_HEADER)

            # We create a simple subtitle line per word for kinetic effect (MVP style)
            # In a full implementation, we'd chunk words into phrases
            for word_obj in word_timings:
                start_str = SubtitleGenerator._format_time(word_obj.get("start", 0))
                end_str = SubtitleGenerator._format_time(word_obj.get("end", 0))
                text = word_obj.get("word", "").strip()
                
                # Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,Text
                f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}\n")
                
        print(f"[SubtitleGenerator] Generated subtitle file at {out_path}")
        return out_path
