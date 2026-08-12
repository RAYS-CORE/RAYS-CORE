import requests
import time
import threading

def run_request():
    url = "http://localhost:11434/v1/chat/completions"
    payload = {
        "model": "ornith:35b",
        "messages": [{"role": "user", "content": "Hello, write a long story."}]
    }
    try:
        requests.post(url, json=payload)
    except:
        pass

t = threading.Thread(target=run_request)
t.start()
time.sleep(2)

import subprocess
subprocess.run(["ollama", "ps"])
