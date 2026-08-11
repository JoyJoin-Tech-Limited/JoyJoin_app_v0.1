import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completeStoryEpisode: vi.fn(),
  expireEncounter: vi.fn(),
  finalizeChoiceIntent: vi.fn(),
  generatePersonalizedResponse: vi.fn(),
  getCompletedStorySeason: vi.fn(),
  getEncounterOwned: vi.fn(),
  getFeatureFlag: vi.fn(),
  getIndustrySignal: vi.fn(),
  getInterestSignal: vi.fn(),
  getLiveAppearance: vi.fn(),
  getOrCreateEncounter: vi.fn(),
  getPersonalitySignal: vi.fn(),
  getPreferences: vi.fn(),
  getReadyChoiceIntent: vi.fn(),
  getStoryEncounterState: vi.fn(),
  consumeLocateBudget: vi.fn(),
  ensureStoryEpisode: vi.fn(),
  prepareChoiceIntent: vi.fn(),
}));

vi.mock("../repositories/flashRepo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/flashRepo")>();
  return {
    ...actual,
    consumeFlashLocateBudget: mocks.consumeLocateBudget,
    expireFlashEncounterIfNeeded: mocks.expireEncounter,
    getFlashEncounterOwned: mocks.getEncounterOwned,
    getFlashPreferences: mocks.getPreferences,
    getFlashUserIndustrySignal: mocks.getIndustrySignal,
    getFlashUserInterestSignal: mocks.getInterestSignal,
    getFlashUserPersonalitySignal: mocks.getPersonalitySignal,
    getLiveFlashAppearance: mocks.getLiveAppearance,
    getOrCreateFlashEncounter: mocks.getOrCreateEncounter,
  };
});

vi.mock("../repositories/flashStoryRepo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/flashStoryRepo")>();
  return {
    ...actual,
    completeFlashStoryEpisode: mocks.completeStoryEpisode,
    ensureFlashStoryEpisodeForEncounter: mocks.ensureStoryEpisode,
    finalizeFlashStoryChoiceIntent: mocks.finalizeChoiceIntent,
    getCompletedFlashStorySeason: mocks.getCompletedStorySeason,
    getFlashStoryEncounterState: mocks.getStoryEncounterState,
    getReadyFlashStoryChoiceIntent: mocks.getReadyChoiceIntent,
    prepareFlashStoryChoiceIntent: mocks.prepareChoiceIntent,
  };
});

vi.mock("../lib/featureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/featureFlags")>();
  return { ...actual, getFeatureFlag: mocks.getFeatureFlag };
});

vi.mock("../services/flashPersonalizedNarrativeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/flashPersonalizedNarrativeService")>();
  return { ...actual, generateFlashPersonalizedResponse: mocks.generatePersonalizedResponse };
});

const { answerFlashEncounter, getFlashEncounter, locateFlashAppearance } = await import("../services/flashService");

const now = new Date("2026-08-09T10:00:00.000Z");
const reviewedOptionResponse = "拾柒把册子转向你：三条短线确实朝着同一个方向。";
const reviewedClosing = "拾柒合上册子：先把这个发现收好。";

const encounter = {
  id: "encounter-1",
  userId: "user-1",
  npcId: "npc-17",
  npcSlug: "shiqi",
  npcName: "拾柒",
  species: "乌鸦",
  personalitySummary: "谨慎的观察者",
  themeColor: "#6D5CE7",
  avatarUrl: null,
  expiresAt: new Date("2026-08-10T10:00:00.000Z"),
};

function storyState(responseSnapshot?: string, includeOptionResponse = true) {
  const completion: null | {
    selectedOptionId: string
    responseSnapshot: string
    renderKind: "template" | "ai" | "fallback"
    promptVersion: string | null
    echoSnapshot: string | null
  } = responseSnapshot === undefined ? null : {
    selectedOptionId: "notice-lines",
    responseSnapshot,
    renderKind: "template",
    promptVersion: null,
    echoSnapshot: null,
  };
  return {
    seasonTitle: "没有名字的旧物",
    universeRun: {
      id: "legacy-personalized-run",
      mode: "personalized",
      echoQueue: [{ copy: "legacy echo" }],
    },
    episode: {
      id: "episode-1",
      seasonId: "season-1",
      code: "phase-1-shiqi",
      phase: 1,
      title: "一本一次也没用过的出门册",
      objectCode: "outing-book",
      motion: { ambient: "breathe" },
      content: {
        opening: "我们应该没见过。我叫拾柒。",
        action: "拾柒把册子推到灯下。",
        discovery: "册页边缘留下三条短线。",
        closing: reviewedClosing,
        question: {
          id: "first-look",
          prompt: "你先看哪里？",
          options: [{ id: "notice-lines", label: "我先看看这三条短线。" }],
        },
        responseByOption: includeOptionResponse ? { "notice-lines": reviewedOptionResponse } : {},
        personalizedFallbackByOption: { "notice-lines": "未经审核的旧个性化回退" },
        effectsByOption: { "notice-lines": { observation: 1 } },
      },
    },
    fragment: {
      id: "fragment-1",
      code: "three-lines",
      category: "object",
      title: "三条短线",
      fact: "三条短线方向一致。",
      assetUrl: null,
    },
    completion,
    completedInPhase: completion ? 1 : 0,
    completedTotal: completion ? 1 : 0,
  };
}

function expectNoPersonalizationRuntimeCalls() {
  expect(mocks.getFeatureFlag).not.toHaveBeenCalled();
  expect(mocks.generatePersonalizedResponse).not.toHaveBeenCalled();
  expect(mocks.getPreferences).not.toHaveBeenCalled();
  expect(mocks.getPersonalitySignal).not.toHaveBeenCalled();
  expect(mocks.getInterestSignal).not.toHaveBeenCalled();
  expect(mocks.getIndustrySignal).not.toHaveBeenCalled();
}

describe("formal Flash story runtime policy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.expireEncounter.mockResolvedValue(undefined);
    mocks.getEncounterOwned.mockResolvedValue(encounter);
    mocks.getOrCreateEncounter.mockResolvedValue(encounter);
    mocks.getCompletedStorySeason.mockResolvedValue(null);
    mocks.getFeatureFlag.mockResolvedValue(true);
    mocks.getPreferences.mockResolvedValue({
      preference: {
        personalizationEnabled: true,
        usePersonality: true,
        useInterests: true,
        useIndustry: true,
        useDistrict: true,
        useTaskBehavior: true,
        consentVersion: "flash-story-personalization-v1",
        consentedAt: now,
      },
      tags: [],
    });
    mocks.getPersonalitySignal.mockResolvedValue({ primaryArchetype: "owl" });
    mocks.getInterestSignal.mockResolvedValue({ interestSelections: [{ label: "解谜" }] });
    mocks.getIndustrySignal.mockResolvedValue({ industryCategory: "design", industryCategoryLabel: "设计" });
    mocks.generatePersonalizedResponse.mockResolvedValue({
      response: "未经审核的运行时 AI 文本",
      renderKind: "ai",
      promptVersion: "legacy-personalized-v1",
    });
    mocks.prepareChoiceIntent.mockResolvedValue({
      state: "claimed",
      intent: { id: "intent-1" },
      leaseToken: "lease-1",
    });
    mocks.finalizeChoiceIntent.mockResolvedValue(true);
    mocks.completeStoryEpisode.mockResolvedValue(undefined);
    mocks.getReadyChoiceIntent.mockResolvedValue(null);
    mocks.ensureStoryEpisode.mockResolvedValue(undefined);
    mocks.consumeLocateBudget.mockResolvedValue({ allowed: true });
  });

  it("starts new formal story runs in standard mode without reading preferences", async () => {
    mocks.getLiveAppearance.mockResolvedValue({
      id: "appearance-1",
      npcId: encounter.npcId,
      latitude: 22.5431,
      longitude: 114.0579,
    });

    const result = await locateFlashAppearance({
      appearanceId: "appearance-1",
      userId: encounter.userId,
      latitude: 22.5431,
      longitude: 114.0579,
      now,
    });

    expect(result.arrived).toBe(true);
    expect(mocks.ensureStoryEpisode).toHaveBeenCalledWith(expect.objectContaining({
      encounterId: encounter.id,
      userId: encounter.userId,
      npcId: encounter.npcId,
      mode: "standard",
      consentVersion: null,
    }));
    expectNoPersonalizationRuntimeCalls();
  });

  it("returns home instead of reopening dialogue when this NPC unit is already complete", async () => {
    mocks.getLiveAppearance.mockResolvedValue({
      id: "appearance-1",
      npcId: encounter.npcId,
      latitude: 22.5431,
      longitude: 114.0579,
    });
    mocks.ensureStoryEpisode.mockResolvedValue({ alreadyCompleted: true });

    const result = await locateFlashAppearance({
      appearanceId: "appearance-1",
      userId: encounter.userId,
      latitude: 22.5431,
      longitude: 114.0579,
      now,
    });

    expect(result.arrived).toBe(true);
    expect(result.canonicalScreen).toBe("completed");
  });

  it("settles a legacy personalized run with reviewed option copy and no personalization reads", async () => {
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState())
      .mockResolvedValueOnce(storyState(reviewedOptionResponse));

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "notice-lines",
      now,
    });

    expect(mocks.finalizeChoiceIntent).toHaveBeenCalledWith(expect.objectContaining({
      responseSnapshot: reviewedOptionResponse,
      renderKind: "template",
      promptVersion: null,
    }));
    expect(mocks.completeStoryEpisode).toHaveBeenCalledWith(expect.objectContaining({
      responseSnapshot: reviewedOptionResponse,
      renderKind: "template",
      promptVersion: null,
    }));
    expect(result.storyEpisode?.response).toBe(reviewedOptionResponse);
    expectNoPersonalizationRuntimeCalls();
  });

  it("returns the completed snapshot without settling again when a committed response was lost", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState(reviewedOptionResponse));

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "notice-lines",
      now,
    });

    expect(result.storyEpisode?.response).toBe(reviewedOptionResponse);
    expect(mocks.prepareChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.finalizeChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
    expectNoPersonalizationRuntimeCalls();
  });

  it("replays a completed episode with reviewed copy and no settlement writes", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState(reviewedOptionResponse));

    const initial = await getFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      now,
      allowStoryReplay: true,
    });
    expect(initial.question?.id).toBe("first-look");
    expect(initial.storyEpisode?.fragment).toBeNull();

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "notice-lines",
      now,
      allowStoryReplay: true,
    });

    expect(result.isReplay).toBe(true);
    expect(result.storyEpisode?.response).toBe(reviewedOptionResponse);
    expect(result.storyEpisode?.fragment).toBeNull();
    expect(mocks.prepareChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.finalizeChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("never serves a legacy AI completion snapshot as formal NPC copy", async () => {
    const completed = storyState("未经审核的旧 AI 快照");
    completed.completion = {
      ...completed.completion!,
      renderKind: "ai",
      promptVersion: "legacy-personalized-v1",
    };
    mocks.getStoryEncounterState.mockResolvedValue(completed);

    const result = await getFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      now,
    });

    expect(result.storyEpisode?.response).toBe(reviewedOptionResponse);
    expect(result.storyEpisode?.renderKind).toBe("template");
    expect(result.storyEpisode?.response).not.toContain("旧 AI");
    expect(mocks.getCompletedStorySeason).toHaveBeenCalledWith(encounter.userId, completed.episode.seasonId);
  });

  it("returns the fifteenth reviewed response and fragment before exposing the finale", async () => {
    const finalState = {
      ...storyState(reviewedOptionResponse),
      completedInPhase: 5,
      completedTotal: 15,
    };
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState())
      .mockResolvedValueOnce(finalState);
    mocks.getCompletedStorySeason.mockResolvedValue({
      season: { id: "season-1", title: "season" },
      run: null,
    });

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "notice-lines",
      now,
    });

    expect(result.storyEpisode?.code).toBe("phase-1-shiqi");
    expect(result.storyEpisode?.response).toBe(reviewedOptionResponse);
    expect(result.storyEpisode?.fragment?.code).toBe("three-lines");
    expect(result.storyEpisode?.progress.completedTotal).toBe(15);
  });

  it("replaces a stale ready AI intent with reviewed closing copy during recovery", async () => {
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState(undefined, false))
      .mockResolvedValueOnce(storyState(reviewedClosing, false));
    mocks.getReadyChoiceIntent.mockResolvedValue({
      encounterId: encounter.id,
      optionId: "notice-lines",
      responseSnapshot: "未经审核的旧 AI 快照",
      renderKind: "ai",
      promptVersion: "legacy-personalized-v1",
    });

    const result = await getFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      now,
    });

    expect(mocks.completeStoryEpisode).toHaveBeenCalledWith(expect.objectContaining({
      responseSnapshot: reviewedClosing,
      renderKind: "template",
      promptVersion: null,
    }));
    expect(result.storyEpisode?.response).toBe(reviewedClosing);
    expectNoPersonalizationRuntimeCalls();
  });
});
