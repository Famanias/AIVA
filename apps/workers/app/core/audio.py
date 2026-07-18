"""
Audio utilities for Loudness Normalization.
See EDD §17 — Master track normalized to -14 LUFS, individual scenes to -16 LUFS.
"""
import structlog

logger = structlog.get_logger(__name__)

def normalize_loudness(input_path: str, output_path: str, target_lufs: float = -14.0) -> None:
    """
    Normalizes the loudness of an audio file to the target LUFS.
    Uses pyloudnorm and soundfile.
    """
    try:
        import soundfile as sf
        import pyloudnorm as pyln
    except ImportError as e:
        raise ImportError("soundfile or pyloudnorm package not installed") from e

    logger.debug("normalize_loudness_start", input=input_path, target_lufs=target_lufs)
    
    data, rate = sf.read(input_path)
    
    # Measure the loudness first 
    meter = pyln.Meter(rate) 
    loudness = meter.integrated_loudness(data)
    
    # Loudness normalize audio to target LUFS
    loudness_normalized_audio = pyln.normalize.loudness(data, loudness, target_lufs)
    
    sf.write(output_path, loudness_normalized_audio, rate)
    logger.info("normalize_loudness_complete", output=output_path, initial_lufs=loudness)
