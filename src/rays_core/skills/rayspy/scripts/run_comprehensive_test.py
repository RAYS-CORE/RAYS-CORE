"""Run full enhanced pipeline with browser + Twitter reference, save comprehensive report."""
import sys, json, time, os
sys.path.insert(0, "scripts")
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import face_search_pipeline as fsp

REFERENCE_URL = "https://pbs.twimg.com/profile_images/2051730041827205120/kBsDNHUD.jpg"

t0 = time.time()
result = fsp.run_enhanced_pipeline(
    name="samreedh",
    reference_url=REFERENCE_URL,
    enable_name_search=True,
    enable_browser_ctrl=True,
    enable_consensus=True,
    enable_memory=True,
    enable_bayesian=True,
)
t1 = time.time()

# Save raw JSON
with open("samreedh_comprehensive_report.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, default=str)

# Generate readable report
lines = []
def L(s=""): lines.append(s)

L("=" * 72)
L("  SAMREEDH — COMPREHENSIVE OSINT REPORT (Browser + Face)")
L("  Pipeline: " + result.get("pipeline_version", "N/A"))
L("  Reference: " + REFERENCE_URL)
L("  Total time: " + str(round(t1 - t0, 1)) + "s")
L("=" * 72)

L()
L("BASIC INFO")
L("  Query: Samreedh")
L("  Structure: single")

L()
L("REFERENCE FACE ANALYSIS")
ref = result.get("reference", {})
L("  Source: Twitter profile photo")
L("  Face detected: " + str(ref.get("face_detected", False)))
if ref.get("face_detected"):
    L("  Gender: " + str(ref.get("gender", "N/A")))
    L("  Age: " + str(ref.get("age", "N/A")) + " years")
    L("  Faces in image: " + str(ref.get("face_count", 0)))

L()
disc = result.get("identity_discovery", {})
L("PROFILES DISCOVERED: " + str(disc.get("profiles_found", 0)))
plat = disc.get("platforms", [])
if plat:
    L("  Platforms: " + ", ".join(plat))
candidates = disc.get("identity_candidates", [])
for ci, c in enumerate(candidates):
    L(f"  Candidate #{ci+1}: {c.get('name_hypothesis', '?')}  conf={c.get('confidence', 0)} ({c.get('confidence_label', '?')})")
    for sig in c.get("signals", []):
        L(f"     [{sig.get('weight', '?')}] {sig.get('signal', '?')}: {sig.get('detail', '')}")

L()
verif = result.get("identity_verification", {})
L("FACE MATCHING")
L("  Face verified: " + str(verif.get("face_verified", False)))
L("  Verification confidence: " + str(verif.get("verification_confidence", 0)))
L("  Faces detected in profiles: " + str(verif.get("face_detected_in_profiles", 0)))
L("  Reference matches: " + str(len(verif.get("reference_matches", []))))
for m in verif.get("reference_matches", []):
    L(f"     sim={m.get('similarity', 0):.3f}  profile={m.get('profile_url', '?')}  platform={m.get('platform', '?')}")

L()
L("DECISION")
dec = result.get("decision", {})
L("  Verdict: " + str(dec.get("verdict", "N/A")))
L("  Explanation: " + str(dec.get("explanation", "N/A")))
L("  Face verification: " + str(dec.get("face_verification")))
L("  Verification confidence: " + str(dec.get("verification_confidence", 0)))

L()
L("--- DETAILED FINDINGS ---")

L()
L("Discovered Profiles:")
for c in candidates:
    for plat2, info in c.get("platform_status", {}).items():
        L("  [" + plat2 + "] " + info.get("url", "?"))
        L("      Accessibility: " + str(info.get("accessibility", "?")))
        L("      Evidence: " + str(info.get("evidence", "?")))

L()
L("Cross-Verification Cycles:")
cv = result.get("enhancements", {}).get("cross_verification", [])
for i, c in enumerate(cv):
    L("  Iteration " + str(i) + ":")
    L("    New profiles: " + str(c.get("new_profiles_found", 0)))
    ids = c.get("new_identifiers", {})
    if ids:
        names = ids.get("names", [])
        if names:
            L("    Names: " + ", ".join(names))
        us = ids.get("usernames", {})
        if us:
            L("    Usernames:")
            for plat2, handle in us.items():
                L("      - " + plat2 + ": " + str(handle))
        emails = ids.get("emails", [])
        if emails:
            L("    Emails: " + ", ".join(emails))
    new_urls = c.get("new_urls", [])
    if new_urls:
        L("    New URLs:")
        for u in new_urls:
            L("      " + u)

L()
L("Identifier Discovery:")
ide = result.get("enhancements", {}).get("identifier_discovery", {})
us = ide.get("usernames", {})
if isinstance(us, dict) and us:
    L("  Usernames:")
    for plat2, handle in us.items():
        L("    - " + plat2 + ": " + str(handle))
else:
    L("  No usernames discovered beyond platform handles")

for label in ("emails", "phones", "websites", "locations", "full_names"):
    items = ide.get(label, [])
    if items:
        L("  " + label.capitalize() + ": " + ", ".join(str(x) for x in items))
    # Also check inside cross-verification identifiers
    found = False
    for c in cv:
        ids = c.get("new_identifiers", {})
        items2 = ids.get(label, [])
        if items2:
            if not found:
                L("  " + label.capitalize() + ": " + ", ".join(str(x) for x in items2))
                found = True

L()
L("Evidence Iteration:")
ei = result.get("enhancements", {}).get("evidence_iteration", {})
L("  Iterations: " + str(ei.get("iterations", 0)))
L("  Converged: " + str(ei.get("converged", False)))
L("  Final confidence: " + str(ei.get("final_confidence", 0)))

L()
L("Organization Graph:")
org = result.get("enhancements", {}).get("organization_graph", {})
L("  Nodes: " + str(org.get("nodes", 0)))
L("  Edges: " + str(org.get("edges", 0)))

L()
L("Geolocation:")
geo = result.get("enhancements", {}).get("geolocation", {})
L("  Locations: " + str(geo.get("locations", [])))
L("  Confidence: " + str(geo.get("confidence", 0)))

L()
L("Browser Controller: " + ("Used" if result.get("enhancements", {}).get("browser_controller_available") else "Unavailable"))

L()
L("--- TIMING ---")
tm = result.get("timing_ms", {})
for k, v in sorted(tm.items(), key=lambda x: -x[1]):
    if v > 1:
        L("  " + k + ": " + str(round(v, 0)) + "ms")
L("  TOTAL: " + str(round(result.get("total_time_ms", 0), 0)) + "ms")

L()
L("--- SEARCH QUERIES ---")
qp_stage = result.get("stages", {}).get("1_query_planner", {})
queries = qp_stage.get("search_queries", [])
if isinstance(queries, int):
    L("  (" + str(queries) + " queries generated)")
elif queries:
    for q in queries:
        L("  - " + q)
else:
    L("  (none)")

L()
L("=" * 72)
L("  END OF REPORT")
L("=" * 72)

report = "\n".join(lines)
with open("samreedh_comprehensive_report.txt", "w", encoding="utf-8") as f:
    f.write(report)
print(report, flush=True)
print("\nReports saved:", flush=True)
print("  samreedh_comprehensive_report.json (raw)", flush=True)
print("  samreedh_comprehensive_report.txt (readable)", flush=True)
