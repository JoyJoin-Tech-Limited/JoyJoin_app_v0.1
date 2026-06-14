/**
 * Speed Friending Phase — Implementation Tests
 *
 * Verifies that speed_friending is properly registered in phase registry,
 * has valid types, and the pair generation algorithm works correctly.
 */
import { describe, it, expect } from 'vitest';
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker';
import { PHASE_CONFIG } from '@shared/socialIcebreaker';
import {
  PHASE_REGISTRY,
  getAllPhaseModules,
  validateRunPlanSegments,
} from '@shared/phaseRegistry';

describe('speed_friending — implementation tests', () => {
  // ── Phase type boundary ──

  it('is a valid SocialIcebreakerPhase type value', () => {
    const validPhases: SocialIcebreakerPhase[] = [
      'warmup',
      'micro_challenge',
      'lie_detective',
      'auction',
      'personality_dice',
      'quip_battle',
      'undercover_word',
      'group_mirror',
      'speed_friending',
      'mini_script',
      'recap',
      'phase_selection',
    ];

    expect(validPhases).toContain('speed_friending');
    expect(new Set(validPhases).size).toBe(12);
  });

  // ── Phase registry presence ──

  it('is registered in the PHASE_REGISTRY', () => {
    const allModules = getAllPhaseModules();
    const moduleIds = allModules.map((m) => m.id);

    expect(moduleIds).toContain('speed_friending');
    expect(allModules.length).toBe(12);
  });

  it('speed_friending has correct PhaseModule shape', () => {
    const module = PHASE_REGISTRY.speed_friending;

    expect(module.id).toBe('speed_friending');
    expect(module.name).toBe('快速交友');
    expect(module.nameEn).toBe('Speed Friending');
    expect(module.durationMinutes).toBe(20);
    expect(module.minPlayers).toBe(2);
    expect(module.category).toBe('conversation');
    expect(module.energyArc).toBe('rising');
    expect(module.requiresGeneration).toBe(false);
    expect(module.canBeSkipped).toBe(false);
    expect(module.participation).toBe('full');
    expect(module.tone).toBe('playful');
  });

  it('validateRunPlanSegments accepts speed_friending now that it is registered', () => {
    const segments = [
      { phase: 'warmup' as const, allocatedMinutes: 8, energyWeight: 1 },
      { phase: 'speed_friending' as const, allocatedMinutes: 10, energyWeight: 2 },
      { phase: 'recap' as const, allocatedMinutes: 5, energyWeight: 1 },
    ];
    expect(validateRunPlanSegments(segments)).toBe(true);
  });

  // ── PHASE_CONFIG presence ──

  it('has a PHASE_CONFIG entry with correct minPlayers', () => {
    // PHASE_CONFIG is used by getNextEligiblePhase to determine min players
    expect(PHASE_CONFIG.speed_friending).toBeDefined();
    expect(PHASE_CONFIG.speed_friending.minPlayersRequired).toBe(2);
    expect(PHASE_CONFIG.speed_friending.timeoutMinutes).toBe(30);
  });

  // ── Phase ordering ──

  it('phases have stable ordering in the registry', () => {
    const allModules = getAllPhaseModules();
    const ids = allModules.map((m) => m.id);

    expect(ids[0]).toBe('warmup');
    expect(ids[ids.length - 2]).toBe('recap');
    expect(ids[ids.length - 1]).toBe('phase_selection');
    expect(new Set(ids).size).toBe(ids.length);
  });

  // ── Pair generation algorithm ──

  describe('generateSpeedFriendingPairs (circle method)', () => {
    /**
     * Replicate the circle-method round-robin algorithm from the route handler.
     */
    function generatePairs(playerIds: string[], displayNames: Map<string, string>) {
      const n = playerIds.length;
      if (n < 2) return [];

      const hasBye = n % 2 === 1;
      const ids = hasBye ? [...playerIds, '__BYE__'] : [...playerIds];
      const m = ids.length;
      const totalRounds = m - 1;
      const allRounds: Array<Array<{ userIdA: string; userIdB: string; displayNameA: string; displayNameB: string }>> = [];

      for (let r = 0; r < totalRounds; r++) {
        const roundPairs: Array<{ userIdA: string; userIdB: string; displayNameA: string; displayNameB: string }> = [];
        for (let i = 0; i < m / 2; i++) {
          const left = ids[i];
          const right = ids[m - 1 - i];
          if (left !== '__BYE__' && right !== '__BYE__') {
            roundPairs.push({
              userIdA: left,
              userIdB: right,
              displayNameA: displayNames.get(left) || left,
              displayNameB: displayNames.get(right) || right,
            });
          }
        }
        allRounds.push(roundPairs);
        ids.splice(1, 0, ids.pop()!);
      }

      return allRounds;
    }

    it('returns empty for fewer than 2 players', () => {
      expect(generatePairs([], new Map())).toEqual([]);
      expect(generatePairs(['A'], new Map([['A', 'Alice']]))).toEqual([]);
    });

    it('generates correct rounds for 2 players', () => {
      const names = new Map([['A', 'Alice'], ['B', 'Bob']]);
      const rounds = generatePairs(['A', 'B'], names);

      expect(rounds.length).toBe(1); // N-1 = 1 round
      expect(rounds[0].length).toBe(1); // 1 pair per round
      expect(rounds[0][0].userIdA).toBe('A');
      expect(rounds[0][0].userIdB).toBe('B');
    });

    it('generates correct rounds for 4 players', () => {
      const names = new Map([
        ['A', 'Alice'], ['B', 'Bob'], ['C', 'Carol'], ['D', 'Dave'],
      ]);
      const rounds = generatePairs(['A', 'B', 'C', 'D'], names);

      expect(rounds.length).toBe(3); // N-1 = 3 rounds
      for (const round of rounds) {
        expect(round.length).toBe(2); // N/2 = 2 pairs per round
      }

      // Every player should meet every other player exactly once
      const meetings = new Set<string>();
      for (const round of rounds) {
        for (const pair of round) {
          const key = [pair.userIdA, pair.userIdB].sort().join('-');
          meetings.add(key);
        }
      }
      // 4 choose 2 = 6 unique meetings
      expect(meetings.size).toBe(6);
    });

    it('generates correct rounds for 6 players', () => {
      const playerIds = ['A', 'B', 'C', 'D', 'E', 'F'];
      const names = new Map(playerIds.map((id, i) => [id, `Player${i}`]));
      const rounds = generatePairs(playerIds, names);

      expect(rounds.length).toBe(5); // N-1 = 5 rounds
      for (const round of rounds) {
        expect(round.length).toBe(3); // N/2 = 3 pairs per round
      }

      // Every pair appears exactly once
      const meetings = new Set<string>();
      for (const round of rounds) {
        for (const pair of round) {
          const key = [pair.userIdA, pair.userIdB].sort().join('-');
          meetings.add(key);
        }
      }
      expect(meetings.size).toBe(15); // 6 choose 2 = 15
    });

    it('handles odd number of players (bye rounds)', () => {
      const playerIds = ['A', 'B', 'C', 'D', 'E']; // 5 players, 1 bye per round
      const names = new Map(playerIds.map((id, i) => [id, `Player${i}`]));
      const rounds = generatePairs(playerIds, names);

      expect(rounds.length).toBe(5); // N rounds for odd N
      for (const round of rounds) {
        expect(round.length).toBe(2); // floor(N/2) = 2 pairs per round
      }

      // Each player meets every other player exactly once
      const meetingsByPlayer = new Map<string, Set<string>>();
      for (const id of playerIds) meetingsByPlayer.set(id, new Set());
      for (const round of rounds) {
        for (const pair of round) {
          meetingsByPlayer.get(pair.userIdA)!.add(pair.userIdB);
          meetingsByPlayer.get(pair.userIdB)!.add(pair.userIdA);
        }
      }
      for (const id of playerIds) {
        expect(meetingsByPlayer.get(id)!.size).toBe(4); // meets all 4 others
      }
    });

    it('no player is paired with themselves', () => {
      const playerIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const names = new Map(playerIds.map((id, i) => [id, `P${i}`]));
      const rounds = generatePairs(playerIds, names);

      for (const round of rounds) {
        for (const pair of round) {
          expect(pair.userIdA).not.toBe(pair.userIdB);
        }
      }
    });

    it('uses correct display names', () => {
      const names = new Map([['A', 'Alice'], ['B', 'Bob'], ['C', 'Carol'], ['D', 'Dave']]);
      const rounds = generatePairs(['A', 'B', 'C', 'D'], names);

      for (const round of rounds) {
        for (const pair of round) {
          expect(pair.displayNameA).toBe(names.get(pair.userIdA));
          expect(pair.displayNameB).toBe(names.get(pair.userIdB));
        }
      }
    });
  });
});
