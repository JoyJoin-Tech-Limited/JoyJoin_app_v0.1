import { describe, expect, it } from "vitest";

import {
  classifyFlashChoiceIntent,
  applyFlashChoiceEffects,
  effectsForFlashChoice,
  EMPTY_FLASH_UNIVERSE_VECTOR,
  resolveFlashStoryEnding,
} from "./parallelUniverse";

describe("Street Blind Box parallel universe engine", () => {
  it("applies bounded deterministic effects", () => {
    const first = applyFlashChoiceEffects(EMPTY_FLASH_UNIVERSE_VECTOR, effectsForFlashChoice("notice-action"));
    const second = applyFlashChoiceEffects(EMPTY_FLASH_UNIVERSE_VECTOR, effectsForFlashChoice("notice-action"));
    expect(first).toEqual(second);
    expect(first).toEqual({ trust: 1, attachment: 0, intervention: 2, truth: 0 });
  });

  it.each([
    [{ trust: 9, attachment: 1, intervention: 2, truth: 0 }, "bridge_keeper"],
    [{ trust: 0, attachment: 9, intervention: 1, truth: 2 }, "memory_keeper"],
    [{ trust: 0, attachment: 1, intervention: 9, truth: 2 }, "path_changer"],
    [{ trust: 0, attachment: 1, intervention: 2, truth: 9 }, "truth_witness"],
    [{ trust: 8, attachment: 7, intervention: 1, truth: 0 }, "parallel_mixed"],
  ] as const)("resolves the five reviewed ending regions", (vector, ending) => {
    expect(resolveFlashStoryEnding(vector)).toBe(ending);
  });

  it("clamps hostile or malformed effect magnitudes", () => {
    expect(applyFlashChoiceEffects(EMPTY_FLASH_UNIVERSE_VECTOR, [{ dimension: "truth", delta: 999 }]).truth).toBe(30);
  });

  it("keeps an unexpired generation lease single-owner and reclaims it after expiry", () => {
    const now = new Date("2026-08-07T08:00:00Z");
    const stored = {
      episodeId: "episode-1", questionId: "q1", optionId: "o1", status: "generating",
      leaseExpiresAt: new Date("2026-08-07T08:00:15Z"), responseSnapshot: null, renderKind: null,
    };
    expect(classifyFlashChoiceIntent({ stored, episodeId: "episode-1", questionId: "q1", optionId: "o1", now })).toBe("pending");
    expect(classifyFlashChoiceIntent({ ...{ episodeId: "episode-1", questionId: "q1", optionId: "o1" }, stored, now: new Date("2026-08-07T08:00:16Z") })).toBe("claim");
  });

  it("never accepts a different choice for an existing encounter intent", () => {
    expect(classifyFlashChoiceIntent({
      stored: {
        episodeId: "episode-1", questionId: "q1", optionId: "o1", status: "completed",
        leaseExpiresAt: null, responseSnapshot: "saved", renderKind: "ai",
      },
      episodeId: "episode-1", questionId: "q1", optionId: "o2", now: new Date(),
    })).toBe("conflict");
  });
});
