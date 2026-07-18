"""
Kokoro TTS Provider implementation.

Runs the Kokoro model locally via a python subprocess or directly if imported.
Since the model isn't provided here, we stub it to load from `model_path`.
"""
import structlog
from app.providers.tts.base import ITTSProvider, TTSSynthesisResult, WordTiming

logger = structlog.get_logger(__name__)

class KokoroProvider(ITTSProvider):
    def __init__(self, model_path: str) -> None:
        self.model_path = model_path
        logger.info("kokoro_provider_initialized", path=model_path)

    async def synthesize(self, text: str, voice_id: str) -> TTSSynthesisResult:
        logger.info("kokoro_synthesize_stub", text=text, voice_id=voice_id)
        # Stub implementation for P1, to be implemented fully with actual Kokoro model integration
        return TTSSynthesisResult(
            audio_url="/storage/tmp/kokoro_audio.wav",
            word_timings=[WordTiming(word="test", start=0.0, end=1.0)],
            duration_sec=1.0,
        )

    async def list_voices(self) -> list[str]:
        return ["kokoro-voice-1"]
