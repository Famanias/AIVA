"""
Edge-TTS provider — cloud fallback when self-hosted TTS is unavailable.
Uses Microsoft's Edge browser TTS API (free, no key required).
"""
import asyncio
import os
import tempfile
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.providers.tts.base import ITTSProvider, TTSSynthesisResult, WordTiming
from typing import Any
from app.core.telemetry import TelemetryClient, ProviderUsageCollector
from app.models.telemetry import TelemetryContext

logger = structlog.get_logger(__name__)


class EdgeTTSProvider(ITTSProvider):
    """
    Microsoft Edge TTS fallback provider.
    Produces MP3 audio with approximate word timings derived from text analysis.
    Word timings are estimated (not precise) — Faster-Whisper re-extracts exact
    timings in the subtitle_extraction stage.
    """

    def __init__(self, default_voice: str = "en-US-AriaNeural") -> None:
        self._default_voice = default_voice

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=2, max=60))
    async def synthesize(self, text: str, voice_id: str, context: TelemetryContext | None = None) -> TTSSynthesisResult:
        try:
            import edge_tts
        except ImportError as e:
            raise ImportError("edge-tts package not installed") from e

        voice = voice_id or self._default_voice
        logger.info("edge_tts_synthesize", voice=voice, text_chars=len(text))

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            audio_path = tmp.name

        # Collect word boundaries for approximate timing
        word_boundaries: list[dict] = []

        import traceback
        try:
            communicate = edge_tts.Communicate(text, voice)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    with open(audio_path, "ab") as f:
                        f.write(chunk["data"])
                elif chunk["type"] == "WordBoundary":
                    word_boundaries.append(chunk)
        except Exception as e:
            logger.exception("edge_tts_failed", exc_info=e)
            traceback.print_exc()
            raise e

        # Convert word boundaries to WordTiming objects
        timings = [
            WordTiming(
                word=wb.get("text", ""),
                start=wb.get("audio_offset", 0) / 10_000_000,  # 100-nanosecond units → seconds
                end=(wb.get("audio_offset", 0) + wb.get("duration", 0)) / 10_000_000,
            )
            for wb in word_boundaries
        ]

        if timings:
            duration = timings[-1].end
        else:
            # Fallback duration measurement from MP3 file size (~128kbps = 16000 bytes/sec)
            file_size = os.path.getsize(audio_path)
            duration = max(1.0, round(file_size / 16000.0, 2))
            
            # Generate estimated word timings from text for subtitle extraction stage
            words = text.split()
            if words:
                time_per_word = duration / len(words)
                timings = [
                    WordTiming(
                        word=w,
                        start=round(i * time_per_word, 2),
                        end=round((i + 1) * time_per_word, 2)
                    )
                    for i, w in enumerate(words)
                ]

        logger.info("edge_tts_complete", duration_sec=duration, word_count=len(timings))
        
        if context:
            with TelemetryClient.track_span("edge_tts_synthesize", context, {"voice": voice}) as span:
                span.attributes["duration_sec"] = duration
                span.attributes["character_count"] = len(text)
                ProviderUsageCollector.extract_and_record_tts(
                    job_id=context.job_id,
                    project_id=context.project_id or "",
                    provider="edge_tts",
                    model=voice,
                    character_count=len(text)
                )

        return TTSSynthesisResult(
            audio_url=audio_path,  # local path; storage service will upload
            word_timings=timings,
            duration_sec=duration,
        )

    async def list_voices(self) -> list[str]:
        try:
            import edge_tts
            voices = await edge_tts.list_voices()
            return [v["ShortName"] for v in voices if v.get("Locale", "").startswith("en-")]
        except ImportError:
            return [self._default_voice]
