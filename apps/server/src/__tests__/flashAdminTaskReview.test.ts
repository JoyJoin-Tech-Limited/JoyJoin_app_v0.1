import { describe, expect, it } from "vitest";

import { hasFlashTaskContentChange } from "../routes/domains/adminAlang";

const current = {
  code: "T01",
  category: "探店借口",
  title: "替我去看看",
  brief: "到附近看看就好",
  instructions: "到附近点击到达，不要求进店",
  dialogueIntro: "我还没去过那里",
  feedbackPrompts: [{
    id: "feeling",
    prompt: "那里给你的感觉？",
    options: [{ id: "calm", label: "安静" }, { id: "lively", label: "热闹" }],
  }],
  tags: ["安静", "探店"],
  durationDays: 7,
  baseWeight: 100,
  safetyLevel: "L1",
  safetyNotes: "无需消费或进店",
  npcIds: ["npc-b", "npc-a"],
  destinationIds: ["destination-a"],
};

describe("Flash admin task review boundary", () => {
  it("allows a review-only save when the editor resends unchanged content", () => {
    expect(hasFlashTaskContentChange(current, {
      ...current,
      code: "t01",
      tags: ["探店", "安静"],
      npcIds: ["npc-a", "npc-b"],
    })).toBe(false);
  });

  it("requires a fresh saved-copy review after any actual content change", () => {
    expect(hasFlashTaskContentChange(current, {
      ...current,
      dialogueIntro: "我听说那里有点意思",
    })).toBe(true);
  });
});
