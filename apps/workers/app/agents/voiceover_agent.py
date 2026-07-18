"""
Voiceover Agent

Iterates over scenes, calls ITTSProvider per scene, and normalizes audio.
Called during the 'voiceover' job_step.
See EDD §16.2.
"""
import asyncio
from dataclasses import dataclass
import structlog
from app.providers.tts.base import ITTSProvider, TTSSynthesisResult
from app.core.audio import normalize_loudness

logger = structlog.get_logger(__name__)

@dataclass
class VoiceoverOutput:
    scene_number: int
    audio_url: str
    word_timings: list[dict]
    duration_sec: float

class VoiceoverAgent:
    def __init__(self, tts: ITTSProvider) -> None:
        self._tts = tts

    async def run(
        self,
        scenes: list[dict], # [{"sequence_number": int, "scriptSegment": str}]
        voice_id: str,
    ) -> list[VoiceoverOutput]:
        logger.info("voiceover_agent_start", num_scenes=len(scenes), voice_id=voice_id)
        
        results = []
        for scene in scenes:
            text = scene.get("scriptSegment", "")
            seq = scene.get("sequence_number", 0)
            
            if not text.strip():
                continue
                
            tts_result: TTSSynthesisResult = await self._tts.synthesize(text, voice_id)
            
            # P1 simplified: in a real implementation we would normalize the audio
            # and upload it to a storage bucket here. For now we just return the local tmp path.
            # normalize_loudness(tts_result.audio_url, tts_result.audio_url, target_lufs=-16.0)

            results.append(VoiceoverOutput(
                scene_number=seq,
                audio_url=tts_result.audio_url,
                word_timings=[{"word": w.word, "start": w.start, "end": w.end} for w in tts_result.word_timings],
                duration_sec=tts_result.duration_sec,
            ))
            
        logger.info("voiceover_agent_complete", num_results=len(results))
        return results
