#!/usr/bin/env node
/**
 * Regression tests for turn-summary normalization and derived next-actions artifacts.
 * Run: node scripts/orchestration-turn-summary.test.mjs
 * CI: npm run orchestration:test
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildNextActionsArtifact,
  NEXT_ACTIONS_ARTIFACT_RELATIVE_PATH,
} from './orchestration-next-actions.mjs';
import {
  normalizeTurnSummaryPayload,
  recordTurnSummary,
} from './orchestration-supervisor.mjs';

function buildTestManifest() {
  return {
    handoff_graph: [
      {
        from: 'Supervisor',
        to: 'Researcher',
        label: 'Re-open discovery',
        prompt: 'Rebuild the missing repo context, constraints, and ambiguities before execution continues.',
      },
      {
        from: 'Supervisor',
        to: 'Planner',
        label: 'Re-plan execution',
        prompt: 'Use the updated findings and current blocker to refresh the approval-first execution plan and end it with a model recommendation for execution.',
      },
      {
        from: 'Supervisor',
        to: 'Auto-Eval',
        label: 'Route local quality gate',
        prompt: 'Use Auto-Eval when the immediate next step is the dirty-worktree gate, a manual rerun, or deterministic local sign-off.',
      },
      {
        from: 'Supervisor',
        to: 'QA Agent',
        label: 'Request focused verification',
        prompt: 'Turn the implemented scope into a concrete verification checklist or change-focused execution summary before more implementation continues.',
      },
      {
        from: 'Supervisor',
        to: 'debug',
        label: 'Route bug investigation',
        prompt: 'Investigate the bug or failing behavior, reproduce the issue, isolate the root cause, and implement or recommend the narrowest safe fix before another specialist takes over.',
      },
    ],
  };
}

function createTempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestration-next-actions-'));
  fs.mkdirSync(path.join(repoRoot, '.github'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, '.github', 'orchestration.yaml'),
    `${JSON.stringify(buildTestManifest(), null, 2)}\n`,
    'utf8',
  );
  return repoRoot;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

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

const withUtil = normalizeTurnSummaryPayload(
  baseAgentPayload({
    utilization: [
      { task: 'API route', agents: ['Backend Engineer'], skills: ['server-domain-architecture'] },
      { invalid: true },
    ],
  }),
);
assert.equal(withUtil.utilization.length, 1, 'drops invalid utilization rows');
assert.equal(withUtil.utilization[0].task, 'API route', 'preserves utilization task');
assert.deepEqual(withUtil.utilization[0].skills, ['server-domain-architecture'], 'preserves skills');

const sup = normalizeTurnSummaryPayload({
  type: 'supervisor_turn_report',
  turnStatus: 'done',
  done: ['x'],
  nextSteps: { bugFix: [], enhancement: [], validation: [] },
});
assert.equal(sup.agentName, 'Supervisor', 'supervisor report defaults agentName');
assert.equal(sup.turnStatus, 'done', 'supervisor accepts turnStatus done');

const pureArtifact = buildNextActionsArtifact({
  runtimeContext: {
    sessionId: 'session-123',
    changedFiles: [
      'scripts/orchestration-supervisor.mjs',
      'apps/mini-program/src/pages/matching-status/index.tsx',
    ],
    recommendedNextAgents: ['Auto-Eval', 'Supervisor'],
    kickoff: {
      status: 'idle',
      approvalMode: 'plan-first',
      lastReason: 'narrow-or-already-routed',
      recommendationIssued: false,
    },
    upstreamResult: {
      prompt: 'Debug the matching-status failure and then validate the orchestration slice.',
    },
    turnSummaryState: {
      focusWindowTurns: 5,
      lastTurnSequence: 2,
      recentAgentSummaries: {
        'Backend Engineer': [
          {
            summaryId: 'agent-summary-1',
            agentName: 'Backend Engineer',
            turnStatus: 'blocked',
            done: ['Investigated the failing matching-status flow'],
            filesChanged: ['apps/mini-program/src/pages/matching-status/index.tsx'],
            blockers: ['Matched selector timeout is still reproducible'],
            nextSteps: {
              bugFix: ['Fix the matching-status controller'],
              enhancement: [],
              validation: ['Re-run the local gate after the fix'],
            },
          },
        ],
      },
      recentSupervisorReports: [
        {
          summaryId: 'supervisor-report-1',
          turnId: 'session-123:turn:2',
          turnStatus: 'ready',
          keyBullets: ['Orchestration slice still needs validation'],
          filesChanged: ['scripts/orchestration-supervisor.mjs'],
          blockers: [],
          nextSteps: {
            bugFix: [],
            enhancement: ['Complete the orchestration next-actions slice'],
            validation: ['Run the local quality gate'],
          },
        },
      ],
    },
    testOutputs: [
      {
        id: 'matching-status-smoke',
        label: 'matching-status smoke',
        statusLabel: 'failed',
        summary: 'selector timeout on matching-status',
        relatedPaths: ['apps/mini-program/src/pages/matching-status/index.tsx'],
      },
    ],
    memoryContext: {
      summary: 'Repo memory warns about orchestration truthfulness.',
      lifecycle: {
        status: 'caution',
        cautionHitCount: 1,
        staleHitCount: 0,
        conflictHitCount: 0,
        warningHitIds: ['repo.orchestration.runtime-state-truthfulness'],
      },
    },
  },
  manifest: buildTestManifest(),
  generatedAt: '2026-04-20T10:00:00.000Z',
});

assert.equal(pureArtifact.routing.primary[0].agent, 'debug', 'failure evidence elevates debug first');
assert.ok(
  pureArtifact.routing.primary.some((entry) => entry.agent === 'Auto-Eval'),
  'orchestration validation remains visible in routing output',
);
assert.ok(
  !pureArtifact.routing.primary.some((entry) => entry.agent === 'Researcher' || entry.agent === 'Planner'),
  'kickoff lanes stay suppressed for narrow slices with concrete failures',
);
assert.deepEqual(
  pureArtifact.tracks.map((track) => track.trackId),
  ['orchestration', 'mini-program-ui'],
  'artifact clusters orchestration and mini-program work separately',
);
const debugNativeHint = pureArtifact.nativeButtonHints.find((entry) => entry.agent === 'debug');
assert.equal(debugNativeHint?.label, 'Route bug investigation', 'native-button labels come from the handoff graph');

const tempRepo = createTempRepo();
try {
  const persisted = recordTurnSummary(tempRepo, baseAgentPayload({
    turnStatus: 'blocked',
    done: ['Attempted the orchestration next-actions implementation'],
    filesChanged: ['scripts/orchestration-supervisor.mjs'],
    blockers: ['Orchestration validation is still failing locally'],
    nextSteps: {
      bugFix: [],
      enhancement: ['Finish the next-actions scorer'],
      validation: ['Run the local quality gate'],
    },
  }));

  assert.equal(persisted.ok, true, 'record-summary succeeds in a temp repo');

  const contextPath = path.join(tempRepo, '.git', '.orchestration', 'context.json');
  const artifactPath = path.join(tempRepo, NEXT_ACTIONS_ARTIFACT_RELATIVE_PATH);
  assert.equal(fs.existsSync(contextPath), true, 'record-summary writes context.json');
  assert.equal(fs.existsSync(artifactPath), true, 'record-summary writes next-actions.json');

  const persistedContext = readJson(contextPath);
  assert.ok(
    persistedContext.artifactPaths.includes(NEXT_ACTIONS_ARTIFACT_RELATIVE_PATH),
    'runtime context advertises the derived next-actions artifact',
  );
  const compactSummary = persistedContext.turnSummaryState.recentAgentSummaries['Backend Engineer'][0];
  assert.deepEqual(compactSummary.filesChanged, ['scripts/orchestration-supervisor.mjs'], 'compact summaries retain filesChanged');
  assert.deepEqual(compactSummary.blockers, ['Orchestration validation is still failing locally'], 'compact summaries retain blockers');
  assert.deepEqual(compactSummary.nextSteps.validation, ['Run the local quality gate'], 'compact summaries retain nextSteps');

  const emittedArtifact = readJson(artifactPath);
  assert.ok(
    emittedArtifact.recommendedNextAgents.includes('Auto-Eval'),
    'derived artifact keeps a coarse recommended-next-agents list',
  );
  assert.equal(
    emittedArtifact.nativeButtonHints[0]?.label,
    'Route local quality gate',
    'emitted artifact reuses manifest labels for static Supervisor routes',
  );
} finally {
  fs.rmSync(tempRepo, { recursive: true, force: true });
}

console.log('orchestration-turn-summary.test.mjs: ok');
