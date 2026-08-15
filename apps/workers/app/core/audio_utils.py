import os
import shutil
import subprocess
from typing import List
import structlog

logger = structlog.get_logger(__name__)


def concat_audio_files(
    input_files: List[str],
    output_path: str,
    temp_dir: str | None = None
) -> str:
    """
    Safely concatenates a list of audio files (e.g. MP3 / WAV) into output_path using FFmpeg.
    - If 0 files provided: raises ValueError.
    - If 1 file provided: copies it to output_path.
    - If multiple files: writes a sanitized FFmpeg concat list, runs stream copy,
      falls back to libmp3lame on error, and cleans up temporary list file.
    """
    valid_files = [f for f in input_files if f and os.path.exists(f)]
    if not valid_files:
        raise ValueError("No valid audio files provided for concatenation.")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    if len(valid_files) == 1:
        shutil.copy2(valid_files[0], output_path)
        return output_path

    ffmpeg_bin = shutil.which("ffmpeg") or "ffmpeg"
    work_dir = temp_dir or os.path.dirname(os.path.abspath(output_path))
    concat_list_file = os.path.join(work_dir, f"concat_{os.getpid()}_{os.path.basename(output_path)}.txt")

    try:
        with open(concat_list_file, "w", encoding="utf-8") as f:
            for file_path in valid_files:
                # Sanitize paths for FFmpeg concat format (forward slashes, escape single quotes)
                safe_path = os.path.abspath(file_path).replace("\\", "/").replace("'", "'\\''")
                f.write(f"file '{safe_path}'\n")

        res = subprocess.run(
            [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", concat_list_file, "-c", "copy", output_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        if res.returncode != 0:
            # Re-encode if stream copy fails (e.g. mismatched codecs/sample rates)
            subprocess.run(
                [ffmpeg_bin, "-y", "-f", "concat", "-safe", "0", "-i", concat_list_file, "-c:a", "libmp3lame", output_path],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
        logger.info("audio_concatenation_successful", count=len(valid_files), output_path=output_path)
        return output_path
    except Exception as e:
        logger.error("audio_concatenation_failed", error=str(e), count=len(valid_files))
        # Fallback to copy first file if concat fails
        shutil.copy2(valid_files[0], output_path)
        return output_path
    finally:
        if os.path.exists(concat_list_file):
            try:
                os.remove(concat_list_file)
            except Exception:
                pass
