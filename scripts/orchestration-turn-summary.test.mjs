#!/usr/bin/env node
/**
 * Regression tests for turn-summary normalization (turnStatus and payload shape).
 * Run: node scripts/orchestration-turn-summary.test.mjs
 * CI: npm run orchestration:test
 */
import assert from 'node:assert/strict';
import { normalizeTurnSummaryPayload } from './orchestration-supervisor.mjs';

function baseAgentPayload(overrides = {}) {
  return {
    type: 'agent_turn_summary',
    agentName: 'Backend Engineer',
    done: [],
    nextSteps: { bugFix: [], enhancement: [], validation: [] },
    ...overrides,
  };
}

assert.throws(
  () => normalizeTurnSummaryPayload(null),
  /must be a JSON object/,
  'rejects null payload',
);

assert.throws(
  () => normalizeTurnSummaryPayload({ type: 'other', agentName: 'X' }),
  /type must be agent_turn_summary or supervisor_turn_report/,
  'rejects unknown type',
);

assert.throws(
  () => normalizeTurnSummaryPayload({ type: 'agent_turn_summary' }),
  /must include agentName/,
  'rejects agent summary without agentName',
);

const ready = normalizeTurnSummaryPayload(
  baseAgentPayload({ turnStatus: 'ready' }),
);
assert.equal(ready.turnStatus, 'ready', 'accepts turnStatus ready');

const blocked = normalizeTurnSummaryPayload(
  baseAgentPayload({ turnStatus: 'BLOCKED' }),
);
assert.equal(blocked.turnStatus, 'blocked', 'normalizes turnStatus case');

const bogus = normalizeTurnSummaryPayload(
  baseAgentPayload({ turnStatus: 'invalid-status' }),
);
assert.equal(bogus.turnStatus, null, 'invalid turnStatus becomes null');

const sup = normalizeTurnSummaryPayload({
  type: 'supervisor_turn_report',
  turnStatus: 'done',
  done: ['x'],
  nextSteps: { bugFix: [], enhancement: [], validation: [] },
});
assert.equal(sup.agentName, 'Supervisor', 'supervisor report defaults agentName');
assert.equal(sup.turnStatus, 'done', 'supervisor accepts turnStatus done');

console.log('orchestration-turn-summary.test.mjs: ok');
