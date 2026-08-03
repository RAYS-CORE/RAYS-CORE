import asyncio
from llmai import get_client
from llmai.shared import OpenAIClientConfig, Message, UserMessage
from utils.llm_utils import get_generate_kwargs
from utils.llm_calls.generate_presentation_outlines import stream_generate_events

async def main():
    client = get_client(config=OpenAIClientConfig(base_url="http://127.0.0.1:11434/v1", api_key="ollama"))
    messages = [UserMessage(content="hi")]
    kwargs = get_generate_kwargs(model=None, messages=messages, stream=True)
    print("Calling stream_generate_events...")
    try:
        async for chunk in stream_generate_events(client, **kwargs):
            print(chunk)
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    asyncio.run(main())
