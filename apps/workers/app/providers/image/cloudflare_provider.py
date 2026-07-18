"""
Cloudflare Workers AI SDXL image generation provider.
Cost: ~$0.001/image. See EDD §21.
"""
import tempfile
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from app.providers.image.base import IImageProvider, ImageGenerationStyle

logger = structlog.get_logger(__name__)

# Style-specific prompt suffixes injected by the Director Agent's instruction (EDD §21)
_STYLE_SUFFIXES: dict[ImageGenerationStyle, str] = {
    "photorealistic": "cinematic, 8k resolution, photorealistic, sharp focus, professional photography",
    "archival": "archival photograph style, film grain, desaturated, vintage, documentary",
    "flat_vector_bg": "flat vector background, minimal, muted palette, no characters, no text, clean design",
}


class CloudflareImageProvider(IImageProvider):
    def __init__(self, account_id: str, token: str) -> None:
        self._account_id = account_id
        self._token = token
        self._base_url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run"

    @retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=2, min=2, max=60))
    async def generate(self, prompt: str, style: ImageGenerationStyle) -> str:
        suffix = _STYLE_SUFFIXES.get(style, "")
        full_prompt = f"{prompt}, {suffix}" if suffix else prompt

        logger.info("cloudflare_image_generate", style=style, prompt_chars=len(full_prompt))

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self._base_url}/@cf/stabilityai/stable-diffusion-xl-base-1.0",
                headers={"Authorization": f"Bearer {self._token}"},
                json={"prompt": full_prompt, "num_steps": 20},
            )
            response.raise_for_status()

        # Response is raw image bytes
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp.write(response.content)
            local_path = tmp.name

        logger.info("cloudflare_image_complete", local_path=local_path)
        return local_path
