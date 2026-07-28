import os
import platform
import subprocess
import threading
import time
from .github_downloader import download_latest_release

SD_CPP_DIR = os.path.expanduser("~/.rays/sd_cpp")
os.makedirs(SD_CPP_DIR, exist_ok=True)

class SdCppManager:
    def __init__(self, port: int = 11435):
        self.port = port
        self.server_process: subprocess.Popen = None
        self.current_model = None
        self.binary_path = self._get_binary_path()

    def _get_binary_path(self) -> str:
        exe = "sd.exe" if platform.system() == "Windows" else "sd"
        return os.path.join(SD_CPP_DIR, exe)
        
    def _get_server_binary_path(self) -> str:
        exe = "sd-server.exe" if platform.system() == "Windows" else "sd-server"
        return os.path.join(SD_CPP_DIR, exe)

    def download_sd_cpp_binary(self):
        if os.path.exists(self.binary_path):
            return
            
        sys_name = platform.system().lower()
        machine = platform.machine().lower()
        
        print(f"[SD.cpp] Detecting platform: {sys_name} {machine}")
        
        keywords = []
        exclude = ["vulkan", "rocm", "cu12", "cuda12"]
        if sys_name == "windows":
            keywords = ["win", "cpu", "x64"]
        elif sys_name == "darwin":
            keywords = ["mac", "arm64" if "arm" in machine else "x86_64"]
        else:
            keywords = ["linux", "x86_64"]
            
        binary_names = ["sd.exe", "sd-cli.exe"] if sys_name == "windows" else ["sd", "sd-cli"]
        
        # Pull from leejet/stable-diffusion.cpp
        success = download_latest_release("leejet/stable-diffusion.cpp", SD_CPP_DIR, binary_names, keywords, exclude_keywords=exclude)
        if not success:
            print("[SD.cpp] Failed to download real binary. Please install manually.")

    def start_server(self, model_path: str):
        self.download_sd_cpp_binary()
        
        if self.server_process is not None:
            print("[SD.cpp] Server already running, stopping first...")
            self.stop_server()
            
        self.current_model = model_path
        print(f"[SD.cpp] Starting server on port {self.port} with model {model_path}")
        
        try:
            server_exe = self._get_server_binary_path()
            if not os.path.exists(server_exe):
                print(f"[SD.cpp] Server binary not found at {server_exe}. Cannot start API.")
                return False
                
            if platform.system() != "Windows":
                os.chmod(server_exe, 0o755)
                
            self.server_process = subprocess.Popen(
                [server_exe, "-m", model_path, "--listen-port", str(self.port)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            # Start background thread to prevent blocking
            threading.Thread(target=self._read_output, daemon=True).start()
            print(f"[SD.cpp] SD server started successfully on port {self.port} with model {model_path}")
            print(f"[SD.cpp] API available at http://localhost:{self.port}")
        except Exception as e:
            print(f"[SD.cpp] Error starting server: {e}")
            
    def _read_output(self):
        if self.server_process:
            while True:
                line = self.server_process.stdout.readline()
                if not line:
                    break
                # print(f"[sd-server] {line.strip()}")

    def generate_image(self, prompt: str, output_path: str):
        if not self.current_model:
            print("[SD.cpp] No model loaded.")
            return False
            
        if not os.path.exists(self.binary_path):
            print("[SD.cpp] Binary not found. Attempting to download...")
            self.download_sd_cpp_binary()
            if not os.path.exists(self.binary_path):
                print("[SD.cpp] Failed to obtain binary.")
                return False
            
        cmd = [
            self.binary_path,
            "-m", self.current_model,
            "-p", prompt,
            "-o", output_path
        ]
        
        print(f"[SD.cpp] Generating image: {prompt}")
        try:
            subprocess.run(cmd, check=True)
            print(f"[SD.cpp] Image saved to {output_path}")
            return True
        except Exception as e:
            print(f"[SD.cpp] Failed to generate image: {e}")
            return False

    def stop_server(self):
        if self.server_process:
            print("[SD.cpp] Stopping server...")
            self.server_process.terminate()
            self.server_process.wait(timeout=5)
            self.server_process = None
            print("[SD.cpp] Server stopped.")

    def hot_swap_model(self, new_model_path: str):
        print(f"[SD.cpp] Hot-swapping model to {new_model_path}...")
        old_model = self.current_model
        self.stop_server()
        
        if old_model and os.path.exists(old_model) and old_model != new_model_path:
            try:
                print(f"[SD.cpp] Deleting old model to reclaim space: {old_model}")
                os.remove(old_model)
            except Exception as e:
                print(f"[SD.cpp] Could not delete old model: {e}")
                
        self.start_server(new_model_path)
        print("[SD.cpp] Hot-swap complete.")

# Global instance
manager = SdCppManager()
