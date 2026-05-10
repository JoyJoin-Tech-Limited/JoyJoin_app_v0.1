import { describe, it, expect } from 'vitest';
import { curateMedals } from './medalCuration';
import type { SocialSessionState } from '@joyjoin/shared/socialIcebreaker';

function makeState(partial: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test_001',
    icebreakerSessionId: 'ice_test_001',
    currentPhase: 'recap',
    hostUserId: 'host1',
    hostDisplayName: 'Host',
    playerCount: 3,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: ['warmup', 'micro_challenge', 'lie_detective'],
    ...partial,
  } as SocialSessionState;
}

describe('curateMedals', () => {
  const roster = [
    { userId: 'u1', displayName: 'Alice' },
    { userId: 'u2', displayName: 'Bob' },
    { userId: 'u3', displayName: 'Carol' },
  ];

  it('returns empty array for empty roster', () => {
    const state = makeState();
    expect(curateMedals(state, [])).toEqual([]);
  });

  it('is deterministic for identical inputs', () => {
    const state = makeState({
      challengeCompletedBy: ['u2', 'u2', 'u1'],
      warmupReadyUserIds: ['u3'],
      votes: [
        { voterId: 'u1', targetUserId: 'u3', guessedStatementIndex: 2 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u3',
        lieIndex: 2,
        voteCount: 1,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
    });
    const result1 = curateMedals(state, roster);
    const result2 = curateMedals(state, roster);
    expect(result1).toEqual(result2);
  });

  it('never awards more than one medal to the same person', () => {
    // u1 dominates every category
    const state = makeState({
      challengeCompletedBy: ['u1'],
      warmupReadyUserIds: ['u1'],
      votes: [
        { voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 1 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 1,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
    });
    const result = curateMedals(state, roster);
    const recipients = result.map((m) => m.recipientDisplayName);
    expect(new Set(recipients).size).toBe(recipients.length);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('caps medals to roster size when roster < 3', () => {
    const state = makeState();
    const smallRoster = [
      { userId: 'u1', displayName: 'Alice' },
      { userId: 'u2', displayName: 'Bob' },
    ];
    const result = curateMedals(state, smallRoster);
    expect(result.length).toBeLessThanOrEqual(2);
    const recipients = result.map((m) => m.recipientDisplayName);
    expect(new Set(recipients).size).toBe(recipients.length);
  });

  it('falls back deterministically when no phase data is present', () => {
    const state = makeState();
    const result = curateMedals(state, roster);
    expect(result.length).toBe(3);
    // Seeded by socialSessionId, the shuffle is stable across calls
    const result2 = curateMedals(state, roster);
    expect(result).toEqual(result2);
  });

  it('awards 最佳侦探 based on correct guesses', () => {
    const state = makeState({
      votes: [
        { voterId: 'u1', targetUserId: 'u3', guessedStatementIndex: 1 },
        { voterId: 'u2', targetUserId: 'u3', guessedStatementIndex: 2 },
        { voterId: 'u3', targetUserId: 'u3', guessedStatementIndex: 2 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u3',
        lieIndex: 2,
        voteCount: 3,
        correctVoteCount: 2,
        revealedAt: Date.now(),
      },
    });
    const result = curateMedals(state, roster);
    const detective = result.find((m) => m.title === '最佳侦探');
    expect(detective?.recipientDisplayName).toBe('Bob'); // u2 guessed correctly
  });

  it('awards 挑战先锋 based on completion count', () => {
    const state = makeState({
      challengeCompletedBy: ['u3', 'u3', 'u2'],
    });
    const result = curateMedals(state, roster);
    const challenge = result.find((m) => m.title === '挑战先锋');
    expect(challenge?.recipientDisplayName).toBe('Carol'); // u3 completed most
  });

  it('awards 话题王 based on pulse-check vibe ratings', () => {
    // Fix winners for the first two categories so u2 is free for topic.
    const state = makeState({
      votes: [
        { voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 1 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 1,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
      challengeCompletedBy: ['u3'],
      pulseChecks: [
        { userId: 'u1', vibe: 2 },
        { userId: 'u2', vibe: 3 },
        { userId: 'u3', vibe: 1 },
      ],
    });
    const result = curateMedals(state, roster);
    const topic = result.find((m) => m.title === '话题王');
    expect(topic?.recipientDisplayName).toBe('Bob'); // u2 has highest vibe and is not used
  });

  it('awards 话题王 based on warmupReady when pulse checks are absent', () => {
    // Fix winners for the first two categories so Alice is free for topic.
    const state = makeState({
      votes: [
        { voterId: 'u2', targetUserId: 'u3', guessedStatementIndex: 1 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u3',
        lieIndex: 1,
        voteCount: 1,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
      challengeCompletedBy: ['u3', 'u2'], // u3 wins challenge, Bob is next but u3 already used
      warmupReadyUserIds: ['u1', 'u3'],
    });
    const result = curateMedals(state, roster);
    const topic = result.find((m) => m.title === '话题王');
    // Alice and Carol are tied (weight 1); Alice wins alphabetically
    expect(topic?.recipientDisplayName).toBe('Alice');
  });

  it('deduplicates so a player receives only their highest-ranked category', () => {
    // u1 is #1 in both detective and challenge
    // u2 is #2 in detective, #3 in challenge
    // u3 is #3 in detective, #2 in challenge
    const state = makeState({
      votes: [
        { voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 1 },
        { voterId: 'u2', targetUserId: 'u2', guessedStatementIndex: 2 },
        { voterId: 'u3', targetUserId: 'u2', guessedStatementIndex: 3 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 3,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
      challengeCompletedBy: ['u1'],
    });
    const result = curateMedals(state, roster);
    const recipients = result.map((m) => m.recipientDisplayName);

    expect(new Set(recipients).size).toBe(recipients.length);
    const u1Count = recipients.filter((r) => r === 'Alice').length;
    expect(u1Count).toBe(1);
  });

  it('uses stable alphabetical tie-break for equal weights', () => {
    // Fix detective winner so challenge tie-break is between Alice and Bob.
    const state = makeState({
      votes: [
        { voterId: 'u3', targetUserId: 'u2', guessedStatementIndex: 1 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 1,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
      challengeCompletedBy: ['u1', 'u2'], // same count
    });
    const result = curateMedals(state, roster);
    const challenge = result.find((m) => m.title === '挑战先锋');
    // u3 used for detective; u1 and u2 tied in challenge; Alice wins alphabetically
    expect(challenge?.recipientDisplayName).toBe('Alice');
  });

  it('returns exactly the expected medals shape', () => {
    const state = makeState({
      challengeCompletedBy: ['u2'],
      warmupReadyUserIds: ['u3'],
      votes: [
        { voterId: 'u1', targetUserId: 'u2', guessedStatementIndex: 1 },
      ],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 1,
        correctVoteCount: 1,
        revealedAt: Date.now(),
      },
    });
    const result = curateMedals(state, roster);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      emoji: '🕵️',
      title: '最佳侦探',
      recipientDisplayName: 'Alice',
      description: '在侦探环节中表现最为出色',
    });
    expect(result[1]).toEqual({
      emoji: '⚡',
      title: '挑战先锋',
      recipientDisplayName: 'Bob',
      description: '率先完成挑战任务',
    });
    expect(result[2]).toEqual({
      emoji: '💬',
      title: '话题王',
      recipientDisplayName: 'Carol',
      description: '在话题卡环节中最活跃',
    });
  });
});
