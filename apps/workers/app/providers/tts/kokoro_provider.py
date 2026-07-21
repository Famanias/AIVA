"""
Kokoro TTS Provider implementation.

Runs the Kokoro model locally via a python subprocess or directly if imported.
Since the model isn't provided here, we stub it to load from `model_path`.
"""
# pyrefly: ignore [missing-import]
import structlog
from app.providers.tts.base import ITTSProvider, TTSSynthesisResult, WordTiming

logger = structlog.get_logger(__name__)

class KokoroProvider(ITTSProvider):
    def __init__(self, model_path: str) -> None:
        self.model_path = model_path
        logger.info("kokoro_provider_initialized", path=model_path)

    async def synthesize(self, text: str, voice_id: str) -> TTSSynthesisResult:
        logger.info("kokoro_synthesize_stub", text=text, voice_id=voice_id)
        
        # Resolve workspace root (D:\repos\AIVA)
        import os, wave
        workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.."))
        tmp_dir = os.path.join(workspace_root, "storage", "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        
        audio_path = os.path.join(tmp_dir, "kokoro_audio.wav")
        
        # Create a 1-second silent WAV file so FFmpeg doesn't crash during composition
        with wave.open(audio_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(44100)
            wf.writeframes(b'\x00' * 44100 * 2)

        return TTSSynthesisResult(
            audio_url=audio_path,
            word_timings=[WordTiming(word="test", start=0.0, end=1.0)],
            duration_sec=1.0,
        )

    async def list_voices(self) -> list[str]:
        return ["kokoro-voice-1"]
