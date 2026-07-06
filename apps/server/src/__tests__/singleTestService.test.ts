import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  pickDiverseBots,
  getSingleTestBotRosterForClient,
  getSingleTestMetaForSessionStart,
} from "../services/singleTestService";
import { isSingleTestMode } from "../lib/isSingleTestMode";

vi.mock("../lib/isSingleTestMode");

function makeVirtualUser(id: string, primaryArchetype: string, archetype?: string) {
  return {
    id,
    displayName: `User ${id}`,
    primaryArchetype,
    archetype: archetype ?? primaryArchetype,
  };
}

describe("pickDiverseBots", () => {
  it("returns 5 bots deterministically for the same groupId", () => {
    const users = [
      makeVirtualUser("u1", "corgi", "社牛柯基"),
      makeVirtualUser("u2", "rooster", "小太阳鸡"),
      makeVirtualUser("u3", "hamster_praise", "夸夸仓鼠"),
      makeVirtualUser("u4", "fox", "寻宝狐"),
      makeVirtualUser("u5", "dolphin_calm", "机灵海豚"),
      makeVirtualUser("u6", "spider", "人脉蛛"),
      makeVirtualUser("u7", "koala", "树洞考拉"),
      makeVirtualUser("u8", "octopus", "脑洞章鱼"),
      makeVirtualUser("u9", "owl", "好奇猫头鹰"),
      makeVirtualUser("u10", "elephant", "靠谱大象"),
      makeVirtualUser("u11", "turtle", "慢热龟"),
      makeVirtualUser("u12", "cat", "小透明猫"),
    ];

    const groupId = "test-group-123";
    const run1 = pickDiverseBots(users, groupId);
    const run2 = pickDiverseBots(users, groupId);

    expect(run1).toHaveLength(5);
    expect(run2).toHaveLength(5);
    expect(run1.map((b) => b.id)).toEqual(run2.map((b) => b.id));

    const archetypes = new Set(run1.map((b) => b.primaryArchetype));
    expect(archetypes.size).toBe(5);
  });

  it("fills remaining slots when virtual users cannot satisfy full diversity", () => {
    const users = [
      makeVirtualUser("u1", "corgi", "社牛柯基"),
      makeVirtualUser("u2", "corgi", "社牛柯基"),
      makeVirtualUser("u3", "corgi", "社牛柯基"),
      makeVirtualUser("u4", "rooster", "小太阳鸡"),
      makeVirtualUser("u5", "rooster", "小太阳鸡"),
    ];

    const result = pickDiverseBots(users, "small-pool-group");
    expect(result).toHaveLength(5);
  });
});

describe("getSingleTestBotRosterForClient", () => {
  const originalAppMode = process.env.APP_MODE;

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.APP_MODE;
    vi.mocked(isSingleTestMode).mockReturnValue(false);
  });

  afterEach(() => {
    if (originalAppMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = originalAppMode;
    }
  });

  it("returns null when not in single-test mode", async () => {
    const result = await getSingleTestBotRosterForClient("any-group");
    expect(result).toBeNull();
  });
});

describe("getSingleTestMetaForSessionStart", () => {
  const originalAppMode = process.env.APP_MODE;

  beforeEach(() => {
    vi.resetAllMocks();
    delete process.env.APP_MODE;
    vi.mocked(isSingleTestMode).mockReturnValue(false);
  });

  afterEach(() => {
    if (originalAppMode === undefined) {
      delete process.env.APP_MODE;
    } else {
      process.env.APP_MODE = originalAppMode;
    }
  });

  it("returns null when not in single-test mode", async () => {
    const result = await getSingleTestMetaForSessionStart("any-group");
    expect(result).toBeNull();
  });
});
