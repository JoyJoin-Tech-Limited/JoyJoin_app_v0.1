/**
 * Drift guard for the committed occupation vector index.
 *
 * `apps/server/data/occupation-vectors.json` is committed and baked into the
 * runtime image (see Dockerfile), so the correction-candidate top-up and the
 * (τ-gated) embedding resolution depend on it. If `packages/shared/src/occupations.ts`
 * changes without regenerating the index, production would silently serve stale
 * candidates. Regenerate with:
 *
 *   npx tsx scripts/build-occupation-vectors.mts
 *
 * This test fails loudly when the committed index no longer covers the current
 * OCCUPATIONS (added/removed/renamed occupations).
 */
import { describe, it, expect } from "vitest";
import { OCCUPATIONS } from "@shared/occupations";
import { loadIndex } from "../lib/occupationVectorIndex";

describe("occupation vector index drift guard", () => {
  it("covers exactly the current OCCUPATIONS ids and display names", () => {
    const index = loadIndex();
    const byId = new Map(index.map((entry) => [entry.id, entry]));

    const missing = OCCUPATIONS.filter((occ) => !byId.has(occ.id)).map((occ) => occ.id);
    expect(
      missing,
      `Missing vectors for: ${missing.join(", ")} — run: npx tsx scripts/build-occupation-vectors.mts (and commit the result)`,
    ).toEqual([]);

    const renamed = OCCUPATIONS.filter(
      (occ) => byId.get(occ.id)?.displayName !== occ.displayName,
    ).map((occ) => occ.id);
    expect(
      renamed,
      `displayName drift for: ${renamed.join(", ")} — regenerate the index`,
    ).toEqual([]);

    const extra = index
      .filter((entry) => !OCCUPATIONS.some((occ) => occ.id === entry.id))
      .map((entry) => entry.id);
    expect(extra, `Stale vector entries: ${extra.join(", ")} — regenerate the index`).toEqual(
      [],
    );

    expect(index.length).toBe(OCCUPATIONS.length);
  });

  it("every vector entry has a full-length numeric vector", () => {
    const index = loadIndex();
    const dim = index[0]?.vector.length ?? 0;
    expect(dim).toBeGreaterThan(0);
    for (const entry of index) {
      expect(entry.vector.length, `bad vector length for ${entry.id}`).toBe(dim);
      expect(entry.vector.every((n) => Number.isFinite(n)), `non-finite value in ${entry.id}`).toBe(
        true,
      );
    }
  });
});
