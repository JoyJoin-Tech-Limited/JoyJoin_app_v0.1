import type {
  FlashStoryEndingCode,
} from "@joyjoin/shared/alang/parallelUniverse";
import type {
  FlashStoryContentV2,
  FlashStoryRunState,
  FlashStoryV2Choice,
  FlashStoryV2Effect,
  FlashStoryV2Node,
  FlashStoryV2Variant,
} from "@shared/schema";

export type { FlashStoryRunState };

export const FLASH_V2_ECHO_MAX = 100;
export const FLASH_V2_ECHO_START = 0;

export function createEmptyFlashRunState(): FlashStoryRunState {
  return {
    echo: FLASH_V2_ECHO_START,
    flags: [],
    variables: {},
    currentNode: null,
    nodePath: [],
  };
}

export function applyEffect(state: FlashStoryRunState, effect: FlashStoryV2Effect | undefined): FlashStoryRunState {
  if (!effect) return state;
  return {
    echo: Math.max(0, Math.min(FLASH_V2_ECHO_MAX, state.echo + (effect.echo ?? 0))),
    flags: [...new Set([...state.flags, ...(effect.flagsSet ?? [])])],
    variables: { ...state.variables, ...(effect.variables ?? {}) },
    currentNode: state.currentNode,
    nodePath: state.nodePath,
  };
}

export function conditionMatches(
  condition: FlashStoryV2Variant["when"],
  state: FlashStoryRunState,
): boolean {
  if (condition === "default") return true;
  if (condition.flags?.length && !condition.flags.every((flag) => state.flags.includes(flag))) {
    return false;
  }
  if (condition.echo) {
    const { gte, lte, lt, gt } = condition.echo;
    if (gte !== undefined && state.echo < gte) return false;
    if (lte !== undefined && state.echo > lte) return false;
    if (lt !== undefined && state.echo >= lt) return false;
    if (gt !== undefined && state.echo <= gt) return false;
  }
  return true;
}

export function resolveVariant(node: FlashStoryV2Node, state: FlashStoryRunState): FlashStoryV2Variant | null {
  if (!node.variants?.length) return null;
  return node.variants.find((variant) => conditionMatches(variant.when, state)) ?? null;
}

export type FlashStoryNodeView = {
  nodeId: string;
  type: FlashStoryV2Node["type"];
  segments: FlashStoryV2Node["segments"];
  choices: FlashStoryV2Node["choices"];
  next: string | null;
  unlockFragment: string | null;
};

export function getStoryNodeView(
  content: FlashStoryContentV2,
  state: FlashStoryRunState,
): FlashStoryNodeView | null {
  const currentId = state.currentNode ?? content.start;
  const node = content.nodes[currentId];
  if (!node) return null;
  const variant = resolveVariant(node, state);
  if (variant) {
    return {
      nodeId: currentId,
      type: node.type,
      segments: variant.segments ?? [],
      choices: variant.choices ?? [],
      next: variant.next !== undefined ? variant.next : node.next ?? null,
      unlockFragment: node.unlockFragment ?? null,
    };
  }
  return {
    nodeId: currentId,
    type: node.type,
    segments: node.segments ?? [],
    choices: node.choices ?? [],
    next: node.next ?? null,
    unlockFragment: node.unlockFragment ?? null,
  };
}

export type FlashStoryChoiceResult = {
  state: FlashStoryRunState;
  view: FlashStoryNodeView;
  finished: boolean;
};

export function answerStoryChoice(input: {
  content: FlashStoryContentV2;
  state: FlashStoryRunState;
  nodeId: string;
  choiceId: string;
}): FlashStoryChoiceResult {
  const { content, state } = input;
  const node = content.nodes[input.nodeId];
  if (!node || node.type !== "choice") {
    throw new Error(`FLASH_V2_NOT_A_CHOICE_NODE: ${input.nodeId}`);
  }
  const variant = resolveVariant(node, state);
  const choices = variant?.choices ?? node.choices ?? [];
  const choice = choices.find((candidate: FlashStoryV2Choice) => candidate.id === input.choiceId);
  if (!choice) {
    throw new Error(`FLASH_V2_UNKNOWN_CHOICE: ${input.nodeId}/${input.choiceId}`);
  }
  let nextState = applyEffect(state, choice.effect);
  const targetNode = content.nodes[choice.next];
  if (!targetNode) {
    throw new Error(`FLASH_V2_BROKEN_NEXT: ${input.nodeId} -> ${choice.next}`);
  }
  nextState = {
    ...nextState,
    currentNode: choice.next,
    nodePath: [...nextState.nodePath, input.nodeId, choice.next],
  };
  const view = getStoryNodeView(content, nextState);
  if (!view) {
    throw new Error(`FLASH_V2_VIEW_FAILED: ${choice.next}`);
  }
  return {
    state: nextState,
    view,
    finished: view.type === "ending" || (view.type === "closure" && !view.next),
  };
}

export function enterStoryEpisode(content: FlashStoryContentV2, state: FlashStoryRunState): FlashStoryRunState {
  if (state.currentNode !== null) return state;
  let next = applyEffect(state, content.state);
  if (next.currentNode === null) {
    next = { ...next, currentNode: content.start, nodePath: [...next.nodePath, content.start] };
  }
  return next;
}

export type FlashStoryAdvanceResult = {
  state: FlashStoryRunState;
  view: FlashStoryNodeView;
  finished: boolean;
};

export function advanceStoryNode(input: {
  content: FlashStoryContentV2;
  state: FlashStoryRunState;
}): FlashStoryAdvanceResult {
  const { content, state } = input;
  const view = getStoryNodeView(content, state);
  if (!view) {
    throw new Error(`FLASH_V2_VIEW_FAILED: ${state.currentNode ?? content.start}`);
  }
  if (view.type === "choice") {
    throw new Error(`FLASH_V2_CHOICE_EXPECTED: ${state.currentNode}`);
  }
  if (!view.next) {
    return {
      state,
      view,
      finished: view.type === "ending" || view.type === "closure",
    };
  }
  const targetNode = content.nodes[view.next];
  if (!targetNode) {
    throw new Error(`FLASH_V2_BROKEN_NEXT: ${state.currentNode} -> ${view.next}`);
  }
  const nextState: FlashStoryRunState = {
    ...state,
    currentNode: view.next,
    nodePath: [...state.nodePath, view.next],
  };
  const nextView = getStoryNodeView(content, nextState);
  if (!nextView) {
    throw new Error(`FLASH_V2_VIEW_FAILED: ${view.next}`);
  }
  return {
    state: nextState,
    view: nextView,
    finished: nextView.type === "ending" || (nextView.type === "closure" && !nextView.next),
  };
}

export function resolveV2Ending(state: FlashStoryRunState): FlashStoryEndingCode {
  if (state.echo >= 60) return "truth_witness";
  if (state.echo >= 40) return "path_changer";
  if (state.echo >= 20) return "bridge_keeper";
  if (state.echo >= 8) return "memory_keeper";
  return "parallel_mixed";
}
