"""ITTSProvider — Abstract base class for TTS providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class WordTiming:
    word: str
    start: float  # seconds
    end: float    # seconds


@dataclass
class TTSSynthesisResult:
    audio_url: str
    word_timings: list[WordTiming]
    duration_sec: float


class ITTSProvider(ABC):
    @abstractmethod
    async def synthesize(
        self, 
        text: str, 
        voice_id: str,
        context: Any = None
    ) -> TTSSynthesisResult:
        """Synthesize speech. Returns audio URL and word-level timings."""
        ...

    @abstractmethod
    async def list_voices(self) -> list[str]:
        """Return available voice IDs."""
        ...
