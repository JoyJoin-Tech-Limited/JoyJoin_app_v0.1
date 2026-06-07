import { describe, it, expect } from 'vitest';

interface WarmupTopic {
  id: string;
  category: string;
  text: string;
}

interface WarmupState {
  currentPhase: string;
  hostUserId: string;
  playerCount: number;
  warmupReadyUserIds: string[];
  warmupTopics: WarmupTopic[];
  currentTopicIndex: number;
}

function makeState(overrides: Partial<WarmupState> = {}): WarmupState {
  return {
    currentPhase: 'warmup',
    hostUserId: 'host',
    playerCount: 4,
    warmupReadyUserIds: [],
    warmupTopics: [],
    currentTopicIndex: 0,
    ...overrides,
  };
}

function canSetMood(mood: unknown): { valid: boolean; error?: string } {
  if (!mood || typeof mood !== 'string') {
    return { valid: false, error: 'mood is required' };
  }
  return { valid: true };
}

function toggleReady(state: WarmupState, userId: string, ready: boolean): { error?: string } {
  if (state.currentPhase !== 'warmup') {
    return { error: 'Not in warmup phase' };
  }
  return {};
}

function advanceTopic(state: WarmupState): { state?: WarmupState; error?: string } {
  if (state.currentPhase !== 'warmup') {
    return { error: 'Not in warmup phase' };
  }
  if (!state.warmupTopics.length) {
    return { error: 'No warmup topics available' };
  }
  const readyCount = state.warmupReadyUserIds.length;
  if (readyCount < state.playerCount) {
    return { error: `Not all ready (${readyCount}/${state.playerCount})` };
  }
  if (state.currentTopicIndex >= state.warmupTopics.length - 1) {
    return { error: 'Already at last topic' };
  }
  return {
    state: {
      ...state,
      currentTopicIndex: state.currentTopicIndex + 1,
      warmupReadyUserIds: [],
    },
  };
}

describe('Warmup Phase — pure logic', () => {
  describe('mood validation', () => {
    it('rejects undefined mood', () => {
      expect(canSetMood(undefined)).toEqual({ valid: false, error: 'mood is required' });
    });

    it('rejects empty string mood', () => {
      expect(canSetMood('')).toEqual({ valid: false, error: 'mood is required' });
    });

    it('accepts valid mood string', () => {
      expect(canSetMood('relaxed')).toEqual({ valid: true });
    });
  });

  describe('ready toggle', () => {
    it('rejects when not in warmup phase', () => {
      const state = makeState({ currentPhase: 'micro_challenge' });
      const result = toggleReady(state, 'user1', true);
      expect(result.error).toBe('Not in warmup phase');
    });

    it('allows toggle when in warmup phase', () => {
      const state = makeState();
      const result = toggleReady(state, 'user1', true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('topic advancement', () => {
    it('rejects when no topics available', () => {
      const state = makeState({ warmupTopics: [] });
      const result = advanceTopic(state);
      expect(result.error).toBe('No warmup topics available');
    });

    it('rejects when not all ready', () => {
      const state = makeState({
        warmupTopics: [{ id: 't1', category: 'chill', text: 'Test?' }],
        warmupReadyUserIds: ['host'],
        playerCount: 4,
      });
      const result = advanceTopic(state);
      expect(result.error).toContain('Not all ready');
    });

    it('advances when all ready', () => {
      const state = makeState({
        warmupTopics: [
          { id: 't1', category: 'chill', text: 'Topic 1' },
          { id: 't2', category: 'fun', text: 'Topic 2' },
        ],
        warmupReadyUserIds: ['host', 'u1', 'u2', 'u3'],
        playerCount: 4,
        currentTopicIndex: 0,
      });
      const result = advanceTopic(state);
      expect(result.error).toBeUndefined();
      expect(result.state?.currentTopicIndex).toBe(1);
      expect(result.state?.warmupReadyUserIds).toEqual([]);
    });

    it('rejects when already at last topic', () => {
      const state = makeState({
        warmupTopics: [{ id: 't1', category: 'chill', text: 'Only topic' }],
        warmupReadyUserIds: ['host', 'u1', 'u2', 'u3'],
        playerCount: 4,
        currentTopicIndex: 0,
      });
      const result = advanceTopic(state);
      expect(result.error).toBe('Already at last topic');
    });

    it('rejects when not in warmup phase', () => {
      const state = makeState({ currentPhase: 'recap' });
      const result = advanceTopic(state);
      expect(result.error).toBe('Not in warmup phase');
    });
  });
});
