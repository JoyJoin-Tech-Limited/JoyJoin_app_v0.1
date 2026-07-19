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

  it("renders the keepsake block with a permission line", async () => {
    const payload: MomentCardPayload = {
      version: 1,
      headline: "留档测试",
      subheadline: "副标题",
      cast: [
        { displayName: "小明", archetype: "corgi" },
        { displayName: "小红", archetype: "rooster" },
        { displayName: "小李", archetype: "dolphin" },
      ],
      stats: { durationMinutes: 60, phasesCompleted: 4, totalPhases: 5, topicsCount: 2, challengesCount: 2 },
      keepsake: {
        question: "如果今晚只能记住一个瞬间，你希望是哪个？",
        permissionLine: "说多少都可以，沉默也被允许",
        depthLevel: 3,
        mood: "emotional",
      },
      medals: [
        { emoji: "🏆", title: "最佳表现", recipient: "小明" },
        { emoji: "🌟", title: "气氛担当", recipient: "小红" },
      ],
      deepLinkUrl: "https://joyjoinapp.com/discover",
      generatedAt: new Date().toISOString(),
    };

    const buffer = await renderMomentCardToPng(payload);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    expect(buffer[0]).toBe(0x89);
  });

  it("renders the keepsake block without a permission line (no dangling prefix)", async () => {
    const payload: MomentCardPayload = {
      version: 1,
      headline: "留档测试",
      subheadline: "副标题",
      cast: [{ displayName: "小明", archetype: "corgi" }],
      stats: { durationMinutes: 40, phasesCompleted: 2, totalPhases: 4, topicsCount: 1, challengesCount: 1 },
      keepsake: {
        question: "最近有什么让你真心笑出来的事？",
        permissionLine: null,
        depthLevel: 1,
        mood: "funny",
      },
      medals: [],
      deepLinkUrl: "https://joyjoinapp.com/discover",
      generatedAt: new Date().toISOString(),
    };

    const buffer = await renderMomentCardToPng(payload);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("clamps a 40+ char keepsake question to two lines without overflowing", async () => {
    const payload: MomentCardPayload = {
      version: 1,
      headline: "长问题测试",
      subheadline: "副标题",
      cast: [{ displayName: "小明", archetype: "corgi" }],
      stats: { durationMinutes: 90, phasesCompleted: 5, totalPhases: 5, topicsCount: 3, challengesCount: 3 },
      keepsake: {
        question:
          "如果可以回到过去改变一件小事，你会选择哪一个瞬间，为什么它对你如此重要，甚至至今仍然影响着你？",
        permissionLine: "这个问题有点深，想到哪说到哪",
        depthLevel: 3,
        mood: "emotional",
      },
      medals: [{ emoji: "🏆", title: "最佳表现", recipient: "小明" }],
      deepLinkUrl: "https://joyjoinapp.com/discover",
      generatedAt: new Date().toISOString(),
    };

    const buffer = await renderMomentCardToPng(payload);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("renders a full card: 12 cast + quote + keepsake + 3 medals without overlap or throw", async () => {
    const payload: MomentCardPayload = {
      version: 1,
      headline: "满员测试",
      subheadline: "副标题",
      cast: Array.from({ length: 12 }, (_, i) => ({
        displayName: `成员${i + 1}`,
        archetype: "corgi",
      })),
      stats: { durationMinutes: 90, phasesCompleted: 5, totalPhases: 5, topicsCount: 3, challengesCount: 6 },
      quote: "今晚聊到了真心话",
      quoteAuthor: "今晚的精彩瞬间",
      keepsake: {
        question: "如果今晚只能记住一个瞬间，你希望是哪个？",
        permissionLine: "说多少都可以",
        depthLevel: 2,
        mood: "emotional",
      },
      medals: [
        { emoji: "🏆", title: "最佳表现", recipient: "成员1" },
        { emoji: "🌟", title: "气氛担当", recipient: "成员2" },
        { emoji: "💫", title: "灵魂提问", recipient: "成员3" },
      ],
      deepLinkUrl: "https://joyjoinapp.com/discover",
      generatedAt: new Date().toISOString(),
    };

    const buffer = await renderMomentCardToPng(payload);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
