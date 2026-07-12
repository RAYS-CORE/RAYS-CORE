# RAYS Spy: Agentic OSINT Reconnaissance

RAYS Spy is an advanced OSINT (Open-Source Intelligence) platform designed to unify hundreds of disparate reconnaissance tools under a single, cohesive AI-driven pipeline. It allows the RAYS Agent, acting through the MCP (Model Context Protocol), to perform deep, autonomous investigations across a vast array of data sources using local models.

## Architecture

RAYS Spy does not just provide tools; it orchestrates them. When the RAYS Agent is tasked with an OSINT objective, it sequentially utilizes these tools, evaluates the output, and determines the next optimal step. This creates a powerful "agentic loop" for rapid intelligence gathering.

Furthermore, every step taken by the agent in this pipeline acts as a training signal. Using the FOGR (Federated Orthogonal Graph Routing) architecture, the local model is continuously fine-tuned on the successful execution paths of the OSINT pipeline. The objective is to achieve highly effective, self-improving agentic reconnaissance on anyone, anywhere, entirely locally and fast.

## Core Capabilities & Tools

RAYS Spy integrates the following capabilities into its unified platform:

### 1. Identity & Social Footprint
- **Sherlock (`sherlock.py`)**: A wrapper around pySherlock that enables rapid username enumeration across 400+ social media networks, forums, and websites.
- **Search Collector (`search_collector.py`)**: Utilizes SerpAPI for batched Google Search collections, gathering wide-net intelligence efficiently.

### 2. Face Recognition & Clustering
- **InsightFace Integration (`face_match.py`, `face_engine.py`)**: Generates high-dimensional face embeddings using the ArcFace / buffalo_l model.
- **DBSCAN Clustering (scikit-learn)**: Groups and clusters faces by cosine distance (Phase B5), enabling the tracking of an identity across different sources and contexts.
- **Perceptual Hashing (`pHash`)**: Detects duplicate images across the internet (Phase B3) to trace the origin or spread of visual media.
- **Reverse Image Search (`image_search.py`)**: Automates reverse image lookups across Google, Bing, and Yandex.

### 3. Real-time Surveillance & Tracking
- **Flight & Military Tracking**: Capable of searching and tracking flights (including military aircraft) using flight numbers, origins, and destinations.
- **Satellite Integration**: Accesses commercial and public satellite feeds, including real-time orbital paths and elements.
- **Global CCTV & Live Data**: Hooks into global public CCTV directories, real-time traffic data, and DEM (Digital Elevation Model) data.

### 4. Advanced Harvesting & Graph Building
- **Playwright**: Automates headless browsers for scraping JS-rendered pages, with `urllib.request` as a fast HTTP fallback.
- **Platform-Specific Validators**: Uses YAML rules and HTML pattern matching to validate targets on specific platforms (e.g., GitHubValidator, LinkedInValidator, TwitterValidator, GenericValidator).
- **Regex-based PII Extractors**: Harvests emails, phone numbers, and websites during the Evidence Harvesting phase (Phase A5).
- **Knowledge Graph (`knowledge_graph.py`)**: Automatically builds relationship graphs and entity linkages from the gathered intelligence.
- **Spiderfoot**: Integrates the comprehensive Spiderfoot passive surface reconnaissance engine.

## Conclusion

RAYS Spy bridges the gap between raw, isolated OSINT tools and intelligent, autonomous analysis. By combining these capabilities with the RAYS Agent and the continuous fine-tuning of the FOGR architecture, it provides an unparalleled platform for fast, accurate, and self-improving reconnaissance.
