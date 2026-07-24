#!/usr/bin/env python3
"""Test all 7 new OSINT modules and their integration into the enhanced pipeline.

Runs each module independently, then invokes the enhanced pipeline with
--name "samreedh" and new module flags.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(SCRIPTS_DIR / "scripts"))

REPORT_FILE = SCRIPTS_DIR / "new_modules_test_report.txt"
_reports: list[str] = []


def log(msg: str):
    _reports.append(msg)
    print(msg)


def heading(title: str):
    sep = "=" * 60
    log(f"\n{sep}")
    log(f"  {title}")
    log(sep)


# ──────────────── 1. URL Canonicalizer ────────────────
def test_url_canonicalizer():
    heading("1. URL Canonicalizer")
    try:
        import url_canonicalizer as uc_mod
        canon = uc_mod.URLCanonicalizer()
        test_urls = [
            "https://www.instagram.com/accounts/login/?next=%2Fsamreedh%2F&source=desktop_nav",
            "https://l.facebook.com/l.php?u=https://www.facebook.com/samreedh",
            "https://duckduckgo.com/l/?uddg=https://www.linkedin.com/in/samreedh",
            "https://www.linkedin.com/in/samreedh",
        ]
        for url in test_urls:
            resolved = canon.resolve(url)
            log(f"  {url[:60]}... -> {resolved}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 2. Identifier Discovery ────────────────
def test_identifier_discovery():
    heading("2. Identifier Discovery")
    try:
        import identifier_discovery as idc_mod
        idc = idc_mod.IdentifierDiscovery()

        # Simulated profile
        profile = {
            "url": "https://github.com/samreedh",
            "platform": "github",
            "bio": "Software engineer at Google. Reach me at sam@example.com or visit https://samreedh.dev. Based in San Francisco, CA.",
            "location": "San Francisco, CA",
            "email": "sam@example.com",
            "handle": "samreedh",
        }
        ids = idc.extract_from_profiles([profile])
        log(f"  From profile: {json.dumps(ids, indent=2)}")

        # From text
        text_ids = idc.extract_from_text("Contact: sam@example.com or +1-555-123-4567. Web: https://samreedh.dev @samreedh")
        log(f"  From text: {json.dumps(text_ids, indent=2)}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 3. Cross-Verification Loop ────────────────
def test_cross_verification():
    heading("3. Cross-Verification Loop")
    try:
        import cross_verification_loop as cvl_mod
        cvl = cvl_mod.CrossVerificationLoop()
        usernames = {"github": "samreedh", "instagram": "samreedh"}
        result = cvl.run(usernames, max_iterations=2)
        log(f"  Result: {json.dumps(result, indent=2, default=str)[:500]}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 4. Post Metadata Extractor ────────────────
def test_post_metadata():
    heading("4. Post Metadata Extractor")
    try:
        import post_metadata_extractor as pme_mod
        pme = pme_mod.PostMetadataExtractor()
        sample_html = """
        <html><body>
        <article>
            <time datetime="2024-12-25T10:00:00Z">December 25, 2024</time>
            <span class="location">New York, NY</span>
            <div class="content">#TechConference @john_doe Amazing event! https://example.com</div>
            <img src="photo.jpg" alt="Conference photo">
            <span class="likes">1,234</span>
            <span class="comments">56</span>
            <span class="shares">12</span>
        </article>
        </body></html>
        """
        metadata = pme.extract_from_html(sample_html, base_url="https://instagram.com/p/test123")
        log(f"  Extracted: {json.dumps(metadata, indent=2, default=str)[:500]}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 5. Organization Graph ────────────────
def test_org_graph():
    heading("5. Organization Graph")
    try:
        import organization_graph as og_mod
        og = og_mod.OrganizationGraph()
        og.add_from_profile("samreedh", {
            "url": "https://linkedin.com/in/samreedh",
            "platform": "linkedin",
            "bio": "SWE at Google, ex-Microsoft",
            "organization": "Google",
        })
        og.add_from_profile("samreedh", {
            "url": "https://github.com/samreedh",
            "platform": "github",
            "bio": "Google engineer. Past: Microsoft",
            "organization": "Microsoft",
        })
        graph = og.build_graph()
        log(f"  Graph: {json.dumps(graph, indent=2, default=str)[:500]}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 6. Geolocation Engine ────────────────
def test_geolocation():
    heading("6. Geolocation Engine")
    try:
        import geolocation_engine as ge_mod
        ge = ge_mod.GeolocationEngine()

        text = "Living in San Francisco, CA. Originally from Seattle, WA. Located at 37.7749, -122.4194"
        text_locs = ge.extract_from_text(text)
        log(f"  Text locations: {json.dumps(text_locs, indent=2)[:300]}")

        urls = ["https://facebook.com/location=sanfrancisco", "https://example.com/en/"]
        url_locs = ge.extract_from_urls(urls)
        log(f"  URL locations: {json.dumps(url_locs, indent=2)[:300]}")

        profile = {"location": "San Francisco, CA", "bio": "I work in NYC"}
        profile_locs = ge.extract_from_profile(profile)
        log(f"  Profile locations: {json.dumps(profile_locs, indent=2)[:300]}")

        aggregated = ge.aggregate([text_locs, url_locs, profile_locs])
        log(f"  Aggregated: {json.dumps(aggregated, indent=2, default=str)[:500]}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 7. Evidence Iteration Loop ────────────────
def test_evidence_iteration():
    heading("7. Evidence Iteration Loop")
    try:
        import evidence_iteration_loop as eil_mod
        eil = eil_mod.EvidenceIterationLoop()

        profiles = [
            {"url": "https://instagram.com/samreedh", "platform": "instagram", "handle": "samreedh"},
            {"url": "https://linkedin.com/in/samreedh", "platform": "linkedin", "handle": "samreedh"},
        ]
        images = [{"url": "https://example.com/photo1.jpg"}]

        mock_verify = lambda imgs, profs: {
            "candidates": [{"confidence": 0.85, "profile_urls": [p["url"] for p in profs]}],
            "decision": {"verdict": "dominant_candidate", "verdict_confidence": 0.85},
        }
        result = eil.run(
            initial_profiles=profiles,
            initial_images=images,
            collect_profiles_fn=lambda ids: [],
            collect_images_fn=lambda profs: [],
            verify_fn=mock_verify,
            max_iterations=3,
        )
        log(f"  Iterations: {result['iterations_completed']}, "
            f"Converged: {result['converged']}, "
            f"Final confidence: {result['final_confidence']:.4f}")
        log(f"  History: {json.dumps(result['iteration_history'], indent=2)[:500]}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        return False


# ──────────────── 8. Pipeline Integration ────────────────
def test_pipeline_integration():
    heading("8. Enhanced Pipeline Integration")
    try:
        import face_search_pipeline as fsp
        # Run the enhanced pipeline with minimal arguments
        # Use a real-looking profile so URL canonicalizer has something to do
        profiles = [
            {"url": "https://www.instagram.com/accounts/login/?next=%2Fsamreedh%2F", "platform": "instagram", "handle": "samreedh", "bio": "Software engineer"},
            {"url": "https://linkedin.com/in/samreedh", "platform": "linkedin", "handle": "samreedh", "bio": "Google engineer"},
        ]
        result = fsp.run_enhanced_pipeline(
            name="samreedh",
            pre_collected_profiles=profiles,
            enable_name_search=False,
            enable_quality=True,
            enable_dedup=True,
            enable_consensus=False,
            enable_memory=True,
            enable_bayesian=True,
            enable_browser_ctrl=False,
        )
        log(f"  Pipeline version: {result.get('pipeline_version', 'N/A')}")
        log(f"  Total profiles: {len(result.get('profiles', []))}")
        log(f"  Decision: {result.get('decision', {}).get('verdict', 'N/A')}")
        enh = result.get("enhancements", {})
        log(f"  URL canonicalized: {enh.get('url_canonicalization', {}).get('canonicalized_count', 0)}")
        log(f"  Identifiers discovered: {len(enh.get('identifier_discovery', {}).get('usernames', []))} usernames, "
            f"{len(enh.get('identifier_discovery', {}).get('emails', []))} emails")
        log(f"  Post metadata: {enh.get('post_metadata', {}).get('count', 0)} items")
        org = enh.get("organization_graph", {})
        log(f"  Organization graph: {len(org.get('organizations', []))} orgs, "
            f"{len(org.get('projects', []))} projects")
        geo = enh.get("geolocation", {})
        log(f"  Geolocation primary: {geo.get('primary_location', 'N/A')} "
            f"(confidence: {geo.get('confidence', 0.0)})")
        cv = enh.get("cross_verification", {})
        if isinstance(cv, list):
            log(f"  Cross-verification: {len(cv)} cycles")
        else:
            log(f"  Cross-verification: {cv.get('cycles', 'N/A')}")
        ei = enh.get("evidence_iteration", {})
        log(f"  Evidence iterations: {ei.get('iterations', 0)}, "
            f"converged: {ei.get('converged', False)}")
        log(f"  Timing: {json.dumps(result.get('timing_ms', {}), indent=2)[:500]}")
        return True
    except Exception as e:
        log(f"  FAILED: {e}")
        import traceback
        log(f"  Traceback: {traceback.format_exc()[:1000]}")
        return False


# ──────────────── Main ────────────────
def main():
    heading("NEW MODULES: UNIT & INTEGRATION TESTS")
    log(f"  Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"  CWD: {SCRIPTS_DIR}")

    results = {}

    results["1_url_canonicalizer"] = test_url_canonicalizer()
    results["2_identifier_discovery"] = test_identifier_discovery()
    results["3_cross_verification"] = test_cross_verification()
    results["4_post_metadata"] = test_post_metadata()
    results["5_org_graph"] = test_org_graph()
    results["6_geolocation"] = test_geolocation()
    results["7_evidence_iteration"] = test_evidence_iteration()
    results["8_pipeline_integration"] = test_pipeline_integration()

    heading("SUMMARY")
    all_pass = all(results.values())
    for name, ok in results.items():
        status = "PASS" if ok else "FAIL"
        log(f"  [{status}] {name}")

    log(f"\n{'ALL TESTS PASSED' if all_pass else 'SOME TESTS FAILED'}")

    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(_reports))

    log(f"\nReport saved to: {REPORT_FILE}")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
