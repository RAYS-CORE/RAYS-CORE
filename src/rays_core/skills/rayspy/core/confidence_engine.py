"""Confidence Engine — evidence-weighted confidence scoring and contradiction tracking."""

EVIDENCE_WEIGHTS = {
    "name_match": 0.25,
    "username_match": 0.15,
    "location_overlap": 0.12,
    "profile_image_match": 0.20,
    "bio_keyword": 0.10,
    "url_pattern": 0.08,
    "follower_overlap": 0.05,
    "post_topic_match": 0.05,
    "external_link_shared": 0.05,
    "face_match": 0.35,
    "manual_confirmation": 0.50,
    "cross_platform_link": 0.30,
    "general": 0.10,
}

class ConfidenceEngine:
    def __init__(self):
        self.weights = dict(EVIDENCE_WEIGHTS)
        self.claims = {}  # Format: { "claim_topic": [{"value": "NY", "confidence": 0.72}, {"value": "LA", "confidence": 0.61}] }

    def add_claim(self, topic: str, value: str, base_confidence: float, evidence_type: str):
        """Adds a claim, adjusting confidence by source weight, keeping contradictions alive."""
        if topic not in self.claims:
            self.claims[topic] = []
        
        weight = self.weights.get(evidence_type, 0.10)
        adjusted_confidence = base_confidence * weight
        
        # Check if value already exists for this topic to merge confidence
        for claim in self.claims[topic]:
            if claim["value"] == value:
                # Bayesian-like simple update for corroborating evidence
                claim["confidence"] = min(1.0, claim["confidence"] + adjusted_confidence * (1 - claim["confidence"]))
                return
        
        # If new value (or contradictory value), append it
        self.claims[topic].append({"value": value, "confidence": adjusted_confidence})

    def get_contradictions(self) -> dict:
        """Returns topics that have multiple conflicting values with high confidence."""
        contradictions = {}
        for topic, values in self.claims.items():
            if len(values) > 1:
                # Sort by confidence
                sorted_vals = sorted(values, key=lambda x: x["confidence"], reverse=True)
                if sorted_vals[0]["confidence"] > 0.3 and sorted_vals[1]["confidence"] > 0.3:
                    contradictions[topic] = sorted_vals
        return contradictions

    def score(self, evidence_list: list[dict]) -> float:
        raw = sum(
            e.get("weight", e.get("confidence", 0)) * self.weights.get(e.get("type", e.get("evidence_type", "general")), 0.1)
            for e in evidence_list
        )
        return min(raw, 1.0)

    def detailed(self, evidence_list: list[dict]) -> dict:
        breakdown = {}
        total = 0.0
        for e in evidence_list:
            t = e.get("type", e.get("evidence_type", "general"))
            w = self.weights.get(t, 0.1)
            contrib = e.get("weight", e.get("confidence", 0)) * w
            breakdown.setdefault(t, {"count": 0, "weight": 0.0, "score": 0.0})
            breakdown[t]["count"] += 1
            breakdown[t]["weight"] += w
            breakdown[t]["score"] += contrib
            total += contrib
        return {"total": min(total, 1.0), "breakdown": breakdown, "contradictions": self.get_contradictions()}
