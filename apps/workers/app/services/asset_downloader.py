import os
import aiohttp
import tempfile

class AssetDownloader:
    """
    Securely downloads media into memory or temp space.
    """
    
    @staticmethod
    async def download(url: str) -> str:
        if not url:
            raise ValueError("URL cannot be empty")
            
        # In a production environment, this would stream the file to disk chunk by chunk
        # to avoid blowing up memory with huge 4K stock videos.
        # For MVP, we will write it to a temporary file.
        temp_dir = os.path.join(tempfile.gettempdir(), "aiva_assets")
        os.makedirs(temp_dir, exist_ok=True)
        
        # Simple extraction of filename, fallback to temp.mp4
        filename = url.split("/")[-1].split("?")[0]
        if not filename:
            filename = "temp.mp4"
            
        temp_path = os.path.join(temp_dir, f"{os.urandom(8).hex()}_{filename}")
        
        print(f"[AssetDownloader] Downloading {url} to {temp_path}")
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    raise Exception(f"Failed to download asset: HTTP {resp.status}")
                
                with open(temp_path, "wb") as f:
                    # Stream download
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
                        
        return temp_path
