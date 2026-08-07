export type FlashStoryMode = "standard" | "personalized";

export function classifyFlashChoiceIntent(input: {
  stored: null | {
    episodeId: string;
    questionId: string;
    optionId: string;
    status: string;
    leaseExpiresAt: Date | null;
    responseSnapshot: string | null;
    renderKind: string | null;
  };
  episodeId: string;
  questionId: string;
  optionId: string;
  now: Date;
}): "claim" | "pending" | "ready" | "conflict" {
  const { stored } = input;
  if (!stored) return "claim";
  if (stored.episodeId !== input.episodeId || stored.questionId !== input.questionId || stored.optionId !== input.optionId) return "conflict";
  if (stored.status === "completed" && stored.responseSnapshot && stored.renderKind) return "ready";
  if (stored.status === "generating" && stored.leaseExpiresAt && stored.leaseExpiresAt > input.now) return "pending";
  return "claim";
}

export const FLASH_UNIVERSE_DIMENSIONS = [
  "trust",
  "attachment",
  "intervention",
  "truth",
] as const;

export type FlashUniverseDimension = (typeof FLASH_UNIVERSE_DIMENSIONS)[number];
export type FlashUniverseVector = Record<FlashUniverseDimension, number>;

export type FlashChoiceEffect = {
  dimension: FlashUniverseDimension;
  delta: number;
  flag?: string;
};

export type FlashStoryEndingCode =
  | "bridge_keeper"
  | "memory_keeper"
  | "path_changer"
  | "truth_witness"
  | "parallel_mixed";

export const EMPTY_FLASH_UNIVERSE_VECTOR: FlashUniverseVector = {
  trust: 0,
  attachment: 0,
  intervention: 0,
  truth: 0,
};

const DEFAULT_EFFECTS_BY_OPTION: Record<string, FlashChoiceEffect[]> = {
  "notice-action": [
    { dimension: "intervention", delta: 2, flag: "noticed_action" },
    { dimension: "trust", delta: 1 },
  ],
  "notice-object": [
    { dimension: "truth", delta: 2, flag: "noticed_evidence" },
    { dimension: "attachment", delta: 1 },
  ],
  "notice-relationship": [
    { dimension: "trust", delta: 2, flag: "noticed_relationship" },
    { dimension: "attachment", delta: 1 },
  ],
};

export function effectsForFlashChoice(
  optionId: string,
  configured?: readonly FlashChoiceEffect[],
): FlashChoiceEffect[] {
  return configured?.length
    ? configured.map((effect) => ({ ...effect }))
    : (DEFAULT_EFFECTS_BY_OPTION[optionId] ?? [
        { dimension: "truth", delta: 1, flag: `choice:${optionId}` },
      ]).map((effect) => ({ ...effect }));
}

export function applyFlashChoiceEffects(
  vector: FlashUniverseVector,
  effects: readonly FlashChoiceEffect[],
): FlashUniverseVector {
  const next = { ...vector };
  for (const effect of effects) {
    if (!FLASH_UNIVERSE_DIMENSIONS.includes(effect.dimension)) continue;
    next[effect.dimension] = Math.max(-30, Math.min(30, next[effect.dimension] + effect.delta));
  }
  return next;
}

export function resolveFlashStoryEnding(
  vector: FlashUniverseVector,
  mixedThreshold = 2,
): FlashStoryEndingCode {
  const ranked = FLASH_UNIVERSE_DIMENSIONS
    .map((dimension) => ({ dimension, score: vector[dimension] }))
    .sort((a, b) => b.score - a.score || a.dimension.localeCompare(b.dimension));
  if (ranked[0].score - ranked[1].score <= mixedThreshold) return "parallel_mixed";
  return {
    trust: "bridge_keeper",
    attachment: "memory_keeper",
    intervention: "path_changer",
    truth: "truth_witness",
  }[ranked[0].dimension] as FlashStoryEndingCode;
}

export const FLASH_STORY_ENDING_COPY: Record<
  FlashStoryEndingCode,
  { title: string; summary: string }
> = {
  bridge_keeper: {
    title: "把故事交回彼此的人",
    summary: "你没有替任何人决定答案，而是让原本错开的声音重新听见了彼此。",
  },
  memory_keeper: {
    title: "替旧物记住名字的人",
    summary: "你选择保留那些尚未准备好告别的痕迹，让它们不必立刻消失。",
  },
  path_changer: {
    title: "让故事继续发生的人",
    summary: "你一次次把观察变成行动，让旧物离开箱子，走向新的去处。",
  },
  truth_witness: {
    title: "把事实拼回原处的人",
    summary: "你追着细节走到最后，让没有名字的旧物重新拥有可以被确认的过去。",
  },
  parallel_mixed: {
    title: "站在平行线之间的人",
    summary: "你没有只走向一种答案。留下、追问、行动与相信，在你的宇宙里同时成立。",
  },
};
