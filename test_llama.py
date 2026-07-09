import sys
sys.path.append("/Users/samreedhbhuyan/Desktop/Win_C/rays_studio_finetuning/RAYS-CORE/src")
from rays_studio.llama_cpp_manager import LlamaCppManager
manager = LlamaCppManager(port=8001)
manager.start_server("fake.gguf")
print("Process:", manager.server_process)
