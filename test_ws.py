import asyncio
import websockets
import json
import sys

async def main():
    async with websockets.connect(sys.argv[1]) as ws:
        print("Connected!")
        await ws.send(json.dumps({"command": "submit_prompt", "payload": {"prompt": "generate a simple presentation about AI", "mode": "agent"}}))
        print("Sent prompt!")
        while True:
            try:
                # Wait longer! (2 minutes)
                msg = await asyncio.wait_for(ws.recv(), timeout=120.0)
                print("RECV:", msg[:200])
            except asyncio.TimeoutError:
                break
        print("Done listening")

asyncio.run(main())
