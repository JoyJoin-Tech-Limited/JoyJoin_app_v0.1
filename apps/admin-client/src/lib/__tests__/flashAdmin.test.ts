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
        "one_published_story_season_required",
        "fifteen_reviewed_story_episodes_required",
        "five_story_npcs_required",
        "shenzhen_boundary_license_not_approved",
      ],
      counts: {
        publishedStorySeasons: 0,
        reviewedStoryEpisodes: 12,
        storyCoveredNpcs: 4,
      },
    })).toEqual([
      {
        code: "one_published_story_season_required",
        label: "第一季发布状态",
        detail: "已发布 0/1 季；请在「第一季故事」完成审核并发布唯一的当前故事季。",
      },
      {
        code: "fifteen_reviewed_story_episodes_required",
        label: "第一季故事单元",
        detail: "已审核 12/15 个；第一季的 15 个故事单元需要全部通过人工审核。",
      },
      {
        code: "five_story_npcs_required",
        label: "第一季角色覆盖",
        detail: "已覆盖 4/5 位；第一季需要包含五位正式 NPC。",
      },
      {
        code: "shenzhen_boundary_license_not_approved",
        label: "深圳服务范围授权",
        detail: "深圳边界数据的授权记录尚未确认；请由负责人完成合规确认。",
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
