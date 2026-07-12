"""Full system test with Twitter profile photo as reference image."""
import sys, json, time, os
sys.path.insert(0, 'scripts')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import face_search_pipeline as fsp

REFERENCE_URL = "https://pbs.twimg.com/profile_images/2051730041827205120/kBsDNHUD.jpg"

# Run the full pipeline with reference image
print("=== Full pipeline with Twitter/X profile photo reference ===", flush=True)
t0 = time.time()
result = fsp.run_enhanced_pipeline(
    name='samreedh',
    reference_url=REFERENCE_URL,
    enable_name_search=True,
    enable_browser_ctrl=False,
    enable_consensus=True,
    enable_memory=True,
    enable_bayesian=True,
)
t1 = time.time()

# Save raw JSON
with open("samreedh_full_report.json", "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, default=str)

# Generate readable report
lines = []
def L(s=""): lines.append(s)

L("=" * 72)
L("  SAMREEDH — FULL OSINT REPORT (Twitter profile pic reference)")
L("  Pipeline: " + result.get("pipeline_version", "N/A"))
L("  Reference: " + REFERENCE_URL)
L("  Total time: " + str(round(t1-t0, 1)) + "s")
L("=" * 72)

L()
st = result.get('stages', {})
L("Stage 2 — Profile Discovery")
L("  Profiles found: " + str(st.get('2_collection',{}).get('profiles_found',0)))
plat = st.get('2_collection',{}).get('platforms',[])
L("  Platforms: " + ", ".join(plat) if plat else "  Platforms: None")

L()
L("Reference image processing:")
ref = result.get('reference')
if ref:
    L("  Face detected: " + str(ref.get('face_detected', False)))
    if ref.get('face_detected'):
        L("  Gender: " + str(ref.get('gender', 'N/A')))
        L("  Age group: " + str(ref.get('age', 'N/A')))
        L("  Confidence: " + str(ref.get('confidence', 0)))
else:
    L("  No reference processing result")

L()
L("Face detection & matching:")
L("  Images queued: " + str(st.get('4_image_collection',{}).get('images_queued',0)))
L("  Images accepted: " + str(st.get('5_quality_validation',{}).get('accepted',0)))
L("  Faces detected: " + str(st.get('7_embedding',{}).get('faces_detected',0)))
L("  Clusters formed: " + str(st.get('8_clustering',{}).get('clusters_formed',0)))
L("  Reference matches: " + str(len(result.get('reference_matches', []))))
for m in result.get('reference_matches', []):
    L("    Face " + str(m.get('face_index', '?')) + ": sim=" + str(round(m.get('similarity', 0), 4)))

L()
L("Decision:")
L("  Verdict: " + str(result.get('decision', {}).get('verdict', 'N/A')))
L("  Explanation: " + str(result.get('decision', {}).get('explanation', 'N/A')))

L()
candidates = result.get('candidates', [])
L("Candidates: " + str(len(candidates)))
for c in candidates:
    L("  Confidence: " + str(round(c.get('confidence', 0), 4)))
    L("  Platforms: " + ", ".join(c.get('platforms', [])))
    for u in c.get('profile_urls', []):
        L("    " + u)

L()
L("--- ENHANCEMENTS ---")
enh = result.get('enhancements', {})
L("  Browser controller: " + ("available" if enh.get('browser_controller_available') else "unavailable"))
L("  Identity memory hit: " + str(enh.get('identity_memory_hit')))
L("  URLs canonicalized: " + str(enh.get('url_canonicalization',{}).get('canonicalized_count',0)))

ide = enh.get('identifier_discovery', {})
us = ide.get('usernames', {})
if isinstance(us, dict) and us:
    L("  Identifier discovery:")
    for plat2, handle in us.items():
        L("    - " + plat2 + ": " + str(handle))
for label in ("emails", "phones", "websites", "locations"):
    items = ide.get(label, [])
    if items:
        L("    " + label + ": " + ", ".join(str(x) for x in items))

L()
cvp = enh.get('cross_verification_profiles', [])
L("Cross-verification profiles (" + str(len(cvp)) + "):")
for p in cvp:
    L("  [" + p.get('platform','?') + "] " + p.get('url',''))

cv = enh.get('cross_verification', [])
L("Cross-verification cycles: " + str(len(cv)))
for i, c in enumerate(cv):
    L("  Iter " + str(i) + ": " + str(c.get('new_profiles_found',0)) + " new")

ei = enh.get('evidence_iteration', {})
L("Evidence iteration: " + str(ei.get('iterations',0)) + " iters, converged=" + str(ei.get('converged',False)))

org = enh.get('organization_graph', {})
L("Organization graph:")
L("  Nodes: " + str(org.get('nodes', 0)) + ", Edges: " + str(org.get('edges', 0)))

geo = enh.get('geolocation', {})
L("Geolocation:")
L("  Primary: " + str(geo.get('primary', 'N/A')))
L("  Confidence: " + str(geo.get('confidence', 0)))

L()
L("--- TIMING ---")
tm = result.get('timing_ms', {})
for k, v in sorted(tm.items()):
    if v > 1:
        L("  " + k + ": " + str(round(v, 0)) + "ms")
L("  TOTAL: " + str(round(result.get('total_time_ms', 0), 0)) + "ms")

L()
L("--- FULL PROFILE DATA ---")
profiles = st.get('2_collection',{}).get('all_profiles', [])
L("All " + str(len(profiles)) + " discovered profiles:")
for p in profiles:
    L("  - " + str(p))

L()
L("=" * 72)

report = "\n".join(lines)
with open("samreedh_full_report.txt", "w", encoding="utf-8") as f:
    f.write(report)
print(report, flush=True)
print("\nRaw JSON: samreedh_full_report.json", flush=True)
print("Readable report: samreedh_full_report.txt", flush=True)
