import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ARCHETYPE_TOPIC_HINTS,
  deriveTopicCues,
} from "../topicHeatUtils";

describe("topicHeatUtils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dedupes and preserves ordering from recent theme titles while skipping nulls", () => {
    const cues = deriveTopicCues([
      { themeTitle: null, themeEmoji: "✨" },
      { themeTitle: " 城市夜游 ", themeEmoji: "🌃" },
      { themeTitle: "城市夜游", themeEmoji: "🌙" },
      { themeTitle: "AI 真心话", themeEmoji: "🤖" },
      { themeTitle: "旅行灵感", themeEmoji: "✈️" },
    ]);

    expect(cues).toEqual([
      { emoji: "🌃", text: "城市夜游" },
      { emoji: "🤖", text: "AI 真心话" },
      { emoji: "✈️", text: "旅行灵感" },
    ]);
  });

  it("falls back to archetype topic hints when fewer than three themes are available", () => {
    const cues = deriveTopicCues(
      [{ themeTitle: "城市夜游", themeEmoji: "🌃" }],
      { 沉思猫头鹰: 2 },
    );

    expect(cues).toEqual([
      { emoji: "🌃", text: "城市夜游" },
      { emoji: "📖", text: "深度观察" },
      { emoji: "🔭", text: "思维碰撞" },
    ]);
  });

  it("falls back to archetype traits when explicit topic hints are unavailable", () => {
    const originalHints = ARCHETYPE_TOPIC_HINTS["沉思猫头鹰"];
    ARCHETYPE_TOPIC_HINTS["沉思猫头鹰"] = [];

    try {
      const cues = deriveTopicCues([], { 沉思猫头鹰: 1 });

      expect(cues).toEqual([
        { emoji: "💡", text: "逻辑性强" },
        { emoji: "💡", text: "善于提问" },
        { emoji: "💡", text: "追求真理" },
      ]);
    } finally {
      ARCHETYPE_TOPIC_HINTS["沉思猫头鹰"] = originalHints;
    }
  });

  it("pads with generic fallbacks until at least three cues are present", () => {
    const cues = deriveTopicCues([{ themeTitle: "城市夜游", themeEmoji: "🌃" }], {
      不存在的原型: 1,
    });

    expect(cues).toEqual([
      { emoji: "🌃", text: "城市夜游" },
      { emoji: "💬", text: "真实对话" },
      { emoji: "✨", text: "相遇故事" },
    ]);
  });
});
