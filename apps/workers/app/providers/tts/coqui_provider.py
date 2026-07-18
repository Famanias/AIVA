"""
Coqui TTS Provider implementation.
"""
import structlog
from app.providers.tts.base import ITTSProvider, TTSSynthesisResult, WordTiming

logger = structlog.get_logger(__name__)

class CoquiProvider(ITTSProvider):
    def __init__(self, model_path: str) -> None:
        self.model_path = model_path
        logger.info("coqui_provider_initialized", path=model_path)

    async def synthesize(self, text: str, voice_id: str) -> TTSSynthesisResult:
        logger.info("coqui_synthesize_stub", text=text, voice_id=voice_id)
        return TTSSynthesisResult(
            audio_url="/storage/tmp/coqui_audio.wav",
            word_timings=[WordTiming(word="test", start=0.0, end=1.0)],
            duration_sec=1.0,
        )

    async def list_voices(self) -> list[str]:
        return ["coqui-voice-1"]
