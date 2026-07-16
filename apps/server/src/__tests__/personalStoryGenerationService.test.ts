import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalStoryNarrativePlan } from "../services/personalStoryGenerationService";

const mocks = vi.hoisted(() => ({
  callCreativeAI: vi.fn(),
  logAITrace: vi.fn(),
}));

vi.mock("../ai/creativeModelRouter", () => ({
  callCreativeAI: mocks.callCreativeAI,
}));

vi.mock("../lib/aiTraceLogger", () => ({
  logAITrace: mocks.logAITrace,
}));

const {
  buildPersonalStoryFactPlan,
  formatPersonalStoryChapterTitle,
  generatePersonalStoryChapter,
  renderPersonalStoryNarrativePlan,
  validatePersonalStoryNarrativePlan,
} = await import("../services/personalStoryGenerationService");

const alangSource = {
  sourceType: "alang" as const,
  sourceId: "archive-1",
  occurredAt: "2026-07-15T10:00:00.000Z",
  keywords: {
    occurredOn: "2026-07-15",
    activityType: "闪现",
    location: "深圳湾公园",
    npc: "阿浪",
    finalMood: "安心",
    choices: ["先听阿浪说完", "一起走到终点"],
  },
};

const canonicalFactIds = [
  "occurred_on",
  "activity_type",
  "location",
  "npc",
  "final_mood",
  "choice:0",
  "choice:1",
];

const canonicalNarrative = {
  paragraphs: [
    {
      factIds: ["occurred_on", "activity_type", "location"],
      clauses: [
        { factId: "occurred_on", variant: "date_recorded" },
        { factId: "activity_type", variant: "activity_experience" },
        { factId: "location", variant: "location_happened" },
      ],
    },
    {
      factIds: ["npc", "final_mood", "choice:0", "choice:1"],
      clauses: [
        { factId: "npc", variant: "npc_present" },
        { factId: "final_mood", variant: "mood_remained" },
        { factId: "choice:0", variant: "choice_made" },
        { factId: "choice:1", variant: "choice_continued" },
      ],
    },
  ],
};

const canonicalBody =
  "2026年07月15日，这段真实经历被记录下来。这次真实经历属于闪现。这一段发生在深圳湾公园。\n\n"
  + "这次经历中出现了阿浪。最后留下的心情是安心。当时记录的选择是先听阿浪说完。接着，记录下的选择是一起走到终点。";

function mockModelNarrative(
  narrative: unknown,
  extra: Record<string, unknown> = {},
): void {
  mocks.callCreativeAI.mockResolvedValue({
    content: JSON.stringify({ ...extra, ...(narrative as object) }),
    provider: "minimax",
    model: "minimax-m2.7",
    latencyMs: 20,
    fallbackUsed: false,
  });
}

describe("personal story grounded narrative generation", () => {
  beforeEach(() => {
    mocks.callCreativeAI.mockReset();
    mocks.logAITrace.mockReset();
  });

  it("accepts a structured one-chapter narrative grounded in every verified fact", async () => {
    mockModelNarrative(canonicalNarrative);

    const result = await generatePersonalStoryChapter(alangSource);

    expect(result).toMatchObject({
      title: "2026.07.15 · 闪现",
      body: canonicalBody,
      provider: "minimax",
      model: "minimax-m2.7",
      promptVersion: "personal-story-grounded-narrative-v3",
      fallbackUsed: false,
    });
    expect(mocks.logAITrace).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: "personal_story",
        success: true,
        provider: "minimax",
      }),
    );
    expect(mocks.callCreativeAI).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.15,
        jsonObject: true,
        validateContent: expect.any(Function),
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining("每次只编排一章"),
          }),
        ]),
      }),
    );
  });

  it("lets the AI choose reviewed narrative variants and paragraph rhythm", () => {
    const allowed = buildPersonalStoryFactPlan(alangSource.keywords);
    const alternate: PersonalStoryNarrativePlan = {
      paragraphs: [
        {
          factIds: canonicalFactIds,
          clauses: [
            { factId: "occurred_on", variant: "date_story_began" },
            { factId: "activity_type", variant: "activity_recorded" },
            { factId: "location", variant: "location_recorded" },
            { factId: "npc", variant: "npc_recorded" },
            { factId: "final_mood", variant: "mood_recorded" },
            { factId: "choice:0", variant: "choice_continued" },
            { factId: "choice:1", variant: "choice_made" },
          ],
        },
      ],
    };

    const rendered = renderPersonalStoryNarrativePlan(alternate, allowed);

    expect(rendered).not.toBe(canonicalBody);
    expect(rendered).toContain("故事发生在2026年07月15日。");
    expect(rendered).toContain("地点记录为深圳湾公园。");
    expect(rendered).not.toContain("\n\n");
  });

  it("rejects unknown, duplicate, missing and reordered fact references", () => {
    const allowed = buildPersonalStoryFactPlan(alangSource.keywords);
    const invalid = {
      paragraphs: [
        {
          factIds: ["activity_type", "occurred_on", "unknown", "occurred_on"],
          clauses: [
            { factId: "activity_type", variant: "activity_recorded" },
            { factId: "occurred_on", variant: "date_recorded" },
            { factId: "unknown", variant: "npc_recorded" },
            { factId: "occurred_on", variant: "date_story_began" },
          ],
        },
      ],
    } as any;

    expect(validatePersonalStoryNarrativePlan(invalid, allowed)).toEqual({
      valid: false,
      errors: expect.arrayContaining([
        "unknown_fact_id",
        "duplicate_fact_id",
        "missing_fact_id",
        "noncanonical_order",
      ]),
    });
  });

  it("rejects a connector variant that changes a fact's semantic role", () => {
    const allowed = buildPersonalStoryFactPlan(alangSource.keywords);
    const invalid = structuredClone(canonicalNarrative) as any;
    invalid.paragraphs[0].clauses[2].variant = "mood_remained";

    expect(validatePersonalStoryNarrativePlan(invalid, allowed)).toEqual({
      valid: false,
      errors: ["invalid_clause_variant"],
    });
  });

  it("rejects paragraph metadata that does not exactly match its clauses", () => {
    const allowed = buildPersonalStoryFactPlan(alangSource.keywords);
    const invalid = structuredClone(canonicalNarrative) as any;
    invalid.paragraphs[0].factIds = ["occurred_on", "location", "activity_type"];

    expect(validatePersonalStoryNarrativePlan(invalid, allowed)).toEqual({
      valid: false,
      errors: ["paragraph_fact_ids_mismatch"],
    });
  });

  it("rejects invented prose, entities, numbers and places even beside a valid plan", async () => {
    mockModelNarrative(canonicalNarrative, {
      body: "我又认识了小林，并在广州走了300米，任务十分成功。",
    });

    await expect(generatePersonalStoryChapter(alangSource)).rejects.toThrow(
      "PERSONAL_STORY_INVALID_MODEL_OUTPUT",
    );
    expect(mocks.logAITrace).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "invalid_model_output" }),
    );
  });

  it("rejects free prose hidden inside an otherwise valid clause", async () => {
    const invalid = structuredClone(canonicalNarrative) as any;
    invalid.paragraphs[0].clauses[0].text = "这是难忘又成功的一天";
    mockModelNarrative(invalid);

    await expect(generatePersonalStoryChapter(alangSource)).rejects.toThrow(
      "PERSONAL_STORY_INVALID_MODEL_OUTPUT",
    );
  });

  it("fails the source when the model omits a pending fact", async () => {
    const invalid = structuredClone(canonicalNarrative) as any;
    invalid.paragraphs[0].factIds = invalid.paragraphs[0].factIds.slice(0, 2);
    invalid.paragraphs[0].clauses = invalid.paragraphs[0].clauses.slice(0, 2);
    mockModelNarrative(invalid);

    await expect(generatePersonalStoryChapter(alangSource)).rejects.toThrow(
      "PERSONAL_STORY_NO_EMBELLISHMENT_REJECTED",
    );
  });

  it("fails when both providers fail and never creates deterministic fallback prose", async () => {
    mocks.callCreativeAI.mockRejectedValue(new Error("providers unavailable"));

    await expect(generatePersonalStoryChapter(alangSource)).rejects.toThrow(
      "PERSONAL_STORY_ALL_PROVIDERS_FAILED",
    );
    expect(mocks.logAITrace).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "all_providers_failed",
        fallbackUsed: false,
      }),
    );
  });

  it("reports all-provider schema rejection without appending a fallback chapter", async () => {
    mocks.callCreativeAI.mockRejectedValue(
      new Error("CREATIVE_AI_ALL_RESPONSES_REJECTED"),
    );

    await expect(generatePersonalStoryChapter(alangSource)).rejects.toThrow(
      "PERSONAL_STORY_INVALID_MODEL_OUTPUT",
    );
    expect(mocks.logAITrace).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: "invalid_model_output" }),
    );
  });

  it("keeps the chapter title limited to the supplied date and activity type", () => {
    expect(formatPersonalStoryChapterTitle(alangSource.keywords)).toBe(
      "2026.07.15 · 闪现",
    );
  });
});
