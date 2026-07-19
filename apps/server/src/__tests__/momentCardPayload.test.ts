import { describe, it, expect } from "vitest";
import type { SocialSessionState, SocialTopic } from "@shared/socialIcebreaker";
import { buildMomentCardPayload, pickKeepsakeTopic } from "../lib/momentCardPayload";

function topic(partial: Partial<SocialTopic> & { question: string }): SocialTopic {
  return {
    id: partial.id ?? `t-${partial.question.slice(0, 6)}`,
    mood: "funny",
    emoji: "",
    ...partial,
  } as SocialTopic;
}

function makeState(partial: Partial<SocialSessionState>): SocialSessionState {
  return {
    socialSessionId: "social_test-session",
    sessionStartedAt: Date.now() - 45 * 60000,
    ...partial,
  } as SocialSessionState;
}

describe("pickKeepsakeTopic", () => {
  it("returns undefined when there are no topics", () => {
    expect(pickKeepsakeTopic(makeState({ warmupTopics: [], currentTopicIndex: 0 }))).toBeUndefined();
    expect(pickKeepsakeTopic(makeState({}))).toBeUndefined();
  });

  it("prefers the last REACHED reflective topic", () => {
    const state = makeState({
      currentTopicIndex: 2,
      warmupTopics: [
        topic({ question: "轻松题", safety: "gentle" }),
        topic({ question: "第一道题反思", safety: "reflective", permissionLine: "慢慢来" }),
        topic({ question: "第二道题反思", safety: "reflective", depthLevel: 3 }),
      ],
    });
    const keepsake = pickKeepsakeTopic(state);
    expect(keepsake?.question).toBe("第二道题反思");
    expect(keepsake?.depthLevel).toBe(3);
  });

  it("falls back to the last reached topic when none are reflective", () => {
    const state = makeState({
      currentTopicIndex: 1,
      warmupTopics: [
        topic({ question: "第一题", safety: "gentle" }),
        topic({ question: "第二题", safety: "open", permissionLine: "说到哪算哪" }),
        topic({ question: "未到达的反思题", safety: "reflective" }),
      ],
    });
    const keepsake = pickKeepsakeTopic(state);
    expect(keepsake?.question).toBe("第二题");
    expect(keepsake?.permissionLine).toBe("说到哪算哪");
  });

  it("never selects an unreached topic (index > currentTopicIndex)", () => {
    const state = makeState({
      currentTopicIndex: 0,
      warmupTopics: [
        topic({ question: "已到题", safety: "gentle" }),
        topic({ question: "未到反思题", safety: "reflective", depthLevel: 3 }),
      ],
    });
    const keepsake = pickKeepsakeTopic(state);
    expect(keepsake?.question).toBe("已到题");
  });

  it("treats a missing currentTopicIndex as index 0 (first topic reached)", () => {
    const state = makeState({
      warmupTopics: [
        topic({ question: "第一题", safety: "reflective" }),
        topic({ question: "第二题", safety: "reflective" }),
      ],
    });
    expect(pickKeepsakeTopic(state)?.question).toBe("第一题");
  });

  it("clamps an out-of-range currentTopicIndex to the last topic", () => {
    const state = makeState({
      currentTopicIndex: 99,
      warmupTopics: [
        topic({ question: "第一题", safety: "gentle" }),
        topic({ question: "最后题", safety: "open" }),
      ],
    });
    expect(pickKeepsakeTopic(state)?.question).toBe("最后题");
  });
});

describe("buildMomentCardPayload — keepsake + quote chain", () => {
  const roster = [{ displayName: "小明", archetype: "corgi" }];

  it("suppresses the warmup-topic quote branch when a keepsake exists", () => {
    const state = makeState({
      currentTopicIndex: 1,
      warmupTopics: [
        topic({ question: "第一题", safety: "gentle" }),
        topic({ question: "留档题", safety: "reflective", permissionLine: "慢慢来" }),
      ],
    });
    const payload = buildMomentCardPayload(state, roster);

    expect(payload.keepsake?.question).toBe("留档题");
    // Warmup topic branch suppressed — quote falls through to the warm fallback.
    expect(payload.quote).not.toBe("留档题");
    expect(payload.quoteAuthor).toBe("JoyJoin");
    expect(payload.version).toBe(1);
  });

  it("keeps the recap standout moment quote branch ahead of the keepsake", () => {
    const state = makeState({
      currentTopicIndex: 0,
      warmupTopics: [topic({ question: "留档题", safety: "reflective" })],
    });
    const payload = buildMomentCardPayload(state, roster, {
      headline: "今晚很精彩",
      closingLine: "下次再见",
      moments: ["大家一起笑到停不下来"],
    });

    expect(payload.keepsake?.question).toBe("留档题");
    expect(payload.quote).toBe("大家一起笑到停不下来");
    expect(payload.quoteAuthor).toBe("今晚的精彩瞬间");
    expect(payload.headline).toBe("今晚很精彩");
    expect(payload.subheadline).toBe("下次再见");
  });

  it("leaves today's quote chain untouched when no keepsake exists", () => {
    const state = makeState({ warmupTopics: [], currentTopicIndex: 0 });
    const payload = buildMomentCardPayload(state, roster);

    expect(payload.keepsake).toBeUndefined();
    expect(payload.quote).toBeTruthy();
    expect(payload.quoteAuthor).toBe("JoyJoin");
  });

  it("still quotes the current warmup topic when topics exist but state carries none reached", () => {
    // currentTopicIndex undefined → index 0 reached → keepsake exists; to cover
    // the no-suppression path we pass a state whose warmupTopics is undefined
    // but recap has a moment (recap branch is unaffected by suppression).
    const state = makeState({});
    const payload = buildMomentCardPayload(state, roster, { moments: ["高光时刻"] });

    expect(payload.keepsake).toBeUndefined();
    expect(payload.quote).toBe("高光时刻");
  });
});
