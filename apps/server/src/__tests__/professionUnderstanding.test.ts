/**
 * Server-side tests for the profession-understanding correction ladder (Tier-2
 * contract sprint_20260915_profession_chips_ladder, deliverables D1/D2/D5).
 *
 * Covers:
 *  - deterministic occupation resolution (exact/synonym → canonical id, else null)
 *  - `standardizedOccupationId` is a canonical `OCCUPATIONS.id` and ≠ industryNiche
 *  - `correctionCandidates` shape/passthrough from `generateCandidates()` output
 *  - fallback still carries the raw input and resolves to `null` (never guesses)
 *  - τ boundary behaviour
 *  - `shouldShowAIGCLabel(undefined) === false`
 */

import { readFileSync } from "node:fs";
import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OCCUPATION_RESOLUTION_THRESHOLD,
  findExactOccupationId,
  findIndexMatch,
  mapCandidateGroups,
  resolveProfessionOccupation,
  topUpOccupationCandidates,
} from "../lib/occupationResolution";
import { loadIndex, type VectorEntry } from "../lib/occupationVectorIndex";
import { shouldShowAIGCLabel } from "@shared/api/aigc";
import { OCCUPATIONS } from "@shared/occupations";

const h = vi.hoisted(() => ({
  classifyUnified: null as any,
  classify: null as any,
  // Spy seam: the mocked deepseek client routes every call through this spy and
  // still throws ("ai offline") so existing fail-closed behavior is unchanged.
  deepseekCreate: null as any,
  // Allows a test to use a distinct rate-limit bucket (the route limiter is
  // keyed by user id, 10 calls/min).
  authenticatedUserId: "test-user",
}));

vi.mock("../inference/industryClassifier", () => ({
  classifyIndustryUnified: (...args: unknown[]) => h.classifyUnified(...args),
  classifyIndustry: (...args: unknown[]) => h.classify(...args),
}));
vi.mock("../db", () => ({ db: {} }));
vi.mock("../ai/deepseekClient", () => ({
  getDeepseekClient: () => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => h.deepseekCreate(...args),
      },
    },
  }),
  getDeepseekModel: () => "mock-model",
}));
vi.mock("../lib/aiContentModeration", () => ({
  moderateGeneratedContent: () => ({ safe: true, field: null }),
}));
vi.mock("../embeddingClient", () => ({
  embeddingClient: { embed: async () => null },
}));
vi.mock("../lib/requestAuth", () => ({
  getAuthenticatedUserId: () => h.authenticatedUserId,
}));
vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

const { registerProfessionUnderstandingRoutes } = await import(
  "../routes/domains/professionUnderstanding"
);

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerProfessionUnderstandingRoutes(app);
  return app;
}

function seedCatalogResult() {
  return {
    category: { id: "tech", label: "科技互联网" },
    segment: { id: "software_dev", label: "软件开发" },
    niche: { id: "backend", label: "后端开发" },
    confidence: 0.62,
    source: "seed" as const,
    processingTimeMs: 1,
    rawInput: "前端工程师",
    normalizedInput: "前端工程师",
    candidates: [
      {
        category: { id: "finance", label: "金融投资" },
        segment: { id: "pe_vc", label: "投资" },
        confidence: 0.5,
        reasoning: "匹配到：投资",
        occupationId: "investor",
        occupationName: "投资人",
      },
      {
        category: { id: "tech", label: "科技互联网" },
        segment: { id: "product", label: "产品" },
        confidence: 0.4,
        reasoning: "匹配到：产品",
        occupationId: "product_manager",
        occupationName: "产品经理",
      },
    ],
  };
}

function fallbackCatalogResult() {
  return {
    category: { id: "other", label: "其他行业" },
    segment: { id: "general", label: "通用" },
    confidence: 0.1,
    source: "fallback" as const,
    processingTimeMs: 1,
    rawInput: "摸鱼大师",
    normalizedInput: "摸鱼大师",
    candidates: [],
  };
}

async function classify(description: string): Promise<any> {
  return withServer(buildTestApp(), async (base) => {
    const res = await fetch(`${base}/api/inference/understand-profession`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description }),
    });
    return { status: res.status, body: await res.json() };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.classifyUnified = vi.fn();
  h.classify = vi.fn();
  h.deepseekCreate = vi.fn(async () => {
    throw new Error("ai offline");
  });
  h.authenticatedUserId = "test-user";
});

describe("occupation resolution — deterministic steps (D2)", () => {
  it("resolves exact displayName / synonym matches to the canonical OCCUPATIONS.id", () => {
    expect(findExactOccupationId("前端工程师")).toBe("frontend_engineer");
    expect(findExactOccupationId("前端开发")).toBe("frontend_engineer");
    expect(findExactOccupationId("PM")).toBe("product_manager");
  });

  it("does not guess on ambiguous or unknown input", () => {
    // "大厂" is a synonym shared by several occupations → ambiguous → null.
    expect(findExactOccupationId("大厂")).toBeNull();
    expect(findExactOccupationId("完全不存在的东西xyz")).toBeNull();
  });

  it("honours the τ boundary inclusively (confidence ≥ τ)", () => {
    const index: VectorEntry[] = [
      { id: "a", displayName: "A", industryId: "tech", vector: [1, 0] },
      { id: "b", displayName: "B", industryId: "tech", vector: [0, 1] },
    ];
    // cos([1,0],[1,0]) === 1
    expect(findIndexMatch([1, 0], index, 1)?.occupationId).toBe("a");
    expect(findIndexMatch([1, 0], index, 1.0001)).toBeNull();
    // cos([1,1],[1,1]) === 1 on the diagonal entry; cos with [1,0] ≈ 0.7071
    expect(findIndexMatch([1, 1], index, 0.7071)?.occupationId).toBe("a");
    expect(findIndexMatch([1, 1], index, 0.7072)).toBeNull();
    // Empty index never matches.
    expect(findIndexMatch([1, 0], [], 0.1)).toBeNull();
  });

  it("exposes a fail-closed runtime threshold invariant (null or > 0.35)", () => {
    if (OCCUPATION_RESOLUTION_THRESHOLD !== null) {
      expect(OCCUPATION_RESOLUTION_THRESHOLD).toBeGreaterThan(0.35);
    }
  });

  it("keeps the shared vector index memoized and non-empty when the artifact is present", () => {
    let first: VectorEntry[];
    try {
      first = loadIndex();
    } catch {
      return; // generated artifact absent in a clean checkout — covered elsewhere
    }
    expect(first.length).toBeGreaterThan(0);
    expect(loadIndex()).toBe(first);
  });
});

describe("resolveProfessionOccupation (D2)", () => {
  it("returns a canonical id for an exact match and null for no match", async () => {
    const classification = {
      category: { id: "tech", label: "科技互联网" },
      segment: { id: "software_dev", label: "软件开发" },
      niche: { id: "backend", label: "后端开发" },
      candidates: [],
    };
    const resolved = await resolveProfessionOccupation("前端工程师", classification);
    expect(resolved.standardizedOccupationId).toBe("frontend_engineer");
    expect(resolved.standardizedOccupationId).not.toBe(classification.niche.id);

    const unresolved = await resolveProfessionOccupation("完全不存在的东西xyz", classification);
    expect(unresolved.standardizedOccupationId).toBeNull();
  });
});

describe("correctionCandidates mapping (D1)", () => {
  const candidates = seedCatalogResult().candidates;

  it("dedupes, excludes already-chosen values, and caps each group at 3", () => {
    const groups = mapCandidateGroups(candidates, {
      categoryId: "tech",
      segmentId: "software_dev",
      occupationId: "product_manager",
    });
    expect(groups.category).toEqual([{ id: "finance", label: "金融投资" }]);
    expect(groups.segment).toEqual([
      { id: "pe_vc", label: "投资" },
      { id: "product", label: "产品" },
    ]);
    expect(groups.occupation).toEqual([{ id: "investor", label: "投资人" }]);
  });

  it("tops up the occupation group from the vector index without dropping existing entries", () => {
    const index: VectorEntry[] = [
      { id: "investor", displayName: "投资人", industryId: "finance", vector: [1, 0] },
      { id: "trader", displayName: "交易员", industryId: "finance", vector: [0.9, 0.1] },
      { id: "analyst", displayName: "分析师", industryId: "finance", vector: [0.8, 0.2] },
      { id: "banker", displayName: "银行家", industryId: "finance", vector: [0.7, 0.3] },
    ];
    const toppedUp = topUpOccupationCandidates(
      [{ id: "investor", label: "投资人" }],
      [1, 0],
      index,
      null,
    );
    expect(toppedUp[0]).toEqual({ id: "investor", label: "投资人" });
    expect(toppedUp).toHaveLength(3);
    expect(toppedUp.map((c) => c.id)).toEqual(["investor", "trader", "analyst"]);
  });
});

describe("POST /api/inference/understand-profession (D1 + D2 + fallback)", () => {
  it("passes correctionCandidates through and resolves a canonical standardizedOccupationId", async () => {
    h.classifyUnified.mockResolvedValue(seedCatalogResult());
    h.classify.mockResolvedValue(null);

    const { status, body } = await classify("前端工程师");

    expect(status).toBe(200);
    expect(body.classification.standardizedOccupationId).toBe("frontend_engineer");
    expect(body.classification.niche).toEqual({ id: "backend", label: "后端开发" });
    expect(body.classification.standardizedOccupationId).not.toBe(body.classification.niche.id);

    expect(body.correctionCandidates).toBeDefined();
    expect(body.correctionCandidates.category).toEqual([{ id: "finance", label: "金融投资" }]);
    expect(body.correctionCandidates.segment).toEqual([
      { id: "pe_vc", label: "投资" },
      { id: "product", label: "产品" },
    ]);
    expect(body.correctionCandidates.occupation).toEqual([
      { id: "investor", label: "投资人" },
      { id: "product_manager", label: "产品经理" },
    ]);
    for (const group of Object.values(body.correctionCandidates) as Array<unknown[]>) {
      expect(group.length).toBeLessThanOrEqual(3);
    }
  });

  it("keeps fallback raw input and resolves to null without guessing or emitting chips", async () => {
    h.classifyUnified.mockResolvedValue(fallbackCatalogResult());
    h.classify.mockResolvedValue(null);

    const { status, body } = await classify("摸鱼大师");

    expect(status).toBe(200);
    expect(body.source).toBe("fallback");
    expect(body.reaction).toContain("摸鱼大师");
    expect(body.classification.standardizedOccupationId).toBeNull();
    expect(body.classification.niche).toBeNull();
    expect(body.correctionCandidates).toBeUndefined();
  });

  it("fails closed when the reaction LLM fails internally (fix #2 regression)", async () => {
    h.classifyUnified.mockResolvedValue(seedCatalogResult());
    h.classify.mockResolvedValue(null);

    // The mocked deepseek client throws ("ai offline"), so `generateAIReaction`
    // returns deterministic fallback copy. That content must NOT be labelled as
    // AI-generated — the internal-fallback path must set `reactionFallbackUsed`.
    const { status, body } = await classify("前端工程师");

    expect(status).toBe(200);
    expect(body.meta.aigc.aiGenerated).toBe(false);
    expect(shouldShowAIGCLabel(body.meta.aigc)).toBe(false);
  });
});

describe("AIGC fail-closed helper (AC-12 server half)", () => {
  it("does not show a label when meta is absent", () => {
    expect(shouldShowAIGCLabel(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QA follow-up: AC-10 fixture · REL-02 determinism · AC-09 candidate-id validity
// ---------------------------------------------------------------------------

/**
 * Schema fixture (AC-10): `fixtures/professionCorrectionCandidates.json` pins
 * the *shape* of the route's `correctionCandidates` (parent spec §7.1) — the
 * three keys, the `{ id, label }` entry members, and the ≤3-per-group cap — not
 * exact values, which depend on classifier input. Keys prefixed with `$` are
 * fixture metadata and are ignored by the shape assertion below.
 */
function loadCorrectionCandidatesFixture(): Record<string, unknown> {
  const raw = readFileSync(
    new URL("./fixtures/professionCorrectionCandidates.json", import.meta.url),
    "utf8",
  );
  return JSON.parse(raw) as Record<string, unknown>;
}

const CORRECTION_FIXTURE = loadCorrectionCandidatesFixture();
const CORRECTION_FIXTURE_SCHEMA_KEYS = Object.keys(CORRECTION_FIXTURE)
  .filter((key) => !key.startsWith("$"))
  .sort() as Array<"category" | "segment" | "occupation">;

/**
 * Catalog result whose candidate `occupationId`s are canonical `OCCUPATIONS`
 * ids, so the AC-09 id-validity assertion exercises the real contract
 * (`seedCatalogResult`'s synthetic `investor` id is not in `OCCUPATIONS`).
 */
function canonicalOccupationCatalogResult() {
  return {
    category: { id: "tech", label: "科技互联网" },
    segment: { id: "software_dev", label: "软件开发" },
    niche: { id: "backend", label: "后端开发" },
    confidence: 0.62,
    source: "seed" as const,
    processingTimeMs: 1,
    rawInput: "前端工程师",
    normalizedInput: "前端工程师",
    candidates: [
      {
        category: { id: "tech", label: "科技互联网" },
        segment: { id: "software_dev", label: "软件开发" },
        confidence: 0.55,
        reasoning: "匹配到：后端",
        occupationId: "backend_engineer",
        occupationName: "后端工程师",
      },
      {
        category: { id: "tech", label: "科技互联网" },
        segment: { id: "product", label: "产品" },
        confidence: 0.42,
        reasoning: "匹配到：产品",
        occupationId: "product_manager",
        occupationName: "产品经理",
      },
    ],
  };
}

describe("correctionCandidates shape fixture (AC-10)", () => {
  it("committed fixture declares exactly the three candidate groups", () => {
    expect(CORRECTION_FIXTURE_SCHEMA_KEYS).toEqual(["category", "occupation", "segment"]);
  });

  it("route correctionCandidates conform to the fixture shape (keys, entry type, ≤3, dedup, excludes chosen)", async () => {
    h.classifyUnified.mockResolvedValue(seedCatalogResult());
    h.classify.mockResolvedValue(null);

    const { status, body } = await classify("前端工程师");
    expect(status).toBe(200);
    expect(body.correctionCandidates).toBeDefined();

    // Same keys as the committed fixture (its metadata keys filtered out).
    expect(Object.keys(body.correctionCandidates).sort()).toEqual(CORRECTION_FIXTURE_SCHEMA_KEYS);

    const chosenByTier: Record<"category" | "segment" | "occupation", string | null> = {
      category: body.classification.category?.id ?? null,
      segment: body.classification.segment?.id ?? null,
      occupation: body.classification.standardizedOccupationId ?? null,
    };

    for (const key of CORRECTION_FIXTURE_SCHEMA_KEYS) {
      const group = body.correctionCandidates[key] as Array<{ id: string; label: string }>;
      expect(Array.isArray(group)).toBe(true);
      expect(group.length).toBeLessThanOrEqual(3);

      const ids = group.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length); // no duplicate ids
      for (const entry of group) {
        expect(typeof entry.id).toBe("string");
        expect(typeof entry.label).toBe("string");
        expect(entry.id).not.toBe(chosenByTier[key]); // id absent from already-chosen value
      }
    }
  });
});

describe("repeat-call determinism (REL-02)", () => {
  it("returns byte-identical classification + correctionCandidates across repeated route calls", async () => {
    // Distinct rate-limit bucket so the 5 repeat calls cannot collide with the
    // other route tests in this file (limiter: 10/min per user id).
    h.authenticatedUserId = "rel02-determinism-user";
    h.classifyUnified.mockResolvedValue(seedCatalogResult());
    h.classify.mockResolvedValue(null);

    const snapshots: string[] = [];
    await withServer(buildTestApp(), async (base) => {
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${base}/api/inference/understand-profession`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ description: "前端工程师" }),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        snapshots.push(
          JSON.stringify({
            classification: body.classification,
            correctionCandidates: body.correctionCandidates,
          }),
        );
      }
    });

    expect(snapshots).toHaveLength(5);
    for (const snapshot of snapshots) {
      expect(snapshot).toBe(snapshots[0]);
    }
  });

  it("makes no LLM call in the resolution path", async () => {
    const classification = canonicalOccupationCatalogResult();
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const resolved = await resolveProfessionOccupation("前端工程师", classification);
      results.push(JSON.stringify(resolved));
    }
    for (const result of results) {
      expect(result).toBe(results[0]);
    }
    // The deepseek client's `create` is a spy that would record any LLM call.
    expect(h.deepseekCreate).not.toHaveBeenCalled();
  });
});

describe("correctionCandidates id validity (AC-09 server half)", () => {
  it("emits only canonical OCCUPATIONS ids and a standardizedOccupationId distinct from the niche", async () => {
    h.classifyUnified.mockResolvedValue(canonicalOccupationCatalogResult());
    h.classify.mockResolvedValue(null);

    const { status, body } = await classify("前端工程师");
    expect(status).toBe(200);

    const canonicalIds = new Set(OCCUPATIONS.map((occupation) => occupation.id));

    const occupationCandidates = body.correctionCandidates.occupation as Array<{ id: string }>;
    expect(occupationCandidates.length).toBeGreaterThan(0);
    for (const candidate of occupationCandidates) {
      expect(canonicalIds.has(candidate.id)).toBe(true);
    }

    const standardized = body.classification.standardizedOccupationId as string | null;
    if (standardized !== null) {
      expect(canonicalIds.has(standardized)).toBe(true);
      expect(standardized).not.toBe(body.classification.niche?.id);
    }
  });
});
