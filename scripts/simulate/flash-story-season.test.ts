import { describe, expect, it } from 'vitest';

import { FLASH_STORY_SEASON_UNITS } from '../../packages/shared/src/alang/flashStorySeason.js';
import {
  DEFAULT_FLASH_SIM_SEED,
  FLASH_SIM_SCENARIOS,
  runFlashStorySimulation,
} from './flash-story-season.js';

const EXPECTED_BRANCH_EVIDENCE = {
  reducer_invalid_transition_noop: {
    operation: 'reducer',
    beforeStage: 'INIT',
    afterStage: 'INIT',
    beforeCompanionEvent: 'INTRO',
    afterCompanionEvent: 'INTRO',
    optionIdPreserved: true,
    labelUpdated: false,
  },
  reducer_first_mistake: {
    operation: 'reducer',
    beforeStage: 'OBJECT_INTERACTION',
    afterStage: 'OBJECT_INTERACTION',
    beforeCompanionEvent: 'INTRO',
    afterCompanionEvent: 'FIRST_MISTAKE',
    optionIdPreserved: true,
    labelUpdated: false,
  },
  restore_interaction_checkpoint: {
    operation: 'restore',
    beforeStage: 'OBJECT_INTERACTION',
    afterStage: 'OBJECT_INTERACTION',
    beforeCompanionEvent: 'INTRO',
    afterCompanionEvent: 'INTRO',
    optionIdPreserved: true,
    labelUpdated: false,
  },
  restore_solved_checkpoint: {
    operation: 'restore',
    beforeStage: 'OBJECT_SUCCESS',
    afterStage: 'OBJECT_SUCCESS',
    beforeCompanionEvent: 'SUCCESS',
    afterCompanionEvent: 'SUCCESS',
    optionIdPreserved: true,
    labelUpdated: false,
  },
  restore_invalid_version_reset: {
    operation: 'restore',
    beforeStage: 'OBJECT_SUCCESS',
    afterStage: 'INIT',
    beforeCompanionEvent: 'SUCCESS',
    afterCompanionEvent: 'INTRO',
    optionIdPreserved: false,
    labelUpdated: false,
  },
  reconcile_reviewed_label: {
    operation: 'reconcile',
    beforeStage: 'OBJECT_SUCCESS',
    afterStage: 'OBJECT_SUCCESS',
    beforeCompanionEvent: 'SUCCESS',
    afterCompanionEvent: 'SUCCESS',
    optionIdPreserved: true,
    labelUpdated: true,
  },
} as const;

describe('flash story season production-client simulator', () => {
  it('drives 100 users through 1,500 reducer/restore journeys without self-reported retry metrics', () => {
    const { summary, traces } = runFlashStorySimulation();

    expect(summary.users).toBe(100);
    expect(summary.attemptedUnits).toBe(1_500);
    expect(summary.completedClientJourneys).toBe(1_500);
    expect(summary.clientDeadEnds).toBe(0);
    expect(summary.payloadIntegrityChecks).toBe(1_500);
    expect(summary.runtimeLlmCallSites).toBe(0);
    expect(summary.seasonReachabilityProxy).toBe(1);
    expect(summary).not.toHaveProperty('retries');
    expect(summary).not.toHaveProperty('faultCoverage');
    expect(summary).not.toHaveProperty('faultMechanisms');
    expect(traces).toHaveLength(1_500);
    expect(traces.every((trace) => trace.terminalStage === 'COMPLETED' && trace.payloadStable)).toBe(true);
    expect(Object.values(summary.scenarioCoverage)).toEqual(FLASH_SIM_SCENARIOS.map(() => 250));
    expect(Object.values(summary.unitCompletion)).toEqual(FLASH_STORY_SEASON_UNITS.map(() => 100));
    for (const unit of FLASH_STORY_SEASON_UNITS) {
      expect(Object.keys(summary.choiceCoverage[unit.unitId])).toHaveLength(2);
      expect(Object.values(summary.choiceCoverage[unit.unitId])).toEqual([50, 50]);
    }
  });

  it('proves every reported scenario reaches one distinct production branch', () => {
    const { summary, traces } = runFlashStorySimulation();
    const evidenceSignatures = new Set(Object.values(EXPECTED_BRANCH_EVIDENCE).map((evidence) => JSON.stringify(evidence)));

    expect(evidenceSignatures.size).toBe(FLASH_SIM_SCENARIOS.length);
    expect(Object.keys(summary.scenarioCoverage)).toEqual([...FLASH_SIM_SCENARIOS]);
    for (const scenario of FLASH_SIM_SCENARIOS) {
      const scenarioTraces = traces.filter((trace) => trace.scenario === scenario);
      expect(scenarioTraces, scenario).toHaveLength(250);
      expect(new Set(scenarioTraces.map((trace) => JSON.stringify(trace.branchEvidence))), scenario)
        .toEqual(new Set([JSON.stringify(EXPECTED_BRANCH_EVIDENCE[scenario])]));
    }
  });

  it('remains deterministic while changing with the seed', () => {
    const first = runFlashStorySimulation(DEFAULT_FLASH_SIM_SEED);
    const repeated = runFlashStorySimulation(DEFAULT_FLASH_SIM_SEED);
    const changed = runFlashStorySimulation('another-seed');

    expect(first.summary.digest).toBe(repeated.summary.digest);
    expect(first.traces).toEqual(repeated.traces);
    expect(changed.summary.digest).not.toBe(first.summary.digest);
  });
});
