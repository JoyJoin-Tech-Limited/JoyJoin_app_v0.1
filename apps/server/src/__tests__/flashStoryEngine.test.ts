import { describe, expect, it } from "vitest";

import type { FlashStoryContentV2 } from "@shared/schema";

import {
  answerStoryChoice,
  createEmptyFlashRunState,
  enterStoryEpisode,
  getStoryNodeView,
  resolveV2Ending,
} from "../services/flashStoryEngine";

const PILOT_UNIT: FlashStoryContentV2 = {
  v: 2,
  start: "n1_setup",
  state: { echo: 5, flagsSet: ["s1-alang-encountered"] },
  nodes: {
    n1_setup: {
      id: "n1_setup",
      type: "prose",
      segments: [{ text: "阿浪把一张折得很薄的图摊在膝盖上。" }],
      next: "n2_object",
    },
    n2_object: {
      id: "n2_object",
      type: "prose",
      segments: [
        { text: "图上画着两把椅子，距离被反复涂改过。" },
        { text: "你想先注意哪一件事？" },
      ],
      next: "n3_choice",
    },
    n3_choice: {
      id: "n3_choice",
      type: "choice",
      choices: [
        { id: "ask-direct", text: "这图画的是两个人吧。", kind: "attitude", next: "n4_echo_a", effect: { echo: 10, flagsSet: ["s1-alang-asked"] } },
        { id: "turn-paper", text: "把纸转回原来的方向", kind: "path", next: "n4_echo_b", effect: { echo: 5 } },
      ],
    },
    n4_echo_a: {
      id: "n4_echo_a",
      type: "callback",
      segments: [{ text: "阿浪愣了一下，手指停在折痕上。" }],
      next: "n5_close",
    },
    n4_echo_b: {
      id: "n4_echo_b",
      type: "callback",
      segments: [{ text: "纸转回来，折痕对着你这边。" }],
      next: "n5_close",
    },
    n5_close: {
      id: "n5_close",
      type: "closure",
      segments: [{ text: "他把图按旧折痕收好，这次没有再看它一眼。" }],
      unlockFragment: "s1-p1-alang-fragment",
    },
  },
};

const VARIANT_UNIT: FlashStoryContentV2 = {
  v: 2,
  start: "n1",
  nodes: {
    n1: {
      id: "n1",
      type: "choice",
      choices: [
        { id: "deep", text: "追问钥匙的来历", kind: "attitude", next: "n2", effect: { echo: 20 } },
        { id: "letgo", text: "把钥匙放回箱底", kind: "attitude", next: "n2", effect: { echo: -5 } },
      ],
    },
    n2: {
      id: "n2",
      type: "closure",
      variants: [
        { when: { echo: { gte: 15 } }, segments: [{ text: "钥匙在灯下泛着铜光，三条短线看得更清了。" }] },
        { when: "default", segments: [{ text: "钥匙滑回箱底，发出两声轻响。" }] },
      ],
    },
  },
};

describe("flashStoryEngine", () => {
  it("applies root entry state then returns the start node", () => {
    const run = enterStoryEpisode(PILOT_UNIT, createEmptyFlashRunState());
    expect(run.echo).toBe(5);
    expect(run.flags).toContain("s1-alang-encountered");
    expect(run.currentNode).toBe("n1_setup");
    expect(run.nodePath).toEqual(["n1_setup"]);
    const view = getStoryNodeView(PILOT_UNIT, run);
    expect(view?.type).toBe("prose");
  });

  it("routes a choice to its dedicated callback and applies state", () => {
    let run = enterStoryEpisode(PILOT_UNIT, createEmptyFlashRunState());
    run = { ...run, currentNode: "n3_choice", nodePath: [...run.nodePath, "n3_choice"] };
    const result = answerStoryChoice({ content: PILOT_UNIT, state: run, nodeId: "n3_choice", choiceId: "ask-direct" });
    expect(result.state.echo).toBe(5 + 10);
    expect(result.state.flags).toContain("s1-alang-asked");
    expect(result.view.nodeId).toBe("n4_echo_a");
    expect(result.view.segments?.[0]?.text).toContain("阿浪愣了一下");
    expect(result.finished).toBe(false);
  });

  it("marks the unit finished after closure without next", () => {
    let run = enterStoryEpisode(PILOT_UNIT, createEmptyFlashRunState());
    run = { ...run, currentNode: "n3_choice", nodePath: [...run.nodePath, "n3_choice"] };
    const after = answerStoryChoice({ content: PILOT_UNIT, state: run, nodeId: "n3_choice", choiceId: "turn-paper" });
    expect(after.view.type).toBe("callback");
    const closure = getStoryNodeView(PILOT_UNIT, { ...after.state, currentNode: "n5_close" });
    expect(closure?.type).toBe("closure");
    expect(closure?.unlockFragment).toBe("s1-p1-alang-fragment");
    expect(closure?.next).toBeNull();
  });

  it("selects variants by echo threshold and falls back to default", () => {
    let run = enterStoryEpisode(VARIANT_UNIT, createEmptyFlashRunState());
    run = { ...run, currentNode: "n1", nodePath: [...run.nodePath, "n1"] };
    const deep = answerStoryChoice({ content: VARIANT_UNIT, state: run, nodeId: "n1", choiceId: "deep" });
    expect(deep.state.echo).toBe(20);
    const view = getStoryNodeView(VARIANT_UNIT, deep.state);
    expect(view?.segments?.[0]?.text).toContain("三条短线");
    const letgo = answerStoryChoice({ content: VARIANT_UNIT, state: { ...run, echo: 0 }, nodeId: "n1", choiceId: "letgo" });
    const fallback = getStoryNodeView(VARIANT_UNIT, letgo.state);
    expect(fallback?.segments?.[0]?.text).toContain("两声轻响");
  });

  it("rejects unknown choices and broken nexts", () => {
    let run = enterStoryEpisode(PILOT_UNIT, createEmptyFlashRunState());
    run = { ...run, currentNode: "n3_choice", nodePath: [...run.nodePath, "n3_choice"] };
    expect(() => answerStoryChoice({ content: PILOT_UNIT, state: run, nodeId: "n3_choice", choiceId: "nope" })).toThrow(/FLASH_V2_UNKNOWN_CHOICE/);
  });

  it("resolves endings from echo + flags", () => {
    expect(resolveV2Ending({ echo: 70, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("truth_witness");
    expect(resolveV2Ending({ echo: 30, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("bridge_keeper");
    expect(resolveV2Ending({ echo: 10, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("memory_keeper");
    expect(resolveV2Ending({ echo: 2, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("parallel_mixed");
  });
});
