"""Check full JSON report for detailed data."""
import json

with open("samreedh_full_report.json", encoding="utf-8") as f:
    d = json.load(f)

print("=== STAGE 2 — Profile Collection ===")
s2 = d.get("stages", {}).get("2_collection", {})
for k, v in s2.items():
    if isinstance(v, list):
        print(f"  {k}: [{len(v)} items]")
        for item in v:
            print(f"    {item}")
    elif isinstance(v, dict):
        print(f"  {k}: {json.dumps(v, default=str)[:300]}")
    else:
        print(f"  {k}: {v}")

print("\n=== ALL PLATFORMS (cross_verification_profiles) ===")
cvp = d.get("enhancements", {}).get("cross_verification_profiles", [])
for p in cvp:
    print(f"  [{p.get('platform','?')}] {p.get('url','')}")
    # Show extra fields
    for k, v in p.items():
        if k not in ("platform", "url"):
            print(f"    {k}: {v}")

print("\n=== REFERENCE FACE ===")
ref = d.get("reference", {})
for k, v in ref.items():
    print(f"  {k}: {v}")

print("\n=== EVIDENCE ===")
ev = d.get("stages", {}).get("9_evidence", {})
print(json.dumps(ev, indent=2, default=str)[:2000])

print("\n=== CROSS VERIFICATION ===")
cv = d.get("enhancements", {}).get("cross_verification", [])
for i, c in enumerate(cv):
    print(f"  Iter {i}: profiles={c.get('new_profiles_found',0)}, queries={c.get('queries_run',0)}")
    n = c.get("new_urls", [])
    for u in n:
        print(f"    {u}")

print("\n=== IDENTIFIER DISCOVERY ===")
ide = d.get("enhancements", {}).get("identifier_discovery", {})
print(json.dumps(ide, indent=2, default=str)[:2000])
