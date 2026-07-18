"""
Subtitle Extraction Agent

Extracts word-level timestamps from voiceover tracks using Faster-Whisper.
Called during the 'subtitle_extraction' job_step.
See EDD §16.2.
"""
import structlog
from dataclasses import dataclass
from app.models.whisper import WhisperModelWrapper

logger = structlog.get_logger(__name__)

@dataclass
class SubtitleOutput:
    scene_number: int
    word_timings: list[dict]

class SubtitleAgent:
    def __init__(self, whisper: WhisperModelWrapper) -> None:
        self._whisper = whisper

    async def run(
        self,
        scene_voiceovers: list[dict], # [{"sequence_number": int, "voiceoverUrl": str}]
    ) -> list[SubtitleOutput]:
        logger.info("subtitle_agent_start", num_scenes=len(scene_voiceovers))
        
        results = []
        for sv in scene_voiceovers:
            seq = sv.get("sequence_number", 0)
            url = sv.get("voiceoverUrl")
            
            if not url:
                continue
                
            # If the TTS provider was Edge-TTS, the timings are imprecise.
            # We re-extract them here with Whisper.
            timings = self._whisper.extract_word_timings(url)

            results.append(SubtitleOutput(
                scene_number=seq,
                word_timings=timings,
            ))
            
        logger.info("subtitle_agent_complete", num_results=len(results))
        return results
