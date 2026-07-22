import asyncio
import traceback
import edge_tts
import aiohttp

TEXT = "Hello. This is an Edge TTS connectivity test."
VOICE = "en-US-AriaNeural"
OUTPUT = "test.mp3"


async def main():
    print("=" * 60)
    print("Edge-TTS Standalone Test")
    print("=" * 60)

    print(f"Voice : {VOICE}")
    print(f"Output: {OUTPUT}")

    try:
        communicate = edge_tts.Communicate(TEXT, VOICE)

        print("Connecting to Microsoft TTS...")

        await communicate.save(OUTPUT)

        print("\nSUCCESS")
        print(f"Audio successfully saved to: {OUTPUT}")

    except aiohttp.client_exceptions.WSServerHandshakeError as e:
        print("\nWEBSOCKET HANDSHAKE FAILED")
        print("-" * 60)

        print("Status :", getattr(e, "status", None))
        print("Message:", getattr(e, "message", None))
        print("Headers:")
        print(getattr(e, "headers", None))

        print("\nFull traceback:")
        traceback.print_exc()

    except Exception as e:
        print("\nUNEXPECTED EXCEPTION")
        print(type(e).__name__)
        print(e)

        print("\nFull traceback:")
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())