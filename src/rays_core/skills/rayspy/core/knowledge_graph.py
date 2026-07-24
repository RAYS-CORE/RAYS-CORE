"""Knowledge Graph — split evidence, identity, organization, and relationship graphs."""


GRAPH_NAMES = ["evidence", "identity", "organization", "relationship"]


class KnowledgeGraph:
    def __init__(self, graphs: dict[str, dict] = None):
        self._graphs = graphs or {name: {"nodes": [], "edges": []}
                                  for name in GRAPH_NAMES}

    @property
    def evidence(self) -> dict:
        return self._graphs["evidence"]

    @property
    def identity(self) -> dict:
        return self._graphs["identity"]

    @property
    def organization(self) -> dict:
        return self._graphs["organization"]

    @property
    def relationship(self) -> dict:
        return self._graphs["relationship"]

    def add_edge(self, graph_name: str, source: str, target: str,
                 relation: str, weight: float = 1.0):
        g = self._graphs.setdefault(graph_name, {"nodes": [], "edges": []})
        seen = set(n["id"] for n in g["nodes"])
        for nid in (source, target):
            if nid not in seen:
                g["nodes"].append({"id": nid})
                seen.add(nid)
        g["edges"].append({"source": source, "target": target,
                           "relation": relation, "weight": weight})

    def get_graph(self, name: str) -> dict:
        return self._graphs.get(name, {"nodes": [], "edges": []})

    def to_dict(self) -> dict[str, dict]:
        return dict(self._graphs)

    def merge(self, other: "KnowledgeGraph"):
        for name in GRAPH_NAMES:
            og = other.get_graph(name)
            self._merge_graph(name, og)

    def _merge_graph(self, name: str, other_graph: dict):
        g = self._graphs.setdefault(name, {"nodes": [], "edges": []})
        seen_nodes = set(n["id"] for n in g["nodes"])
        for n in other_graph.get("nodes", []):
            if n["id"] not in seen_nodes:
                g["nodes"].append(n)
                seen_nodes.add(n["id"])
        existing_edges = set((e["source"], e["target"], e["relation"])
                             for e in g["edges"])
        for e in other_graph.get("edges", []):
            key = (e["source"], e["target"], e["relation"])
            if key not in existing_edges:
                g["edges"].append(e)
                existing_edges.add(key)
