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


def get_audio_duration(file_path: str) -> float:

    """
    Measures the exact audio duration in seconds using ffprobe.
    Falls back to 0.0 if the file does not exist or probing fails.
    """
    if not file_path or not os.path.exists(file_path):
        return 0.0

    ffprobe_bin = shutil.which("ffprobe")
    if not ffprobe_bin and os.name == "nt":
        winget_path = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffprobe.exe")
        if os.path.exists(winget_path):
            ffprobe_bin = winget_path

    if not ffprobe_bin:
        ffprobe_bin = "ffprobe"

    try:
        cmd = [
            ffprobe_bin,
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        dur = float(res.stdout.strip())
        return round(dur, 3)
    except Exception as e:
        logger.warning("ffprobe_duration_measurement_failed", file=file_path, error=str(e))
        return 0.0

