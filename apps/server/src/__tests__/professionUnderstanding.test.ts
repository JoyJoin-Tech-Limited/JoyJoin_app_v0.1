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
  TOP_UP_MIN_COSINE,
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
  // Spy seam for the embedding client: tests control resolve/hang behaviour.
  embed: null as any,
  // Spy seam for safeLoadIndex: undefined → real implementation; a function
  // return value overrides the loaded index (e.g. `() => []` simulates a
  // misbuilt/misconfigured image that is missing occupation-vectors.json).
  safeLoadIndexImpl: null as null | (() => VectorEntry[]),
  // Captured by the occupationVectorIndex mock factory (avoids TDZ on a
  // module-level `let`, since vi.mock factories are hoisted).
  realSafeLoadIndex: null as null | typeof import("../lib/occupationVectorIndex").safeLoadIndex,
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
  embeddingClient: { embed: (...args: unknown[]) => h.embed(...args) },
}));
// Keep the real index machinery (loadIndex/cosine) but let a test override
// what safeLoadIndex() returns — e.g. `() => []` for a misbuilt image.
vi.mock("../lib/occupationVectorIndex", async (importActual) => {
  const actual = await importActual<typeof import("../lib/occupationVectorIndex")>();
  h.realSafeLoadIndex = actual.safeLoadIndex;
  return {
    ...actual,
    safeLoadIndex: () => (h.safeLoadIndexImpl ?? h.realSafeLoadIndex!)(),
  };
});
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
  h.embed = vi.fn(async () => null);
  h.safeLoadIndexImpl = null;
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

describe("resolveProfessionOccupation — missing vector index (Fix A, production posture)", () => {
  // Production Docker images ship without apps/server/data/occupation-vectors.json,
  // so safeLoadIndex() returns []. No embedding quota/latency may be spent then.
  const classification = {
    category: { id: "tech", label: "科技互联网" },
    segment: { id: "software_dev", label: "软件开发" },
    niche: { id: "backend", label: "后端开发" },
    candidates: seedCatalogResult().candidates,
  };

  it("never calls the embedding client when the index is empty (no exact match)", async () => {
    h.safeLoadIndexImpl = () => [];
    const resolved = await resolveProfessionOccupation("完全不存在的东西xyz", classification, {
      threshold: 0.5,
    });
    expect(h.embed).not.toHaveBeenCalled();
    expect(resolved.standardizedOccupationId).toBeNull();
    // Deterministic candidate mapping is preserved unchanged.
    expect(resolved.correctionCandidates.occupation).toEqual([
      { id: "investor", label: "投资人" },
      { id: "product_manager", label: "产品经理" },
    ]);
  });

  it("never calls the embedding client when the index is empty (exact match, top-up needed)", async () => {
    h.safeLoadIndexImpl = () => [];
    const resolved = await resolveProfessionOccupation("前端工程师", classification, {
      threshold: 0.5,
    });
    expect(h.embed).not.toHaveBeenCalled();
    expect(resolved.standardizedOccupationId).toBe("frontend_engineer");
    expect(resolved.correctionCandidates.occupation).toEqual([
      { id: "investor", label: "投资人" },
      { id: "product_manager", label: "产品经理" },
    ]);
  });
});

describe("resolveProfessionOccupation — bounded embedding (Fix B)", () => {
  const classification = {
    category: { id: "tech", label: "科技互联网" },
    segment: { id: "software_dev", label: "软件开发" },
    niche: { id: "backend", label: "后端开发" },
    candidates: seedCatalogResult().candidates,
  };
  const fakeIndex: VectorEntry[] = [
    { id: "backend_engineer", displayName: "后端工程师", industryId: "tech", vector: [1, 0] },
  ];

  it("preserves the deterministic result when the embedding call hangs past its budget", async () => {
    h.safeLoadIndexImpl = () => fakeIndex;
    // Simulate a hung provider: never settles unless the abort signal fires
    // (mirrors how the real OpenAI client rejects on AbortSignal).
    h.embed = vi.fn(
      (_text: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const startedAt = Date.now();
    const resolved = await resolveProfessionOccupation("前端工程师", classification, {
      threshold: 0.5,
      embeddingTimeoutMs: 25,
    });
    const elapsedMs = Date.now() - startedAt;

    // The exact-match id and the deterministic candidates survive the timeout —
    // previously the route's outer catch discarded them as EMPTY.
    expect(resolved.standardizedOccupationId).toBe("frontend_engineer");
    expect(resolved.correctionCandidates.occupation).toEqual([
      { id: "investor", label: "投资人" },
      { id: "product_manager", label: "产品经理" },
    ]);
    // The abort budget bounded the wait — no 1500ms+ hang reached the route.
    expect(elapsedMs).toBeLessThan(1000);
  });

  it("returns null id (no guess) but keeps deterministic candidates on embedding timeout without an exact match", async () => {
    h.safeLoadIndexImpl = () => fakeIndex;
    h.embed = vi.fn(
      (_text: string, options?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    const resolved = await resolveProfessionOccupation("完全不存在的东西xyz", classification, {
      threshold: 0.5,
      embeddingTimeoutMs: 25,
    });

    expect(h.embed).toHaveBeenCalledTimes(1);
    expect(resolved.standardizedOccupationId).toBeNull();
    expect(resolved.correctionCandidates.occupation).toEqual([
      { id: "investor", label: "投资人" },
      { id: "product_manager", label: "产品经理" },
    ]);
  });
});

describe("resolveProfessionOccupation — empty-index observability (Fix C)", () => {
  it("warns once per process when the vector index is missing/empty", async () => {
    h.safeLoadIndexImpl = () => [];
    // Fresh module instance so the memoized "already logged" flag starts false
    // regardless of what earlier tests triggered on the shared instance.
    vi.resetModules();
    const [{ logger }, fresh] = await Promise.all([
      import("../lib/logger"),
      import("../lib/occupationResolution"),
    ]);
    const classification = {
      category: { id: "tech", label: "科技互联网" },
      segment: { id: "software_dev", label: "软件开发" },
      niche: { id: "backend", label: "后端开发" },
      candidates: [],
    };

    await fresh.resolveProfessionOccupation("前端工程师", classification);
    await fresh.resolveProfessionOccupation("产品经理", classification);

    const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) => String(args[0]).includes("vector index"),
    );
    expect(warnCalls).toHaveLength(1);
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

describe("topUpOccupationCandidates — category scoping + cosine floor (tray fix)", () => {
  // Mixed-category fake index. Cross-category entries carry HIGHER cosines on
  // purpose: the pre-fix tray ranked the whole index globally, which is exactly
  // how 并购顾问 (finance) ended up offering 房产经纪/教育顾问/销售经理.
  const mixedIndex: VectorEntry[] = [
    { id: "trader", displayName: "交易员", industryId: "finance", vector: [0.9, 0.1] },
    { id: "analyst", displayName: "分析师", industryId: "finance", vector: [0.8, 0.2] },
    { id: "real_estate_agent", displayName: "房产经纪", industryId: "realestate", vector: [0.99, 0.01] },
    { id: "education_consultant", displayName: "教育顾问", industryId: "education", vector: [0.98, 0.02] },
    { id: "sales_manager", displayName: "销售经理", industryId: "marketing", vector: [0.97, 0.03] },
  ];

  it("restricts the tray to the classified category even when cross-category entries score higher", () => {
    const toppedUp = topUpOccupationCandidates([], [1, 0], mixedIndex, null, {
      categoryId: "finance",
      segmentId: "investment_banking",
    });
    expect(toppedUp.map((c) => c.id)).toEqual(["trader", "analyst"]);
    expect(toppedUp.some((c) => c.id === "real_estate_agent")).toBe(false);
    expect(toppedUp.some((c) => c.id === "education_consultant")).toBe(false);
    expect(toppedUp.some((c) => c.id === "sales_manager")).toBe(false);
  });

  it("keeps existing entries, respects dedup + excludeId, and caps at 3 within the scope", () => {
    const index: VectorEntry[] = [
      { id: "investor", displayName: "投资人", industryId: "finance", vector: [1, 0] },
      { id: "trader", displayName: "交易员", industryId: "finance", vector: [0.9, 0.1] },
      { id: "analyst", displayName: "分析师", industryId: "finance", vector: [0.8, 0.2] },
      { id: "banker", displayName: "银行家", industryId: "finance", vector: [0.7, 0.3] },
      ...mixedIndex.filter((e) => e.industryId !== "finance"),
    ];
    const toppedUp = topUpOccupationCandidates(
      [{ id: "investor", label: "投资人" }],
      [1, 0],
      index,
      "banker",
      { categoryId: "finance" },
    );
    expect(toppedUp.map((c) => c.id)).toEqual(["investor", "trader", "analyst"]);
  });

  it("admits entries whose seedMappings anchor them to the classified category (signal b)", () => {
    // Real catalog anchors: crypto_trader has industryId "tech" but
    // seedMappings finance/pe_vc; accountant has industryId "finance" but
    // seedMappings professional_services/consulting.
    const index: VectorEntry[] = [
      { id: "crypto_trader", displayName: "加密货币交易员", industryId: "tech", vector: [0.9, 0.1] },
      { id: "accountant", displayName: "会计师", industryId: "finance", vector: [0.85, 0.15] },
      { id: "trader", displayName: "交易员", industryId: "finance", vector: [0.8, 0.2] },
    ];
    const financeTray = topUpOccupationCandidates([], [1, 0], index, null, {
      categoryId: "finance",
    });
    expect(financeTray.map((c) => c.id)).toEqual(["crypto_trader", "accountant", "trader"]);

    const profServicesTray = topUpOccupationCandidates([], [1, 0], index, null, {
      categoryId: "professional_services",
    });
    expect(profServicesTray.map((c) => c.id)).toEqual(["accountant"]);
  });

  it("falls back to the global index when the classified category has no scoped entries", () => {
    // "gaming" has no industryId mapping and no seedMappings anchor, so the
    // scoped set is empty — coverage must come from the global pool instead of
    // returning an empty tray.
    const toppedUp = topUpOccupationCandidates([], [1, 0], mixedIndex, null, {
      categoryId: "gaming",
    });
    expect(toppedUp).toHaveLength(3);
    expect(toppedUp[0].id).toBe("real_estate_agent"); // highest cosine globally
  });

  it("excludes entries below TOP_UP_MIN_COSINE even when that leaves fewer than 3", () => {
    const below = TOP_UP_MIN_COSINE - 0.01;
    const above = TOP_UP_MIN_COSINE + 0.01;
    const index: VectorEntry[] = [
      { id: "above", displayName: "贴线之上", industryId: "finance", vector: [above, Math.sqrt(1 - above * above)] },
      { id: "below", displayName: "贴线之下", industryId: "finance", vector: [below, Math.sqrt(1 - below * below)] },
      { id: "orthogonal", displayName: "完全无关", industryId: "finance", vector: [0, 1] },
    ];
    const toppedUp = topUpOccupationCandidates([], [1, 0], index, null, {
      categoryId: "finance",
    });
    expect(toppedUp.map((c) => c.id)).toEqual(["above"]);
  });

  it("returns an empty occupation group (not garbage) when every candidate falls below the floor", () => {
    const index: VectorEntry[] = [
      { id: "noise_a", displayName: "无关甲", industryId: "finance", vector: [0, 1] },
      { id: "noise_b", displayName: "无关乙", industryId: "finance", vector: [-0.2, 0.9] },
    ];
    const toppedUp = topUpOccupationCandidates([], [1, 0], index, null, {
      categoryId: "finance",
    });
    expect(toppedUp).toEqual([]);
  });
});

describe("occupation catalog — new finance entries (Fix 2)", () => {
  it("resolves 并购顾问 and its synonyms to the canonical ma_advisor id", () => {
    expect(findExactOccupationId("并购顾问")).toBe("ma_advisor");
    expect(findExactOccupationId("并购")).toBe("ma_advisor");
    expect(findExactOccupationId("M&A")).toBe("ma_advisor");
    expect(findExactOccupationId("兼并收购")).toBe("ma_advisor");
    expect(findExactOccupationId("M&A顾问")).toBe("ma_advisor");
  });

  it("resolves 投资经理 / 行业研究员 to their canonical ids", () => {
    expect(findExactOccupationId("投资经理")).toBe("investment_manager");
    expect(findExactOccupationId("投资管理")).toBe("investment_manager");
    expect(findExactOccupationId("基金经理助理")).toBe("investment_manager");
    expect(findExactOccupationId("行业研究员")).toBe("industry_researcher");
    expect(findExactOccupationId("行研")).toBe("industry_researcher");
    expect(findExactOccupationId("证券分析师")).toBe("industry_researcher");
  });

  it("keeps existing exact matches intact after the synonym moves", () => {
    expect(findExactOccupationId("战投")).toBe("cvc_strategic");
    expect(findExactOccupationId("CVC")).toBe("cvc_strategic");
    expect(findExactOccupationId("投资")).toBe("pe_vc");
    expect(findExactOccupationId("金融分析师")).toBe("finance_analyst");
    // Pre-existing ambiguities stay null (never a guess), ownership unchanged:
    // “研究员” is shared by finance_analyst + researcher; “基金经理” is
    // fund_manager's displayName and still a pe_vc synonym.
    expect(findExactOccupationId("研究员")).toBeNull();
    expect(findExactOccupationId("基金经理")).toBeNull();
  });

  it("drives a non-null standardizedOccupationId for 并购顾问 end to end", async () => {
    const classification = {
      category: { id: "finance", label: "金融服务" },
      segment: { id: "investment_banking", label: "投资银行" },
      niche: { id: "ma_advisory", label: "并购顾问" },
      candidates: undefined,
    };
    const resolved = await resolveProfessionOccupation("并购顾问", classification);
    expect(resolved.standardizedOccupationId).toBe("ma_advisor");
    expect(resolved.standardizedOccupationId).not.toBe(classification.niche.id);
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

  it("scopes the vector top-up tray to the classified category (并购顾问 regression)", async () => {
    // Verified bug: 并购顾问 classifies as 金融服务 › 投资银行 › 并购顾问 at
    // 0.98 (no classifier candidates), and the unscoped/floorless top-up then
    // filled the 角色 tray with 房产经纪/教育顾问/销售经理.
    h.classifyUnified.mockResolvedValue({
      category: { id: "finance", label: "金融服务" },
      segment: { id: "investment_banking", label: "投资银行" },
      niche: { id: "ma_advisory", label: "并购顾问" },
      confidence: 0.98,
      source: "taxonomy" as const,
      processingTimeMs: 1,
      rawInput: "并购顾问",
      normalizedInput: "并购顾问",
      candidates: undefined,
    });
    h.classify.mockResolvedValue(null);
    h.embed = vi.fn(async () => ({
      vector: [1, 0],
      model: "mock-embedding",
      dimensions: 2,
      provider: "self_hosted" as const,
    }));
    h.safeLoadIndexImpl = () => [
      { id: "investment_banker", displayName: "投行(IBD)", industryId: "finance", vector: [0.9, 0.1] },
      { id: "pe_vc", displayName: "PE/VC投资", industryId: "finance", vector: [0.8, 0.2] },
      // Cross-category entries outrank the finance ones on raw cosine — the
      // pre-fix behaviour this test locks against.
      { id: "real_estate_agent", displayName: "房产经纪", industryId: "realestate", vector: [0.99, 0.01] },
      { id: "education_consultant", displayName: "教育顾问", industryId: "education", vector: [0.98, 0.02] },
      { id: "sales_manager", displayName: "销售经理", industryId: "marketing", vector: [0.97, 0.03] },
    ];

    const { status, body } = await classify("并购顾问");

    expect(status).toBe(200);
    expect(body.classification.standardizedOccupationId).toBe("ma_advisor");
    const occupationTray = body.correctionCandidates.occupation as Array<{
      id: string;
      label: string;
    }>;
    expect(occupationTray.map((c) => c.id)).toEqual(["investment_banker", "pe_vc"]);
    expect(occupationTray.some((c) => c.id === "real_estate_agent")).toBe(false);
    expect(occupationTray.some((c) => c.id === "education_consultant")).toBe(false);
    expect(occupationTray.some((c) => c.id === "sales_manager")).toBe(false);
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
