/**
 * 转化 P0d (S5.1) — deterministic 50/50 experiment bucketing.
 *
 * Covers lib/experimentBucket.ts plus the mount contract on
 * GET /api/payments/ritual-context (routes/domains/payments.ts):
 * the bucket field is emitted ONLY when preRevealRefundEnabled is ON
 * (fail-closed), keeping the bucket on the same resolution chain as the flag.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveExperimentBucket } from "../lib/experimentBucket";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Deterministic PRNG (mulberry32) so the distribution sample is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("resolveExperimentBucket — determinism", () => {
  it("returns the same bucket for the same userId across repeated calls", () => {
    const ids = [
      "user-benchmark-golden-a",
      "user-benchmark-golden-b",
      "9f3c2a7b-1111-4abc-8def-02468ace1357",
      "00000000-0000-0000-0000-000000000001",
      "a".repeat(256),
    ];
    for (const id of ids) {
      const first = resolveExperimentBucket(id);
      for (let i = 0; i < 25; i += 1) {
        expect(resolveExperimentBucket(id)).toBe(first);
      }
    }
  });

  it("matches documented sha256 golden vectors (algorithm pinned)", () => {
    // bucket = parseInt(sha256(userId).hex.slice(0, 8), 16) % 2
    // NOTE: golden ids renamed 2026-10-21 (competitor codename scrub);
    // expectations below recomputed against the pinned algorithm — do NOT
    // rename ids again without recomputing.
    expect(resolveExperimentBucket("user-benchmark-golden-a")).toBe(1);
    expect(resolveExperimentBucket("user-benchmark-golden-d")).toBe(0);
    expect(resolveExperimentBucket("9f3c2a7b-1111-4abc-8def-02468ace1357")).toBe(1);
    expect(resolveExperimentBucket("00000000-0000-0000-0000-000000000001")).toBe(1);
  });
});

describe("resolveExperimentBucket — distribution", () => {
  it("splits ≥1000 pseudo-random ids within 45%–55% per bucket", () => {
    const rng = mulberry32(20261021);
    const SAMPLE_SIZE = 2000;
    let bucketOne = 0;

    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      // UUID-shaped ids with deterministic pseudo-random content.
      const hex = () =>
        Math.floor(rng() * 0xffffffff)
          .toString(16)
          .padStart(8, "0");
      const id = `${hex()}-${hex().slice(0, 4)}-4${hex().slice(1, 4)}-8${hex().slice(1, 4)}-${hex()}${hex()}`;
      if (resolveExperimentBucket(id) === 1) bucketOne += 1;
    }

    const ratio = bucketOne / SAMPLE_SIZE;
    expect(ratio).toBeGreaterThanOrEqual(0.45);
    expect(ratio).toBeLessThanOrEqual(0.55);
  });
});

describe("resolveExperimentBucket — boundary inputs", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["tab/newline only", "\t\n "],
  ])("maps %s to the deterministic control bucket 0", (_label, input) => {
    expect(resolveExperimentBucket(input)).toBe(0);
  });

  it("never throws on non-string inputs and always returns control bucket 0", () => {
    const inputs: unknown[] = [null, undefined, 0, 1, 12345, true, false, {}, [], NaN];
    for (const input of inputs) {
      expect(() => resolveExperimentBucket(input)).not.toThrow();
      expect(resolveExperimentBucket(input)).toBe(0);
    }
  });

  it("treats a whitespace-padded id as valid (trim-only input is hashed)", () => {
    // Only blank-after-trim is rejected; a padded real id still hashes stably.
    const padded = "  user-benchmark-golden-a  ";
    const calls = new Set(
      Array.from({ length: 10 }, () => resolveExperimentBucket(padded)),
    );
    expect(calls.size).toBe(1);
  });
});

describe("ritual-context mount contract (转化 P0d)", () => {
  const paymentsSrc = readFileSync(
    join(__dirname, "../routes/domains/payments.ts"),
    "utf8",
  );

  it("emits refundNarrativeBucket from the same handler that resolves preRevealRefundEnabled", () => {
    expect(paymentsSrc).toContain('getFeatureFlag("preRevealRefundEnabled"');
    expect(paymentsSrc).toContain("resolveExperimentBucket(userId)");
    expect(paymentsSrc).toContain("refundNarrativeBucket");
  });

  it("gates the field behind the flag (fail-closed: flag off → field omitted)", () => {
    // The response spread must be conditional on the resolved flag value.
    expect(paymentsSrc).toMatch(
      /refundNarrativeBucket\s*!==\s*null\s*\?\s*\{\s*refundNarrativeBucket\s*\}\s*:\s*\{\}/,
    );
  });
});
