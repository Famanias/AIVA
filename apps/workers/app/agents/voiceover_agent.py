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
        
        async def synthesize_scene(scene: dict) -> VoiceoverOutput | None:
            text = scene.get("scriptSegment") or scene.get("script_segment") or scene.get("text") or ""
            seq = scene.get("sequence_number", 0)
            
            if not text.strip():
                return None
                
            tts_result: TTSSynthesisResult = await self._tts.synthesize(text, voice_id)
            
            return VoiceoverOutput(
                scene_number=seq,
                audio_url=tts_result.audio_url,
                word_timings=[{"word": w.word, "start": w.start, "end": w.end} for w in tts_result.word_timings],
                duration_sec=tts_result.duration_sec,
            )

        tasks = [synthesize_scene(scene) for scene in scenes]
        raw_results = await asyncio.gather(*tasks)
        results = [r for r in raw_results if r is not None]
        # Keep results sorted by sequence_number
        results.sort(key=lambda r: r.scene_number)
            
        logger.info("voiceover_agent_complete", num_results=len(results))
        return results
