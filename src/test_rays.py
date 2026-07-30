from rays_core.rays_main import RAYS
import sys
overrides = {"llm": {"provider": "ollama", "model": "ornith:35b", "api_key": ""}}
r = RAYS(".", runtime_overrides=overrides)
r.set_execution_mode("autonomous")
r.run("Say hello!")
