/**
 * 12种社交氛围原型化学反应矩阵
 * 定义每对原型之间的兼容性评分 (0-100)
 * 
 * 评分标准：
 * 90-100: 完美互补，火花四溅
 * 75-89: 高度兼容，互相激发
 * 60-74: 良好互动，稳定愉快
 * 45-59: 中等兼容，需要磨合
 * 30-44: 较低兼容，可能冲突
 * 0-29: 不建议配对，高冲突风险
 */

import type { ArchetypeName } from "./archetypeConfig";
export { ArchetypeName };
import { compatibilityMatrix as chemistryMatrix, getChemistryScore } from '@shared/personality/archetypeCompatibility';
export { chemistryMatrix, getChemistryScore };

// 社交能量值映射 (0-100)
export const ARCHETYPE_ENERGY: Record<ArchetypeName, number> = {
  "corgi": 95,    // 摇尾点火官 - 团队永动机
  "rooster": 90,      // 咯咯小太阳 - 人间小暖气
  "hamster_praise": 85,      // 掌声发动机 - 首席鼓掌官
  "fox": 82,      // 巷口密探 - 城市探险家
  "dolphin_calm": 75,    // 气氛冲浪手 - 气氛调频手
  "spider": 72,      // 关系织网师 - 社交黏合剂
  "koala": 70,      // 怀抱故事熊 - 故事收藏家
  "octopus": 68,    // 脑洞喷墨章 - 创意喷射器
  "owl": 55,  // 推镜思考官 - 哲学带师
  "elephant": 52,    // 象鼻定心锚 - 团队定盘星
  "turtle": 38,      // 慢语真知龟 - 人间观察家
  "cat": 30,      // 安静伴伴猫 - 安静陪伴者
};



/**
 * 原型核心特质描述
 */
export const ARCHETYPE_DESCRIPTIONS: Record<ArchetypeName, {
  nickname: string;
  emoji: string;
  coreContribution: string;
  keyTraits: string[];
}> = {
  "corgi": {
    nickname: "摇尾点火官",
    emoji: "🐶",
    coreContribution: "破冰启动，创造欢乐氛围",
    keyTraits: ["能量充沛", "幽默感强", "善于调动气氛"],
  },
  "rooster": {
    nickname: "咯咯小太阳",
    emoji: "🐔",
    coreContribution: "散发温暖能量，提升整体幸福感",
    keyTraits: ["乐观开朗", "感染力强", "情绪稳定"],
  },
  "hamster_praise": {
    nickname: "掌声发动机",
    emoji: "🐹",
    coreContribution: "提供积极反馈，增强团队信心",
    keyTraits: ["鼓励性强", "反应热情", "正能量满满"],
  },
  "fox": {
    nickname: "巷口密探",
    emoji: "🦊",
    coreContribution: "引入新鲜体验，拓展活动边界",
    keyTraits: ["好奇心强", "信息灵通", "勇于尝试"],
  },
  "dolphin_calm": {
    nickname: "气氛冲浪手",
    emoji: "🐬",
    coreContribution: "平衡群体氛围，化解潜在冲突",
    keyTraits: ["情商高", "应变力强", "包容性好"],
  },
  "spider": {
    nickname: "关系织网师",
    emoji: "🕷️",
    coreContribution: "连接不同人群，构建社交网络",
    keyTraits: ["观察敏锐", "善于发现共同点", "人脉广泛"],
  },
  "koala": {
    nickname: "怀抱故事熊",
    emoji: "🐨",
    coreContribution: "建立情感连接，营造深度交流",
    keyTraits: ["善于倾听", "共情力强", "故事力丰富"],
  },
  "octopus": {
    nickname: "脑洞喷墨章",
    emoji: "🐙",
    coreContribution: "多线程发散思维，激发集体脑暴",
    keyTraits: ["思维跳跃", "联想丰富", "创意无穷"],
  },
  "owl": {
    nickname: "推镜思考官",
    emoji: "🦉",
    coreContribution: "提升对话质量，激发深度思考",
    keyTraits: ["逻辑性强", "善于提问", "追求真理"],
  },
  "elephant": {
    nickname: "象鼻定心锚",
    emoji: "🐘",
    coreContribution: "提供稳定支持，奠定安心基调",
    keyTraits: ["稳重可靠", "包容豁达", "给人安全感"],
  },
  "turtle": {
    nickname: "慢语真知龟",
    emoji: "🐢",
    coreContribution: "提供深度洞察，贡献独到见解",
    keyTraits: ["思考深入", "言简意赅", "洞察力强"],
  },
  "cat": {
    nickname: "安静伴伴猫",
    emoji: "🐱",
    coreContribution: "提供安静陪伴，营造轻松氛围",
    keyTraits: ["存在感低", "不施加压力", "享受旁观"],
  },
};

export const ARCHETYPE_NAMES = Object.keys(chemistryMatrix) as ArchetypeName[];

export function isArchetypeName(value: string | null | undefined): value is ArchetypeName {
  return Boolean(value && value in chemistryMatrix);
}

export function normalizeArchetypePair(
  archetype1: ArchetypeName,
  archetype2: ArchetypeName,
): [ArchetypeName, ArchetypeName] {
  return archetype1 <= archetype2
    ? [archetype1, archetype2]
    : [archetype2, archetype1];
}

export function getAllArchetypePairs(): Array<{
  archetypeA: ArchetypeName;
  archetypeB: ArchetypeName;
  baseScore: number;
}> {
  const pairs: Array<{
    archetypeA: ArchetypeName;
    archetypeB: ArchetypeName;
    baseScore: number;
  }> = [];

  for (let i = 0; i < ARCHETYPE_NAMES.length; i++) {
    for (let j = i; j < ARCHETYPE_NAMES.length; j++) {
      const archetypeA = ARCHETYPE_NAMES[i];
      const archetypeB = ARCHETYPE_NAMES[j];
      pairs.push({
        archetypeA,
        archetypeB,
        baseScore: getChemistryScore(archetypeA, archetypeB),
      });
    }
  }

  return pairs;
}

/**
 * 获取两个原型之间的化学反应分数
 */
/**

 * 获取化学反应等级描述
 */
export function getChemistryLevel(score: number): {
  level: string;
  description: string;
  color: string;
} {
  if (score >= 90) {
    return {
      level: "完美互补",
      description: "火花四溅，思维碰撞激烈",
      color: "text-purple-600 dark:text-purple-400"
    };
  } else if (score >= 75) {
    return {
      level: "高度兼容",
      description: "互相激发，对话流畅",
      color: "text-green-600 dark:text-green-400"
    };
  } else if (score >= 60) {
    return {
      level: "良好互动",
      description: "稳定愉快，氛围和谐",
      color: "text-blue-600 dark:text-blue-400"
    };
  } else if (score >= 45) {
    return {
      level: "中等兼容",
      description: "需要磨合，可能有小摩擦",
      color: "text-yellow-600 dark:text-yellow-400"
    };
  } else if (score >= 30) {
    return {
      level: "较低兼容",
      description: "容易冲突，需要协调者",
      color: "text-orange-600 dark:text-orange-400"
    };
  } else {
    return {
      level: "不建议配对",
      description: "高冲突风险，慎重考虑",
      color: "text-red-600 dark:text-red-400"
    };
  }
}

/**
 * 计算一组用户的平均化学反应分数
 */
export function calculateGroupChemistry(archetypes: ArchetypeName[]): number {
  if (archetypes.length < 2) return 0;
  
  let totalScore = 0;
  let pairCount = 0;
  
  for (let i = 0; i < archetypes.length; i++) {
    for (let j = i + 1; j < archetypes.length; j++) {
      totalScore += getChemistryScore(archetypes[i], archetypes[j]);
      pairCount++;
    }
  }
  
  return pairCount > 0 ? Math.round(totalScore / pairCount) : 0;
}

/**
 * 推荐最佳配对原型
 */
export function getBestMatchArchetypes(archetype: ArchetypeName, count: number = 3): ArchetypeName[] {
  const scores = Object.entries(chemistryMatrix[archetype])
    .filter(([other]) => other !== archetype)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .slice(0, count)
    .map(([name]) => name as ArchetypeName);
  
  return scores;
}

/**
 * 推荐应避免的配对原型
 */
export function getWorstMatchArchetypes(archetype: ArchetypeName, count: number = 3): ArchetypeName[] {
  const scores = Object.entries(chemistryMatrix[archetype])
    .filter(([other]) => other !== archetype)
    .sort(([, scoreA], [, scoreB]) => scoreA - scoreB)
    .slice(0, count)
    .map(([name]) => name as ArchetypeName);
  
  return scores;
}
