import type {
  FlashStoryEndingCode,
} from "@joyjoin/shared/alang/parallelUniverse";
import type {
  FlashStoryContentV2,
  FlashStoryRunState,
  FlashStoryV2Choice,
  FlashStoryV2Effect,
  FlashStoryV2Interaction,
  FlashStoryV2Node,
  FlashStoryV2Variant,
} from "@shared/schema";

export function scopeV2TraversalToEpisode(
  state: FlashStoryRunState & { episodeId?: string | null },
  episodeId: string,
): FlashStoryRunState {
  if (state.episodeId === episodeId) {
    return {
      echo: state.echo,
      flags: state.flags,
      variables: state.variables,
      currentNode: state.currentNode,
      nodePath: state.nodePath,
      lastChoiceId: state.lastChoiceId,
    };
  }
  return {
    echo: state.echo,
    flags: state.flags,
    variables: state.variables,
    currentNode: null,
    nodePath: [],
    lastChoiceId: null,
  };
}

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
    lastChoiceId: null,
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
    lastChoiceId: state.lastChoiceId,
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
  /** 动作配置仅在 type === "interaction" 时出现（E123 质量门保证）。 */
  interaction: FlashStoryV2Interaction | null;
};

export function getStoryNodeView(
  content: FlashStoryContentV2,
  state: FlashStoryRunState,
): FlashStoryNodeView | null {
  const currentId = state.currentNode ?? content.start;
  const node = content.nodes[currentId];
  if (!node) return null;
  const interaction = node.type === "interaction" ? node.interaction ?? null : null;
  const variant = resolveVariant(node, state);
  if (variant) {
    return {
      nodeId: currentId,
      type: node.type,
      segments: variant.segments ?? [],
      choices: variant.choices ?? [],
      next: variant.next !== undefined ? variant.next : node.next ?? null,
      unlockFragment: node.unlockFragment ?? null,
      interaction,
    };
  }
  return {
    nodeId: currentId,
    type: node.type,
    segments: node.segments ?? [],
    choices: node.choices ?? [],
    next: node.next ?? null,
    unlockFragment: node.unlockFragment ?? null,
    interaction,
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
    lastChoiceId: choice.id,
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

export type FlashStoryInteractionResult = {
  state: FlashStoryRunState;
  view: FlashStoryNodeView;
  finished: boolean;
};

function finishInteractionTransition(
  content: FlashStoryContentV2,
  state: FlashStoryRunState,
  nodeId: string,
  resultId: string,
  nextNodeId: string,
): FlashStoryInteractionResult {
  const targetNode = content.nodes[nextNodeId];
  if (!targetNode) {
    throw new Error(`FLASH_V2_BROKEN_NEXT: ${nodeId} -> ${nextNodeId}`);
  }
  const nextState: FlashStoryRunState = {
    ...state,
    currentNode: nextNodeId,
    nodePath: [...state.nodePath, nodeId, nextNodeId],
    lastChoiceId: resultId,
  };
  const view = getStoryNodeView(content, nextState);
  if (!view) {
    throw new Error(`FLASH_V2_VIEW_FAILED: ${nextNodeId}`);
  }
  return {
    state: nextState,
    view,
    finished: view.type === "ending" || (view.type === "closure" && !view.next),
  };
}

function requireInteractionNode(
  content: FlashStoryContentV2,
  nodeId: string,
): FlashStoryV2Interaction {
  const node = content.nodes[nodeId];
  if (!node || node.type !== "interaction" || !node.interaction) {
    throw new Error(`FLASH_V2_NOT_AN_INTERACTION_NODE: ${nodeId}`);
  }
  return node.interaction;
}

/**
 * 叙事动作层：提交 interaction 节点的有效结果。应用该结果的 effect 并推进到
 * 其专属回响节点（result.next），与 answerStoryChoice 的状态语义一致。
 */
export function submitStoryInteractionResult(input: {
  content: FlashStoryContentV2;
  state: FlashStoryRunState;
  nodeId: string;
  resultId: string;
}): FlashStoryInteractionResult {
  const { content, state } = input;
  const interaction = requireInteractionNode(content, input.nodeId);
  const result = interaction.results.find((candidate) => candidate.id === input.resultId);
  if (!result) {
    throw new Error(`FLASH_V2_UNKNOWN_RESULT: ${input.nodeId}/${input.resultId}`);
  }
  const nextState = applyEffect(state, result.effect);
  return finishInteractionTransition(content, nextState, input.nodeId, result.id, result.next);
}

/**
 * flag-off 降级（AC-07）：应用审核过的 defaultResultId 结果的 effect，
 * 推进到审核过的非动作叙事节点 fallbackNext。不读取任何客户端手势状态。
 */
export function resolveInteractionFallback(input: {
  content: FlashStoryContentV2;
  state: FlashStoryRunState;
  nodeId: string;
}): FlashStoryInteractionResult {
  const { content, state } = input;
  const interaction = requireInteractionNode(content, input.nodeId);
  const result = interaction.results.find((candidate) => candidate.id === interaction.defaultResultId);
  if (!result) {
    throw new Error(`FLASH_V2_UNKNOWN_RESULT: ${input.nodeId}/${interaction.defaultResultId}`);
  }
  const nextState = applyEffect(state, result.effect);
  return finishInteractionTransition(content, nextState, input.nodeId, result.id, interaction.fallbackNext);
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
  if (view.type === "interaction") {
    throw new Error(`FLASH_V2_INTERACTION_EXPECTED: ${state.currentNode}`);
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

export const FLASH_V2_ENDING_TIERS: ReadonlyArray<{
  code: FlashStoryEndingCode;
  threshold: number;
}> = [
  { code: "truth_witness", threshold: 60 },
  { code: "path_changer", threshold: 40 },
  { code: "bridge_keeper", threshold: 20 },
  { code: "memory_keeper", threshold: 8 },
  { code: "parallel_mixed", threshold: 0 },
];

export function resolveV2Ending(state: FlashStoryRunState): FlashStoryEndingCode {
  for (const { code, threshold } of FLASH_V2_ENDING_TIERS) {
    if (state.echo >= threshold) return code;
  }
  return "parallel_mixed";
}

const ECHO_PER_DEEP_CHOICE = 10;

export type FlashV2EndingGallery = Array<{
  code: FlashStoryEndingCode;
  reached: boolean;
  echoGap: number;
  approxChoices: number;
}>;

export function buildV2EndingGallery(currentEnding: FlashStoryEndingCode, echo: number): FlashV2EndingGallery {
  return FLASH_V2_ENDING_TIERS.map(({ code, threshold }) => ({
    code,
    reached: code === currentEnding,
    echoGap: Math.max(0, threshold - echo),
    approxChoices: Math.max(0, Math.ceil((threshold - echo) / ECHO_PER_DEEP_CHOICE)),
  }));
}

export function resolveV2EchoTier(echo: number): "彻" | "深" | "轻" {
  if (echo >= 40) return "彻";
  if (echo >= 15) return "深";
  return "轻";
}
