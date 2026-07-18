"""IImageProvider — Abstract base class for image generation providers."""
from abc import ABC, abstractmethod
from typing import Literal

ImageGenerationStyle = Literal["photorealistic", "flat_vector_bg", "archival"]


class IImageProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, style: ImageGenerationStyle) -> str:
        """Generate an image. Returns a local file path or URL."""
        ...
