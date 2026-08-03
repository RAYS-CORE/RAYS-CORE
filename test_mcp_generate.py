import asyncio
import httpx

async def generate_ppt(
    topic: str,
    n_slides: int = 5,
    template: str = "general",
    tone: str = "default",
    export_as: str = "pptx",
    language: str = "English",
    verbosity: str = "standard",
    instructions: str | None = None,
):
    BASE = "http://127.0.0.1:8085"
    async with httpx.AsyncClient(base_url=BASE, timeout=30.0) as client:
        response = await client.post(
            "/api/v1/ppt/presentation/generate",
            json={
                "content": topic,
                "n_slides": n_slides,
                "template": template,
                "export_as": export_as,
                "language": language,
                "tone": tone,
                "verbosity": verbosity,
                "instructions": instructions,
            },
        )
        print(response.status_code)
        print(response.text)

asyncio.run(generate_ppt("An Apple a Day Keeps the Doctor Away", template="modern"))
