// Keep this test fast, deterministic, and offline: real tool adapters
// (spiderfoot/sherlock/holehe/serp/overpass) check OSINT_MOCK and return
// stub data instead of shelling out / hitting the network when it's set.
process.env.OSINT_MOCK = '1';

import assert from 'node:assert/strict';
import { handle } from '../src/mcpTool.mjs';
import { ALL_LOG_SOURCES } from '../src/logging/logSources.mjs';

function parse(result) {
  assert.ok(!result.isError, `unexpected tool error: ${result.content?.[0]?.text}`);
  return JSON.parse(result.content[0].text);
}

async function testNormalCompletion() {
  console.log('--- testNormalCompletion ---');
  const res = parse(await handle({
    action: 'start',
    query: 'jane.doe@example.com, @janedoe_handle',
    maxRounds: 3,
  }));

  assert.equal(res.status, 'complete', `expected complete, got ${res.status} (${JSON.stringify(res.guidanceRequest)})`);
  assert.ok(res.report, 'expected a final report');
  assert.ok(res.round >= 1 && res.round <= 3, `round out of range: ${res.round}`);
  assert.ok(res.evidenceCount > 0, 'expected some evidence to be collected');
  assert.ok(res.report.evidenceByTool, 'report should break down evidence by tool');

  const statusRes = parse(await handle({ action: 'status', investigationId: res.investigationId }));
  const seenSources = new Set(statusRes.logs.map((l) => l.source));
  for (const source of ALL_LOG_SOURCES) {
    assert.ok(seenSources.has(source), `missing log entries for region: ${source}`);
  }
  console.log(`  ok: status=${res.status} rounds=${res.round} evidence=${res.evidenceCount} hypotheses=${res.hypotheses.length}`);
  console.log(`  ok: all ${ALL_LOG_SOURCES.length} log regions present (${statusRes.logs.length} total entries)`);
}

async function testGuidanceFlow() {
  console.log('--- testGuidanceFlow ---');
  // 5 comma-separated tokens > AMBIGUITY_ENTITY_THRESHOLD (4) on round 1
  const start = parse(await handle({
    action: 'start',
    query: 'alice@example.com, bob@example.com, carol@example.com, dave@example.com, erin@example.com',
    maxRounds: 3,
  }));

  assert.equal(start.status, 'awaiting_guidance', `expected awaiting_guidance, got ${start.status}`);
  assert.ok(start.guidanceRequest, 'expected a guidanceRequest to be set');
  console.log(`  ok: blocked on guidance with ${start.guidanceRequest.candidates.length} candidates`);

  const resumed = parse(await handle({
    action: 'guidance',
    investigationId: start.investigationId,
    guidance: 'Prioritize alice@example.com',
  }));

  assert.ok(['complete', 'awaiting_guidance'].includes(resumed.status), `unexpected status after guidance: ${resumed.status}`);
  console.log(`  ok: resumed, status=${resumed.status}`);
}

async function testGeoAgentRouting() {
  console.log('--- testGeoAgentRouting ---');
  // Regression test for a planner.mjs bug: a "lat,lon" coordinate pair was
  // being shredded into two bare numbers by the comma split in
  // extractEntities() before COORD_RE ever saw the whole token, so it always
  // fell through to ['entity', 'network'] instead of ['geo'] and the Geo
  // agent (Overpass Turbo) was never reachable from a real query.
  const res = parse(await handle({
    action: 'start',
    query: 'jane.doe@example.com, 40.7128,-74.0060',
    maxRounds: 1,
  }));

  const statusRes = parse(await handle({ action: 'status', investigationId: res.investigationId }));
  const geoCalls = statusRes.logs.filter(
    (l) => l.source === 'osint_agent_pool' && l.payload?.agent === 'geo' && l.payload?.tool === 'overpass_turbo'
  );
  assert.ok(geoCalls.length > 0, 'expected a geo agent / overpass_turbo tool call for a "lat,lon" query token');
  console.log(`  ok: coordinate token routed to geo agent (${geoCalls.length} overpass_turbo call(s))`);
}

async function testAbort() {
  console.log('--- testAbort ---');
  const start = parse(await handle({ action: 'start', query: 'target-x', maxRounds: 1 }));
  if (start.status === 'complete') {
    console.log('  (investigation completed before we could abort it - single-round query, expected)');
    return;
  }
  const aborted = parse(await handle({ action: 'abort', investigationId: start.investigationId }));
  assert.equal(aborted.status, 'aborted');
  console.log('  ok: abort transitions to aborted');
}

async function testErrorHandling() {
  console.log('--- testErrorHandling ---');
  const missingQuery = await handle({ action: 'start' });
  assert.ok(missingQuery.isError, 'expected error for missing query');

  const badId = await handle({ action: 'status', investigationId: 'inv_does_not_exist' });
  assert.ok(badId.isError, 'expected error for unknown investigationId');
  console.log('  ok: error paths behave');
}

async function main() {
  await testNormalCompletion();
  await testGuidanceFlow();
  await testGeoAgentRouting();
  await testAbort();
  await testErrorHandling();
  console.log('\nALL SMOKE TESTS PASSED');
}

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exitCode = 1;
});
