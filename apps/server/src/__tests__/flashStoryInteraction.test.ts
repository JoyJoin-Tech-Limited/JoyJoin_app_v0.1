import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyInteractionFallback: vi.fn(),
  completeStoryEpisode: vi.fn(),
  expireEncounter: vi.fn(),
  generatePersonalizedResponse: vi.fn(),
  getCompletedStorySeason: vi.fn(),
  getEncounterOwned: vi.fn(),
  getFeatureFlag: vi.fn(),
  getReadyChoiceIntent: vi.fn(),
  getStoryEncounterState: vi.fn(),
  listCompletedCodes: vi.fn(),
  submitInteractionResult: vi.fn(),
  updateCompletionNarrative: vi.fn(),
}));

vi.mock("../repositories/flashRepo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/flashRepo")>();
  return {
    ...actual,
    expireFlashEncounterIfNeeded: mocks.expireEncounter,
    getFlashEncounterOwned: mocks.getEncounterOwned,
  };
});

vi.mock("../repositories/flashStoryRepo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/flashStoryRepo")>();
  return {
    ...actual,
    applyFlashV2InteractionFallback: mocks.applyInteractionFallback,
    completeFlashStoryEpisode: mocks.completeStoryEpisode,
    getCompletedFlashStorySeason: mocks.getCompletedStorySeason,
    getFlashStoryEncounterState: mocks.getStoryEncounterState,
    getReadyFlashStoryChoiceIntent: mocks.getReadyChoiceIntent,
    listCompletedFlashStoryEpisodeCodes: mocks.listCompletedCodes,
    submitFlashV2InteractionResult: mocks.submitInteractionResult,
    updateFlashStoryCompletionNarrative: mocks.updateCompletionNarrative,
  };
});

vi.mock("../lib/featureFlags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/featureFlags")>();
  return { ...actual, getFeatureFlag: mocks.getFeatureFlag };
});

vi.mock("../lib/flashFirstActRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/flashFirstActRuntime")>();
  return {
    ...actual,
    isFlashLocalTemplateExperienceUnitId: () => false,
    resolveFlashFirstActRuntimeContent: (_unitId: string, stored: unknown) => stored,
  };
});

vi.mock("../services/flashPersonalizedNarrativeService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/flashPersonalizedNarrativeService")>();
  return { ...actual, generateFlashPersonalizedResponse: mocks.generatePersonalizedResponse };
});

const { getFlashEncounter, submitFlashStoryInteraction } = await import("../services/flashService");
const { FlashStorySettlementInvariantError } = await import("../repositories/flashStoryRepo");

const now = new Date("2026-08-24T10:00:00.000Z");

const encounter = {
  id: "encounter-1",
  userId: "user-1",
  npcId: "npc-alang",
  npcSlug: "alang",
  npcName: "阿浪",
  species: "流浪狗",
  personalitySummary: "沉稳的守箱人",
  themeColor: "#8B5CF6",
  avatarUrl: null,
  expiresAt: new Date("2026-08-25T10:00:00.000Z"),
};

const ACTION_CONTENT = {
  v: 2,
  start: "n1_setup",
  state: { echo: 5 },
  nodes: {
    n1_setup: {
      id: "n1_setup",
      type: "prose",
      segments: [{ text: "阿浪把图摊在膝盖上。" }],
      next: "n2_action",
    },
    n2_action: {
      id: "n2_action",
      type: "interaction",
      interaction: {
        template: "spacing",
        goal: "移动两把椅子，留出图上刚好的并肩距离。",
        hints: ["不用挤在一起。"],
        results: [
          { id: "aligned", next: "n3_callback", effect: { echo: 15, flagsSet: ["s1-alang-aligned"] } },
          { id: "crowded", next: "n3_callback", effect: { echo: -5 } },
        ],
        defaultResultId: "aligned",
        fallbackNext: "n4_fallback",
      },
    },
    n3_callback: {
      id: "n3_callback",
      type: "callback",
      segments: [{ text: "座位之间的空隙和折痕对上了。" }],
      next: "n5_close",
    },
    n4_fallback: {
      id: "n4_fallback",
      type: "prose",
      segments: [{ text: "你们一起把图纸收好。" }],
      next: "n5_close",
    },
    n5_close: {
      id: "n5_close",
      type: "closure",
      segments: [{ text: "他把图按旧折痕收好。" }],
      unlockFragment: "s1-p1-alang-fragment",
    },
  },
} as const;

function storyState(overrides?: {
  currentNode?: string;
  completion?: boolean;
  echo?: number;
  lastChoiceId?: string | null;
}) {
  const currentNode = overrides?.currentNode ?? "n2_action";
  const completion = overrides?.completion
    ? {
        selectedOptionId: "aligned",
        responseSnapshot: "他把图按旧折痕收好。",
        renderKind: "template" as const,
        promptVersion: null,
        echoSnapshot: null,
      }
    : null;
  return {
    seasonTitle: "没有名字的旧物",
    universeRun: {
      id: "run-1",
      mode: "standard",
      flags: [] as string[],
      echoQueue: [],
      currentNode,
      nodePath: currentNode === "n2_action" ? ["n1_setup", "n2_action"] : ["n1_setup", "n2_action", currentNode],
      v2State: {
        episodeId: "episode-1",
        echo: overrides?.echo ?? 5,
        variables: {},
        lastChoiceId: overrides?.lastChoiceId ?? null,
      },
    },
    episode: {
      id: "episode-1",
      seasonId: "season-1",
      code: "s1-p1-alang",
      phase: 1,
      title: "一张反复涂改的座位图",
      objectCode: "seat-plan",
      motion: { ambient: "breathe" },
      content: ACTION_CONTENT,
    },
    fragment: {
      id: "fragment-1",
      code: "seat-plan-fragment",
      category: "object",
      title: "座位图",
      fact: "两把椅子的距离被反复涂改。",
      assetUrl: null,
    },
    completion,
    completedInPhase: completion ? 1 : 0,
    completedTotal: completion ? 1 : 0,
  };
}

function enableFlags(actionsEnabled: boolean) {
  mocks.getFeatureFlag.mockImplementation(async (key: string) => {
    if (key === "flashStoryActionsEnabled") return actionsEnabled;
    if (key === "flashStoryAiResponsesEnabled") return false;
    return true;
  });
}

describe("submitFlashStoryInteraction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.expireEncounter.mockResolvedValue(undefined);
    mocks.getEncounterOwned.mockResolvedValue(encounter);
    mocks.getCompletedStorySeason.mockResolvedValue(null);
    mocks.getReadyChoiceIntent.mockResolvedValue(null);
    mocks.listCompletedCodes.mockResolvedValue([]);
    mocks.completeStoryEpisode.mockResolvedValue({ created: true, fragmentCreated: true });
    mocks.updateCompletionNarrative.mockResolvedValue(true);
    enableFlags(true);
  });

  it("advances on a valid result when the action flag is on", async () => {
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState())
      .mockResolvedValueOnce(storyState({ currentNode: "n3_callback", echo: 20, lastChoiceId: "aligned" }));
    mocks.submitInteractionResult.mockResolvedValue({
      state: "advanced",
      finished: false,
      resultId: "aligned",
      lastChoiceId: "aligned",
    });

    const result = await submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
      requestId: "req-1",
    });

    expect(mocks.submitInteractionResult).toHaveBeenCalledWith(expect.objectContaining({
      encounterId: encounter.id,
      userId: encounter.userId,
      episodeId: "episode-1",
      nodeId: "n2_action",
      resultId: "aligned",
      actionsEnabled: true,
    }));
    expect(result.storyEpisode?.storyV2?.nodeId).toBe("n3_callback");
    expect(result.storyEpisode?.storyV2?.type).toBe("callback");
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("settles exactly once through the existing transaction when the result finishes the episode", async () => {
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState())
      .mockResolvedValueOnce(storyState({ currentNode: "n5_close", completion: true, echo: 20, lastChoiceId: "aligned" }));
    mocks.submitInteractionResult.mockResolvedValue({
      state: "finished",
      finished: true,
      resultId: "aligned",
      lastChoiceId: "aligned",
    });

    const result = await submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
    });

    expect(mocks.completeStoryEpisode).toHaveBeenCalledTimes(1);
    expect(mocks.completeStoryEpisode).toHaveBeenCalledWith(expect.objectContaining({
      episodeId: "episode-1",
      optionId: "aligned",
      renderKind: "template",
    }));
    expect(result.canonicalScreen).toBe("completed");
    expect(result.storyEpisode?.response).toBe("他把图按旧折痕收好。");
  });

  it("rejects an unknown result with a stable 400 and no state change or settlement", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState());
    mocks.submitInteractionResult.mockResolvedValue({ state: "unknown_result", finished: false });

    await expect(submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "forged",
      now,
    })).rejects.toMatchObject({ code: "FLASH_V2_UNKNOWN_RESULT", status: 400 });

    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("rejects a non-interaction node with a stable 400", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState());
    mocks.submitInteractionResult.mockResolvedValue({ state: "not_interaction", finished: false });

    await expect(submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n1_setup",
      resultId: "aligned",
      now,
    })).rejects.toMatchObject({ code: "FLASH_V2_NOT_AN_INTERACTION_NODE", status: 400 });

    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("maps a mid-transaction state conflict to 409 (double-click / concurrent retry)", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState());
    mocks.submitInteractionResult
      .mockResolvedValueOnce({ state: "advanced", finished: false, resultId: "aligned", lastChoiceId: "aligned" })
      .mockResolvedValueOnce({ state: "conflict", finished: false });

    const first = await submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
    });
    expect(first.storyEpisode?.storyV2).toBeTruthy();

    await expect(submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
    })).rejects.toMatchObject({ code: "FLASH_V2_STATE_CONFLICT", status: 409 });

    expect(mocks.submitInteractionResult).toHaveBeenCalledTimes(2);
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("degrades to the reviewed default result when the action flag is off", async () => {
    enableFlags(false);
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState())
      .mockResolvedValueOnce(storyState({ currentNode: "n5_close", completion: true, echo: 20, lastChoiceId: "aligned" }));
    mocks.submitInteractionResult.mockResolvedValue({
      state: "finished",
      finished: true,
      resultId: "aligned",
      lastChoiceId: "aligned",
    });

    const result = await submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "crowded",
      now,
      requestId: "req-degraded",
    });

    expect(mocks.submitInteractionResult).toHaveBeenCalledWith(expect.objectContaining({
      actionsEnabled: false,
    }));
    // 降级路径以 defaultResultId 结算，忽略客户端提交的 resultId。
    expect(mocks.completeStoryEpisode).toHaveBeenCalledWith(expect.objectContaining({
      optionId: "aligned",
    }));
    expect(result.canonicalScreen).toBe("completed");
  });

  it("keeps the fragment settlement invariant fail-closed (REL-03)", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState());
    mocks.submitInteractionResult.mockResolvedValue({
      state: "finished",
      finished: true,
      resultId: "aligned",
      lastChoiceId: "aligned",
    });
    mocks.completeStoryEpisode.mockRejectedValue(new FlashStorySettlementInvariantError("episode-1", 0));

    await expect(submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
    })).rejects.toMatchObject({ code: "FLASH_STORY_FRAGMENT_NOT_READY", status: 503 });
  });

  it("fails closed on expired encounters and unavailable stories", async () => {
    mocks.getEncounterOwned.mockResolvedValue({ ...encounter, expiresAt: new Date("2026-08-23T10:00:00.000Z") });
    await expect(submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
    })).rejects.toMatchObject({ code: "FLASH_ENCOUNTER_EXPIRED", status: 410 });
    expect(mocks.submitInteractionResult).not.toHaveBeenCalled();

    mocks.getEncounterOwned.mockResolvedValue(encounter);
    mocks.getStoryEncounterState.mockResolvedValue(null);
    await expect(submitFlashStoryInteraction({
      encounterId: encounter.id,
      userId: encounter.userId,
      nodeId: "n2_action",
      resultId: "aligned",
      now,
    })).rejects.toMatchObject({ code: "FLASH_STORY_NOT_AVAILABLE", status: 409 });
    expect(mocks.submitInteractionResult).not.toHaveBeenCalled();
  });
});

describe("flag-off read-path degradation (AC-07)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.expireEncounter.mockResolvedValue(undefined);
    mocks.getEncounterOwned.mockResolvedValue(encounter);
    mocks.getCompletedStorySeason.mockResolvedValue(null);
    mocks.getReadyChoiceIntent.mockResolvedValue(null);
    mocks.listCompletedCodes.mockResolvedValue([]);
    mocks.completeStoryEpisode.mockResolvedValue({ created: true, fragmentCreated: true });
    enableFlags(false);
  });

  it("transparently advances past an interaction node without losing progress", async () => {
    mocks.getStoryEncounterState
      .mockResolvedValueOnce(storyState())
      .mockResolvedValueOnce(storyState({ currentNode: "n4_fallback", echo: 20, lastChoiceId: "aligned" }));
    mocks.applyInteractionFallback.mockResolvedValue({
      state: "applied",
      finished: false,
      resultId: "aligned",
      lastChoiceId: "aligned",
    });

    const result = await getFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      now,
      requestId: "req-read",
    });

    expect(mocks.applyInteractionFallback).toHaveBeenCalledWith(expect.objectContaining({
      encounterId: encounter.id,
      userId: encounter.userId,
      episodeId: "episode-1",
    }));
    // 用户看到的不是动作节点，而是审核过的降级叙事节点。
    expect(result.storyEpisode?.storyV2?.type).toBe("prose");
    expect(result.storyEpisode?.storyV2?.nodeId).toBe("n4_fallback");
    expect(result.storyEpisode?.storyV2?.interaction).toBeNull();
    expect(mocks.completeStoryEpisode).not.toHaveBeenCalled();
  });

  it("does not touch the fallback path when the current node is not an interaction", async () => {
    mocks.getStoryEncounterState.mockResolvedValue(storyState({ currentNode: "n4_fallback", echo: 20 }));

    const result = await getFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      now,
    });

    expect(mocks.applyInteractionFallback).not.toHaveBeenCalled();
    expect(result.storyEpisode?.storyV2?.nodeId).toBe("n4_fallback");
  });

  it("serves the interaction node untouched when the action flag is on", async () => {
    enableFlags(true);
    mocks.getStoryEncounterState.mockResolvedValue(storyState());

    const result = await getFlashEncounter({
      encounterId: encounter.id,
      userId: encounter.userId,
      now,
    });

    expect(mocks.applyInteractionFallback).not.toHaveBeenCalled();
    expect(result.storyEpisode?.storyV2?.type).toBe("interaction");
    expect(result.storyEpisode?.storyV2?.interaction?.template).toBe("spacing");
    expect(result.storyEpisode?.storyV2?.interaction?.results).toHaveLength(2);
  });
});
