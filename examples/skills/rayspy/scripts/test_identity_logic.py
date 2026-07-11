"""Test the new two-phase identity logic."""
import sys, json, os
sys.path.insert(0, "scripts")
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import face_search_pipeline as fsp

# === TEST 1: Discovery Only (no reference) ===
print("=" * 60)
print("TEST 1: IDENTITY DISCOVERY ONLY (no reference)")
print("=" * 60)
result = fsp.run_enhanced_pipeline(
    name="samreedh",
    enable_name_search=True,
    enable_browser_ctrl=False,
)
print("\nIdentity Discovery:")
ids = result.get("identity_discovery", {})
print("  Status:", ids.get("status"))
print("  Profiles found:", ids.get("profiles_found"))
print("  Platforms:", ids.get("platforms"))
print("  Converged:", ids.get("converged"))
print("  Convergence message:", ids.get("convergence_message"))

print("\nIdentity Candidates:")
cands = ids.get("identity_candidates", [])
for c in cands:
    print(f"  #{c['rank']}: {c['name_hypothesis']}")
    print(f"     Confidence: {c['confidence']} ({c['confidence_label']})")
    print(f"     Platforms: {c['platforms']}")
    print(f"     Face verified: {c['face_verified']}")
    print(f"     Verification: {c['verification']}")
    for sig in c.get("evidence_signals", []):
        print(f"     Signal: [{sig['strength']}] {sig['signal']}: {sig['detail']}")
    for plat, status in c.get("platform_status", {}).items():
        print(f"     Platform '{plat}': accessibility={status['accessibility']}, evidence={status['evidence']}")

print("\nDecision:")
dec = result.get("decision", {})
print("  Verdict:", dec.get("verdict"))
print("  Explanation:", dec.get("explanation")[:200])

print("\nVerification:", result.get("identity_verification"))

# === TEST 2: With Reference (Twitter profile pic) ===
print("\n" + "=" * 60)
print("TEST 2: WITH REFERENCE (Twitter profile pic)")
print("=" * 60)
REF = "https://pbs.twimg.com/profile_images/2051730041827205120/kBsDNHUD.jpg"
result2 = fsp.run_enhanced_pipeline(
    name="samreedh",
    reference_url=REF,
    enable_name_search=True,
    enable_browser_ctrl=False,
)

print("\nIdentity Discovery:")
ids2 = result2.get("identity_discovery", {})
print("  Profiles found:", ids2.get("profiles_found"))
print("  Platforms:", ids2.get("platforms"))

print("\nIdentity Verification:")
vi = result2.get("identity_verification")
if vi:
    print("  Face verified:", vi.get("face_verified"))
    print("  Verification confidence:", vi.get("verification_confidence"))
    print("  Faces detected in profiles:", vi.get("face_detected_in_profiles"))
    print("  Verification explanation:", vi.get("verification_explanation"))
    print("  Reference matches:", len(vi.get("reference_matches", [])))
    ref_i = vi.get("reference", {})
    if ref_i:
        print("  Reference face detected:", ref_i.get("face_detected"))
        print("  Reference gender:", ref_i.get("gender"))
        print("  Reference age:", ref_i.get("age"))

print("\nDecision:")
dec2 = result2.get("decision", {})
print("  Verdict:", dec2.get("verdict"))
print("  Explanation:", dec2.get("explanation")[:300])

print("\nCandidates with face evidence:")
cands2 = ids2.get("identity_candidates", [])
for c in cands2:
    print(f"  #{c['rank']}: {c['name_hypothesis']}  conf={c['confidence']} ({c['confidence_label']})")
    if c.get("face_evidence"):
        print(f"     Face evidence: max_sim={c['face_evidence']['max_similarity']}, avg_sim={c['face_evidence']['average_similarity']}")
        print(f"     Face verified: {c['face_verified']}")
        print(f"     Verification: {c['verification']}")

# Save full outputs for inspection
out_dir = os.path.join(os.path.dirname(__file__), "..")
with open(os.path.join(out_dir, "test_discovery_only.json"), "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, default=str)
with open(os.path.join(out_dir, "test_with_reference.json"), "w", encoding="utf-8") as f:
    json.dump(result2, f, indent=2, default=str)

print("\nFull outputs saved to test_discovery_only.json and test_with_reference.json")
