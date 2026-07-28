import { describe, expect, it } from "vitest";
import {
  canWriteFlashAdmin,
  formatEligibleWeekdays,
  formatFeedbackPromptLines,
  getFlashReadinessItems,
  getShenzhenDatePair,
  parseCommaList,
  parseFeedbackPromptLines,
  toShenzhenIso,
  unpackFlashCollection,
} from "../flashAdmin";

describe("flashAdmin helpers", () => {
  it("keeps viewer read-only and allows operator roles", () => {
    expect(canWriteFlashAdmin("viewer")).toBe(false);
    expect(canWriteFlashAdmin(undefined)).toBe(false);
    expect(canWriteFlashAdmin("operator")).toBe(true);
    expect(canWriteFlashAdmin("super_admin")).toBe(true);
  });

  it("normalizes direct and enveloped collection responses", () => {
    expect(unpackFlashCollection([{ id: "1" }])).toEqual([{ id: "1" }]);
    expect(unpackFlashCollection({ npcs: [{ id: "2" }] })).toEqual([{ id: "2" }]);
    expect(unpackFlashCollection({ items: [] })).toEqual([]);
    expect(unpackFlashCollection(null)).toEqual([]);
  });

  it("turns server readiness blockers into actionable operator checks", () => {
    expect(getFlashReadinessItems({
      schemaReady: true,
      ready: false,
      blockers: [
        "thirty_human_reviewed_tasks_required",
        "all_tasks_require_active_npc_links",
      ],
      counts: {
        reviewedTasks: 12,
        linkedTasks: 8,
      },
    })).toEqual([
      {
        code: "thirty_human_reviewed_tasks_required",
        label: "人工审核任务",
        detail: "已完成 12/30 条；请在「任务库」逐条确认内容并启用。",
      },
      {
        code: "all_tasks_require_active_npc_links",
        label: "任务 NPC 绑定",
        detail: "已完成 8/30 条；每条任务都要绑定至少一个已启用的数字 NPC。",
      },
    ]);
  });

  it("keeps unknown readiness blockers visible for forward compatibility", () => {
    expect(getFlashReadinessItems({
      schemaReady: true,
      ready: false,
      blockers: ["future_readiness_rule"],
      counts: {},
    })[0]).toEqual({
      code: "future_readiness_rule",
      label: "其他发布条件",
      detail: "服务端返回未识别的检查项：future_readiness_rule。请联系开发人员确认。",
    });
  });

  it("orders weekdays from Monday through Sunday", () => {
    expect(formatEligibleWeekdays([5, 2, 7, 2])).toBe("周二、周五、周日");
  });

  it("returns Shenzhen calendar dates across UTC day boundaries", () => {
    expect(getShenzhenDatePair(new Date("2026-07-20T16:30:00.000Z"))).toEqual({
      today: "2026-07-21",
      tomorrow: "2026-07-22",
    });
  });

  it("normalizes comma-separated operator input", () => {
    expect(parseCommaList("安静, 城市观察，安静\n夜景")).toEqual(["安静", "城市观察", "夜景"]);
  });

  it("creates an explicit Shenzhen timestamp", () => {
    expect(toShenzhenIso("2026-07-21", "09:30")).toBe("2026-07-21T09:30:00+08:00");
  });

  it("parses structured feedback prompts with stable IDs", () => {
    const existing = [{
      id: "impression",
      prompt: "旧问题",
      options: [{ id: "calm", label: "安静" }, { id: "lively", label: "热闹" }],
    }];
    const result = parseFeedbackPromptLines("这里感觉怎么样？｜很安静｜有活力", existing);
    expect(result.error).toBeUndefined();
    expect(result.prompts[0]).toEqual({
      id: "impression",
      prompt: "这里感觉怎么样？",
      options: [{ id: "calm", label: "很安静" }, { id: "lively", label: "有活力" }],
    });
    expect(formatFeedbackPromptLines(result.prompts)).toBe("这里感觉怎么样？｜很安静｜有活力");
  });

  it("rejects feedback prompt rows without two options", () => {
    expect(parseFeedbackPromptLines("这里怎么样？｜不错").error).toContain("两个选项");
  });
});
