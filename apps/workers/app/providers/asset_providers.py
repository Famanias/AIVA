import os
import urllib.parse
import random
import aiohttp
from typing import List
from app.models.asset import RankedCandidate

class IAssetProvider:
    @property
    def name(self) -> str:
        raise NotImplementedError

    async def search(self, query: str, limit: int = 25) -> List[RankedCandidate]:
        raise NotImplementedError

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        raise NotImplementedError

class PexelsProvider(IAssetProvider):
    @property
    def name(self) -> str:
        return "pexels"

    async def search(self, query: str, limit: int = 25) -> List[RankedCandidate]:
        from app.core.db import get_app_setting
        api_key = (await get_app_setting("pexels_api_key")) or os.getenv("PEXELS_API_KEY")
        if not api_key:
            return []

        candidates = []
        async with aiohttp.ClientSession() as session:
            try:
                headers = {"Authorization": api_key}
                # 1. Search Videos (Portrait first)
                async with session.get(
                    "https://api.pexels.com/videos/search",
                    params={"query": query, "per_page": limit, "orientation": "portrait"},
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for video in data.get("videos", []):
                            video_files = video.get("video_files", [])
                            if not video_files:
                                continue
                            best_file = video_files[0]
                            for vf in video_files:
                                if vf.get("quality") == "hd" and vf.get("width", 0) <= 1080:
                                    best_file = vf
                                    break
                            candidates.append(
                                RankedCandidate(
                                    score=0.0,
                                    reason="Pexels Video",
                                    provider=self.name,
                                    raw_metadata={
                                        "url": best_file.get("link"),
                                        "mime_type": "video/mp4",
                                        "description": video.get("url", "").replace("https://www.pexels.com/video/", "").replace("-", " "),
                                        "duration": video.get("duration", 5),
                                        "width": best_file.get("width", 1080),
                                        "height": best_file.get("height", 1920)
                                    }
                                )
                            )

                # 2. Fallback to Pexels Photos if no videos found
                if not candidates:
                    async with session.get(
                        "https://api.pexels.com/v1/search",
                        params={"query": query, "per_page": limit, "orientation": "portrait"},
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            for photo in data.get("photos", []):
                                src = photo.get("src", {})
                                photo_url = src.get("portrait") or src.get("large2x") or src.get("large") or src.get("original")
                                if photo_url:
                                    candidates.append(
                                        RankedCandidate(
                                            score=0.0,
                                            reason="Pexels Photo",
                                            provider=self.name,
                                            raw_metadata={
                                                "url": photo_url,
                                                "mime_type": "image/jpeg",
                                                "description": photo.get("alt", query),
                                                "duration": 5,
                                                "width": photo.get("width", 1080),
                                                "height": photo.get("height", 1920)
                                            }
                                        )
                                    )
            except Exception as e:
                print(f"[PexelsProvider] Search failed: {e}")

        return candidates

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        return await self.search(prompt)


class PixabayProvider(IAssetProvider):
    @property
    def name(self) -> str:
        return "pixabay"

    async def search(self, query: str, limit: int = 25) -> List[RankedCandidate]:
        from app.core.db import get_app_setting
        api_key = (await get_app_setting("pixabay_api_key")) or os.getenv("PIXABAY_API_KEY")
        if not api_key:
            return []

        candidates = []
        async with aiohttp.ClientSession() as session:
            try:
                # Search Pixabay Videos
                async with session.get(
                    "https://pixabay.com/api/videos/",
                    params={"key": api_key, "q": query, "per_page": limit, "video_type": "all"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for hit in data.get("hits", []):
                            videos = hit.get("videos", {})
                            med = videos.get("medium") or videos.get("large") or videos.get("small") or {}
                            if med.get("url"):
                                candidates.append(
                                    RankedCandidate(
                                        score=0.0,
                                        reason="Pixabay Video",
                                        provider=self.name,
                                        raw_metadata={
                                            "url": med.get("url"),
                                            "mime_type": "video/mp4",
                                            "description": hit.get("tags", query),
                                            "duration": hit.get("duration", 5),
                                            "width": med.get("width", 1080),
                                            "height": med.get("height", 1920)
                                        }
                                    )
                                )
            except Exception as e:
                print(f"[PixabayProvider] Search failed: {e}")

        return candidates

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        return await self.search(prompt)


class PollinationsProvider(IAssetProvider):
    """
    100% Free, zero-API-key AI Image Generation via Pollinations.ai.
    Uses modern Flux / SDXL models at 9:16 portrait ratio.
    """
    @property
    def name(self) -> str:
        return "pollinations"

    async def search(self, query: str, limit: int = 25) -> List[RankedCandidate]:
        return await self.generate(query)

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        clean_prompt = prompt.replace("\n", " ").strip()
        encoded = urllib.parse.quote(clean_prompt)
        seed = random.randint(1, 999999)
        url = f"https://image.pollinations.ai/prompt/{encoded}?width=1080&height=1920&nologo=true&model=flux&seed={seed}"
        
        return [
            RankedCandidate(
                score=1.0,
                reason="Pollinations AI Flux Portrait",
                provider=self.name,
                raw_metadata={
                    "url": url,
                    "mime_type": "image/jpeg",
                    "description": clean_prompt,
                    "duration": 5,
                    "width": 1080,
                    "height": 1920
                }
            )
        ]


class SDXLProvider(IAssetProvider):
    @property
    def name(self) -> str:
        return "sdxl"

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        clean_prompt = prompt.replace("\n", " ").strip()
        encoded = urllib.parse.quote(clean_prompt)
        return [
            RankedCandidate(
                score=1.0,
                reason="SDXL Generated Image",
                provider=self.name,
                raw_metadata={
                    "prompt": prompt,
                    "mime_type": "image/jpeg",
                    "url": f"https://image.pollinations.ai/prompt/{encoded}?width=1080&height=1920&nologo=true&model=flux",
                    "duration": 5,
                    "width": 1080,
                    "height": 1920
                }
            )
        ]
