import os
from typing import List
from app.models.asset import RankedCandidate
from app.providers.asset_providers import IAssetProvider

class LocalSolidFallbackProvider(IAssetProvider):
    """
    Guaranteed 100% offline, zero-network fallback asset provider.
    Generates or returns a high-definition styled aesthetic gradient canvas.
    """

    @property
    def name(self) -> str:
        return "local_fallback"

    def _ensure_fallback_image(self, width: int = 1080, height: int = 1920) -> str:
        cache_dir = os.path.abspath(".cache/assets")
        os.makedirs(cache_dir, exist_ok=True)
        file_path = os.path.join(cache_dir, f"fallback_ambient_{width}x{height}.jpg")

        if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
            return file_path

        try:
            from PIL import Image, ImageDraw
            # Generate a sleek dark gradient background with ambient lighting
            image = Image.new("RGB", (width, height), color=(10, 14, 26))
            draw = ImageDraw.Draw(image)

            # Draw a smooth vertical/radial gradient from #0b0f19 to #16213e
            top_color = (11, 15, 25)
            mid_color = (22, 33, 62)
            bot_color = (15, 23, 42)

            half = height // 2
            for y in range(height):
                if y < half:
                    t = y / max(1, half)
                    r = int(top_color[0] * (1 - t) + mid_color[0] * t)
                    g = int(top_color[1] * (1 - t) + mid_color[1] * t)
                    b = int(top_color[2] * (1 - t) + mid_color[2] * t)
                else:
                    t = (y - half) / max(1, half)
                    r = int(mid_color[0] * (1 - t) + bot_color[0] * t)
                    g = int(mid_color[1] * (1 - t) + bot_color[1] * t)
                    b = int(mid_color[2] * (1 - t) + bot_color[2] * t)
                draw.line([(0, y), (width, y)], fill=(r, g, b))

            image.save(file_path, "JPEG", quality=95)
        except Exception:
            # Minimal 1x1 JPEG fallback if Pillow fails
            with open(file_path, "wb") as f:
                # 1x1 black JPEG header
                f.write(bytes.fromhex("ffd8ffe000104a46494600010101004800480000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9"))

        return file_path

    async def search(self, query: str, limit: int = 25) -> List[RankedCandidate]:
        return await self.generate(query)

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        fallback_path = self._ensure_fallback_image(1080, 1920)
        return [
            RankedCandidate(
                score=1.0,
                reason="Local Guaranteed Ambient Canvas",
                provider=self.name,
                raw_metadata={
                    "url": fallback_path,
                    "mime_type": "image/jpeg",
                    "description": "Ambient Dark Gradient Canvas",
                    "duration": 5,
                    "width": 1080,
                    "height": 1920
                }
            )
        ]
