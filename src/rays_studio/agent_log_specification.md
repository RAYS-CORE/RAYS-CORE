# RAYS CORE: Agent Execution Log Specification

This specification defines the standard log format that RAYS CORE agents must output upon successfully completing a task. RAYS Studio will silently ingest these logs in the background to autonomously fine-tune the local LLM using the Spectrally-Bounded Zero-Gated Adapters (SB-ZGA).

## 1. Log Location & Format
- **Directory:** RAYS Studio will monitor a designated folder, e.g., `~/.rays_core/logs/success/`
- **Format:** JSON Lines (`.jsonl`)

## 2. The Execution DAG Schema
For RAYS Studio to apply the **Latent Graph-Topology Loss**, the agent logs cannot just be raw text. They must represent the Directed Acyclic Graph (DAG) of the agent's thought process and tool execution.

### Example JSON Schema

```json
{
  "task_id": "uuid-1234",
  "timestamp": "2026-07-07T12:00:00Z",
  "user_query": "Track suspicious ADSB flight logs in region X",
  "execution_dag": {
    "nodes": [
      {
        "step_id": 1,
        "type": "thought",
        "content": "I need to fetch the flight logs for Region X first."
      },
      {
        "step_id": 2,
        "type": "tool_call",
        "tool_name": "adsb_fetch",
        "parameters": {"region": "X"},
        "result": "Fetched 12 flights."
      },
      {
        "step_id": 3,
        "type": "thought",
        "content": "Now I will extract the tail numbers from the fetched flights."
      }
    ],
    "edges": [
      {"from": 1, "to": 2},
      {"from": 2, "to": 3}
    ]
  },
  "final_answer": "Found 12 flights in Region X. Tail numbers extracted successfully.",
  "success_flag": true
}
```

## 3. How RAYS Studio Uses This
RAYS Studio's background daemon will:
1. Parse the `execution_dag`.
2. Convert the node sequence into Supervised Fine-Tuning (SFT) tensors (e.g., `<user_query> -> <thought> -> <tool_call> -> <result>`).
3. Trigger the PyTorch ROCm fine-tuning loop using these synthetic tensors to steer the adapter weights.

By adhering to this specification, RAYS CORE remains completely decoupled from RAYS Studio's PyTorch math.
