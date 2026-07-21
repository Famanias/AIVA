import asyncio
import sys
sys.path.append('.')
from app.providers.tts.kokoro_provider import KokoroProvider

async def main():
    provider = KokoroProvider('test')
    res = await provider.synthesize('test', 'test')
    print(res)

asyncio.run(main())
