"""
SDXL Local image generation provider.
"""
import structlog
from app.providers.image.base import IImageProvider, ImageGenerationStyle

logger = structlog.get_logger(__name__)

class SDXLLocalProvider(IImageProvider):
    def __init__(self) -> None:
        logger.info("sdxl_local_provider_initialized")

    async def generate(self, prompt: str, style: ImageGenerationStyle) -> str:
        logger.info("sdxl_local_generate_stub", prompt=prompt, style=style)
        return "/storage/tmp/sdxl_image.png"
