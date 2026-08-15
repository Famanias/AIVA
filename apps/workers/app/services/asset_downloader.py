import os
import ssl
import certifi
import aiohttp
import tempfile


def _get_ssl_context() -> ssl.SSLContext:
    try:
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


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
        
        clean_url = url.replace("\\", "/")
        raw_filename = clean_url.split("/")[-1].split("?")[0]
        filename = "".join(c for c in raw_filename if c.isalnum() or c in "._-")
        if not filename:
            filename = "temp.mp4"
            
        temp_path = os.path.join(temp_dir, f"{os.urandom(8).hex()}_{filename}")
        
        # Handle local files directly
        if url.startswith("file://"):
            import urllib.parse
            parsed_path = urllib.parse.unquote(url[7:])
            if parsed_path.startswith('/') and os.name == 'nt' and len(parsed_path) > 2 and parsed_path[2] == ':':
                parsed_path = parsed_path[1:]
            elif parsed_path.startswith('//'):
                parsed_path = parsed_path[1:]
                if os.name == 'nt' and parsed_path.startswith('/') and len(parsed_path) > 2 and parsed_path[2] == ':':
                    parsed_path = parsed_path[1:]
            if os.path.exists(parsed_path):
                import shutil
                shutil.copy2(parsed_path, temp_path)
                return temp_path
        elif os.path.exists(url):
            import shutil
            shutil.copy2(url, temp_path)
            return temp_path

        print(f"[AssetDownloader] Downloading {url} to {temp_path}")
        
        connector = aiohttp.TCPConnector(ssl=_get_ssl_context())
        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.get(url) as resp:
                if resp.status != 200:
                    raise Exception(f"Failed to download asset: HTTP {resp.status}")
                
                with open(temp_path, "wb") as f:
                    # Stream download
                    async for chunk in resp.content.iter_chunked(1024 * 1024):
                        f.write(chunk)
                        
        return temp_path

