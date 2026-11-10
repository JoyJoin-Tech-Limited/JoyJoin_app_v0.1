import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import {
  buildRecapHighlights,
  sanitizeStateForClient,
  toPublicUndercoverWordResult,
} from '../routes/socialIcebreakerHelpers';

/**
 * G0 privacy (2026-11-10) — undercover result at the recap boundary.
 *
 * The role owner's id/display name are server-only. Three independent
 * transports carried them before this change:
 *   1. `state.undercoverWordResults`         (session poll)
 *   2. `state.recapSnapshot.undercoverWordResult` (recap route + session poll)
 *   3. `buildRecapHighlights` output          (recap snapshot writer)
 * Each is asserted below; `caught` (the shared outcome) must survive all three.
 */

const UNDERCOVER_RESULT = {
  undercoverUserId: 'player-undercover',
  undercoverDisplayName: '小明',
  civilianWord: '奶茶',
  undercoverWord: '咖啡',
  voteCounts: { 'player-undercover': 3, 'player-civilian': 1 },
  caught: true,
};

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_recap_privacy',
    icebreakerSessionId: 'icebreaker_recap_privacy',
    currentPhase: 'recap',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 5,
    phaseStartedAt: 1_700_000_000_000,
    sessionStartedAt: 1_699_999_000_000,
    completedPhases: [],
    ...overrides,
  } as SocialSessionState;
}

describe('toPublicUndercoverWordResult', () => {
  it('drops both identity fields and keeps the aggregate outcome', () => {
    const publicResult = toPublicUndercoverWordResult(UNDERCOVER_RESULT);

    expect(publicResult).toEqual({
      civilianWord: '奶茶',
      undercoverWord: '咖啡',
      voteCounts: { 'player-undercover': 3, 'player-civilian': 1 },
      caught: true,
    });
    expect(publicResult).not.toHaveProperty('undercoverUserId');
    expect(publicResult).not.toHaveProperty('undercoverDisplayName');
  });

  it('is a no-op for an already-public shape', () => {
    expect(toPublicUndercoverWordResult({ caught: false })).toEqual({ caught: false });
  });
});

describe('buildRecapHighlights — undercover outcome only', () => {
  it('omits undercoverDisplayName and keeps caught', () => {
    const highlights = buildRecapHighlights(makeState({ undercoverWordResults: UNDERCOVER_RESULT }));

    expect(highlights.undercoverWordResult).toEqual({
      civilianWord: '奶茶',
      undercoverWord: '咖啡',
      voteCounts: { 'player-undercover': 3, 'player-civilian': 1 },
      caught: true,
    });
    expect(JSON.stringify(highlights)).not.toContain('小明');
    // Only the identity FIELD is removed; `voteCounts` is the aggregate tally
    // the table already renders (pre-existing behaviour, keyed by userId).
    expect(JSON.stringify(highlights)).not.toContain('undercoverDisplayName');
    expect(JSON.stringify(highlights)).not.toContain('undercoverUserId');
  });

  it('still records a non-catch (caught: false) without a name', () => {
    const highlights = buildRecapHighlights(
      makeState({ undercoverWordResults: { ...UNDERCOVER_RESULT, caught: false } }),
    );

    expect(highlights.undercoverWordResult?.caught).toBe(false);
    expect(highlights.undercoverWordResult).not.toHaveProperty('undercoverDisplayName');
  });
});

describe('sanitizeStateForClient — recap snapshot projection', () => {
  it('strips the identity from recapSnapshot.undercoverWordResult', () => {
    const sanitized = sanitizeStateForClient(
      makeState({
        recapSnapshot: {
          recapSummary: { headline: '今晚很好' } as never,
          undercoverWordResult: UNDERCOVER_RESULT,
        },
      }),
      'player-civilian',
    );

    expect(sanitized.recapSnapshot?.undercoverWordResult).toEqual({
      civilianWord: '奶茶',
      undercoverWord: '咖啡',
      voteCounts: { 'player-undercover': 3, 'player-civilian': 1 },
      caught: true,
    });
    expect(JSON.stringify(sanitized.recapSnapshot)).not.toContain('小明');
    expect(JSON.stringify(sanitized.recapSnapshot)).not.toContain('undercoverDisplayName');
    expect(JSON.stringify(sanitized.recapSnapshot)).not.toContain('undercoverUserId');
  });

  it('strips the identity from recapSnapshot for the role owner too', () => {
    const sanitized = sanitizeStateForClient(
      makeState({
        recapSnapshot: { undercoverWordResult: UNDERCOVER_RESULT },
      }),
      'player-undercover',
    );

    expect(sanitized.recapSnapshot?.undercoverWordResult).not.toHaveProperty('undercoverUserId');
    expect(sanitized.recapSnapshot?.undercoverWordResult).not.toHaveProperty('undercoverDisplayName');
  });

  it('leaves a snapshot without the block untouched', () => {
    const sanitized = sanitizeStateForClient(
      makeState({ recapSnapshot: { recapSummary: { headline: '今晚很好' } as never } }),
      'player-civilian',
    );

    expect(sanitized.recapSnapshot?.undercoverWordResult).toBeUndefined();
  });
});

describe('recapData.undercoverWord wiring (source guard)', () => {
  const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
  const HELPERS = readFileSync(
    path.resolve(TEST_DIR, '../routes/socialIcebreakerHelpers.ts'),
    'utf8',
  );

  it('writes the outcome-only shape at the pre-cleanup choke point', () => {
    const start = HELPERS.indexOf("if (currentPhase === 'undercover_word'");
    expect(start).toBeGreaterThanOrEqual(0);
    const block = HELPERS.slice(start, HELPERS.indexOf('if (targetPhase ===', start));

    expect(block).toContain('preCleanupState.recapData.undercoverWord = { caught: undercoverCaughtOutcome };');
    expect(block).not.toContain('undercoverDisplayName');
    // Captured BEFORE cleanup wipes the phase state.
    const captureIndex = HELPERS.indexOf(
      'const undercoverCaughtOutcome = preCleanupState.undercoverWordResults?.caught;',
    );
    const cleanupIndex = HELPERS.indexOf('cleanupPhaseStateForNextPhase(state, currentPhase);');
    expect(captureIndex).toBeGreaterThanOrEqual(0);
    expect(captureIndex).toBeLessThan(cleanupIndex);
  });
});
