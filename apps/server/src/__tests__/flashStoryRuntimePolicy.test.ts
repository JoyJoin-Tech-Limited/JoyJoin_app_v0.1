import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAtuanFirstActProgress,
  resolveAtuanFirstActOutcome,
  toAtuanFirstActSubmission,
} from "@joyjoin/shared/alang/atuanFirstAct";
import {
  createAtuanLaterActProgress,
  resolveAtuanLaterActOutcome,
  toAtuanLaterActSubmission,
} from "@joyjoin/shared/alang/atuanLaterActs";

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
  listCompletedCodes: vi.fn(),
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
    listCompletedFlashStoryEpisodeCodes: mocks.listCompletedCodes,
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
    mocks.listCompletedCodes.mockResolvedValue([]);
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
    expect(result.canonicalScreen).toBe("completed");
    expectNoPersonalizationRuntimeCalls();
  });

  it("validates and persists the complete reviewed Atuan first-act path", async () => {
    const initial = storyState();
    initial.episode.code = "s1-p1-atuan";
    initial.episode.content.question = {
      id: "first-look",
      prompt: "你先怎么调查？",
      options: [
        { id: "notice-lines", label: "先看痕迹" },
        { id: "protect-boundary", label: "先守边界" },
      ],
    };
    const progress = createAtuanFirstActProgress(encounter.id, "notice_wait");
    const outcome = resolveAtuanFirstActOutcome(encounter.id, {
      ...progress,
      followupId: "offer_help",
      arrivalReplyId: "turn_face_down",
      benchReached: true,
      highlightOrder: ["fold", "string", "blank_name"],
      cardPlacements: [{ cardId: "city", destinationId: "keep" }, { cardId: "habit", destinationId: "return" }, { cardId: "private_time", destinationId: "cover" }],
    });
    const storyPath = toAtuanFirstActSubmission(outcome.progress);
    const completed = {
      ...initial,
      completion: {
        selectedOptionId: "notice-lines",
        responseSnapshot: outcome.responseCopy,
        renderKind: "template" as const,
        promptVersion: null,
        echoSnapshot: null,
      },
      completedInPhase: 1,
      completedTotal: 1,
    };
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(completed);

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "notice-lines",
      storyPath,
      now,
    });

    expect(mocks.prepareChoiceIntent).toHaveBeenCalledWith(expect.objectContaining({
      storyAnswers: expect.arrayContaining([
        expect.objectContaining({ questionId: "atuan-first-act:ending", optionId: storyPath.endingId }),
      ]),
    }));
    expect(mocks.finalizeChoiceIntent).toHaveBeenCalledWith(expect.objectContaining({
      responseSnapshot: outcome.responseCopy,
    }));
    expect(mocks.completeStoryEpisode).toHaveBeenCalledWith(expect.objectContaining({
      responseSnapshot: outcome.responseCopy,
    }));
    expect(result.storyEpisode?.response).toBe(outcome.responseCopy);
  });

  it("rejects a forged Atuan ending before preparing a choice intent", async () => {
    const initial = storyState();
    initial.episode.code = "s1-p1-atuan";
    initial.episode.content.question = {
      id: "first-look",
      prompt: "你先怎么调查？",
      options: [
        { id: "notice-lines", label: "先看痕迹" },
        { id: "protect-boundary", label: "先守边界" },
      ],
    };
    mocks.getStoryEncounterState.mockResolvedValue(initial);
    const progress = createAtuanFirstActProgress(encounter.id, "notice_wait");
    const storyPath = toAtuanFirstActSubmission({
      ...progress,
      followupId: "offer_help",
      arrivalReplyId: "turn_face_down",
      benchReached: true,
      highlightOrder: ["fold", "string", "blank_name"],
      cardPlacements: [{ cardId: "city", destinationId: "keep" }, { cardId: "habit", destinationId: "return" }, { cardId: "private_time", destinationId: "cover" }],
    });

    await expect(answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "notice-lines",
      storyPath: { ...storyPath, endingId: "felt_seen" },
      now,
    })).rejects.toMatchObject({ code: "FLASH_INVALID_DIALOGUE_OPTION", status: 400 });

    expect(mocks.prepareChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.finalizeChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("validates and persists the complete reviewed Atuan second-act path", async () => {
    const initial = storyState();
    initial.episode.code = "s1-p2-atuan";
    initial.episode.phase = 2;
    initial.episode.content.question = {
      id: "second-look",
      prompt: "这次你先看哪里？",
      options: [
        { id: "read-plan", label: "先看改过的地方" },
        { id: "name-invitation", label: "先问这是不是邀请" },
      ],
    };
    const progress = createAtuanLaterActProgress("s1-p2-atuan", "read_plan_first");
    const outcome = resolveAtuanLaterActOutcome({
      ...progress,
      arrivalReplyId: "ask_fold_history",
      highlightOrder: ["plan_folds", "chair_scuffs", "blank_place"],
      followupId: "leave_choice",
      gameStarted: true,
      game: { planUpright: true, chairGap: "breathing", attempts: 2 },
    });
    const storyPath = toAtuanLaterActSubmission(outcome.progress);
    const completed = {
      ...initial,
      completion: {
        selectedOptionId: "read-plan",
        responseSnapshot: outcome.responseCopy,
        renderKind: "template" as const,
        promptVersion: null,
        echoSnapshot: null,
      },
      completedInPhase: 1,
      completedTotal: 1,
    };
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(completed);

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "second-look",
      optionId: "read-plan",
      storyPath,
      now,
    });

    expect(mocks.prepareChoiceIntent).toHaveBeenCalledWith(expect.objectContaining({
      storyAnswers: expect.arrayContaining([
        expect.objectContaining({ questionId: "atuan-later-act:ending", optionId: "room_preserved" }),
        expect.objectContaining({ questionId: "atuan-later-act:arrival-reply", optionId: "ask_fold_history" }),
        expect.objectContaining({ questionId: "atuan-later-act:action", optionId: "arrange_seating_plan" }),
        expect.objectContaining({ questionId: "atuan-later-act:game:chair-gap", optionId: "breathing" }),
      ]),
    }));
    expect(mocks.finalizeChoiceIntent).toHaveBeenCalledWith(expect.objectContaining({
      responseSnapshot: outcome.responseCopy,
    }));
    expect(result.storyEpisode?.response).toBe(outcome.responseCopy);
  });

  it("validates and persists the complete reviewed Atuan third-act path", async () => {
    const initial = storyState();
    initial.episode.code = "s1-p3-atuan";
    initial.episode.phase = 3;
    initial.episode.content.question = {
      id: "third-look",
      prompt: "最后这次你先看哪里？",
      options: [
        { id: "open-box", label: "先看钥匙" },
        { id: "read-card", label: "先看第六张卡" },
      ],
    };
    const progress = createAtuanLaterActProgress("s1-p3-atuan", "open_box_first");
    const outcome = resolveAtuanLaterActOutcome({
      ...progress,
      arrivalReplyId: "ask_sixth_card",
      highlightOrder: ["box_key", "sixth_card", "empty_seat"],
      followupId: "leave_answer",
      gameStarted: true,
      game: { boxUnlocked: true, invitationPlaced: true, atuanNamePlaced: true, otherSeat: "blank", attempts: 1 },
    });
    const storyPath = toAtuanLaterActSubmission(outcome.progress);
    const completed = {
      ...initial,
      completion: {
        selectedOptionId: "open-box",
        responseSnapshot: outcome.responseCopy,
        renderKind: "template" as const,
        promptVersion: null,
        echoSnapshot: null,
      },
      completedInPhase: 1,
      completedTotal: 1,
    };
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(completed);

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "third-look",
      optionId: "open-box",
      storyPath,
      now,
    });

    expect(mocks.prepareChoiceIntent).toHaveBeenCalledWith(expect.objectContaining({
      storyAnswers: expect.arrayContaining([
        expect.objectContaining({ questionId: "atuan-later-act:ending", optionId: "answer_left_open" }),
        expect.objectContaining({ questionId: "atuan-later-act:arrival-reply", optionId: "ask_sixth_card" }),
        expect.objectContaining({ questionId: "atuan-later-act:action", optionId: "open_returned_card" }),
        expect.objectContaining({ questionId: "atuan-later-act:game:invitation", optionId: "placed_on_plan" }),
        expect.objectContaining({ questionId: "atuan-later-act:game:other-seat", optionId: "blank" }),
      ]),
    }));
    expect(result.storyEpisode?.response).toBe(outcome.responseCopy);
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
    expect(result.canonicalScreen).toBe("completed");
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
    expect(result.canonicalScreen).toBe("dialogue");
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

  it("replays an Atuan first-act path with its newly chosen ending and no settlement writes", async () => {
    const completed = storyState(reviewedOptionResponse);
    completed.episode.code = "s1-p1-atuan";
    completed.episode.content.question = {
      id: "first-look",
      prompt: "你先怎么调查？",
      options: [
        { id: "notice-lines", label: "先看痕迹" },
        { id: "protect-boundary", label: "先守边界" },
      ],
    };
    mocks.getStoryEncounterState.mockResolvedValue(completed);
    const progress = createAtuanFirstActProgress(encounter.id, "notice_again");
    const outcome = resolveAtuanFirstActOutcome(encounter.id, {
      ...progress,
      followupId: "move_forward",
      arrivalReplyId: "count_cards",
      benchReached: true,
      highlightOrder: ["fold", "string", "blank_name"],
      cardPlacements: [{ cardId: "city", destinationId: "keep" }, { cardId: "habit", destinationId: "return" }, { cardId: "private_time", destinationId: "cover" }],
    });

    const result = await answerFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      questionId: "first-look",
      optionId: "protect-boundary",
      storyPath: toAtuanFirstActSubmission(outcome.progress),
      now,
      allowStoryReplay: true,
    });

    expect(result.isReplay).toBe(true);
    expect(result.storyEpisode?.response).toBe(outcome.responseCopy);
    expect(mocks.prepareChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.finalizeChoiceIntent).not.toHaveBeenCalled();
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });
});
