import structlog
from typing import Any

from app.providers.tts.base import ITTSProvider, TTSSynthesisResult, WordTiming
from app.models.telemetry import TelemetryContext

logger = structlog.get_logger(__name__)

class MockTTSProvider(ITTSProvider):
    """
    Deterministic Mock TTS Provider for CI/CD and Golden Suite Certification.
    Returns a dummy audio URL and hardcoded word timings without running any ML models.
    """

    async def synthesize(
        self, 
        text: str, 
        voice_id: str,
        context: TelemetryContext | None = None
    ) -> TTSSynthesisResult:
        logger.info("mock_tts_synthesize", voice=voice_id, text_chars=len(text))
        
        words = text.split()
        timings = []
        current_time = 0.0
        
        for word in words:
            start = current_time
            end = current_time + 0.3  # Fake 300ms per word
            timings.append(WordTiming(word=word, start=start, end=end))
            current_time = end
            
        return TTSSynthesisResult(
            audio_url="/mock/audio/path.mp3",
            word_timings=timings,
            duration_sec=current_time
        )

    async def list_voices(self) -> list[str]:
        return ["mock-voice-1", "mock-voice-2"]
