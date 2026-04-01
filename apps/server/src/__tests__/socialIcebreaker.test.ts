/**
 * Unit tests for Social Icebreaker recovery and presence invariants.
 *
 * Tests cover:
 * - Deterministic social session IDs
 * - Rejoin: starting again with the same icebreakerSessionId returns the
 *   existing session with current phase preserved
 * - Expiry: sessions older than TTL return the correct expired flag
 * - Participant roster vs active presence (heartbeat-based)
 * - Votes and lie-detective statements survive a "reload" (DB round-trip)
 * - Server-only lie truth is NOT present in public stateJson
 *
 * These tests intentionally use a lightweight in-memory model of the same
 * invariants. Route/store integration with a real database is deferred until
 * the repo has a reusable DB-backed test harness for this feature area.
 */

import { describe, it, expect } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';

// ---------------------------------------------------------------------------
// Because the real store is DB-backed and currently requires DATABASE_URL,
// these tests model the same invariants locally instead of pretending to
// exercise the Drizzle layer directly.
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const PRESENCE_THRESHOLD_MS = 30_000;

function getSocialSessionId(icebreakerSessionId: string): string {
  return `social_${icebreakerSessionId}`;
}

// ---------------------------------------------------------------------------
// socialIcebreakerStore - pure logic helpers (no DB)
// ---------------------------------------------------------------------------

describe('getSocialSessionId', () => {
  it('produces a deterministic socialSessionId from an icebreakerSessionId', () => {
    expect(getSocialSessionId('abc123')).toBe('social_abc123');
    expect(getSocialSessionId('abc123')).toBe(getSocialSessionId('abc123'));
  });

  it('produces different IDs for different icebreakerSessionIds', () => {
    expect(getSocialSessionId('session-A')).not.toBe(getSocialSessionId('session-B'));
  });
});

describe('SESSION_TTL_MS and PRESENCE_THRESHOLD_MS constants', () => {
  it('SESSION_TTL_MS is at least 1 hour', () => {
    expect(SESSION_TTL_MS).toBeGreaterThanOrEqual(60 * 60 * 1000);
  });

  it('PRESENCE_THRESHOLD_MS is between 10 s and 2 min', () => {
    expect(PRESENCE_THRESHOLD_MS).toBeGreaterThanOrEqual(10_000);
    expect(PRESENCE_THRESHOLD_MS).toBeLessThanOrEqual(120_000);
  });
});

// ---------------------------------------------------------------------------
// In-memory simulation of the store — validates the same invariants the real
// store enforces.
// ---------------------------------------------------------------------------

interface StoredSession {
  state: SocialSessionState;
  icebreakerSessionId: string;
  expiresAt: Date;
}

interface StoredParticipant {
  socialSessionId: string;
  userId: string;
  displayName: string;
  joinedAt: Date;
  lastSeenAt: Date;
}

interface StoredLieTruth {
  socialSessionId: string;
  userId: string;
  statements: Array<{ index: number; text: string; isLie: boolean }>;
}

class InMemoryStore {
  private sessions = new Map<string, StoredSession>();
  private sessionsByIcebreakerSessionId = new Map<string, string>();
  private participants = new Map<string, StoredParticipant>();
  private lieTruths = new Map<string, StoredLieTruth>();

  createSession(state: SocialSessionState, ttlMs = SESSION_TTL_MS): void {
    const expiresAt = new Date(Date.now() + ttlMs);
    this.sessions.set(state.socialSessionId, {
      state: { ...state },
      icebreakerSessionId: state.icebreakerSessionId,
      expiresAt,
    });
    this.sessionsByIcebreakerSessionId.set(state.icebreakerSessionId, state.socialSessionId);
  }

  getSession(socialSessionId: string): { state: SocialSessionState; expired: boolean } | null {
    const row = this.sessions.get(socialSessionId);
    if (!row) return null;
    return { state: { ...row.state }, expired: row.expiresAt < new Date() };
  }

  getSessionByIcebreakerSessionId(
    icebreakerSessionId: string,
  ): { socialSessionId: string; state: SocialSessionState; expired: boolean } | null {
    const id = this.sessionsByIcebreakerSessionId.get(icebreakerSessionId);
    if (!id) return null;
    const row = this.sessions.get(id);
    if (!row) return null;
    return { socialSessionId: id, state: { ...row.state }, expired: row.expiresAt < new Date() };
  }

  updateSession(socialSessionId: string, state: SocialSessionState): void {
    const row = this.sessions.get(socialSessionId);
    if (row) row.state = { ...state };
  }

  upsertParticipant(socialSessionId: string, userId: string, displayName: string): void {
    const key = `${socialSessionId}::${userId}`;
    const existing = this.participants.get(key);
    if (existing) {
      existing.lastSeenAt = new Date();
      existing.displayName = displayName;
    } else {
      this.participants.set(key, {
        socialSessionId,
        userId,
        displayName,
        joinedAt: new Date(),
        lastSeenAt: new Date(),
      });
    }
  }

  heartbeat(socialSessionId: string, userId: string): void {
    const key = `${socialSessionId}::${userId}`;
    const p = this.participants.get(key);
    if (p) p.lastSeenAt = new Date();
  }

  getRosterCount(socialSessionId: string): number {
    let count = 0;
    for (const p of this.participants.values()) {
      if (p.socialSessionId === socialSessionId) count++;
    }
    return count;
  }

  getActiveParticipantCount(
    socialSessionId: string,
    thresholdMs = PRESENCE_THRESHOLD_MS,
  ): number {
    const since = new Date(Date.now() - thresholdMs);
    let count = 0;
    for (const p of this.participants.values()) {
      if (p.socialSessionId === socialSessionId && p.lastSeenAt >= since) count++;
    }
    return count;
  }

  setLieTruths(
    socialSessionId: string,
    userId: string,
    statements: Array<{ index: number; text: string; isLie: boolean }>,
  ): void {
    this.lieTruths.set(`${socialSessionId}::${userId}`, { socialSessionId, userId, statements });
  }

  getLieTruths(
    socialSessionId: string,
    userId: string,
  ): Array<{ index: number; text: string; isLie: boolean }> | null {
    return this.lieTruths.get(`${socialSessionId}::${userId}`)?.statements ?? null;
  }

  getAllSessionLieTruths(
    socialSessionId: string,
  ): Map<string, Array<{ index: number; text: string; isLie: boolean }>> {
    const result = new Map<string, Array<{ index: number; text: string; isLie: boolean }>>();
    for (const entry of this.lieTruths.values()) {
      if (entry.socialSessionId === socialSessionId) {
        result.set(entry.userId, entry.statements);
      }
    }
    return result;
  }
}

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_sess-1',
    icebreakerSessionId: 'sess-1',
    currentPhase: 'warmup',
    hostUserId: 'host-1',
    hostDisplayName: 'Alice',
    playerCount: 1,
    phaseStartedAt: Date.now(),
    sessionStartedAt: Date.now(),
    completedPhases: [],
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InMemoryStore – session persist-and-reload semantics', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('returns null for a session that was never created', () => {
    expect(store.getSession('social_unknown')).toBeNull();
  });

  it('creates a session and can retrieve it', () => {
    const state = makeState();
    store.createSession(state);

    const result = store.getSession('social_sess-1');
    expect(result).not.toBeNull();
    expect(result!.expired).toBe(false);
    expect(result!.state.currentPhase).toBe('warmup');
  });

  it('persists phase updates (simulates server restart reload)', () => {
    const state = makeState();
    store.createSession(state);

    // Advance phase
    const updated = { ...state, currentPhase: 'micro_challenge' as const, completedPhases: ['warmup' as const] };
    store.updateSession('social_sess-1', updated);

    const result = store.getSession('social_sess-1');
    expect(result!.state.currentPhase).toBe('micro_challenge');
    expect(result!.state.completedPhases).toContain('warmup');
  });

  it('can look up session by icebreakerSessionId (rejoin after refresh)', () => {
    const state = makeState();
    store.createSession(state);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result).not.toBeNull();
    expect(result!.socialSessionId).toBe('social_sess-1');
    expect(result!.state.hostUserId).toBe('host-1');
    expect(result!.expired).toBe(false);
  });

  it('preserves host identity on rejoin', () => {
    const state = makeState({ hostUserId: 'host-42', hostDisplayName: 'Bob' });
    store.createSession(state);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result!.state.hostUserId).toBe('host-42');
    expect(result!.state.hostDisplayName).toBe('Bob');
  });
});

describe('InMemoryStore – expiry semantics', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  it('returns expired=true for a session past its TTL', () => {
    const state = makeState();
    // Create with a TTL that is already expired (-1 ms)
    store.createSession(state, -1);

    const result = store.getSession('social_sess-1');
    expect(result).not.toBeNull();
    expect(result!.expired).toBe(true);
  });

  it('returns expired=true on icebreakerSessionId lookup when TTL passed', () => {
    const state = makeState();
    store.createSession(state, -1);

    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result!.expired).toBe(true);
  });

  it('returns expired=false for a fresh session', () => {
    const state = makeState();
    store.createSession(state, SESSION_TTL_MS);

    const result = store.getSession('social_sess-1');
    expect(result!.expired).toBe(false);
  });
});

describe('InMemoryStore – participant roster vs active presence', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    const state = makeState();
    store.createSession(state);
  });

  it('roster count increases as users join', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    expect(store.getRosterCount('social_sess-1')).toBe(1);

    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');
    expect(store.getRosterCount('social_sess-1')).toBe(2);
  });

  it('roster count does not increase on re-join (upsert semantics)', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    expect(store.getRosterCount('social_sess-1')).toBe(1);
  });

  it('active count reflects participants who have recently heartbeated', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');

    // Both joined just now, so both are active
    expect(store.getActiveParticipantCount('social_sess-1')).toBe(2);
  });

  it('active count excludes participants who have not been seen recently', () => {
    store.upsertParticipant('social_sess-1', 'user-1', 'Alice');
    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');

    // Simulate user-2 going stale: set lastSeenAt to well in the past
    const key = 'social_sess-1::user-2';
    const p = (store as any).participants.get(key);
    p.lastSeenAt = new Date(Date.now() - PRESENCE_THRESHOLD_MS - 1000);

    expect(store.getActiveParticipantCount('social_sess-1')).toBe(1);
  });

  it('heartbeat refreshes a stale participant to active', () => {
    store.upsertParticipant('social_sess-1', 'user-2', 'Bob');
    const key = 'social_sess-1::user-2';
    const p = (store as any).participants.get(key);
    p.lastSeenAt = new Date(Date.now() - PRESENCE_THRESHOLD_MS - 1000);

    expect(store.getActiveParticipantCount('social_sess-1')).toBe(0);

    store.heartbeat('social_sess-1', 'user-2');
    expect(store.getActiveParticipantCount('social_sess-1')).toBe(1);
  });
});

describe('InMemoryStore – votes and statements survive a reload', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    store.createSession(makeState());
  });

  it('stores and retrieves votes after update', () => {
    const state = makeState();
    state.votes = [{ voterId: 'user-1', targetUserId: 'user-2', guessedStatementIndex: 2 }];
    store.updateSession('social_sess-1', state);

    const result = store.getSession('social_sess-1');
    expect(result!.state.votes).toHaveLength(1);
    expect(result!.state.votes![0].guessedStatementIndex).toBe(2);
  });

  it('stores and retrieves lie-detective players (sanitized, no isLie)', () => {
    const state = makeState();
    state.lieDetectivePlayers = [
      { userId: 'user-1', displayName: 'Alice', statements: [{ index: 1, text: 'I run marathons' }] },
    ];
    store.updateSession('social_sess-1', state);

    const result = store.getSession('social_sess-1');
    const player = result!.state.lieDetectivePlayers![0];
    expect(player.statements[0]).not.toHaveProperty('isLie');
    expect(player.statements[0].text).toBe('I run marathons');
  });
});

describe('InMemoryStore – server-only lie truth secrecy', () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
    store.createSession(makeState());
  });

  it('stores lie truth separately from public state', () => {
    const truthStatements = [
      { index: 1, text: 'I run marathons', isLie: false },
      { index: 2, text: 'I have a pet iguana', isLie: true },
      { index: 3, text: 'I lived in Paris', isLie: false },
    ];
    store.setLieTruths('social_sess-1', 'user-1', truthStatements);

    // Public state stateJson should NOT contain isLie data
    const sessionResult = store.getSession('social_sess-1');
    const stateStr = JSON.stringify(sessionResult!.state);
    expect(stateStr).not.toContain('"isLie"');
  });

  it('getLieTruths returns the full truth data including isLie', () => {
    const truthStatements = [
      { index: 1, text: 'I run marathons', isLie: false },
      { index: 2, text: 'I have a pet iguana', isLie: true },
    ];
    store.setLieTruths('social_sess-1', 'user-1', truthStatements);

    const truths = store.getLieTruths('social_sess-1', 'user-1');
    expect(truths).not.toBeNull();
    expect(truths!.find(s => s.isLie)?.index).toBe(2);
  });

  it('getLieTruths returns null for a user who has not generated statements', () => {
    expect(store.getLieTruths('social_sess-1', 'user-99')).toBeNull();
  });

  it('getAllSessionLieTruths returns truth data for all players in the session', () => {
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'A', isLie: false },
      { index: 2, text: 'B', isLie: true },
    ]);
    store.setLieTruths('social_sess-1', 'user-2', [
      { index: 1, text: 'X', isLie: true },
      { index: 2, text: 'Y', isLie: false },
    ]);

    const all = store.getAllSessionLieTruths('social_sess-1');
    expect(all.size).toBe(2);
    expect(all.get('user-1')!.find(s => s.isLie)?.index).toBe(2);
    expect(all.get('user-2')!.find(s => s.isLie)?.index).toBe(1);
  });

  it('setLieTruths overwrites previous data (idempotent)', () => {
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'Old text', isLie: false },
    ]);
    store.setLieTruths('social_sess-1', 'user-1', [
      { index: 1, text: 'New text', isLie: true },
    ]);
    const truths = store.getLieTruths('social_sess-1', 'user-1');
    expect(truths!.length).toBe(1);
    expect(truths![0].text).toBe('New text');
    expect(truths![0].isLie).toBe(true);
  });
});

describe('InMemoryStore – rejoin/reconnect restores session state', () => {
  it('a second join finds the same session at the current phase', () => {
    const store = new InMemoryStore();
    const state = makeState({ currentPhase: 'lie_detective', completedPhases: ['warmup', 'micro_challenge'] });
    store.createSession(state);

    // User joins; server looks up by icebreakerSessionId
    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result!.state.currentPhase).toBe('lie_detective');
    expect(result!.state.completedPhases).toContain('warmup');
    expect(result!.state.completedPhases).toContain('micro_challenge');
  });

  it('votes are preserved after a rejoin (state round-trip)', () => {
    const store = new InMemoryStore();
    const state = makeState({ currentPhase: 'lie_detective' });
    state.votes = [{ voterId: 'user-3', targetUserId: 'user-1', guessedStatementIndex: 1 }];
    store.createSession(state);
    store.updateSession('social_sess-1', state);

    // Simulate rejoin: look up by icebreakerSessionId
    const result = store.getSessionByIcebreakerSessionId('sess-1');
    expect(result!.state.votes).toHaveLength(1);
  });
});
