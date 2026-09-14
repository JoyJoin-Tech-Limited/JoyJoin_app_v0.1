import { describe, expect, it } from 'vitest';
import { resolveDuoEligibilityAfterHardConstraint } from '../poolMatchingService';

/**
 * W8 (AC-W8.6) — duo atomicity across the hard-constraint boundary.
 *
 * Regression: duo bindings used to be resolved AFTER the hard-constraint filter
 * (only from eligible users), so a partner removed by a hard constraint silently
 * split the duo and the remaining member could match solo. The binding is now
 * resolved pre-filter and enforced here — both strand together (整组顺延).
 */

type U = { userId: string };

const u = (userId: string): U => ({ userId });

describe('resolveDuoEligibilityAfterHardConstraint', () => {
  it('keeps both members when both survive the hard-constraint filter', () => {
    const result = resolveDuoEligibilityAfterHardConstraint({
      eligibleUsers: [u('a'), u('b'), u('c')],
      duoPairs: [{ inviterId: 'a', inviteeId: 'b' }],
    });

    expect(result.eligibleUsers.map((x) => x.userId)).toEqual(['a', 'b', 'c']);
    expect(result.duoPairs).toEqual([{ inviterId: 'a', inviteeId: 'b' }]);
    expect(result.strandedUserIds).toEqual([]);
  });

  it('strands the surviving partner when the OTHER fails a hard constraint (never split)', () => {
    // 'b' was filtered out by a hard constraint; 'a' must NOT match solo.
    const result = resolveDuoEligibilityAfterHardConstraint({
      eligibleUsers: [u('a'), u('c')],
      duoPairs: [{ inviterId: 'a', inviteeId: 'b' }],
    });

    expect(result.eligibleUsers.map((x) => x.userId)).toEqual(['c']);
    expect(result.strandedUserIds).toEqual(['a']);
    expect(result.duoPairs).toEqual([]);
  });

  it('strands from either side of the pair (invitee survives, inviter filtered)', () => {
    const result = resolveDuoEligibilityAfterHardConstraint({
      eligibleUsers: [u('b'), u('c')],
      duoPairs: [{ inviterId: 'a', inviteeId: 'b' }],
    });

    expect(result.eligibleUsers.map((x) => x.userId)).toEqual(['c']);
    expect(result.strandedUserIds).toEqual(['b']);
    expect(result.duoPairs).toEqual([]);
  });

  it('leaves both out when neither survives (nothing to strand)', () => {
    const result = resolveDuoEligibilityAfterHardConstraint({
      eligibleUsers: [u('c')],
      duoPairs: [{ inviterId: 'a', inviteeId: 'b' }],
    });

    expect(result.eligibleUsers.map((x) => x.userId)).toEqual(['c']);
    expect(result.strandedUserIds).toEqual([]);
    expect(result.duoPairs).toEqual([]);
  });

  it('is byte-identical for zero-duo pools', () => {
    const users = [u('a'), u('b')];
    const result = resolveDuoEligibilityAfterHardConstraint({ eligibleUsers: users, duoPairs: [] });
    expect(result.eligibleUsers).toBe(users);
    expect(result.duoPairs).toEqual([]);
    expect(result.strandedUserIds).toEqual([]);
  });

  it('handles multiple duos independently', () => {
    const result = resolveDuoEligibilityAfterHardConstraint({
      eligibleUsers: [u('a'), u('b'), u('c'), u('d')],
      duoPairs: [
        { inviterId: 'a', inviteeId: 'b' },
        { inviterId: 'c', inviteeId: 'x' }, // x filtered out → c strands
      ],
    });

    expect(result.eligibleUsers.map((x) => x.userId)).toEqual(['a', 'b', 'd']);
    expect(result.duoPairs).toEqual([{ inviterId: 'a', inviteeId: 'b' }]);
    expect(result.strandedUserIds).toEqual(['c']);
  });
});
