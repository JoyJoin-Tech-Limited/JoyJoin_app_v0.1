/**
 * 双人成行 S1 (one-partner-per-pool) AC-5 — admin duo-list conflict marker.
 *
 * `computeDuoConflictInvitationIds` is the pure core of the admin conflict
 * flag: given every VALID duo binding (both sides registered in the
 * invitation's pool — the same definition as the write-side guard), an
 * invitation is conflicted when
 *   - the same invitation carries 2+ valid bindings (a claimed code was
 *     consumed again — pre-guard legacy rows or a double-consume race), or
 *   - the same invitee holds 2+ valid bindings in the same pool.
 *
 * Read-only marker — the function maps rows → ids, it never mutates.
 * The db module is mocked so the repo imports cleanly without a DATABASE_URL.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({
  db: {},
}));

import {
  computeDuoConflictInvitationIds,
  type DuoValidBindingRow,
} from "../repositories/adminReferralsRepo";

const B = (invitationId: string, inviteeId: string, poolId: string | null = "pool-1"): DuoValidBindingRow => ({
  invitationId,
  inviteeId,
  poolId,
});

describe("computeDuoConflictInvitationIds (S1 AC-5)", () => {
  it("flags an invitation carrying 2+ valid bindings (claimed code consumed again)", () => {
    const ids = computeDuoConflictInvitationIds([
      B("inv-a", "user-1"),
      B("inv-a", "user-2"),
    ]);
    expect(ids).toEqual(new Set(["inv-a"]));
  });

  it("flags every invitation when the same invitee holds 2+ valid bindings in the same pool", () => {
    const ids = computeDuoConflictInvitationIds([
      B("inv-a", "user-1"),
      B("inv-b", "user-1"),
    ]);
    expect(ids).toEqual(new Set(["inv-a", "inv-b"]));
  });

  it("does NOT flag the same invitee bound in DIFFERENT pools (bindings are pool-scoped)", () => {
    const ids = computeDuoConflictInvitationIds([
      B("inv-a", "user-1", "pool-1"),
      B("inv-b", "user-1", "pool-2"),
    ]);
    expect(ids.size).toBe(0);
  });

  it("leaves clean one-consumer bindings unflagged", () => {
    const ids = computeDuoConflictInvitationIds([
      B("inv-a", "user-1"),
      B("inv-b", "user-2"),
      B("inv-c", "user-3"),
    ]);
    expect(ids.size).toBe(0);
  });

  it("flags only the conflicted invitations in a mixed set", () => {
    const ids = computeDuoConflictInvitationIds([
      B("inv-a", "user-1"),
      B("inv-a", "user-2"), // inv-a over-consumed
      B("inv-x", "user-8"),
      B("inv-y", "user-9"),
    ]);
    expect(ids).toEqual(new Set(["inv-a"]));
  });

  it("handles empty input", () => {
    expect(computeDuoConflictInvitationIds([]).size).toBe(0);
  });

  it("is order-independent (shuffled rows yield the same conflicted set)", () => {
    const rows = [B("inv-a", "user-1"), B("inv-b", "user-1"), B("inv-x", "user-8")];
    const shuffled = [B("inv-x", "user-8"), B("inv-b", "user-1"), B("inv-a", "user-1")];
    expect(computeDuoConflictInvitationIds(shuffled)).toEqual(
      computeDuoConflictInvitationIds(rows),
    );
  });
});
