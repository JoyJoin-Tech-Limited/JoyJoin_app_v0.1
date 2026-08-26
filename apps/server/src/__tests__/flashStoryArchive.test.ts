import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPublishedSeason: vi.fn(),
  getSeasonRun: vi.fn(),
  listCompletedDetails: vi.fn(),
  listFragments: vi.fn(),
}));

vi.mock("../repositories/flashStoryRepo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../repositories/flashStoryRepo")>();
  return {
    ...actual,
    getFlashSeasonUniverseRun: mocks.getSeasonRun,
    getPublishedFlashStorySeason: mocks.getPublishedSeason,
    listCompletedFlashStoryEpisodeDetails: mocks.listCompletedDetails,
    listFlashUserStoryFragments: mocks.listFragments,
  };
});

vi.mock("../lib/flashFirstActRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/flashFirstActRuntime")>();
  return {
    ...actual,
    isFlashLocalTemplateExperienceUnitId: () => false,
    resolveFlashFirstActRuntimeContent: (_unitId: string, stored: unknown) => stored,
  };
});

const { getFlashStoryArchive } = await import("../services/flashService");

const ACTION_CONTENT = {
  v: 2,
  start: "n1",
  nodes: {
    n1: { id: "n1", type: "prose", segments: [{ text: "开场" }], next: "n2" },
    n2: {
      id: "n2",
      type: "interaction",
      interaction: {
        template: "spacing",
        goal: "移动两把椅子。",
        results: [
          { id: "aligned", next: "n3", effect: { echo: 15 } },
          { id: "crowded", next: "n3", effect: { echo: -5 } },
        ],
        defaultResultId: "aligned",
        fallbackNext: "n3",
      },
    },
    n3: { id: "n3", type: "closure", segments: [{ text: "收好。" }] },
  },
};

const V1_CONTENT = {
  opening: "我们应该没见过。",
  action: "动作",
  discovery: "发现",
  closing: "收尾",
  question: { id: "q", prompt: "？", options: [{ id: "a", label: "好" }] },
  responseByOption: { a: "回应" },
};

describe("getFlashStoryArchive (AC-05 谜案档案台 MVP)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getPublishedSeason.mockResolvedValue({ id: "season-1", code: "s1", title: "没有名字的旧物" });
    mocks.listFragments.mockResolvedValue([]);
    mocks.listCompletedDetails.mockResolvedValue([]);
    mocks.getSeasonRun.mockResolvedValue(null);
  });

  it("returns an empty desk when no season is published", async () => {
    mocks.getPublishedSeason.mockResolvedValue(null);
    const dto = await getFlashStoryArchive("user-1");
    expect(dto).toEqual({
      season: null,
      fragments: [],
      imprints: [],
      hookHint: null,
      completedUnitIds: [],
    });
    expect(mocks.listCompletedDetails).not.toHaveBeenCalled();
  });

  it("derives imprints from settled action results without a dedicated table", async () => {
    const settledAt = new Date("2026-08-24T08:00:00.000Z");
    mocks.listCompletedDetails.mockResolvedValue([
      { code: "s1-p1-alang", content: ACTION_CONTENT, settledAt },
      { code: "s1-p1-lizi", content: V1_CONTENT, settledAt },
    ]);
    mocks.getSeasonRun.mockResolvedValue({
      id: "run-1",
      v2State: { episodeId: "episode-1", echo: 20, variables: { "imprint:s1-p1-alang": 2 }, lastChoiceId: "crowded" },
    });
    mocks.listFragments.mockResolvedValue([{
      id: "fragment-1",
      code: "seat-plan-fragment",
      category: "object",
      title: "座位图",
      fact: "两把椅子的距离被反复涂改。",
      assetUrl: null,
      unlockedAt: settledAt,
      episodeTitle: "一张反复涂改的座位图",
      npcName: "阿浪",
    }]);

    const dto = await getFlashStoryArchive("user-1");

    expect(dto.season).toEqual({ id: "season-1", code: "s1", title: "没有名字的旧物" });
    expect(dto.completedUnitIds).toEqual(["s1-p1-alang", "s1-p1-lizi"]);
    expect(dto.imprints).toEqual([{
      unitId: "s1-p1-alang",
      template: "spacing",
      resultId: "crowded",
      settledAt: settledAt.toISOString(),
    }]);
    expect(dto.fragments).toEqual([{
      id: "fragment-1",
      code: "seat-plan-fragment",
      category: "object",
      title: "座位图",
      fact: "两把椅子的距离被反复涂改。",
      assetUrl: null,
      unlockedAt: settledAt.toISOString(),
      episodeTitle: "一张反复涂改的座位图",
      npcName: "阿浪",
    }]);
    // s1-p1-alang 是 h1-metal-sound 钩子的 plantedUnit 且未 resolved。
    expect(dto.hookHint).toContain("阿浪");
  });

  it("omits imprints when the marker or the interaction config is absent", async () => {
    const settledAt = new Date("2026-08-24T08:00:00.000Z");
    mocks.listCompletedDetails.mockResolvedValue([
      { code: "s1-p1-alang", content: ACTION_CONTENT, settledAt },
    ]);
    mocks.getSeasonRun.mockResolvedValue({
      id: "run-1",
      v2State: { episodeId: "episode-1", echo: 5, variables: {}, lastChoiceId: null },
    });

    const dto = await getFlashStoryArchive("user-1");
    expect(dto.imprints).toEqual([]);
    expect(dto.completedUnitIds).toEqual(["s1-p1-alang"]);
  });

  it("ignores out-of-range imprint markers instead of crashing", async () => {
    const settledAt = new Date("2026-08-24T08:00:00.000Z");
    mocks.listCompletedDetails.mockResolvedValue([
      { code: "s1-p1-alang", content: ACTION_CONTENT, settledAt },
    ]);
    mocks.getSeasonRun.mockResolvedValue({
      id: "run-1",
      v2State: { episodeId: "episode-1", echo: 5, variables: { "imprint:s1-p1-alang": 99 }, lastChoiceId: null },
    });

    const dto = await getFlashStoryArchive("user-1");
    expect(dto.imprints).toEqual([]);
  });

  it("uses batched reads only (SCA-02) and never leaks forbidden fields (SEC-02)", async () => {
    const settledAt = new Date("2026-08-24T08:00:00.000Z");
    mocks.listCompletedDetails.mockResolvedValue([
      { code: "s1-p1-alang", content: ACTION_CONTENT, settledAt },
    ]);
    mocks.getSeasonRun.mockResolvedValue({
      id: "run-1",
      v2State: { episodeId: "episode-1", echo: 20, variables: { "imprint:s1-p1-alang": 1 }, lastChoiceId: "aligned" },
    });

    const dto = await getFlashStoryArchive("user-1");

    expect(mocks.getPublishedSeason).toHaveBeenCalledTimes(1);
    expect(mocks.listFragments).toHaveBeenCalledTimes(1);
    expect(mocks.listCompletedDetails).toHaveBeenCalledTimes(1);
    expect(mocks.getSeasonRun).toHaveBeenCalledTimes(1);

    // DTO 快照：字段集合锁定，禁止坐标/距离/排班/路线/私人回复进入档案台。
    expect(Object.keys(dto).sort()).toEqual([
      "completedUnitIds",
      "fragments",
      "hookHint",
      "imprints",
      "season",
    ]);
    expect(Object.keys(dto.imprints[0]!).sort()).toEqual(["resultId", "settledAt", "template", "unitId"]);
    const serialized = JSON.stringify(dto);
    for (const forbidden of ["latitude", "longitude", "distance", "schedule", "route", "privateReply", "startsAt", "endsAt", "address"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
