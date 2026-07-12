"""Entry point for the new workspace-driven investigation pipeline.

Usage:
    python run_investigation.py <target_name>

Output:
    workspace/<workspace_target>/
    ├── investigation.json     — Single source of truth
    ├── report.json            — Structured JSON report
    ├── report.html             — Dashboard-style HTML report
    ├── face_registry.npy       — Face embeddings
    ├── workspace_state.json    — Workspace metadata
    ├── accounts/               — Sherlock accounts data
    ├── evidence/               — Harvested images / evidence
    ├── related/                — Related profiles
    ├── network/                — Network analysis
    ├── locations/              — Geolocation data
    └── tools/                  — Tool outputs

Backward-compatible: also writes <target>_investigation_raw.json and
<target>_investigation_report.txt to the project root.
"""

import sys
import os
import json
import time as time_module

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))

from core.pipeline import InvestigationPipeline


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else "samreedh"
    
    ref_image = None
    if "--ref" in sys.argv:
        ref_idx = sys.argv.index("--ref")
        if ref_idx + 1 < len(sys.argv):
            ref_image = sys.argv[ref_idx + 1]

    t0 = time_module.time()

    # Run the new workspace-driven pipeline
    pipeline = InvestigationPipeline(base_dir=BASE_DIR, target_name=target)
    pipeline.reference_image = ref_image
    result = pipeline.run()

    t1 = time_module.time()
    print(f"\n[Complete] {round(t1 - t0, 1)}s elapsed", flush=True)

    # ── Backward-compatible output ────────────────────────────────────
    target_lc = target.lower().replace(" ", "_")
    ec = result.get("evidence_chain", {})
    disc = result.get("pipeline_result", {}).get("identity_discovery", {})
    verif = result.get("pipeline_result", {}).get("verification_summary", {})

    lines = []
    L = lambda s="": lines.append(s)

    L("=" * 72)
    L(f"  {target.upper()} — WORKSPACE-DRIVEN OSINT INVESTIGATION (v4)")
    L(f"  Investigation ID: {result.get('investigation_id', 'N/A')}")
    L(f"  Duration: {round(t1 - t0, 1)}s")
    L("=" * 72)

    L()
    L("EVIDENCE CHAIN")
    for k, v in sorted(ec.items()):
        L(f"  {k}: {v}")

    L()
    L("IDENTITY DISCOVERY")
    L(f"  Platforms: {', '.join(disc.get('platforms', []))}")
    L(f"  Cross-verification cycles: {disc.get('cross_verification_cycles', 0)}")
    L(f"  Converged: {disc.get('converged', False)}")

    candidates = disc.get("identity_candidates", [])
    for ci, c in enumerate(candidates):
        if isinstance(c, dict):
            L()
            L(f"  Candidate #{ci + 1}: {c.get('name', '?')}")
            L(f"     Confidence: {c.get('confidence', 0)} ({c.get('confidence_label', '?')})")
            platforms = [p.get('platform', '?') for p in c.get('linked_profiles', [])]
            L(f"     Platforms: {', '.join(platforms)}")

    L()
    L("FACE VERIFICATION")
    L(f"  Status: {verif.get('face_verification', 'NOT_ATTEMPTED')}")
    L(f"  Face verified: {verif.get('face_verified', False)}")
    L(f"  Confidence: {verif.get('verification_confidence', 0)}")
    L(f"  {verif.get('explanation', '')}")

    L()
    L("TIMING")
    timings = result.get("timings_ms", {})
    for k, v in sorted(timings.items(), key=lambda x: -x[1]):
        if v > 1:
            L(f"  {k}: {round(v, 0)}ms")
    L(f"  TOTAL: {round((t1 - t0) * 1000, 0)}ms")

    L()
    L("=" * 72)
    L("  END OF REPORT")
    L("=" * 72)

    report_txt = os.path.join(BASE_DIR, f"{target_lc}_investigation_report.txt")
    with open(report_txt, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("\n".join(lines))
    print(f"\nReport saved: {report_txt}")
    print(f"Workspace: {pipeline.workspace.root}")


if __name__ == "__main__":
    main()
