import * as personMatcher from '../tools/personMatcher.mjs';
import * as serp from '../tools/serp.mjs';
import { stableHash } from '../utils/ids.mjs';
import { log } from '../logging/logger.mjs';
import { LogSource } from '../logging/logSources.mjs';

/**
 * Social agent: given a person's name, runs the full 14-stage RaySpy
 * Face Search Pipeline:
 *   1. Query Planner      6. Duplicate Removal     11. Confidence Scoring
 *   2. Multi-Source       7. Face Embedding        12. Candidate Ranking
 *   3. Normalization      8. Clustering            13. Decision Engine
 *   4. Image Collection   9. Evidence Aggregation  14. Explainable Output
 *   5. Quality Validation 10. Evidence Weighting
 *
 * The agent searches for social media profiles, collects profile images,
 * validates image quality, removes duplicates, extracts face embeddings,
 * clusters identities by face similarity, aggregates cross-platform
 * evidence, weighs reliability, scores confidence, and returns ranked
 * identity candidates with explainable outputs.
 *
 * Hits:
 *   - "identity_candidate" — a ranked person identity with evidence
 *   - "profile" — individual social media profiles found (low-level)
 */

function knownImageUrl(platform, handle) {
  if (!handle) return null;
  if (platform === 'github') return `https://github.com/${handle}.png`;
  return null;
}

function extractHandle(platform, url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const segs = path.split('/').filter(Boolean);
    if (platform === 'linkedin' && segs[0] === 'in') return segs[1];
    if (platform === 'x' || platform === 'twitter') return segs[0];
    if (platform === 'github') return segs[0];
    if (platform === 'instagram') return segs[0];
    return segs[segs.length - 1] || null;
  } catch {
    return null;
  }
}

function guessPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('linkedin')) return 'linkedin';
  if (u.includes('instagram')) return 'instagram';
  if (u.includes('x.com') || u.includes('twitter')) return 'x';
  if (u.includes('facebook')) return 'facebook';
  if (u.includes('github')) return 'github';
  if (u.includes('youtube')) return 'youtube';
  return 'web';
}

export async function runSocialAgent(session, task) {
  const { target } = task;
  const profiles = [];

  // --- Step 1: Search SERP for social media profiles by name ---
  const platforms = ['linkedin', 'instagram', 'x', 'twitter', 'facebook', 'github', 'youtube'];
  for (const platform of platforms) {
    const query = platform === 'x'
      ? `site:x.com "${target}" OR site:twitter.com "${target}"`
      : `site:${platform}.com "${target}"`;
    try {
      const result = await serp.run(query);
      if (result.status === 'ok' && result.hits.length > 0) {
        for (const hit of result.hits) {
          const url = hit.url;
          const plat = guessPlatform(url);
          const handle = extractHandle(plat, url);
          const knownImg = knownImageUrl(plat, handle);
          profiles.push({
            url,
            platform: plat,
            handle,
            image_url: knownImg,
            source: 'serp',
          });
        }
      }
    } catch {
      // SERP failure is non-fatal
    }
  }

  // --- Step 2: Deduplicate profiles by URL ---
  const seen = new Set();
  const uniqueProfiles = [];
  for (const p of profiles) {
    const key = p.url;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueProfiles.push(p);
    }
  }

  // --- Step 3: Build extra image items from known patterns ---
  const extraImages = uniqueProfiles
    .filter((p) => p.image_url)
    .map((p) => ({
      url: p.image_url,
      platform: p.platform,
      profile_url: p.url,
      handle: p.handle,
      source: p.source,
    }));

  // --- Step 4: Run the full 14-stage pipeline ---
  // If we have 0 profiles and 0 images, the pipeline still runs
  // its query planner and tries name-based search (if enabled).
  let pipelineResult;
  try {
    pipelineResult = await personMatcher.runFullPipeline(target, {
      profiles: uniqueProfiles,
      images: extraImages,
      nameSearch: false,   // SERP search already done above; pipeline won't re-search
      quality: true,
      dedup: true,
    });
  } catch (err) {
    pipelineResult = {
      tool: 'faceSearchPipeline',
      target,
      status: 'error',
      durationMs: 0,
      hits: [],
      error: err.message,
    };
  }

  log(session, LogSource.OSINT_AGENT_POOL, 'tool_call', {
    agent: 'social',
    tool: 'faceSearchPipeline',
    target,
    status: pipelineResult.status,
    durationMs: pipelineResult.durationMs,
    hitCount: pipelineResult.hits.length,
    details: pipelineResult.raw ? {
      total_images_processed: pipelineResult.raw.total_images_processed,
      total_faces_detected: pipelineResult.raw.total_faces_detected,
      identity_clusters: pipelineResult.raw.identity_clusters,
      decision: pipelineResult.raw.decision?.verdict,
    } : {},
  });

  // If pipeline returned error or no hits, fall back to basic profile results
  if (pipelineResult.status === 'error' || pipelineResult.hits.length === 0) {
    const profileHits = uniqueProfiles.map((p) => ({
      id: `profile_${stableHash(p.url)}`,
      tool: 'faceSearchPipeline',
      target,
      summary: `${p.platform}: ${p.url}` + (p.handle ? ` (${p.handle})` : ''),
      confidence: 0.4,
      timestamp: new Date().toISOString(),
      platform: p.platform,
      profile_url: p.url,
      image_url: p.image_url,
      matchType: 'profile',
      agent: 'social',
      taskId: task.id,
      target,
    }));
    return profileHits.length > 0 ? profileHits : [{
      id: `social_${stableHash(target)}`,
      tool: 'faceSearchPipeline',
      target,
      summary: `No profiles found for "${target}". Web search may be unavailable from this network.`,
      confidence: 0,
      timestamp: new Date().toISOString(),
      matchType: 'profile',
      agent: 'social',
      taskId: task.id,
      target,
    }];
  }

  // Return pipeline candidates as hits
  return pipelineResult.hits.map((hit) => ({
    ...hit,
    agent: 'social',
    taskId: task.id,
    target,
  }));
}
