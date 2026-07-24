"""Hypothesis Generation Engine — evaluates current evidence and spawns new questions."""
import json
from typing import List, Dict, Any

class HypothesisEngine:
    def __init__(self, ai_client):
        self.ai_client = ai_client
        self.hypotheses = []

    def generate_hypotheses(self, graph_summary: dict, contradictions: dict) -> List[Dict[str, Any]]:
        """Analyzes the current graph and contradictions to propose testable hypotheses."""
        prompt = f"""
You are an OSINT Hypothesis Engine.
Based on the current investigation knowledge graph and known contradictions, generate 1-3 testable hypotheses to advance the investigation.

Knowledge Graph Summary:
{json.dumps(graph_summary, indent=2)}

Known Contradictions:
{json.dumps(contradictions, indent=2)}

Return JSON in this format:
{{
  "hypotheses": [
    {{
      "id": "H1",
      "statement": "Target resides in LA, and the NY address is a registered business front.",
      "required_tests": ["Check corporate registry for NY address", "Verify LA address property records"]
    }}
  ]
}}
"""
        response = self.ai_client.generate_json(prompt, system_prompt="You are a hypothesis generator. Return only JSON.")
        new_hypotheses = response.get("hypotheses", [])
        self.hypotheses.extend(new_hypotheses)
        return new_hypotheses
