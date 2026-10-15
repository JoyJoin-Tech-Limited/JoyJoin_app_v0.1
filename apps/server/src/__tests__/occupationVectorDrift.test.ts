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

/**
 * Occupations added to the catalog WITHOUT committed vectors yet (the Granite
 * embedding endpoint — `EMBEDDING_BASE_URL` — is a self-hosted sidecar that is
 * not reachable from every dev/CI environment, so the index cannot always be
 * regenerated in the same change). Exact/synonym resolution and the scoped
 * top-up (industryId/seedMappings signals) work for these entries regardless;
 * they simply cannot appear as vector top-up candidates until regenerated.
 *
 * Tripwire: the assertions below pin this list to EXACTLY the uncovered ids.
 * Regenerating `occupation-vectors.json` with these entries included makes the
 * "uncovered" set empty and FAILS the pin — forcing the list back to `[]` and
 * restoring full coverage strictness. Never grow this list silently.
 *
 * Regenerate with:
 *   EMBEDDING_BASE_URL=http://<granite-host>/v1 npx tsx scripts/build-occupation-vectors.mts
 *
 * 2026-10-15: regenerated (167 entries, Granite via staging tunnel); the list
 * must stay empty whenever full coverage holds. Only pin ids here when a new
 * OCCUPATIONS entry ships without regenerating the index yet.
 */
const OCCUPATIONS_AWAITING_VECTORS: readonly string[] = [];

describe("occupation vector index drift guard", () => {
  it("covers exactly the current OCCUPATIONS ids and display names, minus the pinned awaiting-vectors list", () => {
    const index = loadIndex();
    const byId = new Map(index.map((entry) => [entry.id, entry]));
    const awaiting = new Set(OCCUPATIONS_AWAITING_VECTORS);

    const missing = OCCUPATIONS.filter(
      (occ) => !byId.has(occ.id) && !awaiting.has(occ.id),
    ).map((occ) => occ.id);
    expect(
      missing,
      `Missing vectors for: ${missing.join(", ")} — run: npx tsx scripts/build-occupation-vectors.mts (and commit the result)`,
    ).toEqual([]);

    // Tripwire: the pinned list must equal the actual uncovered set. When the
    // index is regenerated this fails until OCCUPATIONS_AWAITING_VECTORS is
    // emptied — the guard can never quietly rot into a permanent exemption.
    const uncovered = OCCUPATIONS.filter((occ) => !byId.has(occ.id))
      .map((occ) => occ.id)
      .sort();
    const awaitingSorted = [...awaiting].sort();
    expect(
      uncovered,
      `Uncovered ids drifted from the pinned awaiting-vectors list (actual: ${uncovered.join(", ")}) — update OCCUPATIONS_AWAITING_VECTORS after regenerating the index`,
    ).toEqual(awaitingSorted);

    const renamed = OCCUPATIONS.filter(
      (occ) => byId.has(occ.id) && byId.get(occ.id)?.displayName !== occ.displayName,
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

    expect(index.length).toBe(OCCUPATIONS.length - awaiting.size);
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
