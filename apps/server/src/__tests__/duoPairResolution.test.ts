/**
 * 双人成行 S1 (one-partner-per-pool) — pure overlap-resolution tests for
 * `matching/duoPairResolution.resolveDuoPairSet` (sprint-contract
 * duo-s1-one-partner-per-pool AC-4, Harness Reliability: order-independence).
 */

import { describe, expect, it } from "vitest";

import { resolveDuoPairSet } from "../matching/duoPairResolution";

const P = (inviterId: string, inviteeId: string) => ({ inviterId, inviteeId });

describe("resolveDuoPairSet", () => {
  it("builds both-direction partner maps for clean pairs (zero-conflict passthrough)", () => {
    const result = resolveDuoPairSet([P("a", "b"), P("c", "d")]);

    expect(result.conflictingUserIds).toEqual([]);
    expect(result.droppedPairCount).toBe(0);
    expect(result.pairs).toEqual([P("a", "b"), P("c", "d")]);
    expect(result.duoPartnerOf.get("a")).toBe("b");
    expect(result.duoPartnerOf.get("b")).toBe("a");
    expect(result.duoPartnerOf.get("c")).toBe("d");
    expect(result.duoInternalPairKeys).toEqual(new Set(["a|b", "c|d"]));
  });

  it("handles empty input", () => {
    const result = resolveDuoPairSet([]);
    expect(result.conflictingUserIds).toEqual([]);
    expect(result.droppedPairCount).toBe(0);
    expect(result.duoPartnerOf.size).toBe(0);
    expect(result.duoInternalPairKeys.size).toBe(0);
  });

  it("drops every pair touching a pivot user (A→B, A→C): all three users conflict", () => {
    const result = resolveDuoPairSet([P("a", "b"), P("a", "c")]);

    expect(result.droppedPairCount).toBe(2);
    expect(result.pairs).toEqual([]);
    // The pivot (a) AND both single-binding members strand together — a duo
    // never matches as a half-unit.
    expect(result.conflictingUserIds).toEqual(["a", "b", "c"]);
    expect(result.duoPartnerOf.size).toBe(0);
    expect(result.duoInternalPairKeys.size).toBe(0);
  });

  it("resolves the A→B / A→C / B→C triangle: all pairs dropped, everyone strands", () => {
    const result = resolveDuoPairSet([P("a", "b"), P("a", "c"), P("b", "c")]);

    expect(result.droppedPairCount).toBe(3);
    expect(result.pairs).toEqual([]);
    expect(result.conflictingUserIds).toEqual(["a", "b", "c"]);
  });

  it("keeps non-conflicted pairs intact alongside a conflicted cluster", () => {
    const result = resolveDuoPairSet([P("a", "b"), P("a", "c"), P("x", "y")]);

    expect(result.conflictingUserIds).toEqual(["a", "b", "c"]);
    expect(result.pairs).toEqual([P("x", "y")]);
    expect(result.duoPartnerOf.get("x")).toBe("y");
    expect(result.duoInternalPairKeys).toEqual(new Set(["x|y"]));
  });

  it("dedupes an identical re-presented pair (either direction) — not a conflict", () => {
    const result = resolveDuoPairSet([P("a", "b"), P("b", "a"), P("a", "b")]);

    expect(result.conflictingUserIds).toEqual([]);
    expect(result.droppedPairCount).toBe(0);
    expect(result.pairs).toEqual([P("a", "b")]);
    expect(result.duoPartnerOf.get("a")).toBe("b");
    expect(result.duoInternalPairKeys).toEqual(new Set(["a|b"]));
  });

  it("ignores degenerate self-pairs defensively", () => {
    const result = resolveDuoPairSet([P("a", "a"), P("b", "c")]);

    expect(result.conflictingUserIds).toEqual([]);
    expect(result.pairs).toEqual([P("b", "c")]);
    expect(result.duoPartnerOf.has("a")).toBe(false);
  });

  it("is order-independent: shuffled input yields identical output", () => {
    const base = [P("a", "b"), P("a", "c"), P("b", "c"), P("x", "y")];
    const shuffled = [P("b", "c"), P("x", "y"), P("c", "a"), P("a", "b")];

    const a = resolveDuoPairSet(base);
    const b = resolveDuoPairSet(shuffled);

    expect(b.conflictingUserIds).toEqual(a.conflictingUserIds);
    expect(b.droppedPairCount).toBe(a.droppedPairCount);
    expect([...b.duoPartnerOf.entries()].sort()).toEqual(
      [...a.duoPartnerOf.entries()].sort(),
    );
    expect([...b.duoInternalPairKeys].sort()).toEqual(
      [...a.duoInternalPairKeys].sort(),
    );
    expect(b.pairs).toEqual(a.pairs);
  });
});
