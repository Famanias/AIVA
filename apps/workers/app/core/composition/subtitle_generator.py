import os
import tempfile
from typing import List, Dict, Any
import structlog

logger = structlog.get_logger(__name__)

class SubtitleGenerator:
    """
    Generates styled .ass (Advanced SubStation Alpha) subtitle files from word timings.
    Never invokes FFmpeg directly.
    """

    # Enhanced ASS header with high-contrast, center-bottom safe zone styling
    ASS_HEADER = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Segoe UI,72,&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,40,40,280,1

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
    def _chunk_words(word_timings: List[Dict[str, Any]], max_words: int = 4, max_dur: float = 2.4) -> List[Dict[str, Any]]:
        """
        Groups individual word timings into readable, cohesive phrase chunks.
        """
        if not word_timings:
            return []

        chunks = []
        current_words = []
        chunk_start = 0.0

        for idx, wt in enumerate(word_timings):
            w_text = str(wt.get("word", "")).strip()
            if not w_text:
                continue

            w_start = float(wt.get("start", 0.0))
            w_end = float(wt.get("end", w_start + 0.3))

            if not current_words:
                chunk_start = w_start
                current_words.append(w_text)
                chunk_end = w_end
            else:
                gap = w_start - chunk_end
                phrase_dur = w_end - chunk_start

                if len(current_words) >= max_words or gap > 0.6 or phrase_dur >= max_dur:
                    chunks.append({
                        "start": chunk_start,
                        "end": max(chunk_end, chunk_start + 0.4),
                        "text": " ".join(current_words)
                    })
                    chunk_start = w_start
                    current_words = [w_text]
                    chunk_end = w_end
                else:
                    current_words.append(w_text)
                    chunk_end = w_end

        if current_words:
            chunks.append({
                "start": chunk_start,
                "end": max(chunk_end, chunk_start + 0.4),
                "text": " ".join(current_words)
            })

        return chunks

    @staticmethod
    def generate(word_timings: List[Dict[str, Any]], job_id: str) -> str:
        if not word_timings:
            return ""

        temp_dir = os.path.join(tempfile.gettempdir(), "aiva_composition")
        os.makedirs(temp_dir, exist_ok=True)
        
        out_path = os.path.join(temp_dir, f"{job_id}_subs.ass")
        chunks = SubtitleGenerator._chunk_words(word_timings)

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(SubtitleGenerator.ASS_HEADER)

            for chunk in chunks:
                start_str = SubtitleGenerator._format_time(chunk["start"])
                end_str = SubtitleGenerator._format_time(chunk["end"])
                text = chunk["text"]
                
                # Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,Text
                f.write(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}\n")
                
        logger.info("subtitle_file_generated", path=out_path, job_id=job_id, words_count=len(word_timings), phrases_count=len(chunks))
        return out_path

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        """Converts seconds float to SRT time format: HH:MM:SS,mmm"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int(round((seconds - int(seconds)) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    @staticmethod
    def generate_srt(word_timings: List[Dict[str, Any]], out_path: str) -> str:
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        chunks = SubtitleGenerator._chunk_words(word_timings)
        with open(out_path, "w", encoding="utf-8") as f:
            if not chunks:
                f.write("1\n00:00:00,000 --> 00:00:05,000\n[No subtitles generated]\n\n")
            else:
                for idx, chunk in enumerate(chunks, 1):
                    start_str = SubtitleGenerator._format_srt_time(chunk["start"])
                    end_str = SubtitleGenerator._format_srt_time(chunk["end"])
                    text = chunk["text"]
                    f.write(f"{idx}\n{start_str} --> {end_str}\n{text}\n\n")
        logger.info("srt_file_generated", path=out_path, words_count=len(word_timings), phrases_count=len(chunks))
        return out_path
