"""Confidence Engine — evidence-weighted confidence scoring."""


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
}


class ConfidenceEngine:
    def __init__(self):
        self.weights = dict(EVIDENCE_WEIGHTS)

    def score(self, evidence_list: list[dict]) -> float:
        raw = sum(
            e.get("weight", 0) * self.weights.get(e.get("type", ""), 0.1)
            for e in evidence_list
        )
        return min(raw, 1.0)

    def score_by_type(self, evidence_list: list[dict], evidence_type: str) -> float:
        items = [e for e in evidence_list if e.get("type") == evidence_type]
        if not items:
            return 0.0
        w = self.weights.get(evidence_type, 0.1)
        return min(sum(e.get("weight", 0) * w for e in items), 1.0)

    def detailed(self, evidence_list: list[dict]) -> dict:
        breakdown = {}
        total = 0.0
        for e in evidence_list:
            t = e.get("type", "unknown")
            w = self.weights.get(t, 0.1)
            contrib = e.get("weight", 0) * w
            breakdown.setdefault(t, {"count": 0, "weight": 0.0, "score": 0.0})
            breakdown[t]["count"] += 1
            breakdown[t]["weight"] += w
            breakdown[t]["score"] += contrib
            total += contrib
        return {"total": min(total, 1.0), "breakdown": breakdown}
