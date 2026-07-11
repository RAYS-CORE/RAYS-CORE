# RAYS Studio: Comprehensive Guide & Tutorial

Welcome to RAYS Studio, the localized, decentralized hosting and fine-tuning daemon that powers the FOGR (Federated Orthogonal Gradient Routing) architecture for RAYS-CORE. This document serves as an in-depth tutorial and architectural deep-dive into how RAYS Studio operates, the mathematics behind it, and how to operate both its CLI (Command Line Interface) and GUI (Graphical User Interface) components.

---

## 1. Background & Mathematical Theory

At its core, RAYS Studio solves a major bottleneck in decentralized AI: **How do we train models across thousands of independent consumer devices without catastrophic forgetting or bandwidth limitations?**

The solution is the **Federated Orthogonal Gradient Routing (FOGR)** architecture combined with **Spectrally Bounded Zero-Gated Adapters (SB-ZGA)**. 

### The Mathematics (SB-ZGA & SVD)
Instead of fine-tuning the entire multi-billion parameter base model (which requires immense VRAM), RAYS Studio injects tiny, localized adapter matrices into the neural network.
- **Zero-Gating:** The adapters are initialized at zero. Initially, the model behaves exactly like the base model.
- **Spectral Bounding via SVD:** During training, RAYS Studio calculates the Singular Value Decomposition (SVD) of the adapter weights ($W = U \Sigma V^T$). It zeroes out the highest singular values (the "dominant" directions) to enforce strict orthogonality.
- **Why Orthogonality?** By forcing each client's adapters to occupy orthogonal mathematical subspaces, we prevent **catastrophic interference**. When the central server aggregates adapters from hundreds of clients, their weight matrices do not overlap or destructively interfere, allowing the global model to learn multiple specific OSINT domains simultaneously.

---

## 2. The RAYS Studio Pipeline

The complete end-to-end pipeline operates as follows:

1. **Inference & Logging:** A user connects `rays-core` (the agentic client) to a RAYS Studio inference endpoint. As the agent performs tasks, all conversation trees, thought processes, and results are logged locally in `~/.rays/logs/success/`.
2. **Local Fine-Tuning:** The user triggers a training run. The RAYS Studio Daemon ingests these local logs, constructs PyTorch tensors, and trains an SB-ZGA adapter on the local machine (using MPS for Apple Silicon or CUDA for GPUs).
3. **SVD Constraint & Compilation:** The daemon applies SVD bounding to the adapter, merges it with the base GGUF model, and recompiles a brand-new optimized `.gguf` file via `llama.cpp`.
4. **Federated Sync:** The orthogonal adapter weights are hashed and pushed to the global Hub Hash.
5. **Hot-Swapping:** The new, smarter `.gguf` model is instantly hot-swapped into the `llama.cpp` server without downtime, ready for the next inference request.

---

## 3. Terminal CLI & TUI Commands

RAYS Studio is fully operable from the terminal. 

### Core Commands
- `rays --studio`: Opens the interactive TUI (Terminal User Interface). Here you can browse Hugging Face repositories, download GGUF models directly to `~/.rays/models`, and manage your local environment.
- `rays --studio --start`: Launches the unified RAYS Studio Daemon. This starts the FastAPI server on port `8000` (for federated syncing) and the `llama.cpp` inference server on port `8001`.
- `rays --studio --force-sync`: Manually triggers the local SB-ZGA fine-tuning pipeline on your aggregated OSINT logs and simulates a push to the global network.

### Connecting the Agent (Terminal)
To tell the `rays-core` agent to use your RAYS Studio node:
1. Run `rays`.
2. In the setup menu, select **Select AI Provider**.
3. Choose **RAYS Studio** from the list.
4. When prompted, enter the **Base URL**. 
   - If running locally: `http://localhost:8001/v1`
   - If connecting to a remote node: `http://<NODE_IP>:8001/v1`

---

## 4. Using the GUI (React IDE)

If you prefer visual management, RAYS-CORE provides an Electron-based React IDE that interacts directly with the RAYS Studio daemon.

### Configuring the Provider in the GUI
1. Open the RAYS-CORE Desktop IDE.
2. Click the **Settings** gear icon (usually located in the sidebar or app header) to open the **Settings Modal**.
3. Navigate to the **AI Providers** tab.
4. Under the list of providers, click the newly integrated **RAYS Studio** button.
5. The standard "API Key" field will dynamically change to a **Base URL** input.
6. Enter your RAYS Studio endpoint (e.g., `http://localhost:8001/v1`) and click **Save**. 

The IDE is now fully routed to use your localized (or remote) FOGR model.

---

## 5. Downloading Models & Managing Storage

RAYS Studio completely replaces standard backend management by utilizing a highly optimized local storage structure.
- **Model Storage:** All downloaded base models and compiled hot-swapped models are stored exclusively in `~/.rays/models/`.
- **Training Data:** All agentic logs are stored in `~/.rays/logs/success/`.
- **Garbage Collection (Upcoming):** The daemon is designed to be storage-conscious. During the hot-swap process, older `gguf` models are targeted for deletion to prevent your drive from filling up with massive multi-gigabyte files.

---

## 6. Multi-Client Federated Networking

Because RAYS Studio perfectly mimics the standard OpenAI API structure (`/v1/chat/completions`), multi-client topologies are trivially easy to deploy:

1. **Deploy Server Node:** Run `rays --studio --start` on a centralized server (e.g., `192.168.1.100`).
2. **Deploy Clients:** On 50 different laptops, open the RAYS-CORE Settings Modal and set the **Base URL** to `http://192.168.1.100:8001/v1`. 
3. **Execute OSINT Tasks:** All 50 laptops execute their agentic tasks using the central model. Each laptop generates its *own* local logs.
4. **Local Tuning:** Each laptop eventually runs its own local `rays --studio --force-sync`. It will compute the heavy PyTorch math locally using its own GPU, generate the orthogonal differentials, and submit them back to the server node. 

This ensures that the central server is never bottlenecked by heavy training compute, making infinite decentralized scaling a reality.

---

## 7. AMD Hardware Fine-Tuning Pipeline (HCLS)

RAYS Studio includes a physically isolated and mathematically optimized pipeline explicitly designed for AMD hardware (ROCm/HIP architectures like RDNA/CDNA). 

### Hardware-Cooperative Layer Selection (HCLS)
Instead of fine-tuning all layers or arbitrary targets, the AMD pipeline strictly targets memory-heavy `q_proj`, `v_proj`, and `gate_proj` layers, completely freezing everything else. This explicitly minimizes memory bandwidth bottlenecks which are historically challenging on non-datacenter AMD consumer cards.

### Wavefront-Aligned Matrices
AMD GPUs execute threads in "Wavefronts" of size 64. The RAYS Studio AMD pipeline explicitly forces the adapter rank ($r$) to exactly `64`. This ensures perfectly aligned matrix multiplications, maximizing ALUs and preventing register spilling and unused execution lanes.

### Using the AMD Pipeline (CLI & GUI)
This pipeline is completely segregated from the standard training execution to ensure absolute stability.

**Via the Terminal:**
To manually trigger the AMD-optimized sync, append the `--amd-sync` flag to your command:
```bash
rays --studio --amd-sync "your-model-name"
```

**Via the GUI (React IDE):**
1. Open the **Settings Modal** and navigate to the **AI Providers** tab.
2. Select **RAYS Studio** as your provider.
3. Check the **"AMD Hardware Fine-Tuning Pipeline"** toggle that appears below the Base URL field.
4. Click **Save**.

The GUI will now securely orchestrate the specific ROCm-compatible pipeline for all subsequent operations.
