import { describe, it, expect } from "vitest";
import { renderMomentCardToPng } from "../lib/momentCardRenderer";
import type { MomentCardPayload } from "../lib/momentCardPayload";

describe("renderMomentCardToPng", () => {
  it("renders a valid PNG buffer for a basic payload", async () => {
    const payload: MomentCardPayload = {
      version: 1,
      headline: "测试标题",
      subheadline: "测试副标题",
      cast: [
        { displayName: "小明", archetype: "corgi" },
        { displayName: "小红", archetype: "rooster" },
      ],
      stats: {
        durationMinutes: 60,
        phasesCompleted: 4,
        totalPhases: 5,
        topicsCount: 3,
        challengesCount: 2,
      },
      quote: "这是一个测试引用",
      quoteAuthor: "JoyJoin",
      medals: [
        { emoji: "🏆", title: "最佳表现", recipient: "小明" },
      ],
      deepLinkUrl: "https://joyjoinapp.com/discover",
      generatedAt: new Date().toISOString(),
    };

    const buffer = await renderMomentCardToPng(payload);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PNG magic bytes
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50);
    expect(buffer[2]).toBe(0x4e);
    expect(buffer[3]).toBe(0x47);
  });

  it("renders without quote when omitted", async () => {
    const payload: MomentCardPayload = {
      version: 1,
      headline: "无引用测试",
      subheadline: "副标题",
      cast: [],
      stats: { durationMinutes: 40, phasesCompleted: 2, totalPhases: 4, topicsCount: 1, challengesCount: 1 },
      medals: [],
      deepLinkUrl: "https://joyjoinapp.com",
      generatedAt: new Date().toISOString(),
    };

    const buffer = await renderMomentCardToPng(payload);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
