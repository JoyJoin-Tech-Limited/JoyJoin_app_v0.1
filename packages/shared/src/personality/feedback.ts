/**
 * V4 Adaptive Assessment - Xiaoyue Feedback System
 * 小悦反馈系统 - 平衡性反馈
 */

import { TraitKey } from './types';

export interface OptionFeedback {
  text: string;
  traitHints: TraitKey[];
}

export interface QuestionFeedbackConfig {
  questionId: string;
  options: Record<string, OptionFeedback>;
}

export const xiaoyueFeedback: Record<string, Record<string, string>> = {
  "Q1": {
    "A": "欣然加入！你很享受和别人互动的感觉呢~",
    "B": "先评估再决定，做事很有章法！",
    "C": "友好但有边界，你很懂得照顾自己的节奏~",
    "D": "需要先恢复能量，这很正常！"
  },
  "Q2": {
    "A": "开放包容！你适应力很强~",
    "B": "做功课派！靠谱的人就是你~",
    "C": "探索欲旺盛，喜欢尝鲜！",
    "D": "清楚自己想要什么，很好~"
  },
  "Q3": {
    "A": "社交充电型！热闹让你快乐~",
    "B": "有自己的节奏，这很重要！",
    "C": "两全其美的智慧~",
    "D": "需要消化冲突是正常的~"
  },
  "Q5": {
    "A": "自带领导气场！C位就是你的~",
    "B": "关心他人，你是温暖的存在~",
    "C": "配合度高，让团队很顺畅~",
    "D": "舒适最重要，不勉强自己~"
  },
  "Q9": {
    "A": "勇气可嘉！享受舞台的感觉~",
    "B": "有伴更安心，这很人之常情~",
    "C": "保护好自己的舒适区~",
    "D": "气氛组也是重要贡献！"
  },
  "Q12": {
    "A": "直觉派！效率第一~",
    "B": "善于借力，聪明的做法~",
    "C": "做足功课，不会踩雷~",
    "D": "省心省力，也是一种智慧~"
  },
  "Q13": {
    "A": "用心了解对方，你很贴心~",
    "B": "有个人风格，独特的你~",
    "C": "稳妥实用，不会出错~",
    "D": "投入心意创造独特，浪漫~"
  }
};

export interface PrototypeHint {
  leadingTraits: TraitKey[];
  hint: string;
  emoji: string;
}

export const prototypeHints: Record<string, PrototypeHint> = {
  "high_X_high_P": {
    leadingTraits: ["X", "P"],
    hint: "感觉你是个很会带动气氛的人呢！",
    emoji: "🎉"
  },
  "high_A_high_E": {
    leadingTraits: ["A", "E"],
    hint: "你给人很温暖稳定的感觉~",
    emoji: "🤗"
  },
  "high_O_high_C": {
    leadingTraits: ["O", "C"],
    hint: "既有创意又有条理，很厉害！",
    emoji: "💡"
  },
  "high_E_low_X": {
    leadingTraits: ["E"],
    hint: "你很沉稳，喜欢自己的节奏~",
    emoji: "🧘"
  },
  "high_A_high_P": {
    leadingTraits: ["A", "P"],
    hint: "你是个很暖心的开心果！",
    emoji: "☀️"
  },
  "high_C_high_E": {
    leadingTraits: ["C", "E"],
    hint: "靠谱又稳重，值得信赖！",
    emoji: "🐘"
  },
  "high_O_low_X": {
    leadingTraits: ["O"],
    hint: "内心世界很丰富呢~",
    emoji: "🌌"
  }
};

export interface MilestoneConfig {
  position: number;
  message: string;
  xiaoyueMood: 'thinking' | 'excited' | 'encouraging' | 'curious';
  animation?: string;
}

export const milestoneConfigs: MilestoneConfig[] = [
  {
    position: 6,
    message: "已经对你有初步印象啦~注册后继续完成测评，解锁完整结果！",
    xiaoyueMood: 'curious',
    animation: 'bounce'
  },
  {
    position: 10,
    message: "越来越了解你了！继续加油~",
    xiaoyueMood: 'encouraging',
    animation: 'pulse'
  },
  {
    position: 15,
    message: "快完成了！最后几题帮我确认一下你的社交风格~",
    xiaoyueMood: 'excited',
    animation: 'wiggle'
  }
];

export function getOptionFeedback(questionId: string, optionValue: string): string | undefined {
  return xiaoyueFeedback[questionId]?.[optionValue];
}

export function getMilestoneMessage(questionNumber: number): MilestoneConfig | undefined {
  return milestoneConfigs.find(m => m.position === questionNumber);
}

export function getPrototypeHint(traits: Record<TraitKey, number>): PrototypeHint | undefined {
  const entries = Object.entries(traits) as [TraitKey, number][];
  entries.sort((a, b) => b[1] - a[1]);
  
  const topTraits = entries.slice(0, 2).map(([trait]) => trait);
  const lowTraits = entries.slice(-2).map(([trait]) => trait);
  
  if (topTraits.includes('X') && topTraits.includes('P')) {
    return prototypeHints['high_X_high_P'];
  }
  if (topTraits.includes('A') && topTraits.includes('E')) {
    return prototypeHints['high_A_high_E'];
  }
  if (topTraits.includes('O') && topTraits.includes('C')) {
    return prototypeHints['high_O_high_C'];
  }
  if (topTraits.includes('A') && topTraits.includes('P')) {
    return prototypeHints['high_A_high_P'];
  }
  if (topTraits.includes('C') && topTraits.includes('E')) {
    return prototypeHints['high_C_high_E'];
  }
  if (topTraits.includes('E') && lowTraits.includes('X')) {
    return prototypeHints['high_E_low_X'];
  }
  if (topTraits.includes('O') && lowTraits.includes('X')) {
    return prototypeHints['high_O_low_X'];
  }
  
  return undefined;
}
