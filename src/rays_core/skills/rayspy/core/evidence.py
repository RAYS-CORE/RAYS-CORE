"""Standardized Evidence Objects for the Investigation Graph."""
import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class Evidence:
    """A standardized evidence object produced by any OSINT tool."""
    observation: str
    source: str
    timestamp: str = field(default_factory=lambda: datetime.datetime.utcnow().isoformat() + "Z")
    confidence: float = 0.5
    evidence_type: str = "general"
    discovered_entities: List[Dict[str, str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self):
        return {
            "observation": self.observation,
            "source": self.source,
            "timestamp": self.timestamp,
            "confidence": self.confidence,
            "evidence_type": self.evidence_type,
            "discovered_entities": self.discovered_entities,
            "metadata": self.metadata
        }
