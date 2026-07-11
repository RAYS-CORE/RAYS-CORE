# AMD Hardware Architecture Design for RAYS Studio

## 1. Executive Summary
This document outlines the specialized AMD fine-tuning pipeline integrated into RAYS Studio. The pipeline provides a completely segregated, hardware-aware mathematical tuning process designed specifically for AMD's ROCm ecosystem, allowing decentralized OSINT models to leverage Radeon and Instinct GPUs (RDNA/CDNA architectures) with optimal Matrix Core utilization.

## 2. Motivation
Conventional fine-tuning approaches blindly target model layers without considering the underlying hardware execution units. AMD GPUs utilize distinct caching hierarchies and wavefront matrix units (WMMA on RDNA3, MFMA on CDNA) compared to NVIDIA's CUDA cores. When running generic LoRA pipelines on AMD hardware, memory-bound layers trigger massive kernel launch overheads and thrash the cache, resulting in inefficient utilization. By isolating and targeting mathematically proven optimal layers, we can unlock extreme performance on consumer AMD graphics cards.

## 3. Hardware-Cooperative Layer Selection (HCLS)
The AMD fine-tuning flag (`--amd-sync`) physically bypasses the standard tuning routine.

### Bottleneck Mitigation
Consumer AMD GPUs possess immense raw compute but follow different Roofline model characteristics. To prevent memory bandwidth saturation:
- **Frozen Layers:** All normalization layers (RMSNorm, LayerNorm) and memory-bound activations are excluded from the tuning subgraph.
- **Target Matrices:** The tuning focuses strictly on dense GEMMs (General Matrix Multiplications) found in:
  - `$W_q$` (Query Projections)
  - `$W_v$` (Value Projections)
  - `$W_{gate}$` (MLP Gate Projections)

### Matrix Wavefront Alignment
AMD's instruction sets natively process data in wavefronts (threads working in parallel). 
- To saturate the matrix cores and prevent thread divergence, the AMD pipeline dynamically scales the Low-Rank Adapter (LoRA) `$r$` dimension to exactly `64`. 
- This mathematically aligns the SVD decomposition matrices ($A$ and $B$) precisely with the 64-thread wavefront execution paradigm.

## 4. Software Implementation
The implementation maintains strict isolation from the existing unified pipeline to ensure zero regression.

### Component Isolation
1. **CLI Layer (`rays_main.py`):** Introduces a dedicated `--amd-sync` argument.
2. **GUI Layer (`SettingsModal.tsx`):** A physical toggle allows users to explicitly opt into the "AMD Hardware Tuning Pipeline".
3. **Mathematical Engine (`finetuning_math.py`):** A new class method `finetune_amd_optimized` handles ROCm validation (`torch.version.hip`), applies wavefront dimensioning (`r=64`), and routes the targets strictly to `["q_proj", "v_proj", "gate_proj"]`.

## 5. Security and Privacy
This AMD extension leverages the existing FOGR (Federated Orthogonal Gradient Routing) architecture. The mathematically aligned, low-rank differentials are safely collected and routed to the central aggregation daemon without transmitting any private OSINT datasets.
