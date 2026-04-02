export const STATIC_MATCHING_WEIGHTS = {
  personalityWeight: 23,
  interestsWeight: 24,
  intentWeight: 13,
  backgroundWeight: 15,
  cultureWeight: 10,
  conversationSignatureWeight: 15,
} as const;

export const WEIGHT_DIMENSIONS = [
  {
    key: "personalityWeight",
    label: "人格匹配",
    alphaKey: "personalityAlpha",
    betaKey: "personalityBeta",
    color: "#8b5cf6",
  },
  {
    key: "interestsWeight",
    label: "兴趣匹配",
    alphaKey: "interestsAlpha",
    betaKey: "interestsBeta",
    color: "#3b82f6",
  },
  {
    key: "intentWeight",
    label: "意图匹配",
    alphaKey: "intentAlpha",
    betaKey: "intentBeta",
    color: "#22c55e",
  },
  {
    key: "backgroundWeight",
    label: "背景多样性",
    alphaKey: "backgroundAlpha",
    betaKey: "backgroundBeta",
    color: "#f97316",
  },
  {
    key: "cultureWeight",
    label: "文化语言",
    alphaKey: "cultureAlpha",
    betaKey: "cultureBeta",
    color: "#ec4899",
  },
  {
    key: "conversationSignatureWeight",
    label: "对话签名",
    alphaKey: "conversationSignatureAlpha",
    betaKey: "conversationSignatureBeta",
    color: "#06b6d4",
  },
] as const;

export type MatchingWeightKey = keyof typeof STATIC_MATCHING_WEIGHTS;
export type MatchingWeightsRecord = Record<MatchingWeightKey, number>;
type NumericLike = number | string | null | undefined;
type ConfigLike = Partial<Record<(typeof WEIGHT_DIMENSIONS)[number]["alphaKey"] | (typeof WEIGHT_DIMENSIONS)[number]["betaKey"], NumericLike>> & {
  totalMatches?: NumericLike;
  successfulMatches?: NumericLike;
  updatedAt?: string | null;
};

type HistoryLike = Partial<Record<MatchingWeightKey, NumericLike>> & {
  recordedAt?: string | null;
  changeReason?: string | null;
  matchesSinceLastUpdate?: NumericLike;
};

function parseNumber(value: NumericLike): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function parseWeightPercent(value: NumericLike): number {
  const parsed = parseNumber(value);
  return parsed <= 1 ? parsed * 100 : parsed;
}

export function getCurrentWeights(weights?: Partial<Record<MatchingWeightKey, NumericLike>> | null): MatchingWeightsRecord {
  return WEIGHT_DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension.key] = parseWeightPercent(weights?.[dimension.key]);
    return acc;
  }, {} as MatchingWeightsRecord);
}

export function getRecommendedWeights(config?: ConfigLike | null): MatchingWeightsRecord {
  const rawScores = WEIGHT_DIMENSIONS.map((dimension) => {
    const alpha = Math.max(parseNumber(config?.[dimension.alphaKey]), 1);
    const beta = Math.max(parseNumber(config?.[dimension.betaKey]), 1);
    return {
      key: dimension.key,
      score: alpha / (alpha + beta),
      evidence: Math.max(alpha + beta - 2, 0),
    };
  });

  const totalEvidence = rawScores.reduce((sum, entry) => sum + entry.evidence, 0);
  if (totalEvidence <= 0) {
    return { ...STATIC_MATCHING_WEIGHTS };
  }

  const total = rawScores.reduce((sum, entry) => sum + entry.score, 0) || 1;

  return rawScores.reduce((acc, entry) => {
    acc[entry.key] = Number(((entry.score / total) * 100).toFixed(1));
    return acc;
  }, {} as MatchingWeightsRecord);
}

export function getRecommendationConfidence(config?: ConfigLike | null): number {
  const totalMatches = parseNumber(config?.totalMatches);
  const posteriorEvidence = WEIGHT_DIMENSIONS.reduce((sum, dimension) => {
    const alpha = Math.max(parseNumber(config?.[dimension.alphaKey]), 1);
    const beta = Math.max(parseNumber(config?.[dimension.betaKey]), 1);
    return sum + Math.max(alpha + beta - 2, 0);
  }, 0) / WEIGHT_DIMENSIONS.length;

  const matchSignal = Math.min(totalMatches / 200, 1);
  const posteriorSignal = Math.min(posteriorEvidence / 20, 1);

  return Math.round((matchSignal * 0.7 + posteriorSignal * 0.3) * 100);
}

export function getRecommendationReadiness(config?: ConfigLike | null): {
  label: string;
  tone: "critical" | "warning" | "positive";
  description: string;
} {
  const totalMatches = parseNumber(config?.totalMatches);

  if (totalMatches < 50) {
    return {
      label: "样本不足",
      tone: "critical",
      description: `还需 ${50 - totalMatches} 个反馈样本才能进入首个稳定更新窗口。`,
    };
  }

  if (totalMatches < 150) {
    return {
      label: "观察中",
      tone: "warning",
      description: "已有初步学习信号，建议结合更多反馈再决定是否采纳推荐权重。",
    };
  }

  return {
    label: "可采纳",
    tone: "positive",
    description: "反馈样本已具备参考价值，推荐权重可作为下一轮实验候选。",
  };
}

export function getSuccessfulMatchRate(config?: ConfigLike | null): number {
  const totalMatches = parseNumber(config?.totalMatches);
  if (totalMatches <= 0) {
    return 0;
  }

  return (parseNumber(config?.successfulMatches) / totalMatches) * 100;
}

export function getWeightHistorySeries(history: HistoryLike[] = []) {
  return [...history]
    .sort((left, right) => {
      const leftTime = left.recordedAt ? new Date(left.recordedAt).getTime() : 0;
      const rightTime = right.recordedAt ? new Date(right.recordedAt).getTime() : 0;
      return leftTime - rightTime;
    })
    .map((entry, index) => ({
      id: `${entry.recordedAt ?? "unknown"}-${index}`,
      recordedAt: entry.recordedAt,
      label: formatHistoryLabel(entry.recordedAt, index),
      changeReason: entry.changeReason || "bandit_exploration",
      matchesSinceLastUpdate: parseNumber(entry.matchesSinceLastUpdate),
      ...getCurrentWeights(entry),
    }));
}

function formatHistoryLabel(recordedAt: string | null | undefined, index: number): string {
  if (!recordedAt) {
    return `更新 ${index + 1}`;
  }

  const date = new Date(recordedAt);
  if (Number.isNaN(date.getTime())) {
    return `更新 ${index + 1}`;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}
