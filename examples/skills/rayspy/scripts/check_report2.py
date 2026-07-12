"""Check full JSON report for detailed data."""
import json, sys
sys.path.insert(0, "scripts")

with open("scripts/samreedh_full_report.json", encoding="utf-8") as f:
    d = json.load(f)

print("=== PROFILE-BY-PROFILE DETAILS ===")
cvp = d.get("enhancements", {}).get("cross_verification_profiles", [])
for p in cvp:
    plat = p.get("platform", "?")
    url = p.get("url", "")
    print(f"\n  [{plat}] {url}")
    for k, v in p.items():
        if k not in ("platform", "url"):
            vstr = str(v)[:200]
            print(f"    {k}: {vstr}")

print("\n=== REFERENCE FACE ===")
ref = d.get("reference", {})
for k, v in ref.items():
    print(f"  {k}: {v}")

print("\n=== CROSS VERIFICATION ITERATIONS ===")
cv = d.get("enhancements", {}).get("cross_verification", [])
for i, c in enumerate(cv):
    print(f"  Iter {i}: new={c.get('new_profiles_found',0)}, queries={c.get('queries_run',0)}")
    for u in c.get("new_urls", []):
        print(f"    NEW: {u}")

print("\n=== IDENTIFIER DISCOVERY (any emails/phones/names) ===")
ide = d.get("enhancements", {}).get("identifier_discovery", {})
discovered = False
for k in ("usernames", "emails", "phones", "websites", "locations", "full_names"):
    v = ide.get(k, {}) if isinstance(ide.get(k), dict) else ide.get(k, [])
    if v:
        discovered = True
        print(f"  {k}: {v}")
if not discovered:
    print("  No additional identifiers discovered")

print("\n=== TEXT EVIDENCE ===")
ev = d.get("stages", {}).get("9_evidence", {})
print(json.dumps(ev, indent=2, default=str)[:1000])

print("\n=== SEARCH QUERIES RUN ===")
q = d.get("stages", {}).get("1_query_planner", {})
if q:
    print(json.dumps(q, indent=2, default=str)[:500])

print("\nDone.")
