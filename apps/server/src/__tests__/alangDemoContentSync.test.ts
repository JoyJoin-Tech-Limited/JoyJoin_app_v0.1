import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  existing: null as any,
  updatedValues: null as any,
}));

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  insert: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => state.existing ? [state.existing] : [],
        }),
      }),
    }),
    update: mocks.update,
    insert: mocks.insert,
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: mocks.info,
    warn: mocks.warn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { seedDemoMissionIfNeeded } = await import("../repositories/alangRepo");

describe("Alang approved demo content synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.updatedValues = null;
    state.existing = {
      id: "mission-1",
      slug: "alang-demo",
      title: "旧标题",
      description: "旧内容",
      contentJson: {
        version: "1.0",
        title: "旧标题",
        description: "旧内容",
        startNodeId: "old",
        nodes: [{ id: "old", type: "event_card", content: { body: "旧内容" } }],
      },
      isInternalOnly: true,
    };
    mocks.update.mockImplementation(() => ({
      set: (values: unknown) => {
        state.updatedValues = values;
        return {
          where: () => ({
            returning: async () => [{ id: "mission-1" }],
          }),
        };
      },
    }));
    mocks.insert.mockImplementation(() => ({
      values: () => ({
        onConflictDoNothing: async () => undefined,
      }),
    }));
  });

  it("updates only an existing internal demo when the approved version changes", async () => {
    await expect(seedDemoMissionIfNeeded()).resolves.toBe(true);

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(state.updatedValues.contentJson.version).toBe("1.1");
    expect(state.updatedValues.contentJson.nodes).toHaveLength(13);
    expect(mocks.info).toHaveBeenCalledWith(
      "[AlangRepo] Updated approved demo mission content",
      expect.objectContaining({ missionId: "mission-1", version: "1.1" }),
    );
  });

  it("is idempotent when the database already has the approved version", async () => {
    state.existing.contentJson = {
      ...state.updatedValues,
      version: "1.1",
    };
    // Use the canonical content shape by completing one synchronization first.
    state.existing.contentJson = (await import("../../content/alang/stories/demo-story.json", {
      assert: { type: "json" },
    })).default;

    await expect(seedDemoMissionIfNeeded()).resolves.toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("never overwrites a mission that is not marked internal", async () => {
    state.existing.isInternalOnly = false;

    await expect(seedDemoMissionIfNeeded()).resolves.toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.warn).toHaveBeenCalledWith(
      "[AlangRepo] Refused to update non-internal demo mission",
      expect.objectContaining({ missionId: "mission-1" }),
    );
  });
});
