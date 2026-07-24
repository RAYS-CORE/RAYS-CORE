"""Full system test with GitHub avatar as reference image."""
import sys, json, time, os
sys.path.insert(0, 'scripts')
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import face_search_pipeline as fsp

REFERENCE_URL = "https://avatars.githubusercontent.com/samreedh"

print("=== PASS 1: Discover profiles without reference ===", flush=True)
t0 = time.time()
result1 = fsp.run_enhanced_pipeline(
    name='samreedh',
    enable_name_search=True,
    enable_browser_ctrl=False,
    enable_consensus=False,
    enable_memory=True,
    enable_bayesian=True,
)
t1 = time.time()
print(f"Pass 1 completed in {t1-t0:.1f}s", flush=True)
print(f"Profiles found: {result1.get('stages',{}).get('2_collection',{}).get('profiles_found',0)}", flush=True)
print(f"Platforms: {result1.get('stages',{}).get('2_collection',{}).get('platforms',[])}", flush=True)

print("\n=== PASS 2: Face matching with GitHub avatar reference ===", flush=True)
t2 = time.time()
result2 = fsp.run_enhanced_pipeline(
    name='samreedh',
    reference_url=REFERENCE_URL,
    enable_name_search=True,
    enable_browser_ctrl=False,
    enable_consensus=True,
    enable_memory=True,
    enable_bayesian=True,
)
t3 = time.time()
print(f"Pass 2 completed in {t3-t2:.1f}s", flush=True)

# Save raw JSON
with open("samreedh_face_report.json", "w", encoding="utf-8") as f:
    json.dump(result2, f, indent=2, default=str)

# Generate readable report
lines = []
def L(s=""): lines.append(s)

L("=" * 72)
L("  SAMREEDH — FULL OSINT REPORT (with face reference)")
L("  Pipeline: " + result2.get("pipeline_version", "N/A"))
L("  Reference: " + REFERENCE_URL)
L("  Total time: " + str(round(t3-t0, 1)) + "s")
L("=" * 72)

L()
L("PASS 1 — Profile Discovery")
L("  Platforms: " + ", ".join(result1.get('stages',{}).get('2_collection',{}).get('platforms',[])))

L()
L("PASS 2 — Face Matching Results")
st2 = result2.get('stages', {})
L("  Profiles found: " + str(st2.get('2_collection',{}).get('profiles_found',0)))
L("  Images queued: " + str(st2.get('4_image_collection',{}).get('images_queued',0)))
L("  Images accepted: " + str(st2.get('5_quality_validation',{}).get('accepted',0)))
L("  Faces detected: " + str(st2.get('7_embedding',{}).get('faces_detected',0)))
L("  Clusters formed: " + str(st2.get('8_clustering',{}).get('clusters_formed',0)))

L()
L("  Reference info: ")
ref = result2.get('reference')
if ref:
    L("    Face detected: " + str(ref.get('face_detected', False)))
    if ref.get('face_detected'):
        L("    Gender: " + str(ref.get('gender', 'N/A')))
        L("    Age: " + str(ref.get('age', 'N/A')))
        L("    Confidence: " + str(ref.get('confidence', 0)))
else:
    L("    No reference info")

L()
L("  Reference matches: " + str(len(result2.get('reference_matches', []))))
for m in result2.get('reference_matches', []):
    L("    - Face " + str(m.get('face_index', '?')) + " sim=" + str(m.get('similarity', 0)))

L()
L("  Decision: " + str(result2.get('decision', {}).get('verdict', 'N/A')))
L("  Explanation: " + str(result2.get('decision', {}).get('explanation', 'N/A')))

L()
L("  Candidates: " + str(len(result2.get('candidates', []))))
for c in result2.get('candidates', []):
    L("    - Confidence: " + str(round(c.get('confidence', 0), 4)))
    L("      Platforms: " + ", ".join(c.get('platforms', [])))
    L("      URLs: " + ", ".join(c.get('profile_urls', [])))

L()
L("--- ENHANCEMENTS ---")
enh = result2.get('enhancements', {})
L("  Browser: " + ("available" if enh.get('browser_controller_available') else "unavailable"))
L("  Memory hit: " + str(enh.get('identity_memory_hit')))
L("  Consensus: " + str(enh.get('consensus_verification')))
L("  URLs canonicalized: " + str(enh.get('url_canonicalization',{}).get('canonicalized_count',0)))

ide = enh.get('identifier_discovery', {})
us = ide.get('usernames', {})
L("  Identifier discovery:")
if isinstance(us, dict):
    for plat, handle in us.items():
        L("    - " + plat + ": " + str(handle))
for k in ("emails", "phones", "websites", "locations"):
    items = ide.get(k, [])
    if items:
        L("    " + k + ": " + ", ".join(str(x) for x in items))

cvp = enh.get('cross_verification_profiles', [])
L("  Cross-verification profiles: " + str(len(cvp)))
for p in cvp:
    L("    - [" + p.get('platform','?') + "] " + p.get('url',''))

cv = enh.get('cross_verification', [])
L("  Cross-verification cycles: " + str(len(cv)))
for i, c in enumerate(cv):
    L("    Iter " + str(i) + ": " + str(c.get('new_profiles_found',0)) + " new, queries=" + str(c.get('queries_run',0)))

ei = enh.get('evidence_iteration', {})
L("  Evidence iteration: " + str(ei.get('iterations',0)) + " iters, converged=" + str(ei.get('converged',False)))

L()
L("--- TIMING ---")
tm = result2.get('timing_ms', {})
for k, v in sorted(tm.items()):
    if v > 1:
        L("  " + k + ": " + str(round(v, 0)) + "ms")
L("  TOTAL: " + str(round(result2.get('total_time_ms', 0), 0)) + "ms")

L()
L("=" * 72)

report = "\n".join(lines)
with open("samreedh_face_report.txt", "w", encoding="utf-8") as f:
    f.write(report)
print("\nReadable report saved to samreedh_face_report.txt", flush=True)
print(report, flush=True)
