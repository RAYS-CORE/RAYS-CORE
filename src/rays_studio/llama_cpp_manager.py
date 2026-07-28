import os
import sys
import platform
import subprocess
import tarfile
import zipfile
import urllib.request
import threading
import time
from .github_downloader import download_latest_release

LLAMA_CPP_DIR = os.path.expanduser("~/.rays/llama_cpp")
os.makedirs(LLAMA_CPP_DIR, exist_ok=True)

class LlamaCppManager:
    def __init__(self, port: int = 11434):
        self.port = port
        self.server_process: subprocess.Popen = None
        self.current_gguf = None
        self.binary_path = self._get_binary_path()

    def _get_binary_path(self) -> str:
        exe = "llama-server.exe" if platform.system() == "Windows" else "llama-server"
        return os.path.join(LLAMA_CPP_DIR, exe)

    def download_llama_cpp_binary(self):
        if os.path.exists(self.binary_path):
            return
            
        sys_name = platform.system().lower()
        machine = platform.machine().lower()
        
        print(f"[LLaMA.cpp] Detecting platform: {sys_name} {machine}")
        
        keywords = []
        if sys_name == "windows":
            keywords = ["win", "x64"]
        elif sys_name == "darwin":
            keywords = ["macos", "arm64" if "arm" in machine else "x64"]
        else:
            keywords = ["ubuntu", "x64"]
            
        binary_names = ["llama-server.exe"] if sys_name == "windows" else ["llama-server"]
        
        success = download_latest_release("ggerganov/llama.cpp", LLAMA_CPP_DIR, binary_names, keywords)
        if not success:
            print("[LLaMA.cpp] Failed to download real binary. Please install manually.")

    def start_server(self, gguf_path: str):
        self.download_llama_cpp_binary()
        
        if self.server_process is not None:
            print("[LLaMA.cpp] Server already running, stopping first...")
            self.stop_server()
            
        self.current_gguf = gguf_path
        print(f"[LLaMA.cpp] Starting server on port {self.port} with model {gguf_path}")
        
        try:
            self.server_process = subprocess.Popen(
                [self.binary_path, "-m", gguf_path, "--port", str(self.port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            # Start a background thread to read output so it doesn't block
            threading.Thread(target=self._read_output, daemon=True).start()
            print(f"[LLaMA.cpp] Server started successfully on port {self.port}.")
        except Exception as e:
            print(f"[LLaMA.cpp] Error starting server: {e}")

    def _read_output(self):
        if self.server_process:
            while True:
                line = self.server_process.stdout.readline()
                if not line:
                    break
                # print(f"[llama-server] {line.strip()}")

    def stop_server(self):
        if self.server_process:
            print("[LLaMA.cpp] Stopping server...")
            self.server_process.terminate()
            self.server_process.wait(timeout=5)
            self.server_process = None
            print("[LLaMA.cpp] Server stopped.")

    def hot_swap_model(self, new_gguf_path: str):
        print(f"[LLaMA.cpp] Hot-swapping model to {new_gguf_path}...")
        old_gguf = self.current_gguf
        self.stop_server()
        
        if old_gguf and os.path.exists(old_gguf) and old_gguf != new_gguf_path:
            try:
                print(f"[LLaMA.cpp] Deleting old GGUF to reclaim space: {old_gguf}")
                os.remove(old_gguf)
            except Exception as e:
                print(f"[LLaMA.cpp] Could not delete old GGUF: {e}")
                
        self.start_server(new_gguf_path)
        print("[LLaMA.cpp] Hot-swap complete.")

# Global instance
manager = LlamaCppManager()
