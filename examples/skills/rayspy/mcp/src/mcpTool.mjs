import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createSession, getSession, withLock } from './session/sessionStore.mjs';
import { assertTransition, isTerminal } from './session/stateMachine.mjs';
import { runUntilBlocked, resumeWithGuidance } from './pipeline/investigationPipeline.mjs';
import { log } from './logging/logger.mjs';
import { LogSource } from './logging/logSources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_MAX_ROUNDS = 4;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const PYTHON_BIN = process.env.INSIGHTFACE_PYTHON || process.env.SPIDERFOOT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const SCRIPTS_DIR = path.resolve(__dirname, '..', '..', 'scripts');
const PIPELINE_TIMEOUT_MS = Number(process.env.FACE_SEARCH_PIPELINE_TIMEOUT_MS || 300_000);

// Track background pipeline jobs so the status action can check completion
const backgroundJobs = new Map();

export const TOOL_NAME = 'rays_investigate';

export const inputSchema = {
  action: z.enum(['start', 'guidance', 'status', 'abort', 'person_search', 'face_search']).describe(
    'start: begin a new investigation. guidance: answer a pending question and resume. ' +
    'status: read the current session state + logs. abort: cancel a running investigation. ' +
    'person_search: search social media by name and cross-match faces. ' +
    'face_search: run the full 14-stage face identity resolution pipeline.'
  ),
  query: z.string().optional().describe('Free-text investigation target(s). Required for action=start.'),
  investigationId: z.string().optional().describe('Required for guidance/status/abort.'),
  guidance: z.string().optional().describe('Required for action=guidance - answers the pending guidanceRequest.'),
  maxRounds: z.number().int().min(1).max(10).optional().describe(`Defaults to ${DEFAULT_MAX_ROUNDS}.`),
  timeoutMs: z.number().int().min(1000).optional().describe(`Defaults to ${DEFAULT_TIMEOUT_MS}.`),
  name: z.string().optional().describe('Person name to search (required for person_search and face_search).'),
  referenceImage: z.string().optional().describe('URL of a reference face image for direct comparison (optional).'),
  matchThreshold: z.number().min(0).max(1).optional().describe('Face match threshold (default 0.9).'),
  nameSearch: z.boolean().optional().describe('Enable live web search for profiles (face_search only, default false).'),
  quality: z.boolean().optional().describe('Enable image quality validation (face_search only, default true).'),
  dedup: z.boolean().optional().describe('Enable near-duplicate removal (face_search only, default true).'),
};

export const description =
  'Runs (or resumes) a multi-agent OSINT investigation. Single action-routed tool: ' +
  'start a new investigation, supply guidance to an investigation that is awaiting_guidance, ' +
  'check status/logs, or abort. The pipeline runs rounds automatically until it completes, ' +
  'aborts, or needs guidance - the host agent never has to step rounds manually.';

function summarize(session) {
  return {
    investigationId: session.id,
    targetName: session.targetName,
    status: session.status,
    round: session.round,
    maxRounds: session.maxRounds,
    guidanceRequest: session.guidanceRequest,
    abortReason: session.abortReason,
    entities: session.entities,
    evidenceCount: session.evidence.length,
    claimCount: session.claims.length,
    hypotheses: session.hypotheses,
    report: session.report,
    verification: session.verification,
  };
}

function toolResult(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function toolError(message) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: message }, null, 2) }] };
}

export async function handle(args) {
  const { action } = args;
  try {
    if (action === 'start') return await handleStart(args);
    if (action === 'guidance') return await handleGuidance(args);
    if (action === 'status') return handleStatus(args);
    if (action === 'abort') return handleAbort(args);
    if (action === 'person_search') return await handlePersonSearch(args);
    if (action === 'face_search') return await handleFaceSearch(args);
    return toolError(`Unknown action: ${action}`);
  } catch (err) {
    return toolError(err.message ?? String(err));
  }
}

async function handleStart(args) {
  if (!args.query) return toolError('action=start requires `query`.');

  const session = createSession({
    query: args.query,
    maxRounds: args.maxRounds ?? DEFAULT_MAX_ROUNDS,
    timeoutMs: args.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
  log(session, LogSource.HOST_BOUNDARY, 'query_received', { query: args.query });

  // Run the Python face_search_pipeline in background so the HTTP
  // /rayspy-mcp/start endpoint returns immediately with the session.
  // The dashboard polls /rayspy-mcp/status to see progress.
  runPipelineInBackground(session, args);

  return toolResult(summarize(session));
}

async function runPipelineInBackground(session, args) {
  backgroundJobs.set(session.id, true);
  try {
    const query = (args.query || '').trim();
    const targetName = query.toLowerCase().replace(/\s+/g, '_');
    const invScript = path.resolve(SCRIPTS_DIR, '..', 'run_investigation.py');

    log(session, LogSource.HOST_BOUNDARY, 'pipeline_start', {
      pipeline: 'osint_investigation',
      query,
      script: invScript,
    });

    if (!fs.existsSync(invScript)) {
      throw new Error(`Investigation script not found: ${invScript}`);
    }

    // Spawn run_investigation.py <targetName> <optional: --ref referenceImage>
    const spawnArgs = [invScript, query];
    if (args.referenceImage) {
      spawnArgs.push('--ref', args.referenceImage);
    }

    const child = spawn(PYTHON_BIN, spawnArgs, {
      cwd: SCRIPTS_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    let stdoutAccum = '';
    let stderrAccum = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdoutAccum += text;
      for (const line of text.split('\n').filter(Boolean)) {
        session.logs.push({
          ts: new Date().toISOString(),
          round: null,
          source: LogSource.OSINT_AGENT_POOL,
          event: 'pipeline_output',
          payload: { line },
          paragraph: line,
        });
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrAccum += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
      child.on('error', (err) => {
        stderrAccum += `Spawn error: ${err.message}\n`;
        resolve(-1);
      });
    });

    if (exitCode !== 0) {
      throw new Error(`Pipeline exited with code ${exitCode}. stderr: ${stderrAccum.slice(0, 500)}`);
    }

    // Read the saved JSON result
    const workspaceDir = path.resolve(SCRIPTS_DIR, '..', `workspace_${targetName}`);
    const jsonPath = path.resolve(workspaceDir, 'report.json');
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`Pipeline result not found at ${jsonPath}. stdout (last 500 chars): ${stdoutAccum.slice(-500)}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    } catch (err) {
      throw new Error(`Failed to parse pipeline result: ${err.message}`);
    }

    // Store full result
    session.pipelineResult = parsed;

    // Read the TXT report
    const reportPath = path.resolve(SCRIPTS_DIR, '..', `${targetName}_investigation_report.txt`);
    if (fs.existsSync(reportPath)) {
      session.report = fs.readFileSync(reportPath, 'utf-8');
    }

    // Extract fields for entity/hypothesis display (supporting both V3 and V4 schemas)
    const pipelineResult = parsed.pipeline_result || parsed || {};
    const disc = pipelineResult.identity_discovery || {};
    const decision = pipelineResult.decision || {};
    // Only use identity_candidates to avoid spamming UI with hundreds of raw leads in V4
    const candidates = disc.identity_candidates || [];

    const evSum = pipelineResult.evidence_summary || parsed.evidence_chain || {};

    log(session, LogSource.EVIDENCE_GRAPH, 'discovery_complete', {
      leads: evSum.leads ?? 0,
      validated: evSum.validated ?? evSum.profile_validated ?? 0,
      platforms: (disc.platforms || []).join(', '),
      cross_verification_cycles: disc.cross_verification_cycles,
      converged: disc.converged,
    });

    for (const c of candidates) {
      const candidateName = c.name || c.name_hypothesis || c.handles?.[0] || 'unknown';
      const cPlatforms = c.platforms || (c.linked_profiles || []).map(p => p.platform);
      
      session.entities.push({
        id: `entity_${c.candidate_id || Date.now()}`,
        target: candidateName,
        types: ['person', 'identity_candidate'],
        discoveredRound: 1,
        confidence: c.confidence,
      });
      session.hypotheses.push({
        id: `hyp_${c.candidate_id || Date.now()}`,
        label: candidateName,
        confidence: c.confidence,
        confidence_label: c.confidence_label,
        platforms: cPlatforms,
        face_verified: c.face_verified || (c.face_verification_status === 'VERIFIED'),
      });
      log(session, LogSource.FINAL_STAGE, 'identity_candidate', {
        name: candidateName,
        confidence: c.confidence,
        confidence_label: c.confidence_label,
        platforms: cPlatforms.join(', '),
      });
    }

    if (decision.explanation) {
      log(session, LogSource.FINAL_STAGE, 'decision', {
        verdict: decision.verdict,
        explanation: decision.explanation,
      });
    }

    assertTransition(session, 'complete', { reason: 'pipeline_finished' });
  } catch (err) {
    session.abortReason = err.message;
    try { assertTransition(session, 'aborted', { reason: err.message }); } catch { session.status = 'aborted'; }
    log(session, LogSource.HOST_BOUNDARY, 'pipeline_error', { error: err.message });
  } finally {
    backgroundJobs.delete(session.id);
  }
}

async function handleGuidance(args) {
  if (!args.investigationId) return toolError('action=guidance requires `investigationId`.');
  if (!args.guidance) return toolError('action=guidance requires `guidance`.');

  const session = getSession(args.investigationId);
  if (!session) return toolError(`No such investigation: ${args.investigationId}`);
  if (isTerminal(session.status)) {
    return toolError(`Investigation ${args.investigationId} is already ${session.status}.`);
  }
  if (session.status !== 'awaiting_guidance') {
    return toolError(`Investigation ${args.investigationId} is not awaiting guidance (status=${session.status}).`);
  }

  await withLock(session.id, async (s) => {
    resumeWithGuidance(s, args.guidance);
    await runUntilBlocked(s);
  });
  return toolResult(summarize(session));
}

function handleStatus(args) {
  if (!args.investigationId) return toolError('action=status requires `investigationId`.');
  const session = getSession(args.investigationId);
  if (!session) return toolError(`No such investigation: ${args.investigationId}`);
  return toolResult({
    ...summarize(session),
    logs: session.logs,
    pipelineResult: session.pipelineResult || null,
  });
}

function handleAbort(args) {
  if (!args.investigationId) return toolError('action=abort requires `investigationId`.');
  const session = getSession(args.investigationId);
  if (!session) return toolError(`No such investigation: ${args.investigationId}`);
  if (isTerminal(session.status)) {
    return toolError(`Investigation ${args.investigationId} is already ${session.status}.`);
  }
  session.abortReason = 'user_abort';
  assertTransition(session, 'aborted', { reason: 'user_abort' });
  return toolResult(summarize(session));
}

async function handlePersonSearch(args) {
  const name = args.name || args.query;
  if (!name) return toolError('action=person_search requires `name` or `query`.');

  const startTime = Date.now();
  const refImage = args.referenceImage;

  // --- Step 1: Search for social media profiles ---
  const { runSocialAgent } = await import('./agents/socialAgent.mjs');
  const mockSession = {
    id: `person_search_${Date.now()}`,
    logs: [],
    evidence: [],
    entities: [{ target: name, types: ['social'], discoveredRound: 1 }],
  };
  const mockTask = {
    id: `task_person_${Date.now()}`,
    type: 'social',
    target: name,
  };

  const hits = await runSocialAgent(mockSession, mockTask);
  const profilesHits = (hits || []).filter((h) => h.matchType === 'profile');
  const faceMatchHits = (hits || []).filter((h) => h.matchType === 'face_cross_match');

  // --- Step 2: If a reference image was provided, run face analysis ---
  let referenceResult = null;
  if (refImage) {
    const { run: runMatcher } = await import('./tools/personMatcher.mjs');
    const startRef = Date.now();
    const refMatches = await runMatcher(name, {
      images: [],
      reference: refImage,
      threshold: args.matchThreshold ?? 0.9,
    });
    const refDuration = Date.now() - startRef;
    if (refMatches.status === 'ok' && refMatches.raw) {
      referenceResult = { ...refMatches.raw, _durationMs: refDuration };
    } else {
      referenceResult = { _error: refMatches.error || 'unknown', _status: refMatches.status, _durationMs: refDuration };
    }
  }

  // --- Step 3: Build output ---
  const result = {
    status: 'ok',
    name,
    durationMs: Date.now() - startTime,
    profiles_found: profilesHits.length,
    matched_persons: faceMatchHits.length,
    profiles: profilesHits.map((p) => ({
      platform: p.platform,
      profile_url: p.profile_url,
      image_url: p.image_url,
      face_detected: p.face_detected,
      gender: p.gender,
      age: p.age,
    })),
    face_matches: faceMatchHits.map((m) => ({
      platforms: m.platforms,
      profile_urls: m.profile_urls,
      face_count: m.face_count,
      max_similarity: m.max_similarity,
    })),
  };

  // Add reference image analysis if available
  if (referenceResult) {
    result.reference_analysis = {
      status: referenceResult._error ? `error: ${referenceResult._error}` : 'ok',
      durationMs: referenceResult._durationMs,
      images_processed: referenceResult.images_processed,
      total_faces_detected: referenceResult.total_faces_detected,
      face_detected: referenceResult.face_results?.[0]?.face_detected || false,
      face_results: referenceResult.face_results,
      reference_matches: referenceResult.reference_matches,
      matched_persons: referenceResult.matched_persons,
    };
  }

  if (profilesHits.length === 0 && faceMatchHits.length === 0) {
    if (!refImage) {
      result.note = 'No profiles found. Web search may be unavailable from this network. ' +
        'Try providing profile URLs or a reference image.';
    } else if (referenceResult?.total_faces_detected === 0) {
      result.note = 'Reference image provided but no face detected. ' +
        'Try a clear frontal portrait photo.';
    } else {
      result.note = 'Reference face analyzed but no matching profiles found. ' +
        'Provide profile image URLs to cross-match against the reference.';
    }
  }

  return toolResult(result);
}

async function handleFaceSearch(args) {
  const name = args.name || args.query;
  if (!name) return toolError('action=face_search requires `name` or `query`.');

  const startTime = Date.now();
  const { runFullPipeline } = await import('./tools/personMatcher.mjs');

  const result = await runFullPipeline(name, {
    reference: args.referenceImage,
    threshold: args.matchThreshold ?? 0.9,
    nameSearch: args.nameSearch ?? false,
    quality: args.quality ?? true,
    dedup: args.dedup ?? true,
  });

  if (result.status === 'error') {
    return toolResult({
      status: 'error',
      name,
      durationMs: Date.now() - startTime,
      error: result.error,
    });
  }

  const raw = result.raw || {};

  return toolResult({
    status: 'ok',
    name,
    durationMs: Date.now() - startTime,
    pipeline_time_ms: raw.total_time_ms,

    // Decision summary
    verdict: raw.decision?.verdict,
    decision_explanation: raw.decision?.explanation,
    uncertainty_notes: raw.uncertainty_notes,

    // Profile discovery
    total_profiles_found: raw.total_profiles_found,
    profiles_per_platform: raw.stages?.['2_collection']?.platforms,

    // Image processing summary
    total_images_processed: raw.total_images_processed,
    images_accepted: raw.stages?.['5_quality_validation']?.accepted,
    images_rejected: raw.stages?.['5_quality_validation']?.rejected,
    rejection_reasons: raw.stages?.['5_quality_validation']?.rejection_reasons,

    // Face analysis
    total_faces_detected: raw.total_faces_detected,
    identity_clusters: raw.identity_clusters,

    // Reference image (if provided)
    reference: raw.reference,
    reference_matches: raw.reference_matches,

    // Detailed image results
    image_results: raw.image_results?.map((img) => ({
      image_url: img.image_url,
      platform: img.platform,
      profile_url: img.profile_url,
      accepted: img.accepted,
      rejection_reason: img.rejection_reason,
      face_detected: img.face_detected,
      gender: img.gender,
      age: img.age,
      det_score: img.det_score,
      resolution: img.resolution,
      blurry: img.blurry,
    })) || [],

    // Ranked identity candidates
    candidates: raw.candidates?.map((c) => ({
      rank: c.rank,
      confidence: c.confidence,
      face_score: c.face_score,
      evidence_weight: c.evidence_weight,
      max_similarity: c.max_similarity,
      platforms: c.platforms,
      profile_urls: c.profile_urls,
      handles: c.handles,
      matching_signals: c.matching_signals,
      cross_site_references: c.evidence?.cross_site_references,
    })) || [],

    // Stage-by-stage breakdown
    stage_timings_ms: raw.timing_ms,
    stages_summary: raw.stages,
  });
}
