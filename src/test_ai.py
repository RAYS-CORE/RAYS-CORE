from rays_core.ai_client import AIClient
import requests

ai = AIClient({
    'provider': 'ollama',
    'model': 'ornith:35b',
    'base_url': 'http://localhost:11434',
    'api_key': '',
    'delay': 0.1
})
print("Is available:", ai.is_available())
resp = ai._ollama_generate("Hello")
print("Response:", resp)
