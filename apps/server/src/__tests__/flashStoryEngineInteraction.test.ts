import { describe, expect, it } from "vitest";

import type { FlashStoryContentV2 } from "@shared/schema";

import {
  advanceStoryNode,
  createEmptyFlashRunState,
  enterStoryEpisode,
  getStoryNodeView,
  resolveInteractionFallback,
  submitStoryInteractionResult,
} from "../services/flashStoryEngine";

const ACTION_UNIT: FlashStoryContentV2 = {
  v: 2,
  start: "n1_setup",
  state: { echo: 5 },
  nodes: {
    n1_setup: {
      id: "n1_setup",
      type: "prose",
      segments: [{ text: "阿浪把一张折得很薄的图摊在膝盖上。" }],
      next: "n2_action",
    },
    n2_action: {
      id: "n2_action",
      type: "interaction",
      interaction: {
        template: "spacing",
        goal: "移动两把椅子，留出图上刚好的并肩距离。",
        hints: ["不用挤在一起。"],
        results: [
          { id: "aligned", next: "n3_callback_a", effect: { echo: 15, flagsSet: ["s1-alang-aligned"] } },
          { id: "crowded", next: "n3_callback_b", effect: { echo: -5 } },
          { id: "settle-now", next: "n5_close", effect: { echo: 3 } },
        ],
        defaultResultId: "aligned",
        fallbackNext: "n4_fallback",
      },
    },
    n3_callback_a: {
      id: "n3_callback_a",
      type: "callback",
      segments: [{ text: "座位之间的空隙和折痕对上了。" }],
      next: "n5_close",
    },
    n3_callback_b: {
      id: "n3_callback_b",
      type: "callback",
      segments: [{ text: "椅子靠得太近，图纸被遮住了一角。" }],
      next: "n5_close",
    },
    n4_fallback: {
      id: "n4_fallback",
      type: "prose",
      segments: [{ text: "你们一起把图纸收好。" }],
      next: "n5_close",
    },
    n5_close: {
      id: "n5_close",
      type: "closure",
      segments: [{ text: "他把图按旧折痕收好。" }],
      unlockFragment: "s1-p1-alang-fragment",
    },
  },
};

function stateAt(nodeId: string, echo = 5) {
  const entered = enterStoryEpisode(ACTION_UNIT, createEmptyFlashRunState());
  return { ...entered, echo, currentNode: nodeId, nodePath: [...entered.nodePath, nodeId] };
}

describe("flashStoryEngine interaction nodes", () => {
  it("exposes the interaction config on the node view and null elsewhere", () => {
    const proseView = getStoryNodeView(ACTION_UNIT, stateAt("n1_setup"));
    expect(proseView?.type).toBe("prose");
    expect(proseView?.interaction).toBeNull();

    const actionView = getStoryNodeView(ACTION_UNIT, stateAt("n2_action"));
    expect(actionView?.type).toBe("interaction");
    expect(actionView?.interaction?.template).toBe("spacing");
    expect(actionView?.interaction?.goal).toContain("移动两把椅子");
    expect(actionView?.interaction?.hints).toHaveLength(1);
    expect(actionView?.interaction?.results.map((result) => result.id)).toEqual([
      "aligned",
      "crowded",
      "settle-now",
    ]);
    expect(actionView?.interaction?.defaultResultId).toBe("aligned");
    expect(actionView?.interaction?.fallbackNext).toBe("n4_fallback");
  });

  it("submits a valid result: applies effect, advances to its callback, records path and result id", () => {
    const result = submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: stateAt("n2_action"),
      nodeId: "n2_action",
      resultId: "aligned",
    });
    expect(result.state.echo).toBe(5 + 15);
    expect(result.state.flags).toContain("s1-alang-aligned");
    expect(result.state.currentNode).toBe("n3_callback_a");
    expect(result.state.nodePath).toEqual(["n1_setup", "n2_action", "n2_action", "n3_callback_a"]);
    expect(result.state.lastChoiceId).toBe("aligned");
    expect(result.view.nodeId).toBe("n3_callback_a");
    expect(result.finished).toBe(false);
  });

  it("detects finished when the result lands on a terminal closure", () => {
    const result = submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: stateAt("n2_action"),
      nodeId: "n2_action",
      resultId: "settle-now",
    });
    expect(result.view.type).toBe("closure");
    expect(result.view.next).toBeNull();
    expect(result.finished).toBe(true);
  });

  it("rejects a non-interaction node with FLASH_V2_NOT_AN_INTERACTION_NODE", () => {
    expect(() => submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: stateAt("n1_setup"),
      nodeId: "n1_setup",
      resultId: "aligned",
    })).toThrowError(/^FLASH_V2_NOT_AN_INTERACTION_NODE/);
    expect(() => submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: stateAt("n2_action"),
      nodeId: "n9_missing",
      resultId: "aligned",
    })).toThrowError(/^FLASH_V2_NOT_AN_INTERACTION_NODE/);
  });

  it("rejects an unknown result id with FLASH_V2_UNKNOWN_RESULT and no state change", () => {
    const before = stateAt("n2_action");
    expect(() => submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: before,
      nodeId: "n2_action",
      resultId: "forged-result",
    })).toThrowError(/^FLASH_V2_UNKNOWN_RESULT: n2_action\/forged-result/);
    expect(before.currentNode).toBe("n2_action");
  });

  it("clamps result effects into the 0..100 echo band", () => {
    const high = submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: stateAt("n2_action", 95),
      nodeId: "n2_action",
      resultId: "aligned",
    });
    expect(high.state.echo).toBe(100);
    const low = submitStoryInteractionResult({
      content: ACTION_UNIT,
      state: stateAt("n2_action", 2),
      nodeId: "n2_action",
      resultId: "crowded",
    });
    expect(low.state.echo).toBe(0);
  });

  it("blocks plain advance on interaction nodes", () => {
    expect(() => advanceStoryNode({ content: ACTION_UNIT, state: stateAt("n2_action") }))
      .toThrowError(/^FLASH_V2_INTERACTION_EXPECTED: n2_action/);
  });

  it("resolves the flag-off fallback: default result effect, reviewed fallbackNext", () => {
    const result = resolveInteractionFallback({
      content: ACTION_UNIT,
      state: stateAt("n2_action"),
      nodeId: "n2_action",
    });
    expect(result.state.echo).toBe(5 + 15);
    expect(result.state.flags).toContain("s1-alang-aligned");
    expect(result.state.currentNode).toBe("n4_fallback");
    expect(result.state.lastChoiceId).toBe("aligned");
    expect(result.state.nodePath).toEqual(["n1_setup", "n2_action", "n2_action", "n4_fallback"]);
    expect(result.view.nodeId).toBe("n4_fallback");
    expect(result.finished).toBe(false);
  });

  it("refuses fallback on non-interaction nodes and on unknown default results", () => {
    expect(() => resolveInteractionFallback({
      content: ACTION_UNIT,
      state: stateAt("n1_setup"),
      nodeId: "n1_setup",
    })).toThrowError(/^FLASH_V2_NOT_AN_INTERACTION_NODE/);

    const broken: FlashStoryContentV2 = {
      ...ACTION_UNIT,
      nodes: {
        ...ACTION_UNIT.nodes,
        n2_action: {
          ...ACTION_UNIT.nodes.n2_action,
          interaction: {
            ...ACTION_UNIT.nodes.n2_action.interaction!,
            defaultResultId: "ghost",
          },
        },
      },
    };
    expect(() => resolveInteractionFallback({
      content: broken,
      state: stateAt("n2_action"),
      nodeId: "n2_action",
    })).toThrowError(/^FLASH_V2_UNKNOWN_RESULT: n2_action\/ghost/);
  });

  it("fails loudly on a broken result next pointer", () => {
    const broken: FlashStoryContentV2 = {
      ...ACTION_UNIT,
      nodes: {
        ...ACTION_UNIT.nodes,
        n2_action: {
          ...ACTION_UNIT.nodes.n2_action,
          interaction: {
            ...ACTION_UNIT.nodes.n2_action.interaction!,
            results: [{ id: "aligned", next: "n9_missing" }],
            defaultResultId: "aligned",
          },
        },
      },
    };
    expect(() => submitStoryInteractionResult({
      content: broken,
      state: stateAt("n2_action"),
      nodeId: "n2_action",
      resultId: "aligned",
    })).toThrowError(/^FLASH_V2_BROKEN_NEXT: n2_action -> n9_missing/);
  });
});
