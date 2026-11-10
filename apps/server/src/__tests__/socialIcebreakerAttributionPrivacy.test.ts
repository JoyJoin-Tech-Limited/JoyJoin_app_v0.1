import { describe, expect, it } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { sanitizeStateForClient } from '../routes/socialIcebreakerHelpers';
import {
  resolveQuipAnswerIdentity,
  resolveQuipAuthorUserId,
} from '../lib/quipAnswerIdentity';

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_attribution_test',
    icebreakerSessionId: 'icebreaker_attribution_test',
    currentPhase: 'lie_detective',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: 1_700_000_000_000,
    sessionStartedAt: 1_699_999_000_000,
    completedPhases: [],
    ...overrides,
  } as SocialSessionState;
}

describe('G0 attribution privacy — sanitizeStateForClient', () => {
  describe('lie detective ballots', () => {
    const votes = [
      { voterId: 'p1', targetUserId: 'p2', guessedStatementIndex: 2 },
      { voterId: 'p3', targetUserId: 'p2', guessedStatementIndex: 1 },
    ];

    it('keeps only the requester ballot before reveal', () => {
      const sanitized = sanitizeStateForClient(makeState({ votes }), 'p1');

      expect(sanitized.votes?.[0]).toEqual({
        voterId: 'p1',
        targetUserId: 'p2',
        guessedStatementIndex: 2,
      });
      expect(sanitized.votes?.[1]).toEqual({
        voterId: '',
        targetUserId: 'p2',
        guessedStatementIndex: -1,
      });
    });

    it('does not leak any voter identity to an anonymous projection', () => {
      const sanitized = sanitizeStateForClient(makeState({ votes }));

      expect(sanitized.votes?.every((vote) => vote.voterId === '')).toBe(true);
      expect(sanitized.votes?.every((vote) => vote.guessedStatementIndex === -1)).toBe(true);
      expect(sanitized.votes?.map((vote) => vote.targetUserId)).toEqual(['p2', 'p2']);
    });

    it('restores full ballots once the phase reveal exists', () => {
      const sanitized = sanitizeStateForClient(
        makeState({
          votes,
          currentLieDetectiveReveal: {
            targetUserId: 'p2',
            lieIndex: 2,
            voteCount: 2,
            correctVoteCount: 1,
            revealedAt: 1_700_000_100_000,
          },
        }),
        'p1',
      );

      expect(sanitized.votes).toEqual(votes);
    });
  });

  describe('group mirror answers', () => {
    const answers = [
      { userId: 'p1', displayName: 'A', questionId: 'q1', targetUserId: 'p2' },
      { userId: 'p3', displayName: 'C', questionId: 'q1', targetUserId: 'p2' },
    ];

    it('projects only the requester own answers', () => {
      const sanitized = sanitizeStateForClient(
        makeState({ currentPhase: 'group_mirror', groupMirrorAnswers: answers }),
        'p1',
      );

      expect(sanitized.groupMirrorAnswers).toEqual([answers[0]]);
    });

    it('returns no answer identities to an anonymous projection', () => {
      const sanitized = sanitizeStateForClient(
        makeState({ currentPhase: 'group_mirror', groupMirrorAnswers: answers }),
      );

      expect(sanitized.groupMirrorAnswers).toEqual([]);
    });
  });

  describe('undercover role', () => {
    const results = {
      undercoverUserId: 'p3',
      undercoverDisplayName: 'C',
      civilianWord: '咖啡',
      undercoverWord: '茶',
      voteCounts: { p3: 3 },
      caught: true,
    };

    it('hides the undercover identity from other players', () => {
      const sanitized = sanitizeStateForClient(
        makeState({
          currentPhase: 'undercover_word',
          undercoverUserId: 'p3',
          undercoverWordResults: results,
        }),
        'p1',
      );

      expect(sanitized.undercoverUserId).toBeUndefined();
      expect(sanitized.undercoverWordResults).not.toHaveProperty('undercoverUserId');
      expect(sanitized.undercoverWordResults).not.toHaveProperty('undercoverDisplayName');
      expect(sanitized.undercoverWordResults?.voteCounts).toEqual({ p3: 3 });
    });

    it('keeps the undercover player own role without exposing the name', () => {
      const sanitized = sanitizeStateForClient(
        makeState({
          currentPhase: 'undercover_word',
          undercoverUserId: 'p3',
          undercoverWordResults: results,
        }),
        'p3',
      );

      expect(sanitized.undercoverUserId).toBe('p3');
      expect(sanitized.undercoverWordResults).not.toHaveProperty('undercoverDisplayName');
    });
  });

  describe('quip battle authorship', () => {
    const answers = [
      { userId: 'p1', displayName: 'A', promptId: 'prompt-1', answerText: '一' },
      { userId: 'p2', displayName: 'B', promptId: 'prompt-1', answerText: '二' },
    ];

    it('masks other authors with a stable opaque id — no raw user id in the payload', () => {
      const state = makeState({ currentPhase: 'quip_battle', quipBattleAnswers: answers });
      const sanitized = sanitizeStateForClient(state, 'p1');

      // Own answer: real identity preserved (submitted-count / own-answer UX).
      expect(sanitized.quipBattleAnswers?.[0]).toMatchObject({
        userId: 'p1',
        displayName: 'A',
        answerText: '一',
      });
      // Other author: anonymous + opaque token, never the account id.
      const masked = sanitized.quipBattleAnswers?.[1];
      expect(masked?.displayName).toBe('匿名同桌');
      expect(masked?.userId).not.toBe('p2');
      expect(masked?.userId.startsWith('q_')).toBe(true);
      // The whole pre-reveal payload carries no real correlated user id.
      expect(JSON.stringify(sanitized)).not.toContain('p2');
    });

    it('keeps the opaque token stable across polls', () => {
      const state = makeState({ currentPhase: 'quip_battle', quipBattleAnswers: answers });

      const first = sanitizeStateForClient(state, 'p1').quipBattleAnswers?.[1];
      const second = sanitizeStateForClient(state, 'p1').quipBattleAnswers?.[1];

      expect(second?.userId).toBe(first?.userId);
      expect(second?.answerId).toBe(first?.answerId);
    });

    it('exposes an opaque answerId that resolves back for voting and reporting', () => {
      const state = makeState({ currentPhase: 'quip_battle', quipBattleAnswers: answers });
      const masked = sanitizeStateForClient(state, 'p1').quipBattleAnswers?.[1];

      expect(masked?.answerId).toBeDefined();
      expect(masked?.answerId).not.toContain('p2');
      // Voting: the opaque id is a valid ballot target.
      expect(resolveQuipAnswerIdentity(state, masked?.answerId)).toEqual({
        userId: 'p2',
        promptId: 'prompt-1',
      });
      // Reporting: the client sends the masked userId as targetUserId.
      expect(resolveQuipAuthorUserId(state, masked?.userId)).toBe('p2');
    });

    it('still accepts the legacy internal answerId (older clients / persisted votes)', () => {
      const state = makeState({ currentPhase: 'quip_battle', quipBattleAnswers: answers });

      expect(resolveQuipAnswerIdentity(state, 'p2::prompt-1')).toEqual({
        userId: 'p2',
        promptId: 'prompt-1',
      });
      expect(resolveQuipAnswerIdentity(state, 'p9::prompt-1')).toBeNull();
      expect(resolveQuipAuthorUserId(state, 'p2')).toBeNull();
    });

    it('hides every other ballot before reveal (no voter→author graph)', () => {
      const votes = [
        { voterId: 'p1', answerId: 'p2::prompt-1', promptId: 'prompt-1' },
        { voterId: 'p2', answerId: 'p1::prompt-1', promptId: 'prompt-1' },
      ];
      const sanitized = sanitizeStateForClient(
        makeState({ currentPhase: 'quip_battle', quipBattleAnswers: answers, quipBattleVotes: votes }),
        'p1',
      );

      expect(sanitized.quipBattleVotes).toHaveLength(1);
      expect(sanitized.quipBattleVotes?.[0].voterId).toBe('p1');
      // Own ballot still targets the right answer, but by the opaque key.
      expect(sanitized.quipBattleVotes?.[0].answerId).not.toContain('p2');
      expect(resolveQuipAnswerIdentity(
        makeState({ quipBattleAnswers: answers }),
        sanitized.quipBattleVotes?.[0].answerId,
      )).toEqual({ userId: 'p2', promptId: 'prompt-1' });
    });

    it('returns no ballots to an anonymous projection', () => {
      const sanitized = sanitizeStateForClient(
        makeState({
          currentPhase: 'quip_battle',
          quipBattleAnswers: answers,
          quipBattleVotes: [{ voterId: 'p1', answerId: 'p2::prompt-1', promptId: 'prompt-1' }],
        }),
      );

      expect(sanitized.quipBattleVotes).toEqual([]);
    });

    it('preserves authors after reveal', () => {
      const sanitized = sanitizeStateForClient(
        makeState({
          currentPhase: 'quip_battle',
          quipBattleAnswers: answers,
          quipBattleRevealed: true,
        }),
        'p1',
      );

      expect(sanitized.quipBattleAnswers).toEqual([
        { ...answers[0], answerId: 'p1::prompt-1' },
        { ...answers[1], answerId: 'p2::prompt-1' },
      ]);
    });
  });
});
