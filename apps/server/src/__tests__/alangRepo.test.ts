import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeDb = vi.hoisted(() => {
  const archives = new Map<string, any>();

  const persist = (data: any, ignoreConflict: boolean) => {
    const existing = archives.get(data.progressId);
    if (existing) {
      if (ignoreConflict) return [];
      throw Object.assign(new Error("duplicate progress archive"), { code: "23505" });
    }
    const row = { ...data, id: "archive-1", createdAt: new Date("2026-07-12T00:00:00Z") };
    archives.set(data.progressId, row);
    return [row];
  };

  return {
    archives,
    insert: vi.fn(() => ({
      values: (data: any) => ({
        returning: async () => persist(data, false),
        onConflictDoNothing: () => ({
          returning: async () => persist(data, true),
        }),
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            const first = fakeDb.archives.values().next().value;
            return first ? [first] : [];
          },
        }),
      }),
    })),
  };
});

vi.mock("../db", () => ({
  db: {
    insert: fakeDb.insert,
    select: fakeDb.select,
  },
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { archiveStory } = await import("../repositories/alangRepo");

describe("Alang archive repository", () => {
  beforeEach(() => {
    fakeDb.archives.clear();
    vi.clearAllMocks();
  });

  it("returns one archive id for concurrent completes of the same progress", async () => {
    const input = {
      userId: "user-1",
      missionId: "mission-1",
      progressId: "progress-1",
      title: "阿浪的傍晚",
      completedAt: new Date("2026-07-12T00:00:00Z"),
      nodeHistory: ["result_card"],
      choicesMade: [],
    } as any;

    const [first, second] = await Promise.all([archiveStory(input), archiveStory(input)]);
    expect(first.archive.id).toBe("archive-1");
    expect(second.archive.id).toBe(first.archive.id);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(second.archive.completedAt).toEqual(first.archive.completedAt);
    expect(fakeDb.archives.size).toBe(1);
  });
});
