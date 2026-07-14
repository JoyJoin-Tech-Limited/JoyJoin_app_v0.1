import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, any>;
type Condition =
  | { kind: "eq"; column: { name: string }; value: unknown }
  | { kind: "and"; conditions: Condition[] };

const store = vi.hoisted(() => ({
  progresses: [] as Row[],
  archives: [] as Row[],
  selectCall: 0,
  deleteCall: 0,
  failProgressDelete: false,
}));
const mockLoggerInfo = vi.hoisted(() => vi.fn());

function propertyForColumn(columnName: string): string {
  return columnName.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function matches(row: Row, condition: Condition): boolean {
  if (condition.kind === "and") {
    return condition.conditions.every((child) => matches(row, child));
  }
  return row[propertyForColumn(condition.column.name)] === condition.value;
}

const fakeDb = vi.hoisted(() => {
  const tx = {
    select: vi.fn(() => {
      const callIndex = store.selectCall++;
      const rows = callIndex === 0 ? store.progresses : store.archives;
      return {
        from: () => ({
          where: (condition: Condition) => {
            const selected = () => rows.filter((row) => matches(row, condition)).map(({ id }) => ({ id }));
            return callIndex === 0
              ? {
                  limit: (limit: number) => ({
                    for: async () => selected().slice(0, limit),
                  }),
                }
              : {
                  for: async () => selected(),
                };
          },
        }),
      };
    }),
    delete: vi.fn(() => {
      const callIndex = store.deleteCall++;
      const rows = callIndex === 0 ? store.archives : store.progresses;
      return {
        where: (condition: Condition) => ({
          returning: async () => {
            if (callIndex === 1 && store.failProgressDelete) {
              throw new Error("simulated progress delete failure");
            }
            const deleting = rows.filter((row) => matches(row, condition));
            if (callIndex === 1) {
              const hasReferencingArchive = deleting.some((progress) =>
                store.archives.some((archive) => archive.progressId === progress.id)
              );
              if (hasReferencingArchive) {
                throw new Error("foreign key violation");
              }
            }
            const survivors = rows.filter((row) => !matches(row, condition));
            if (callIndex === 0) store.archives = survivors;
            else store.progresses = survivors;
            return deleting.map(({ id }) => ({ id }));
          },
        }),
      };
    }),
  };

  return {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      const snapshot = {
        progresses: store.progresses.map((row) => ({ ...row })),
        archives: store.archives.map((row) => ({ ...row })),
      };
      store.selectCall = 0;
      store.deleteCall = 0;
      try {
        return await callback(tx);
      } catch (error) {
        store.progresses = snapshot.progresses;
        store.archives = snapshot.archives;
        throw error;
      }
    }),
    tx,
  };
});

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown): Condition => ({ kind: "eq", column, value }),
    and: (...conditions: Condition[]): Condition => ({ kind: "and", conditions }),
  };
});
vi.mock("../db", () => ({
  db: {
    transaction: fakeDb.transaction,
  },
}));
vi.mock("../lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { deleteMissionProgress } = await import("../repositories/alangRepo");

function progress(id: string, userId: string, missionId: string): Row {
  return { id, userId, missionId };
}

function archive(id: string, progressId: string, userId: string, missionId: string): Row {
  return { id, progressId, userId, missionId };
}

describe("deleteMissionProgress transactional scope", () => {
  beforeEach(() => {
    store.progresses = [];
    store.archives = [];
    store.failProgressDelete = false;
    vi.clearAllMocks();
  });

  it("deletes the acting user's progress and its owned archive in one transaction", async () => {
    store.progresses = [progress("progress-1", "user-1", "mission-1")];
    store.archives = [archive("archive-1", "progress-1", "user-1", "mission-1")];

    await expect(deleteMissionProgress("user-1", "mission-1")).resolves.toEqual({
      deletedProgressCount: 1,
      deletedArchiveCount: 1,
    });
    expect(store.progresses).toEqual([]);
    expect(store.archives).toEqual([]);
  });

  it("deletes an in-progress run when no archive exists", async () => {
    store.progresses = [progress("progress-1", "user-1", "mission-1")];

    await expect(deleteMissionProgress("user-1", "mission-1")).resolves.toEqual({
      deletedProgressCount: 1,
      deletedArchiveCount: 0,
    });
  });

  it("is idempotent and does not scan archives when no owned progress exists", async () => {
    store.archives = [archive("archive-other", "progress-other", "user-2", "mission-1")];

    await expect(deleteMissionProgress("user-1", "mission-1")).resolves.toEqual({
      deletedProgressCount: 0,
      deletedArchiveCount: 0,
    });
    await expect(deleteMissionProgress("user-1", "mission-1")).resolves.toEqual({
      deletedProgressCount: 0,
      deletedArchiveCount: 0,
    });
    expect(store.archives).toHaveLength(1);
    expect(fakeDb.tx.delete).not.toHaveBeenCalled();
  });

  it("does not delete an archive owned by another user even if it references the progress", async () => {
    store.progresses = [progress("progress-1", "user-1", "mission-1")];
    store.archives = [archive("archive-other", "progress-1", "user-2", "mission-1")];

    await expect(deleteMissionProgress("user-1", "mission-1")).rejects.toThrow("foreign key");
    expect(store.progresses).toEqual([progress("progress-1", "user-1", "mission-1")]);
    expect(store.archives).toEqual([
      archive("archive-other", "progress-1", "user-2", "mission-1"),
    ]);
  });

  it("rolls back the archive delete when progress deletion fails", async () => {
    store.progresses = [progress("progress-1", "user-1", "mission-1")];
    store.archives = [archive("archive-1", "progress-1", "user-1", "mission-1")];
    store.failProgressDelete = true;

    await expect(deleteMissionProgress("user-1", "mission-1")).rejects.toThrow(
      "simulated progress delete failure"
    );
    expect(store.progresses).toEqual([progress("progress-1", "user-1", "mission-1")]);
    expect(store.archives).toEqual([
      archive("archive-1", "progress-1", "user-1", "mission-1"),
    ]);
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("preserves every other user and mission while deleting only the requested tuple", async () => {
    store.progresses = [
      progress("progress-target", "user-1", "mission-1"),
      progress("progress-other-user", "user-2", "mission-1"),
      progress("progress-other-mission", "user-1", "mission-2"),
    ];
    store.archives = [
      archive("archive-target", "progress-target", "user-1", "mission-1"),
      archive("archive-other-user", "progress-other-user", "user-2", "mission-1"),
      archive("archive-other-mission", "progress-other-mission", "user-1", "mission-2"),
    ];

    await expect(deleteMissionProgress("user-1", "mission-1")).resolves.toEqual({
      deletedProgressCount: 1,
      deletedArchiveCount: 1,
    });
    expect(store.progresses.map((row) => row.id).sort()).toEqual([
      "progress-other-mission",
      "progress-other-user",
    ]);
    expect(store.archives.map((row) => row.id).sort()).toEqual([
      "archive-other-mission",
      "archive-other-user",
    ]);
  });
});
