export interface MatchPreviewCopy {
  title: string;
  subtitle: string;
  emoji: string;
}

/**
 * Generate goal-specific preview copy for the event registration flow.
 * Called after user selects social goals, before final confirmation.
 */
export function getMatchPreviewCopy(selectedGoals: string[]): MatchPreviewCopy {
  // Priority order: check most specific combinations first, then individual goals

  // Compound: networking + friends
  if (selectedGoals.includes("networking") && selectedGoals.includes("friends")) {
    return {
      title: "人脉+朋友双管齐下",
      subtitle: "小悦会帮你找到既能聊业务、又能处朋友的人",
      emoji: "🤝",
    };
  }

  // Compound: romance + friends
  if (selectedGoals.includes("romance") && selectedGoals.includes("friends")) {
    return {
      title: "缘分和友情都不放过",
      subtitle: "先当朋友再看缘分，小悦懂这个节奏",
      emoji: "💫",
    };
  }

  // Individual goals
  if (selectedGoals.includes("networking") && selectedGoals.length === 1) {
    return {
      title: "人脉拓展局",
      subtitle: "已有不少同样想拓展圈子的职场人报名",
      emoji: "💼",
    };
  }

  if (selectedGoals.includes("romance") && selectedGoals.length === 1) {
    return {
      title: "缘分在路上",
      subtitle: "小悦会特别注意性格互补的配对 💕",
      emoji: "💕",
    };
  }

  if (selectedGoals.includes("friends") && selectedGoals.length === 1) {
    return {
      title: "找到你的同频好友",
      subtitle: "兴趣相投的人已经在等你了",
      emoji: "🎉",
    };
  }

  if (selectedGoals.includes("discussion") && selectedGoals.length === 1) {
    return {
      title: "思维碰撞的一晚",
      subtitle: "小悦会帮你找到有料、有趣、有深度的同桌",
      emoji: "💭",
    };
  }

  if (selectedGoals.includes("flexible")) {
    return {
      title: "惊喜配桌模式",
      subtitle: "什么人都想认识？小悦正在研究最有化学反应的组合……",
      emoji: "✨",
    };
  }

  if (selectedGoals.includes("fun")) {
    return {
      title: "今晚就是来嗨的",
      subtitle: "小悦会把最会玩的人凑到一桌",
      emoji: "🎊",
    };
  }

  // Default fallback
  return {
    title: "小悦已收到你的偏好",
    subtitle: "正在为你寻找最合适的同桌……",
    emoji: "🎯",
  };
}
