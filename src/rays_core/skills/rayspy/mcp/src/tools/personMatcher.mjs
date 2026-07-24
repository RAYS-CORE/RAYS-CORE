import { runCommand } from './_shell.mjs';
import { stableHash } from '../utils/ids.mjs';
import { simulateLatency, mockHitCount, buildStubResult } from './_stubHelpers.mjs';

const PYTHON_BIN = process.env.INSIGHTFACE_PYTHON || process.env.SPIDERFOOT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const MATCHER_SCRIPT = process.env.PERSON_MATCHER_SCRIPT;
const PIPELINE_SCRIPT = process.env.FACE_SEARCH_PIPELINE_SCRIPT;
const TIMEOUT_MS = Number(process.env.PERSON_MATCHER_TIMEOUT_MS || 180_000);
const PIPELINE_TIMEOUT_MS = Number(process.env.FACE_SEARCH_PIPELINE_TIMEOUT_MS || 300_000);

/**
 * Person matcher tool — given image URLs, extracts face embeddings via
 * InsightFace and cross-matches to find which images belong to the same
 * person (cosine similarity >= threshold).
 *
 * @param {string} target - display label (person name)
 * @param {object} opts
 * @param {Array<{id:string,url:string,platform?:string,profile_url?:string}>} opts.images - image items to match
 * @param {string} [opts.reference] - reference image URL for direct comparison
 * @param {number} [opts.threshold=0.9] - match threshold
 */
export async function run(target, { images, reference, threshold } = {}) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(2000, 8000);
    const n = images?.length || mockHitCount(target, 'personMatcher', 3);
    const hits = Array.from({ length: n }, (_, i) => ({
      id: `person_${stableHash(images?.[i]?.url || `${target}_${i}`)}_${i}`,
      tool: 'personMatcher',
      target,
      summary: i === 0
        ? `Matched person via face verification — found profiles`
        : `Additional profile match #${i + 1}`,
      confidence: 0.9 + (i * 0.03),
      timestamp: new Date().toISOString(),
      platform: images?.[i]?.platform || ['linkedin', 'instagram', 'github'][i] || 'web',
      profile_url: images?.[i]?.profile_url || '',
      matchType: 'face_cross_match',
    }));
    return buildStubResult('personMatcher', target, hits, durationMs);
  }

  if (!MATCHER_SCRIPT) {
    return {
      tool: 'personMatcher',
      target,
      status: 'error',
      durationMs: 0,
      hits: [],
      error: 'PERSON_MATCHER_SCRIPT not set. Set it in proxy-server.mjs or .env.',
    };
  }

  const imageUrlsJson = JSON.stringify(images || []);
  const args = [
    '--image-urls', imageUrlsJson,
    '--name', target,
    '--output-format', 'json',
    '--threshold', String(threshold ?? 0.9),
  ];
  if (reference) {
    args.push('--reference', reference);
  }

  const result = await runCommand(PYTHON_BIN, [MATCHER_SCRIPT, ...args], { timeoutMs: TIMEOUT_MS });

  if (result.spawnError) {
    return {
      tool: 'personMatcher',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `Failed to start matcher script: ${result.stderr.slice(0, 300)}`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
    if (parsed.error) {
      return {
        tool: 'personMatcher',
        target,
        status: 'error',
        durationMs: result.durationMs,
        hits: [],
        error: parsed.error,
      };
    }
  } catch {
    return {
      tool: 'personMatcher',
      target,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `Matcher script returned invalid JSON. stderr: ${result.stderr.slice(0, 200)}`,
    };
  }

  // Generate hits for each processed face result
  const profileHits = (parsed.face_results || []).map((fr) => ({
    id: `person_${stableHash(fr.image_url || fr.id || target)}`,
    tool: 'personMatcher',
    target,
    summary: fr.platform
      ? `${fr.platform}: ${fr.profile_url || fr.image_url}` +
        (fr.face_detected ? ` [face: ${fr.gender || '?'}, ~${fr.age || '?'}yo]` : ' [no face]')
      : `Image: ${fr.image_url?.slice(0, 80)}` +
        (fr.face_detected ? ` [face: ${fr.gender || '?'}, ~${fr.age || '?'}yo]` : ' [no face]'),
    confidence: fr.face_detected ? 0.85 : 0.5,
    timestamp: new Date().toISOString(),
    platform: fr.platform,
    profile_url: fr.profile_url,
    image_url: fr.image_url,
    face_detected: fr.face_detected,
    gender: fr.gender,
    age: fr.age,
    matchType: 'profile',
  }));

  // Generate hits for matched person clusters
  const matchedHits = (parsed.matched_persons || []).map((mp, i) => ({
    id: `person_matched_${stableHash(JSON.stringify(mp.profile_urls || []))}_${i}`,
    tool: 'personMatcher',
    target,
    summary: `Matched person — ${mp.platforms?.join(', ') || 'unknown'} profiles face-matched (sim=${mp.max_similarity})`,
    confidence: mp.max_similarity || 0.9,
    timestamp: new Date().toISOString(),
    platforms: mp.platforms,
    profile_urls: mp.profile_urls,
    face_count: mp.face_count,
    max_similarity: mp.max_similarity,
    matchType: 'face_cross_match',
  }));

  return {
    tool: 'personMatcher',
    target,
    status: result.timedOut ? 'timeout' : 'ok',
    durationMs: result.durationMs,
    hits: [...profileHits, ...matchedHits],
    raw: {
      images_processed: parsed.images_processed,
      total_faces_detected: parsed.total_faces_detected,
      cross_matches: parsed.cross_matches,
      identity_clusters: parsed.identity_clusters,
      matched_person_count: parsed.matched_person_count,
      face_results: parsed.face_results,
      reference_matches: parsed.reference_matches,
      reference_face: parsed.reference_face,
    },
  };
}

/**
 * Full 14-stage face search pipeline.
 * Calls face_search_pipeline.py which implements:
 *   Query Planner → Multi-Source Collection → Normalization → Image Collection →
 *   Quality Validation → Dedup → Embedding → Clustering → Evidence Aggregation →
 *   Weighting → Scoring → Ranking → Decision Engine → Explainable Output
 *
 * @param {string} name - Person name to search
 * @param {object} [opts]
 * @param {Array<{url:string,platform?:string,handle?:string}>} [opts.profiles] - pre-discovered profiles
 * @param {Array<{url:string,platform?:string,profile_url?:string}>} [opts.images] - extra image URLs
 * @param {string} [opts.reference] - reference image URL for direct comparison
 * @param {number} [opts.threshold=0.9] - face match threshold
 * @param {boolean} [opts.nameSearch=false] - enable live web search for profiles
 * @param {boolean} [opts.quality=true] - enable image quality validation
 * @param {boolean} [opts.dedup=true] - enable near-duplicate removal
 */
export async function runFullPipeline(name, {
  profiles,
  images,
  reference,
  threshold = 0.9,
  nameSearch = false,
  quality = true,
  dedup = true,
} = {}) {
  const MOCK = process.env.OSINT_MOCK === '1';
  if (MOCK) {
    const durationMs = await simulateLatency(5000, 20000);
    const n = profiles?.length || mockHitCount(name, 'faceSearchPipeline', 3);
    const hits = Array.from({ length: n }, (_, i) => ({
      id: `face_${stableHash(`${name}_${i}`)}`,
      tool: 'faceSearchPipeline',
      target: name,
      summary: i === 0
        ? `[MOCK] Face search pipeline — found identity cluster`
        : `[MOCK] Additional candidate #${i + 1}`,
      confidence: 0.95 - (i * 0.08),
      timestamp: new Date().toISOString(),
      platform: ['linkedin', 'instagram', 'github'][i] || 'web',
      matchType: 'identity_candidate',
    }));
    return buildStubResult('faceSearchPipeline', name, hits, durationMs);
  }

  if (!PIPELINE_SCRIPT) {
    return {
      tool: 'faceSearchPipeline',
      target: name,
      status: 'error',
      durationMs: 0,
      hits: [],
      error: 'FACE_SEARCH_PIPELINE_SCRIPT not set. Set it in proxy-server.mjs or .env.',
    };
  }

  const profilesJson = profiles?.length ? JSON.stringify(profiles) : '[]';
  const imagesJson = images?.length ? JSON.stringify(images) : '[]';
  const args = [
    '--name', name,
    '--enhanced', 'true',
    '--profiles', profilesJson,
    '--image-urls', imagesJson,
    '--threshold', String(threshold),
    '--name-search', nameSearch ? 'true' : 'false',
    '--quality', quality ? 'true' : 'false',
    '--dedup', dedup ? 'true' : 'false',
  ];
  if (reference) {
    args.push('--reference', reference);
  }

  const result = await runCommand(PYTHON_BIN, [PIPELINE_SCRIPT, ...args], { timeoutMs: PIPELINE_TIMEOUT_MS });

  if (result.spawnError) {
    return {
      tool: 'faceSearchPipeline',
      target: name,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `Failed to start pipeline: ${result.stderr.slice(0, 300)}`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
    if (parsed.error) {
      return {
        tool: 'faceSearchPipeline',
        target: name,
        status: 'error',
        durationMs: result.durationMs,
        hits: [],
        error: parsed.error,
      };
    }
  } catch {
    return {
      tool: 'faceSearchPipeline',
      target: name,
      status: 'error',
      durationMs: result.durationMs,
      hits: [],
      error: `Pipeline returned invalid JSON. stderr: ${result.stderr.slice(0, 200)}`,
    };
  }

  // Build hits from candidates
  const candidateHits = (parsed.candidates || []).map((c, i) => ({
    id: `candidate_${stableHash(JSON.stringify(c.profile_urls || []))}_${i}`,
    tool: 'faceSearchPipeline',
    target: name,
    summary: `Identity candidate #${c.rank}: ${c.platforms?.join(', ') || 'unknown'} ` +
      `(confidence=${c.confidence}, face_sim=${c.max_similarity})`,
    confidence: c.confidence || 0.5,
    timestamp: new Date().toISOString(),
    rank: c.rank,
    platforms: c.platforms,
    profile_urls: c.profile_urls,
    handles: c.handles,
    face_count: c.face_count,
    max_similarity: c.max_similarity,
    evidence_weight: c.evidence_weight,
    matching_signals: c.matching_signals,
    matchType: 'identity_candidate',
  }));

  return {
    tool: 'faceSearchPipeline',
    target: name,
    status: result.timedOut ? 'timeout' : 'ok',
    durationMs: result.durationMs,
    hits: candidateHits,
    raw: {
      query_plan: parsed.query_plan,
      stages: parsed.stages,
      decision: parsed.decision,
      total_profiles_found: parsed.total_profiles_found,
      total_images_processed: parsed.total_images_processed,
      total_faces_detected: parsed.total_faces_detected,
      identity_clusters: parsed.identity_clusters,
      timing_ms: parsed.timing_ms,
      total_time_ms: parsed.total_time_ms,
      image_results: parsed.image_results,
      candidates: parsed.candidates,
      reference: parsed.reference,
      reference_matches: parsed.reference_matches,
      uncertainty_notes: parsed.uncertainty_notes,
    },
  };
}
