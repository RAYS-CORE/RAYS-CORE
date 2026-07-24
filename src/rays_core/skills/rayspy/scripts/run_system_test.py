"""Full OSINT system test on samreedh, save readable report."""
import sys, json, time, os

sys.path.insert(0, 'scripts')
os.chdir(os.path.dirname(os.path.abspath(__file__)))

import face_search_pipeline as fsp

print("Running enhanced pipeline with name search + browser...", flush=True)
t0 = time.time()
result = fsp.run_enhanced_pipeline(
    name='samreedh',
    enable_name_search=True,
    enable_browser_ctrl=True,
    enable_consensus=False,
    enable_memory=True,
    enable_bayesian=True,
)
elapsed = time.time() - t0
print(f"Pipeline completed in {elapsed:.1f}s", flush=True)

# Save raw JSON
with open("samreedh_full.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, default=str)
print("Raw JSON saved to samreedh_full.json", flush=True)

# Generate readable report
lines = []
def L(s=""): lines.append(s)

L("=" * 72)
L("  SAMREEDH — COMPREHENSIVE OSINT REPORT")
L("  Pipeline: " + result.get("pipeline_version", "N/A"))
L("  Run time: " + str(round(elapsed, 1)) + "s")
L("=" * 72)

# Query
qp = result.get("query_plan", {})
L()
L("QUERY: " + qp.get("normalized_name", "N/A"))
L("  Structure: " + str(qp.get("structure", "N/A")))

# Identity Discovery
disc = result.get("identity_discovery", {})
L()
L("IDENTITY DISCOVERY")
L("  Status: " + disc.get("status", "unknown"))
L("  Profiles found: " + str(disc.get("profiles_found", 0)))
for p in disc.get("platforms", []):
    L("  - " + p)

candidates = disc.get("identity_candidates", [])
for ci, c in enumerate(candidates):
    L(f"  Candidate #{ci+1}: {c.get('name_hypothesis', '?')}")
    L(f"     Confidence: {c.get('confidence', 0)} ({c.get('confidence_label', '?')})")
    L(f"     Platforms: {', '.join(c.get('platforms', []))}")
    for sig in c.get("signals", []):
        L(f"     [{sig.get('weight', '?')}] {sig.get('signal', '?')}: {sig.get('detail', '')}")

L(f"  Cross-verification cycles: {disc.get('cross_verification_cycles', 0)}")
L(f"  Converged: {disc.get('converged', False)}")

# Decision
dec = result.get("decision", {})
L()
L("DECISION: " + str(dec.get("verdict", "N/A")))
L("  Explanation: " + str(dec.get("explanation", "N/A")))

# Enhancements
enh = result.get("enhancements", {})
L()
L("--- ENHANCEMENTS ---")
L("Browser controller: " + ("available" if enh.get("browser_controller_available") else "unavailable"))
L("Identity memory hit: " + str(enh.get("identity_memory_hit")))

uc = enh.get("url_canonicalization", {})
L("URLs canonicalized: " + str(uc.get("canonicalized_count", 0)))

ide = enh.get("identifier_discovery", {})
us = ide.get("usernames", {})
L("Identifier discovery:")
if isinstance(us, dict):
    for plat, handle in us.items():
        L("  - " + plat + ": " + str(handle))
for k in ("emails", "phones", "websites", "locations"):
    items = ide.get(k, [])
    if items:
        L("  " + k + ": " + ", ".join(str(x) for x in items))

pm = enh.get("post_metadata", {})
L("Post metadata items: " + str(pm.get("count", 0)))

og = enh.get("organization_graph", {})
L("Organization graph:")
L("  Nodes: " + str(len(og.get("nodes", []))))
L("  Edges: " + str(len(og.get("edges", []))))
for n in og.get("nodes", []):
    L("    - " + n.get("type", "?") + ": " + n.get("label", "?"))

geo = enh.get("geolocation", {})
L("Geolocation:")
L("  Primary: " + str(geo.get("primary_location", "N/A")))
L("  Confidence: " + str(geo.get("confidence", 0.0)))
if geo.get("coordinates"):
    L("  Coordinates: " + str(geo["coordinates"]["lat"]) + ", " + str(geo["coordinates"]["lng"]))
if geo.get("display_name"):
    L("  Display: " + geo["display_name"])
nearby = geo.get("nearby_places", [])
if nearby:
    for p in nearby[:5]:
        L("    - " + p.get("name", "?") + " (" + p.get("type", "?") + ")")

cv = enh.get("cross_verification", [])
L("Cross-verification cycles: " + str(len(cv)))
for i, c in enumerate(cv[:3]):
    L("  Iter " + str(i) + ": " + str(c.get("new_profiles_found", 0)) + " new")

ei = enh.get("evidence_iteration", {})
L("Evidence iteration: " + str(ei.get("iterations", 0)) + " iters, converged=" + str(ei.get("converged", False)))

# Timing
tm = result.get("timing_ms", {})
L()
L("--- TIMING ---")
L("Total: " + str(round(result.get("total_time_ms", 0), 0)) + "ms")
for k, v in sorted(tm.items()):
    if v > 1:
        L("  " + k + ": " + str(round(v, 0)) + "ms")

L()
L("=" * 72)

report = "\n".join(lines)
with open("samreedh_readable_report.txt", "w", encoding="utf-8") as f:
    f.write(report)
print("Readable report saved to samreedh_readable_report.txt", flush=True)
print(report, flush=True)
