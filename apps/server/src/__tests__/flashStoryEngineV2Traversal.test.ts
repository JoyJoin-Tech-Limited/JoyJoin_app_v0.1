import { describe, expect, it } from "vitest";

import type { FlashStoryContentV2 } from "@shared/schema";

import {
  advanceStoryNode,
  answerStoryChoice,
  buildV2EndingGallery,
  enterStoryEpisode,
  getStoryNodeView,
  resolveV2EchoTier,
  resolveV2Ending,
} from "../services/flashStoryEngine";

const UNIT: FlashStoryContentV2 = {
  v: 2,
  start: "n1",
  state: { echo: 5 },
  nodes: {
    n1: {
      id: "n1",
      type: "prose",
      segments: [{ text: "阿浪把图摊开。" }],
      next: "n2",
    },
    n2: {
      id: "n2",
      type: "choice",
      choices: [
        { id: "a", text: "这图画的是两个人吧。", kind: "attitude", next: "n3a", effect: { echo: 10, flagsSet: ["s1-alang-asked"] } },
        { id: "b", text: "把纸转回去", kind: "path", next: "n3b", effect: { echo: 5 } },
      ],
    },
    n3a: { id: "n3a", type: "callback", segments: [{ text: "阿浪愣了一下。" }], next: "n4" },
    n3b: { id: "n3b", type: "callback", segments: [{ text: "纸转回折痕那面。" }], next: "n4" },
    n4: {
      id: "n4",
      type: "closure",
      variants: [
        { when: { echo: { gte: 12 } }, segments: [{ text: "他把图收好，这次没有再看。" }] },
        { when: "default", segments: [{ text: "他把图收好。" }] },
      ],
    },
  },
};

describe("flashStoryEngine v2 full traversal", () => {
  it("traverses prose → choice → callback → closure with variant echo", () => {
    let run = enterStoryEpisode(UNIT, { echo: 0, flags: [], variables: {}, currentNode: null, nodePath: [] });
    expect(run.echo).toBe(5);
    expect(getStoryNodeView(UNIT, run)?.type).toBe("prose");

    run = { ...run, currentNode: "n2", nodePath: [...run.nodePath, "n2"] };
    const first = answerStoryChoice({ content: UNIT, state: run, nodeId: "n2", choiceId: "a" });
    expect(first.view.type).toBe("callback");
    expect(first.state.echo).toBe(15);
    expect(first.state.flags).toContain("s1-alang-asked");
    expect(first.finished).toBe(false);

    const closure = getStoryNodeView(UNIT, { ...first.state, currentNode: "n4" });
    expect(closure?.type).toBe("closure");
    expect(closure?.segments?.[0]?.text).toContain("没有再看");
  });

  it("keeps echo in [0,100] bounds", () => {
    const unit: FlashStoryContentV2 = {
      v: 2,
      start: "n1",
      nodes: {
        n1: {
          id: "n1",
          type: "choice",
          choices: [
            { id: "a", text: "深挖", kind: "attitude", next: "n2", effect: { echo: 500 } },
            { id: "b", text: "放下", kind: "attitude", next: "n2", effect: { echo: -500 } },
          ],
        },
        n2: { id: "n2", type: "closure", segments: [{ text: "结束。" }] },
      },
    };
    let run = enterStoryEpisode(unit, { echo: 50, flags: [], variables: {}, currentNode: null, nodePath: [] });
    run = { ...run, currentNode: "n1", nodePath: [...run.nodePath, "n1"] };
    const deep = answerStoryChoice({ content: unit, state: run, nodeId: "n1", choiceId: "a" });
    expect(deep.state.echo).toBe(100);
    const drop = answerStoryChoice({ content: unit, state: { ...run, echo: 10 }, nodeId: "n1", choiceId: "b" });
    expect(drop.state.echo).toBe(0);
  });

  it("resolves all ending codes across the echo range", () => {
    expect(resolveV2Ending({ echo: 70, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("truth_witness");
    expect(resolveV2Ending({ echo: 50, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("path_changer");
    expect(resolveV2Ending({ echo: 30, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("bridge_keeper");
    expect(resolveV2Ending({ echo: 10, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("memory_keeper");
    expect(resolveV2Ending({ echo: 2, flags: [], variables: {}, currentNode: null, nodePath: [] })).toBe("parallel_mixed");
  });

  it("advances prose and callback nodes along next until a choice or terminal", () => {
    let run = enterStoryEpisode(UNIT, { echo: 0, flags: [], variables: {}, currentNode: null, nodePath: [] });
    expect(getStoryNodeView(UNIT, run)?.type).toBe("prose");
    const advanced = advanceStoryNode({ content: UNIT, state: run });
    expect(advanced.view.type).toBe("choice");
    expect(advanced.state.currentNode).toBe("n2");
    expect(advanced.finished).toBe(false);

    const afterChoice = answerStoryChoice({ content: UNIT, state: advanced.state, nodeId: "n2", choiceId: "b" });
    expect(afterChoice.view.type).toBe("callback");
    const atClosure = advanceStoryNode({ content: UNIT, state: afterChoice.state });
    expect(atClosure.view.type).toBe("closure");
    expect(atClosure.finished).toBe(true);
  });

  it("does not re-apply root state on re-entry", () => {
    let run = enterStoryEpisode(UNIT, { echo: 0, flags: [], variables: {}, currentNode: null, nodePath: [] });
    expect(run.echo).toBe(5);
    const reEntered = enterStoryEpisode(UNIT, run);
    expect(reEntered.echo).toBe(5);
    expect(reEntered.currentNode).toBe("n1");
    expect(reEntered.nodePath).toEqual(["n1"]);
  });

  it("rejects advancing a choice node and terminal closure", () => {
    let run = enterStoryEpisode(UNIT, { echo: 0, flags: [], variables: {}, currentNode: null, nodePath: [] });
    run = { ...run, currentNode: "n2", nodePath: [...run.nodePath, "n2"] };
    expect(() => advanceStoryNode({ content: UNIT, state: run })).toThrow(/FLASH_V2_CHOICE_EXPECTED/);
    const terminal = advanceStoryNode({ content: UNIT, state: { ...run, currentNode: "n4", nodePath: [...run.nodePath, "n4"] } });
    expect(terminal.finished).toBe(true);
  });
});

describe("v2 ending gallery + echo tier", () => {
  it("builds a gallery with reached flag and echo gaps", () => {
    
    const gallery = buildV2EndingGallery("bridge_keeper", 25);
    expect(gallery.map((g: { code: string }) => g.code)).toEqual([
      "truth_witness", "path_changer", "bridge_keeper", "memory_keeper", "parallel_mixed",
    ]);
    const reached = gallery.filter((g: { reached: boolean }) => g.reached);
    expect(reached.map((g: { code: string }) => g.code)).toEqual(["bridge_keeper"]);
    const truth = gallery.find((g: { code: string }) => g.code === "truth_witness");
    expect(truth?.echoGap).toBe(35);
    expect(truth?.approxChoices).toBe(4);
  });

  it("resolves echo tiers", () => {
    
    expect(resolveV2EchoTier(50)).toBe("彻");
    expect(resolveV2EchoTier(20)).toBe("深");
    expect(resolveV2EchoTier(3)).toBe("轻");
  });
});
