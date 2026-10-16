/**
 * Tests for aggregatePeerImpressionTags — 印象标签回流 (2026-10-16
 * premium-uplift spec #18): the positive preset tags a peer gave the user in
 * the event-feedback wrapup step, surfaced on the connections tab as
 * 「同桌觉得你：温暖·会聊天」.
 *
 * The helper is pure (no DB) — rows mirror the batched event_feedback query
 * in getUserConnections.
 */

import { describe, expect, it } from "vitest";
import {
  aggregatePeerImpressionTags,
  type PeerImpressionFeedbackRow,
} from "../repositories/connectionsRepo";
import { POSITIVE_IMPRESSION_TAG_PRESETS } from "@shared/api";

const TARGET = "user-target";

function row(giverId: string, attendeeTraits: unknown): PeerImpressionFeedbackRow {
  return { giverId, attendeeTraits };
}

describe("aggregatePeerImpressionTags", () => {
  it("returns the top tags addressed to the target user", () => {
    const result = aggregatePeerImpressionTags(
      [row("peer-1", { [TARGET]: { displayName: "小明", tags: ["温暖", "会聊天"] } })],
      TARGET,
    );
    // Equal frequency → preset order wins: 会聊天 precedes 温暖.
    expect(result.get("peer-1")).toEqual(["会聊天", "温暖"]);
  });

  it("ranks by frequency and caps at Top 2", () => {
    const result = aggregatePeerImpressionTags(
      [
        // peer-1 tagged the user across two events: 有趣 x2, 温暖 x1, 同频 x1
        row("peer-1", { [TARGET]: { tags: ["有趣", "温暖", "同频"] } }),
        row("peer-1", { [TARGET]: { tags: ["有趣"] } }),
      ],
      TARGET,
    );
    expect(result.get("peer-1")).toEqual(["有趣", "温暖"]);
  });

  it("tie-breaks equal frequencies by preset order (deterministic)", () => {
    // 同频 appears later in the preset list than 会聊天 — 会聊天 must win.
    const result = aggregatePeerImpressionTags(
      [row("peer-1", { [TARGET]: { tags: ["同频", "会聊天"] } })],
      TARGET,
    );
    const idxHuiLiao = POSITIVE_IMPRESSION_TAG_PRESETS.indexOf("会聊天");
    const idxTongPin = POSITIVE_IMPRESSION_TAG_PRESETS.indexOf("同频");
    expect(idxHuiLiao).toBeLessThan(idxTongPin);
    expect(result.get("peer-1")).toEqual(["会聊天", "同频"]);
  });

  it("drops non-preset (crafted) tags entirely", () => {
    const result = aggregatePeerImpressionTags(
      [row("peer-1", { [TARGET]: { tags: ["土豪", "温暖", "<script>"] } })],
      TARGET,
    );
    expect(result.get("peer-1")).toEqual(["温暖"]);
  });

  it("ignores tags addressed to other attendees", () => {
    const result = aggregatePeerImpressionTags(
      [
        row("peer-1", {
          "someone-else": { tags: ["有趣", "活跃"] },
          [TARGET]: { tags: ["温暖"] },
        }),
      ],
      TARGET,
    );
    expect(result.get("peer-1")).toEqual(["温暖"]);
  });

  it("keeps peers independent", () => {
    const result = aggregatePeerImpressionTags(
      [
        row("peer-1", { [TARGET]: { tags: ["有趣"] } }),
        row("peer-2", { [TARGET]: { tags: ["会倾听", "温暖"] } }),
      ],
      TARGET,
    );
    expect(result.get("peer-1")).toEqual(["有趣"]);
    expect(result.get("peer-2")).toEqual(["温暖", "会倾听"]);
  });

  it("omits givers whose tags are all non-preset or empty", () => {
    const result = aggregatePeerImpressionTags(
      [
        row("peer-1", { [TARGET]: { tags: ["不存在的词"] } }),
        row("peer-2", { [TARGET]: { tags: [] } }),
      ],
      TARGET,
    );
    expect(result.has("peer-1")).toBe(false);
    expect(result.has("peer-2")).toBe(false);
  });

  it("tolerates malformed attendee_traits payloads", () => {
    const result = aggregatePeerImpressionTags(
      [
        row("peer-1", null),
        row("peer-2", "not-an-object"),
        row("peer-3", { [TARGET]: { tags: "not-an-array" } }),
        row("peer-4", { [TARGET]: { tags: [42, null, "温暖"] } }),
        row("peer-5", { [TARGET]: {} }),
      ],
      TARGET,
    );
    expect(result.size).toBe(1);
    expect(result.get("peer-4")).toEqual(["温暖"]);
  });

  it("returns an empty map for no rows", () => {
    expect(aggregatePeerImpressionTags([], TARGET).size).toBe(0);
  });

  it("every emitted tag is a positive preset word", () => {
    const result = aggregatePeerImpressionTags(
      [row("peer-1", { [TARGET]: { tags: [...POSITIVE_IMPRESSION_TAG_PRESETS, "外来词"] } })],
      TARGET,
    );
    for (const tags of result.values()) {
      for (const tag of tags) {
        expect(POSITIVE_IMPRESSION_TAG_PRESETS).toContain(tag);
      }
    }
  });
});
