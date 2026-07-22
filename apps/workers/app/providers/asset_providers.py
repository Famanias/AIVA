import os
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
        api_key = os.getenv("PEXELS_API_KEY")
        if not api_key:
            return []

        # MVP mock of a Pexels API call.
        # In full implementation, we use aiohttp to call https://api.pexels.com/videos/search
        candidates = []
        async with aiohttp.ClientSession() as session:
            try:
                headers = {"Authorization": api_key}
                async with session.get(
                    "https://api.pexels.com/videos/search",
                    params={"query": query, "per_page": limit, "orientation": "portrait"},
                    headers=headers
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for video in data.get("videos", []):
                            # Extract the best video file (e.g. hd, portrait)
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
                                    score=0.0, # Filled by Ranker later
                                    reason="Initial provider fetch",
                                    provider=self.name,
                                    raw_metadata={
                                        "url": best_file.get("link"),
                                        "description": video.get("url", "").replace("https://www.pexels.com/video/", "").replace("-", " "),
                                        "duration": video.get("duration"),
                                        "width": best_file.get("width"),
                                        "height": best_file.get("height")
                                    }
                                )
                            )
            except Exception as e:
                print(f"[PexelsProvider] Search failed: {e}")

        return candidates

class SDXLProvider(IAssetProvider):
    @property
    def name(self) -> str:
        return "sdxl"

    async def generate(self, prompt: str) -> List[RankedCandidate]:
        # For MVP, we simulate hitting Cloudflare Workers AI SDXL
        # The result would be an image URL or base64 stream.
        return [
            RankedCandidate(
                score=1.0, # Always a perfect match if generated
                reason="Generated exactly to prompt",
                provider=self.name,
                raw_metadata={
                    "prompt": prompt,
                    "mime_type": "image/jpeg",
                    # Static fallback for SDXL without API key setup
                    "url": "https://picsum.photos/1080/1920"
                }
            )
        ]
