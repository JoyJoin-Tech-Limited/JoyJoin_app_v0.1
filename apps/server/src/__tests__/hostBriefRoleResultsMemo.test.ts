/**
 * FU-02 — `hostBriefRoleResultsMemo` invariants.
 *
 * The memo is what keeps ACOEXP enrichment off the 3s session poll. These
 * tests pin the three properties the host brief relies on:
 *
 * 1. one `role_results` batch read per session per TTL window;
 * 2. a hard bound on memoized sessions (oldest evicted first);
 * 3. fail-open — an error resolves to an empty map (the persona's archetype
 *    fallback) and is itself memoized, so a broken database cannot turn the
 *    poll into a retry storm.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getLatestRoleResultsForUsersMock } = vi.hoisted(() => ({
  getLatestRoleResultsForUsersMock: vi.fn(async () => new Map()),
}));

vi.mock('../repositories/assessmentRepo', () => ({
  getLatestRoleResultsForUsers: getLatestRoleResultsForUsersMock,
}));

import {
  HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS,
  HOST_BRIEF_ROLE_RESULTS_TTL_MS,
  getHostBriefRoleResults,
  getHostBriefRoleResultsMemoSize,
  resetHostBriefRoleResultsMemo,
} from '../lib/hostBriefRoleResultsMemo';

const TRAITS = { extraversion: 30, affinity: 70, emotionalStability: 60 };

beforeEach(() => {
  vi.clearAllMocks();
  resetHostBriefRoleResultsMemo();
  getLatestRoleResultsForUsersMock.mockResolvedValue(new Map([['u1', TRAITS]]));
});

afterEach(() => {
  vi.useRealTimers();
  resetHostBriefRoleResultsMemo();
});

describe('hostBriefRoleResultsMemo', () => {
  it('queries once per session and serves later calls from the memo', async () => {
    const first = await getHostBriefRoleResults('social_a', ['u1']);
    const second = await getHostBriefRoleResults('social_a', ['u1']);

    expect(first.get('u1')).toEqual(TRAITS);
    expect(second).toBe(first);
    expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(1);
  });

  it('keys the memo per session', async () => {
    await getHostBriefRoleResults('social_a', ['u1']);
    await getHostBriefRoleResults('social_b', ['u1']);

    expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(2);
  });

  it('re-queries after the TTL window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T00:00:00.000Z'));

    await getHostBriefRoleResults('social_ttl', ['u1']);
    vi.setSystemTime(new Date(Date.now() + HOST_BRIEF_ROLE_RESULTS_TTL_MS - 1));
    await getHostBriefRoleResults('social_ttl', ['u1']);
    expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + 2));
    await getHostBriefRoleResults('social_ttl', ['u1']);
    expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(2);
  });

  it('fails open to an empty map and memoizes the negative result', async () => {
    getLatestRoleResultsForUsersMock.mockRejectedValue(new Error('db down'));

    const first = await getHostBriefRoleResults('social_fail', ['u1']);
    const second = await getHostBriefRoleResults('social_fail', ['u1']);

    expect(first.size).toBe(0);
    expect(second.size).toBe(0);
    // One attempt per TTL window, even on the failure path.
    expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(1);
  });

  it('never queries without a session id', async () => {
    expect((await getHostBriefRoleResults('', ['u1'])).size).toBe(0);
    expect((await getHostBriefRoleResults('   ', ['u1'])).size).toBe(0);

    expect(getLatestRoleResultsForUsersMock).not.toHaveBeenCalled();
  });

  it('bounds the memo at MAX_SESSIONS, evicting the oldest entry first', async () => {
    for (let index = 0; index < HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS; index += 1) {
      await getHostBriefRoleResults(`social_${index}`, ['u1']);
    }
    expect(getHostBriefRoleResultsMemoSize()).toBe(HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS);

    await getHostBriefRoleResults('social_overflow', ['u1']);

    expect(getHostBriefRoleResultsMemoSize()).toBe(HOST_BRIEF_ROLE_RESULTS_MAX_SESSIONS);
    // The oldest key was evicted; the next-oldest survived. Check the survivor
    // FIRST — re-querying the evicted key would itself evict it.
    getLatestRoleResultsForUsersMock.mockClear();
    await getHostBriefRoleResults('social_1', ['u1']);
    expect(getLatestRoleResultsForUsersMock).not.toHaveBeenCalled();

    getLatestRoleResultsForUsersMock.mockClear();
    await getHostBriefRoleResults('social_0', ['u1']);
    expect(getLatestRoleResultsForUsersMock).toHaveBeenCalledTimes(1);
  });
});
