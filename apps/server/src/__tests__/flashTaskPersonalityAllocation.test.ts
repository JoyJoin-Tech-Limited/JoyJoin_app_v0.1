import { describe, expect, it } from "vitest";
import { FLASH_INVITATION_DEFINITIONS } from "@shared/alang/flashInvitationCatalog";
import { FLASH_NPC_SEEDS, FLASH_TASK_SEEDS } from "@shared/alang/flashCatalog";

/**
 * 趣味#3 结构回归锁定（R2，2026-08-26 Sprint Contract r2-flash-polish）。
 *
 * 调研结论：30 任务在种子层已是 5 NPC × 6（5 条生活邀请 + 1 条 NPC 传话）
 * 的性格子集，「按 NPC 重排」无对象。此测试快照锁定该分配：未来任何种子
 * 改动破坏性格聚类（任务跨 NPC 共享、传话目标等于来源、某 NPC 失去 6 条
 * 子集）都会在此显式失败。
 */
describe("flash task personality allocation (6 x 5 structural lock)", () => {
  const npcSlugs = FLASH_NPC_SEEDS.map((npc) => npc.slug);

  it("keeps exactly five NPCs and thirty tasks", () => {
    expect(npcSlugs).toHaveLength(5);
    expect(FLASH_TASK_SEEDS).toHaveLength(30);
    expect(FLASH_INVITATION_DEFINITIONS).toHaveLength(30);
  });

  it("assigns every life invitation to exactly one NPC", () => {
    const lifeTasks = FLASH_INVITATION_DEFINITIONS.filter((task) => task.kind === "life_invitation");
    expect(lifeTasks).toHaveLength(25);
    for (const task of lifeTasks) {
      expect(task.npcSlugs, `${task.code} ${task.title} must belong to exactly one NPC`).toHaveLength(1);
      expect(npcSlugs, `${task.code} owner must be a known NPC`).toContain(task.npcSlugs[0]);
    }
  });

  it("gives every NPC exactly five life invitations plus one relay message", () => {
    for (const slug of npcSlugs) {
      const owned = FLASH_INVITATION_DEFINITIONS.filter((task) => task.npcSlugs.includes(slug));
      const life = owned.filter((task) => task.kind === "life_invitation");
      const relay = owned.filter((task) => task.kind === "npc_message");
      expect(life, `${slug} should own five life invitations`).toHaveLength(5);
      expect(relay, `${slug} should own exactly one relay message`).toHaveLength(1);
    }
  });

  it("never lets a relay message target its own sender", () => {
    const relayTasks = FLASH_INVITATION_DEFINITIONS.filter((task) => task.kind === "npc_message");
    expect(relayTasks).toHaveLength(5);
    for (const task of relayTasks) {
      expect(task.targetNpcSlug, `${task.code} must declare a target NPC`).toBeTruthy();
      expect(npcSlugs, `${task.code} target must be a known NPC`).toContain(task.targetNpcSlug);
      expect(task.npcSlugs, `${task.code} must have exactly one sender`).toHaveLength(1);
      expect(task.npcSlugs[0], `${task.code} sender must differ from target`).not.toBe(task.targetNpcSlug);
    }
  });

  it("locks the current personality map so silent re-clustering fails loudly", () => {
    const allocation: Record<string, string[]> = {};
    for (const task of FLASH_INVITATION_DEFINITIONS) {
      const owner = task.npcSlugs[0];
      allocation[owner] = [...(allocation[owner] ?? []), task.code].sort();
    }
    expect(allocation).toEqual({
      alang: ["T01", "T02", "T03", "T04", "T05", "T26"],
      atuan: ["T11", "T15", "T21", "T22", "T24", "T30"],
      lizi: ["T06", "T09", "T12", "T17", "T25", "T27"],
      momo: ["T07", "T08", "T10", "T13", "T23", "T28"],
      shiqi: ["T14", "T16", "T18", "T19", "T20", "T29"],
    });
  });
});
