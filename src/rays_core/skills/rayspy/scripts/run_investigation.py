"""Orchestrate full investigation: pipeline with Sherlock leads + evidence-based report."""
import sys, json, time, os

# Windows consoles often default to a legacy codepage (e.g. cp1252) that
# cannot encode symbols used in the report output (↓, —, etc.), which crashes
# print() with UnicodeEncodeError even though the file itself is written as
# UTF-8. Force UTF-8 on stdout/stderr so console output can't crash the run.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")
import face_search_pipeline as fsp

TARGET_NAME = sys.argv[1] if len(sys.argv) > 1 else "samreedh"
TARGET_LC = TARGET_NAME.lower().replace(" ", "_")

# ── Step 0: Load Sherlock leads BEFORE running pipeline ──
sherlock_path = os.path.join(os.path.dirname(__file__), "..", f"sherlock_{TARGET_LC}")
sherlock_urls = []
if os.path.exists(sherlock_path):
    with open(sherlock_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("http://") or line.startswith("https://"):
                sherlock_urls.append(line)
while sherlock_urls and not sherlock_urls[-1].startswith("http"):
    sherlock_urls.pop()

# Convert Sherlock URLs to lead dicts (just tracking, not full validation)
sherlock_leads = []
for url in sherlock_urls:
    domain = url.split("/")[2] if "://" in url else url
    sherlock_leads.append({
        "url": url,
        "platform": domain.split(".")[-2] if "." in domain else domain,
        "handle": TARGET_LC,
    })

print(f"Loaded {len(sherlock_leads)} Sherlock leads", flush=True)

# ── Step 1: Run enhanced pipeline with Sherlock leads registered separately ──
t0 = time.time()
result = fsp.run_enhanced_pipeline(
    name=TARGET_NAME,
    sherlock_leads=sherlock_leads,
    enable_name_search=True,
    enable_browser_ctrl=False,
    enable_consensus=True,
    enable_memory=True,
    enable_bayesian=True,
)
t1 = time.time()

print(f"Pipeline: {round(t1-t0, 1)}s", flush=True)

# ── Step 2: Save raw JSON ──
output_dir = os.path.join(os.path.dirname(__file__), "..")
json_path = os.path.join(output_dir, f"{TARGET_LC}_investigation_raw.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(result, f, indent=2, default=str)

# ── Step 3: Generate evidence-based report ──
lines = []
L = lambda s="": lines.append(s)

L("=" * 72)
L(f"  {TARGET_NAME.upper()} — EVIDENCE-DRIVEN OSINT INVESTIGATION")
L("  Pipeline: " + str(result.get("pipeline_version", "N/A")))
L("  Pipeline run: " + str(round(t1 - t0, 1)) + "s")
L("=" * 72)

# ── Evidence Summary ──
ev = result.get("evidence_summary", {})
L()
L("STAGE PROGRESSION")
L("  Leads:              " + str(ev.get("leads", 0)))
L("  ↓ Candidates:       " + str(ev.get("candidates", 0)))
L("  ↓ Browser Loaded:   " + str(ev.get("browser_loaded", 0)))
L("  ↓ Validated:        " + str(ev.get("validated", 0)))
L("  ↓ Rejected:         " + str(ev.get("rejected", 0)))
L("  ↓ With Names:       " + str(ev.get("harvested_with_names", 0)))
L("  ↓ With Emails:      " + str(ev.get("harvested_with_emails", 0)))
L("  ↓ High Quality:     " + str(ev.get("high_quality", 0)))
L("  ↓ Identity Cand:    " + str(ev.get("identity_candidates", 0)))
L("  ↓ Verified:         " + str(ev.get("verified", 0)))

# ── Harvested Evidence Detail ──
hev = result.get("identity_discovery", {}).get("harvested_evidence", {})
L()
L("HARVESTED EVIDENCE (from profile HTML)")
if hev.get("display_names"):
    L("  Display names: " + ", ".join(hev["display_names"]))
if hev.get("emails"):
    L("  Emails:        " + ", ".join(hev["emails"]))
if hev.get("phones"):
    L("  Phones:        " + ", ".join(hev["phones"]))
if hev.get("websites"):
    L("  Websites:      " + ", ".join(hev["websites"]))
if hev.get("organizations"):
    L("  Organizations: " + ", ".join(hev["organizations"]))
if not any([hev.get("display_names"), hev.get("emails"), hev.get("websites"), hev.get("organizations")]):
    L("  (none extracted)")

# ── Face Verification ──
verif = result.get("verification_summary", {})
L()
L("FACE VERIFICATION")
L("  Status: " + verif.get("face_verification", "NOT_ATTEMPTED"))
L("  Reference source: " + verif.get("reference_source", "None"))
L("  Face verified: " + str(verif.get("face_verified", False)))
L("  Confidence: " + str(verif.get("verification_confidence", 0)))
L("  " + verif.get("explanation", ""))

auto_ref = verif.get("auto_selected_reference")
if auto_ref:
    L()
    L("  Auto-selected reference (NOT independent verification):")
    L("    Image: " + str(auto_ref.get("image_url", "")))
    L("    Source profile: " + str(auto_ref.get("profile_url", "")) + " (" + str(auto_ref.get("platform", "")) + ")")
    auto_matches = verif.get("auto_reference_matches", [])
    if auto_matches:
        L("    Cross-platform matches:")
        for m in auto_matches:
            L(f"      - {m.get('platform', '?')}: {m.get('profile_url', '')} (similarity={m.get('similarity', 0)})")
    else:
        L("    No cross-platform corroboration found.")

# ── Identity Discovery ──
disc = result.get("identity_discovery", {})
L()
L("IDENTITY DISCOVERY")
L("  Status: " + disc.get("status", "unknown"))
L("  Platforms: " + ", ".join(disc.get("platforms", [])))
L("  Cross-verification cycles: " + str(disc.get("cross_verification_cycles", 0)))
L("  Converged: " + str(disc.get("converged", False)))
L("  " + disc.get("convergence_message", ""))

# Identity candidates
candidates = disc.get("identity_candidates", [])
for ci, c in enumerate(candidates):
    L()
    L(f"  Candidate #{ci+1}: {c.get('name', '?')}")
    L(f"     Confidence: {c.get('confidence', 0)} ({c.get('confidence_label', '?')})")
    L(f"     Platforms: {', '.join(p.get('platform', '?') for p in c.get('linked_profiles', []))}")
    L(f"     Face verification: {c.get('face_verification_status', 'NOT_ATTEMPTED')}")
    for e in c.get("evidence", []):
        cls = e.get("evidence_class", "?")
        desc = e.get("description", "")
        wgt = e.get("weight", 0)
        L(f"     Evidence [{cls}] {desc} (weight={wgt})")

# ── Decision ──
dec = result.get("decision", {})
L()
L("DECISION")
L("  Verdict: " + dec.get("verdict", "N/A"))
L("  Explanation: " + dec.get("explanation", ""))
L("  Face verification: " + str(dec.get("face_verification")))
L("  Verification confidence: " + str(dec.get("verification_confidence", 0)))

# ── Identifiers ──
ide = result.get("enhancements", {}).get("identifier_discovery", {})
L()
L("IDENTIFIERS EXTRACTED")
found_id = False
for label in ("emails", "phones", "websites", "locations", "full_names"):
    items = ide.get(label, [])
    if items:
        found_id = True
        L("  " + label + ": " + ", ".join(str(x) for x in items))
if not found_id:
    L("  No emails, phones, or names publicly exposed")

# ── Organization Graph ──
org = result.get("enhancements", {}).get("organization_graph", {})
L()
L("RELATIONSHIP / ORGANIZATION GRAPH")
L("  Nodes: " + str(len(org.get("nodes", []))))
L("  Edges: " + str(len(org.get("edges", []))))

# ── Geolocation ──
geo = result.get("enhancements", {}).get("geolocation", {})
L()
L("GEOLOCATION")
L("  Locations: " + str(geo.get("locations", [])))
L("  Confidence: " + str(geo.get("confidence", 0)))

# ── Timing ──
L()
L("TIMING")
tm = result.get("timing_ms", {})
for k, v in sorted(tm.items(), key=lambda x: -x[1]):
    if v > 1:
        L("  " + k + ": " + str(round(v, 0)) + "ms")
L("  TOTAL: " + str(round(result.get("total_time_ms", 0), 0)) + "ms")

# ── SHERLOCK LEAD LIST ──
L()
L("=" * 72)
L("  APPENDIX A: SHERLOCK — " + str(len(sherlock_urls)) + " CANDIDATE USERNAMES")
L("  (Sherlock matches URL patterns only — does not verify accounts)")
L("=" * 72)

platform_groups = {
    "Dev & Code": [], "Social": [], "Gaming": [], "Forum": [],
    "Creative": [], "Music/Media": [], "Shopping": [], "Other": []
}
for url in sorted(sherlock_urls):
    domain = url.split("/")[2] if "://" in url else url
    if any(d in domain for d in ["github", "gitlab", "replit", "codesandbox", "huggingface", "hashnode", "hackmd", "geeksforgeeks", "patched", "leetcode", "codolio", "hackenproof", "dmoj", "tryhackme", "weblate", "hubski"]):
        platform_groups["Dev & Code"].append(url)
    elif any(d in domain for d in ["reddit", "twitter", "instagram", "facebook", "snapchat", "tiktok", "pinterest", "discord", "telegram", "mastodon", "linkedin", "letterboxd", "lesswrong", "digitalspy", "dailykos", "interpals", "librarything"]):
        platform_groups["Social"].append(url)
    elif any(d in domain for d in ["chess", "typeracer", "monkeytype", "nationstates", "realmeye", "xbox", "spotify", "yandex"]):
        platform_groups["Gaming"].append(url)
    elif any(d in domain for d in ["forum", "forums", "hubski", "lemmy", "programming", "slashdot", "velomania", "php", "igromania", "opennet", "baby", "mercadolivre", "authorstream"]):
        platform_groups["Forum"].append(url)
    elif any(d in domain for d in ["archive", "scribd", "slideshare", "shelf", "hackmd", "sketchfab", "cults3d", "furaffinity", "svidbook"]):
        platform_groups["Creative"].append(url)
    else:
        platform_groups["Other"].append(url)

for group_name, urls in platform_groups.items():
    if urls:
        L()
        L(f"  {group_name}:")
        for u in urls:
            L("    " + u)

# Overlap analysis
L()
L()
L("=" * 72)
L("  APPENDIX B: CROSS-REFERENCE — VALIDATED vs SHERLOCK")
L("=" * 72)
pipeline_set = set(disc.get("platforms", []))
L("  Validated platforms: " + ", ".join(sorted(pipeline_set)))
L()
L("  Sherlock candidate usernames: " + str(len(sherlock_urls)))
L("  Total unique candidate URLs: " + str(len(sherlock_urls) + len(pipeline_set)))

L()
L("=" * 72)
L("  LIMITATIONS & NOTES")
L("=" * 72)
if not result.get("identity_verification"):
    L("  - No reference image provided. Face verification SKIPPED.")
for c in candidates:
    for p in c.get("linked_profiles", []):
        if not p.get("is_eligible", False):
            L(f"  - {p.get('platform', '?')}: validated but below quality threshold")
L("  - DuckDuckGo blocked by corporate proxy — name search unavailable")
L("  - Sherlock generated " + str(len(sherlock_urls)) + " URL pattern matches;")
L("    these are candidate usernames, not verified accounts.")
if not hev.get("emails") and not hev.get("phones"):
    L("  - No emails or phone numbers found in public sources")

L()
L("=" * 72)
L("  END OF REPORT")
L("=" * 72)

report_path = os.path.join(output_dir, f"{TARGET_LC}_investigation_report.txt")
with open(report_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print("\n".join(lines))
print(f"\nSaved: {TARGET_LC}_investigation_raw.json")
print(f"Saved: {TARGET_LC}_investigation_report.txt")
