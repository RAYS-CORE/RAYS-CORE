"""InvestigationPipeline — workspace-driven orchestrator wrapping the existing face_search_pipeline.

Data flows:  Sherlock/collection → Workspace → Registry (investigation.json) → Enhanced Pipeline → Registry → Report

The enhanced pipeline (Phase A + Phase B) handles the heavy lifting. This orchestrator
wraps it with the new core abstractions: Workspace, Registry, EventBus, ConfidenceEngine,
FaceEngine, KnowledgeGraph, and ReportGenerator.
"""

import os
import json
import sys
import time
import traceback
from pathlib import Path
from datetime import datetime
from typing import Optional

from .event_bus import EventBus
from .workspace import Workspace
from .registry import InvestigationRegistry
from .confidence_engine import ConfidenceEngine
from .face_engine import FaceEngine
from .knowledge_graph import KnowledgeGraph, GRAPH_NAMES
from .report_generator import generate_html_report
from .investigation_planner import InvestigationPlanner
from .hypothesis_engine import HypothesisEngine

try:
    from rays_core.ai_client import AIClient
    from rays_core.config import load_config
except ImportError:
    AIClient = None
    load_config = None


class InvestigationPipeline:
    def __init__(self, base_dir: str, target_name: str):
        self.base_dir = os.path.abspath(base_dir)
        self.target_name = target_name

        self.events = EventBus()
        self.workspace = Workspace(base_dir, target_name)
        self.registry = InvestigationRegistry(str(self.workspace.root))
        self.confidence = ConfidenceEngine()
        self.face_engine = FaceEngine(str(self.workspace.root))
        self.graph = KnowledgeGraph()
        
        # Initialize deterministic OSINT AI components if available
        self.ai_client = None
        self.planner = None
        self.hypothesis_engine = None
        
        if AIClient is not None:
            # Try to load default config to initialize AI Client for planners
            try:
                config_path = os.path.expanduser("~/.rays/config.yaml")
                if not os.path.exists(config_path):
                    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(self.base_dir)))), "config.yaml")
                config = load_config(config_path) if load_config else {"llm": {"provider": "ollama", "model": "llama3"}}
                self.ai_client = AIClient(config)
                self.planner = InvestigationPlanner(self.ai_client)
                self.hypothesis_engine = HypothesisEngine(self.ai_client)
            except Exception as e:
                print(f"[Pipeline] Warning: Could not initialize AI planners: {e}")

        self._timings = {}

    # ── Helpers ──────────────────────────────────────────────────────────

    def _timed(self, action_name: str, fn: callable, *args, **kw):
        t0 = time.time()
        try:
            return fn(*args, **kw)
        finally:
            self._timings[action_name] = (time.time() - t0) * 1000

    def _load_sherlock_leads(self) -> list[dict]:
        target_lc = self.target_name.lower().replace(" ", "_")
        sherlock_file = os.path.join(self.base_dir, f"sherlock_{target_lc}")

        if not os.path.exists(sherlock_file):
            sherlock_file = os.path.join(self.base_dir, "sherlock_samreedh")
        if not os.path.exists(sherlock_file):
            return []

        urls = []
        with open(sherlock_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith(("http://", "https://")):
                    urls.append(line)
        while urls and not urls[-1].startswith("http"):
            urls.pop()

        leads = []
        for url in urls:
            domain = url.split("/")[2] if "://" in url else url
            platform = domain.split(".")[-2] if "." in domain else domain
            leads.append({"url": url, "platform": platform, "handle": target_lc})
        return leads

    # ── Run ──────────────────────────────────────────────────────────────

    def run(self) -> dict:
        self.workspace.create()
        self.registry.init(self.target_name)
        self.events.emit("initialized", target=self.target_name)

        print(f"\n[Investigation Planner] Decomposing goal for target: {self.target_name}")
        
        # 0. Initialize autonomous planning if available
        if self.planner:
            initial_tasks = self._timed("goal_decomposition", self.planner.decompose_goal, f"Conduct a comprehensive OSINT investigation on {self.target_name} to map out associated accounts, faces, and locations.")
            print(f"[Planner] Generated {len(initial_tasks)} tasks for investigation.")
            for t in initial_tasks:
                print(f"  - [{t.planner_type}] {t.objective}")
        else:
            print("[Planner] AI Client unavailable. Falling back to default deterministic execution.")

        # 1. Load Sherlock leads
        sherlock_leads = self._timed("load_sherlock", self._load_sherlock_leads)
        print(f"[Core] Loaded {len(sherlock_leads)} Sherlock leads", flush=True)

        for lead in sherlock_leads:
            cid = self.registry.add_candidate(
                platform=lead.get("platform", "unknown"),
                url=lead.get("url", ""),
                username=lead.get("handle", self.target_name),
                source="sherlock",
                source_confidence=0.3,
            )
            self.registry.transition_candidate(cid, "LEAD", "Sherlock search result")
        self.registry.save()

        # 2. Run enhanced pipeline (Execute Task Scheduled by Planner)
        print(f"[Task Scheduler] Dispatching Media & Search Planners for '{self.target_name}'...", flush=True)
        sys.path.insert(0, os.path.join(self.base_dir, "scripts"))
        from face_search_pipeline import run_enhanced_pipeline

        pipeline_result = self._timed(
            "enhanced_pipeline",
            run_enhanced_pipeline,
            name=self.target_name,
            sherlock_leads=sherlock_leads,
            reference_url=getattr(self, 'reference_image', None),
            enable_name_search=True,
            enable_browser_ctrl=False,
            enable_consensus=True,
            enable_memory=True,
            enable_bayesian=True,
        )
        self.events.emit("pipeline_completed", result_keys=list(pipeline_result.keys()))

        # Mark tasks as completed
        if self.planner:
            for task in list(self.planner.active_tasks):
                self.planner.complete_task(task.task_id, {"status": "success", "source": "enhanced_pipeline"})
                
        # 3. Sync pipeline results back into registry and graph
        self._sync_pipeline_to_registry(pipeline_result)

        # 4. Hypothesis Generation Engine (Post-Execution)
        if self.hypothesis_engine:
            print(f"\n[Hypothesis Engine] Analyzing Knowledge Graph and Contradictions...")
            contradictions = self.confidence.get_contradictions()
            if contradictions:
                print(f"  > Found {len(contradictions)} contradictions. Requesting resolution hypotheses.")
            
            hypotheses = self._timed("hypothesis_generation", self.hypothesis_engine.generate_hypotheses, self.graph.to_dict(), contradictions)
            if hypotheses:
                print(f"[Hypothesis Engine] Generated {len(hypotheses)} new hypothesis paths:")
                for h in hypotheses:
                    print(f"  - [{h.get('id', 'H')}] {h.get('statement', '')}")
                    self.registry.add_evidence("hypothesis", "hypothesis", "ai_engine", 0.0, h.get("statement", ""))
            else:
                print("[Hypothesis Engine] No further hypotheses generated.")

        # 5. Generate output
        report_data = self._build_report(pipeline_result)

        self.registry.set_status("completed")
        self.registry.save()
        self.workspace.update_state(status="completed")
        self.workspace.save_state()
        self.events.emit("completed", target=self.target_name)

        return report_data

    def _sync_pipeline_to_registry(self, result: dict):
        """Merge pipeline output into the InvestigationRegistry."""
        evidence_summary = result.get("evidence_summary", {})
        disc = result.get("identity_discovery", {})
        verif = result.get("identity_verification", {})

        # Evidence from identity discovery
        for candidate in disc.get("identity_candidates", []):
            if isinstance(candidate, dict):
                cid = candidate.get("candidate_id", "")
                linked = candidate.get("linked_profiles", [])
                for lp in linked:
                    if isinstance(lp, dict):
                        plat = lp.get("platform", "web")
                        url = lp.get("url", "")
                        existing = self.registry.get_candidate_by_url(url)
                        if existing:
                            self.registry.transition_candidate(
                                existing["candidate_id"], "VERIFIED",
                                f"Identity: {candidate.get('name', '')}"
                            )
                            self.registry.add_evidence(
                                existing["candidate_id"],
                                evidence_type="identity_resolution",
                                source="pipeline",
                                weight=candidate.get("confidence", 0.0),
                                description=f"Linked in identity candidate",
                            )

            for ev in candidate.get("evidence", []):
                kw = {
                    "candidate_id": candidate.get("candidate_id", ""),
                    "evidence_type": ev.get("description", "evidence"),
                    "source": "identity_discovery",
                    "weight": ev.get("weight", 0.1),
                    "description": ev.get("description", ""),
                }
                if kw["candidate_id"]:
                    self.registry.add_evidence(**kw)

        # Evidence from verification
        if verif.get("reference") and verif.get("face_verified"):
            for c in self.registry.all_candidates():
                self.registry.add_evidence(
                    c["candidate_id"],
                    evidence_type="face_match",
                    source="face_verification",
                    weight=verif.get("verification_confidence", 0),
                    description=f"Face match via reference: {verif.get('verification_confidence', 0):.1%}",
                )

        # Enhancements evidence
        enhancements = result.get("enhancements", {})
        for label in ("organization_graph", "geolocation", "identifier_discovery", "cross_verification"):
            item = enhancements.get(label, {})
            if item:
                self.registry.add_evidence(
                    candidate_id="pipeline",
                    evidence_type=label,
                    source="enhancements",
                    weight=0.5,
                    description=f"{label}: processed",
                )

        # Knowledge graph from enhancements
        org_graph = enhancements.get("organization_graph", {})
        for edge in org_graph.get("edges", []):
            self.graph.add_edge("organization", edge.get("source", "?"),
                                edge.get("target", "?"), "affiliated")
        for node in org_graph.get("nodes", []):
            pass
        cross_verif = enhancements.get("cross_verification", [])
        for iteration in cross_verif:
            for prof in iteration.get("discovered_profiles", []):
                url = prof.get("url", "")
                c = self.registry.get_candidate_by_url(url)
                if c:
                    self.graph.add_edge("evidence", url, c["candidate_id"],
                                        "discovered_via_cross_verification")

        # Face engine sync
        verif_summary = result.get("verification_summary", {})
        if verif_summary.get("face_verified"):
            vconf = verif_summary.get("verification_confidence", 0)
            self.registry.add_evidence(
                candidate_id="pipeline",
                evidence_type="face_verification",
                source="pipeline",
                weight=vconf,
                description=f"Face verification: {vconf:.1%} confidence",
            )

    def _build_report(self, pipeline_result: dict) -> dict:
        report_data = {
            "investigation_id": self.registry.investigation_id,
            "target_name": self.registry.target_name,
            "status": "completed",
            "generated": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "evidence_chain": self.registry.evidence_chain(),
            "candidates": self.registry.all_candidates(),
            "evidence": self.registry.all_evidence(),
            "face_registry": self.registry.all_faces(),
            "identities": self.registry._data.get("identities", []),
            "graphs": self.graph.to_dict(),
            "pipeline_result": pipeline_result,
            "timings_ms": self._timings,
        }

        report_json_path = self.workspace.root / "report.json"
        with open(report_json_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2, default=str)

        report_html_path = self.workspace.root / "report.html"
        html = generate_html_report(report_data)
        with open(report_html_path, "w", encoding="utf-8") as f:
            f.write(html)

        self.registry.update_state(
            report_json=str(report_json_path),
            report_html=str(report_html_path),
            timings=self._timings,
            evidence_chain=self.registry.evidence_chain(),
        )
        self.registry.save()

        print(f"[Core] Report saved: {report_json_path}", flush=True)
        print(f"[Core] HTML report: {report_html_path}", flush=True)

        return report_data
