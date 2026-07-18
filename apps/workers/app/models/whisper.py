"""
Faster-Whisper model wrapper for subtitle extraction.
Extracts word-level timestamps from audio files.
"""
import structlog

logger = structlog.get_logger(__name__)

class WhisperModelWrapper:
    def __init__(self, model_size: str = "medium.en") -> None:
        try:
            from faster_whisper import WhisperModel
            # compute_type="default" falls back to float32 on CPU, float16 on GPU
            self._model = WhisperModel(model_size, device="auto", compute_type="default")
            logger.info("whisper_model_loaded", size=model_size)
        except ImportError as e:
            raise ImportError("faster-whisper package not installed") from e

    def extract_word_timings(self, audio_path: str) -> list[dict]:
        """
        Extract word-level timestamps from an audio file.
        Returns a list of dicts: [{"word": str, "start": float, "end": float}]
        """
        logger.info("whisper_extract_start", audio_path=audio_path)
        segments, _ = self._model.transcribe(audio_path, word_timestamps=True)
        
        timings = []
        for segment in segments:
            for word in segment.words:
                timings.append({
                    "word": word.word.strip(),
                    "start": word.start,
                    "end": word.end,
                })
                
        logger.info("whisper_extract_complete", word_count=len(timings))
        return timings
