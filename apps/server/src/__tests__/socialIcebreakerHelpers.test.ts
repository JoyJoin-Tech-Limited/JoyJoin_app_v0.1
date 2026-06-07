import { describe, expect, it } from 'vitest';
import type { SocialSessionState, SpeedFriendingRound } from '@shared/socialIcebreaker';

function sanitizeStateForClient(state: SocialSessionState, _userId?: string): SocialSessionState {
  const sanitized = { ...state };
  delete (sanitized as any).xiaoyueAdaptiveSuggestion;
  delete (sanitized as any).xiaoyueSessionPackMeta;
  if (sanitized.participants) {
    sanitized.participants = sanitized.participants.map((p: any) => {
      const { profile, ...rest } = p;
      return profile ? rest : p;
    });
  }
  return sanitized;
}

function getUniqueUserCount(userIds?: string[]): number {
  return new Set(userIds || []).size;
}

function hasAllRosterParticipantsResponded(userIds: string[] | undefined, playerCount: number): boolean {
  return getUniqueUserCount(userIds) >= playerCount;
}

function generateSpeedFriendingPairs(
  playerIds: string[],
  displayNames: Map<string, string>,
): SpeedFriendingRound[] {
  const n = playerIds.length;
  if (n < 2) return [];

  const rounds: SpeedFriendingRound[] = [];
  const ids = [...playerIds];
  if (n % 2 === 1) ids.push('BYE');

  const totalRounds = ids.length - 1;
  const half = ids.length / 2;

  for (let round = 0; round < totalRounds; round++) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < half; i++) {
      const a = ids[i];
      const b = ids[ids.length - 1 - i];
      if (a !== 'BYE' && b !== 'BYE') {
        pairs.push([a, b]);
      }
    }
    rounds.push({
      round,
      pairs: pairs.map(([id1, id2]) => ({
        player1Id: id1,
        player2Id: id2,
        player1Name: displayNames.get(id1) ?? id1,
        player2Name: displayNames.get(id2) ?? id2,
      })),
    });
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

function recapDisplayNameByUserId(
  roster: Array<{ userId: string; displayName: string }>,
  state: SocialSessionState,
  userId: string,
): string {
  const rosterEntry = roster.find((r) => r.userId === userId);
  if (rosterEntry) return rosterEntry.displayName;
  if (state.hostUserId === userId) return state.hostDisplayName || 'Host';
  if (state.lieDetectivePlayers) {
    const ld = state.lieDetectivePlayers.find((p) => p.userId === userId);
    if (ld) return ld.displayName;
  }
  return '某位参与者';
}

function incrementCommonGround(state: SocialSessionState): void {
  state.commonGroundCount = Math.max(0, (state.commonGroundCount || 0)) + 1;
}

function buildRecapParticipants(
  roster: Array<{ userId: string; displayName: string }>,
  state: SocialSessionState,
): Array<{ displayName: string }> {
  if (roster.length > 0) {
    return roster.map((r) => ({ displayName: r.displayName }));
  }
  if (state.hostUserId && state.hostDisplayName) {
    return [{ displayName: state.hostDisplayName }];
  }
  if (state.lieDetectivePlayers && state.lieDetectivePlayers.length > 0) {
    return state.lieDetectivePlayers.map((p) => ({ displayName: p.displayName }));
  }
  return [{ displayName: '参与者' }];
}

function buildLieDetectiveRecapHighlights(
  _state: SocialSessionState,
  _roster: Array<{ userId: string; displayName: string }>,
  sessionLieMap: Map<string, Array<{ index: number; text: string; isLie: boolean }>>,
): string[] {
  const highlights: string[] = [];
  for (const [_userId, statements] of sessionLieMap.entries()) {
    const lies = statements.filter((s) => s.isLie);
    for (const lie of lies) {
      if (highlights.length >= 8) break;
      highlights.push(`"${lie.text}"`);
    }
    if (highlights.length >= 8) break;
  }
  return highlights;
}

describe('socialIcebreakerHelpers', () => {
  describe('sanitizeStateForClient', () => {
    it('removes xiaoyueAdaptiveSuggestion and xiaoyueSessionPackMeta', () => {
      const state: any = {
        socialSessionId: 'social_test',
        currentPhase: 'warmup',
        xiaoyueAdaptiveSuggestion: { type: 'boost_mood' },
        xiaoyueSessionPackMeta: { version: 1 },
      };
      const result = sanitizeStateForClient(state as SocialSessionState);
      expect((result as any).xiaoyueAdaptiveSuggestion).toBeUndefined();
      expect((result as any).xiaoyueSessionPackMeta).toBeUndefined();
    });

    it('strips profile from participants', () => {
      const state: any = {
        socialSessionId: 'social_test',
        currentPhase: 'warmup',
        participants: [
          { userId: 'u1', profile: { age: 25 } },
          { userId: 'u2' },
        ],
      };
      const result = sanitizeStateForClient(state as SocialSessionState);
      expect(result.participants?.[0]).not.toHaveProperty('profile');
      expect(result.participants?.[1]).not.toHaveProperty('profile');
    });

    it('preserves all other fields', () => {
      const state: any = {
        socialSessionId: 'social_test',
        currentPhase: 'warmup',
        warmupTopics: [{ id: 't1', text: 'Hello' }],
        playerCount: 4,
      };
      const result = sanitizeStateForClient(state as SocialSessionState);
      expect(result.socialSessionId).toBe('social_test');
      expect(result.currentPhase).toBe('warmup');
      expect(result.warmupTopics).toHaveLength(1);
    });
  });

  describe('getUniqueUserCount', () => {
    it('returns 0 for undefined', () => {
      expect(getUniqueUserCount(undefined)).toBe(0);
    });

    it('returns unique count for duplicate ids', () => {
      expect(getUniqueUserCount(['a', 'b', 'a', 'c'])).toBe(3);
    });

    it('returns 0 for empty array', () => {
      expect(getUniqueUserCount([])).toBe(0);
    });
  });

  describe('hasAllRosterParticipantsResponded', () => {
    it('returns true when unique count >= playerCount', () => {
      expect(hasAllRosterParticipantsResponded(['a', 'b', 'c'], 3)).toBe(true);
    });

    it('returns false when unique count < playerCount', () => {
      expect(hasAllRosterParticipantsResponded(['a', 'b'], 3)).toBe(false);
    });

    it('returns false for undefined userIds', () => {
      expect(hasAllRosterParticipantsResponded(undefined, 3)).toBe(false);
    });
  });

  describe('generateSpeedFriendingPairs', () => {
    it('generates correct number of rounds for even players', () => {
      const names = new Map([['u1', 'Alice'], ['u2', 'Bob'], ['u3', 'Charlie'], ['u4', 'Diana']]);
      const rounds = generateSpeedFriendingPairs(['u1', 'u2', 'u3', 'u4'], names);
      expect(rounds).toHaveLength(3);
      for (const round of rounds) {
        expect(round.pairs).toHaveLength(2);
        for (const pair of round.pairs) {
          expect(pair.player1Id).not.toBe(pair.player2Id);
        }
      }
    });

    it('handles odd player count with BYE', () => {
      const names = new Map([['u1', 'Alice'], ['u2', 'Bob'], ['u3', 'Charlie']]);
      const rounds = generateSpeedFriendingPairs(['u1', 'u2', 'u3'], names);
      expect(rounds).toHaveLength(3);
      for (const round of rounds) {
        expect(round.pairs.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('returns empty for less than 2 players', () => {
      expect(generateSpeedFriendingPairs(['u1'], new Map())).toHaveLength(0);
      expect(generateSpeedFriendingPairs([], new Map())).toHaveLength(0);
    });
  });

  describe('recapDisplayNameByUserId', () => {
    const roster = [
      { userId: 'u1', displayName: 'Alice' },
      { userId: 'u2', displayName: 'Bob' },
    ];

    it('returns roster display name when found', () => {
      const state = { hostUserId: 'host' } as SocialSessionState;
      expect(recapDisplayNameByUserId(roster, state, 'u1')).toBe('Alice');
    });

    it('falls back to host display name', () => {
      const state = { hostUserId: 'host', hostDisplayName: 'HostUser' } as SocialSessionState;
      expect(recapDisplayNameByUserId([], state, 'host')).toBe('HostUser');
    });

    it('falls back to lie detective player name', () => {
      const state = {
        lieDetectivePlayers: [{ userId: 'ld1', displayName: 'Detective' }],
      } as SocialSessionState;
      expect(recapDisplayNameByUserId([], state, 'ld1')).toBe('Detective');
    });

    it('returns fallback when not found anywhere', () => {
      expect(recapDisplayNameByUserId([], {} as SocialSessionState, 'unknown')).toBe('某位参与者');
    });
  });

  describe('incrementCommonGround', () => {
    it('increments from existing value', () => {
      const state = { commonGroundCount: 3 } as SocialSessionState;
      incrementCommonGround(state);
      expect(state.commonGroundCount).toBe(4);
    });

    it('handles undefined starting value', () => {
      const state = {} as SocialSessionState;
      incrementCommonGround(state);
      expect(state.commonGroundCount).toBe(1);
    });

    it('handles zero starting value', () => {
      const state = { commonGroundCount: 0 } as SocialSessionState;
      incrementCommonGround(state);
      expect(state.commonGroundCount).toBe(1);
    });
  });

  describe('buildRecapParticipants', () => {
    it('uses roster when available', () => {
      const roster = [{ userId: 'u1', displayName: 'Alice' }];
      const result = buildRecapParticipants(roster, {} as SocialSessionState);
      expect(result).toEqual([{ displayName: 'Alice' }]);
    });

    it('falls back to host', () => {
      const state = { hostUserId: 'host', hostDisplayName: 'HostUser' } as SocialSessionState;
      const result = buildRecapParticipants([], state);
      expect(result).toEqual([{ displayName: 'HostUser' }]);
    });

    it('falls back to lie detective players', () => {
      const state = {
        lieDetectivePlayers: [{ userId: 'ld1', displayName: 'Detective' }],
      } as SocialSessionState;
      const result = buildRecapParticipants([], state);
      expect(result).toEqual([{ displayName: 'Detective' }]);
    });

    it('returns default when nothing available', () => {
      const result = buildRecapParticipants([], {} as SocialSessionState);
      expect(result).toEqual([{ displayName: '参与者' }]);
    });
  });

  describe('buildLieDetectiveRecapHighlights', () => {
    it('builds highlights from lies in session map', () => {
      const lieMap = new Map([
        ['u1', [
          { index: 0, text: 'I speak 5 languages', isLie: true },
          { index: 1, text: 'I like coffee', isLie: false },
        ]],
      ]);
      const highlights = buildLieDetectiveRecapHighlights({} as SocialSessionState, [], lieMap);
      expect(highlights).toContain('"I speak 5 languages"');
      expect(highlights).not.toContain('"I like coffee"');
    });

    it('limits to 8 highlights', () => {
      const lieMap = new Map<string, Array<{ index: number; text: string; isLie: boolean }>>();
      for (let i = 0; i < 10; i++) {
        lieMap.set(`u${i}`, [{ index: 0, text: `Lie ${i}`, isLie: true }]);
      }
      const highlights = buildLieDetectiveRecapHighlights({} as SocialSessionState, [], lieMap);
      expect(highlights.length).toBeLessThanOrEqual(8);
    });
  });
});
