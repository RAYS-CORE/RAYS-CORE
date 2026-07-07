# RAYS Studio: Fine-Tuning & Architecture Guide

This document outlines the architecture and features implemented for the RAYS Studio fine-tuning module and federated server operations.

## Core Features Implemented
- **RAYS Studio GUI**: A fully-fledged React frontend dashboard for viewing, downloading, and fine-tuning Hugging Face models via a native local Daemon.
- **Python Daemon (`daemon.py`)**: Runs in the background (`rays --studio --start`). It exposes OpenAI-compatible endpoints (`/v1/completions`) and handles downloading both `.safetensors` and `.gguf` variants of models natively from Hugging Face Hub.
- **Federated Server (`rays --host`)**: Hosts an aggregator node that generates a 16-character secure hash key, which clients connect to via `rays --core <hash_key>`.
- **Zero-Downtime Hot Swapping**: The background daemon loads `.gguf` into memory for inference. When a new fine-tuned model is generated, it hotswaps the Llama instance in memory using a threading lock without needing to restart the server.

---

## The Fine-Tuning Mathematical API Boundary

To ensure smooth collaboration, the codebase is cleanly separated into two distinct components: **Integration (Inference/Daemon)** and **Mathematics (Fine-Tuning/SB-ZGA layers)**.

### 1. Integration (The Daemon)
**File**: `src/rays_studio/daemon.py`
**Responsibility**:
- Receives HTTP requests from the React UI to start fine-tuning.
- Detects the available hardware (VRAM, CPU, OS).
- Identifies the correct download directory of the `.safetensors`.
- **Instantiates and calls the Math Class**.

### 2. Mathematics (The Fine-Tuning Engine)
**File**: `src/rays_studio/finetuning_math.py`
**Class**: `FinetuningEngine`
**Responsibility**:
- Houses all the mathematically intense PyTorch tensor operations.
- Receives the raw `.safetensors` path, model name, and VRAM detection from the daemon.
- Calculates the optimal number of perpendicular layers needed based on the hardware constraints.
- Modifies the tensors, compiles a new `.gguf` file using `llama.cpp` tools, and returns the absolute path to the generated `.gguf`.

### Class Interoperability

When a user triggers fine-tuning from the Studio UI, the flow is as follows:

1. `daemon.py` receives a POST request to `/v1/models/finetune` with a specific mode (`memory`, `local`, or `server`).
2. `daemon.py` detects the available VRAM and initializes `FinetuningEngine` from `finetuning_math.py`.
3. Depending on the mode, it calls one of the following functions:
   - `engine.finetune_memory(repo_id, safetensors_path, vram_gb)`
   - `engine.finetune_local(repo_id, safetensors_path, vram_gb)`
   - `engine.finetune_server(repo_id, safetensors_path, vram_gb, hardware_info)`
4. The `FinetuningEngine` takes the `safetensors_path`, applies the mathematical fine-tuning (e.g., Spectrally Bounded Zero-Gated Adapters), and compiles a new `.gguf` file.
5. The function returns the path to the newly compiled `.gguf`.
6. `daemon.py` receives the new path and performs a hot-swap to load the new weights for inference.

This separation ensures that developers focusing on mathematical layer manipulation only need to edit `finetuning_math.py`, while developers focusing on system integration and native inference only need to edit `daemon.py`.
