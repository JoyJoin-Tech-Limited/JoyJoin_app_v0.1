// ============ 降级文案 ============

/**
 * 降级模板解释（当API调用失败时使用）
 *
 * W7.3: never ship a horoscope-only explanation. When a concrete shared
 * interest or connection point exists, the body names it — the fallback must
 * stay specific, not just vaguely warm. The chemistry band still selects the
 * tone. (Exported for contract tests.)
 */
export function generateFallbackPairCopy(
  chemistryScore: number,
  sharedInterests: string[] = [],
  connectionPoints: string[] = [],
): { explanation: string; introAngle?: string } {
  const concreteHook = [sharedInterests[0], connectionPoints[0]].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  let explanation: string;
  if (concreteHook) {
    const hook = concreteHook.trim();
    explanation = chemistryScore >= 70
      ? `你们在「${hook}」上有共同话题，性格上也很合拍，应该能聊得很投缘。`
      : `虽然你们风格不同，「${hook}」会是很自然的共同话题，值得聊下去。`;
  } else if (chemistryScore >= 85) {
    explanation = `这两位的性格特质非常互补，预计会擦出精彩的火花！`;
  } else if (chemistryScore >= 70) {
    explanation = `两位都是活力满满的人，相信会有很多话题可以聊。`;
  } else if (chemistryScore >= 55) {
    explanation = `虽然风格不同，但这正是认识新朋友的好机会！`;
  } else {
    explanation = `每一次相遇都是缘分，期待你们发现彼此的独特之处。`;
  }
  const introAngle =
    sharedInterests.length > 0 ? `先从「${sharedInterests[0]}」聊起吧` : undefined;
  return { explanation, introAngle };
}

/**
 * 降级破冰话题
 */
export function getFallbackIceBreakers(eventType: string, commonInterests: string[]): string[] {
  const baseTopics = [
    "最近发现的一家宝藏餐厅是哪家？",
    "如果可以拥有一项超能力，你会选什么？",
    "周末最喜欢的放松方式是什么？",
    "最近在追什么剧或者看什么书？",
    "如果明天开始一段旅行，你最想去哪里？",
  ];
  
  if (eventType === "酒局") {
    baseTopics.unshift("你喜欢什么类型的酒？有什么推荐的吗？");
  }
  
  if (commonInterests.includes("美食")) {
    baseTopics.unshift("最拿手的一道菜是什么？");
  }
  
  if (commonInterests.includes("旅游")) {
    baseTopics.unshift("印象最深的一次旅行经历是什么？");
  }
  
  return baseTopics.slice(0, 5);
}
