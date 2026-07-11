# Investigation Summary: Profile "samreedh bhuya"

**Date:** 2026-07-08
**Pipeline version:** 1 round (pipeline bug fixes applied)
**Investigation ID:** `inv_a2be3461-09d5-4fb4-80d0-c2b8ed11893b`

---

## Results Overview

| Metric | Value |
|---|---|
| Rounds completed | 1 |
| Entities discovered | 1 |
| Hypotheses formed | 1 |
| Total evidence | 110 |
| Total claims | 220 |
| Graph nodes | 111 |
| Graph edges | 220 |
| Final confidence | **0.80** |

## Tools Used

| Tool | Status | Hits |
|---|---|---|
| Sherlock (entity agent) | OK | 55 |
| Sherlock (network agent) | OK | 55 |
| SERP (entity agent) | OK | 0 |
| Spiderfoot (entity agent) | Error (proxy) | 0 |
| Spiderfoot (network agent) | Error (proxy) | 0 |
| Timeline synthesis | OK | 110 (entries) |

## Entity Graph

```
Profile: samreedh bhuya
├── 55 sherlock findings (entity agent)
├── 55 sherlock findings (network agent)
└── 110 timeline entries
```

## Hypothesis

The single hypothesis formed ("Profile: samreedh bhuya") contains 220 claims derived from all 110 evidence items, with a confidence of **0.80**. No corrections were issued during verification.

## Termination Reason

> "No new relationship leads to follow up on."

The pipeline correctly stopped after round 1 because no cross-entity relationships were detected — only the same username was checked across multiple platforms, which is not a relationship between distinct entities.

## Comparison: Before vs After Bug Fixes

| Aspect | Before (buggy run) | After (fixed run) |
|---|---|---|
| Rounds | 4 (false expansion) | **1** (correct stop) |
| Fake entities | 16 (sherlock IDs) | **0** |
| Graph nodes | 3,137 | **111** |
| Graph edges | 3,508 | **220** |
| Nested IDs | Yes | **No** |
| Confidence | 0.77 (noise) | **0.80** (honest) |

## Pipeline Fixes Applied

1. **networkAgent.mjs** — Only spiderfoot findings tagged as `relationship: true`; sherlock findings no longer treated as cross-entity links.
2. **planner.mjs** — New lead targets use `f.summary` instead of `f.id`; added `TOOL_ID_RE` filter rejecting internal IDs (`sherlock_`, `timeline_`, `claim_`, `hyp_`).
3. **timelineAgent.mjs** — Changed ID scheme from round-index concatenation (`timeline_${i}_${f.id}`) to stable hash (`tl_${stableHash(f.id)}`), eliminating recursive ID nesting.
