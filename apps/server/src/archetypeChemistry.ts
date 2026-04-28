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

// 化学反应矩阵：每对原型的兼容性评分
export const chemistryMatrix: Record<ArchetypeName, Record<ArchetypeName, number>> = {
  "corgi": {
    "corgi": 70,   // 双柯基能量爆棚，但可能竞争主导
    "rooster": 88,     // 破冰+温暖=完美氛围基础
    "hamster_praise": 90,     // 点火+鼓掌=双向正能量循环
    "fox": 85,     // 破冰+新鲜=惊喜连连
    "dolphin_calm": 82,   // 热情被海豚平衡，节奏舒适
    "spider": 83,     // 破冰后蜘蛛连接深化关系
    "koala": 92,     // 破冰→走心，完美的"热场→深度"
    "octopus": 86,   // 活力+创意=脑洞大开
    "owl": 75, // 能量差适中，柯基带动猫鹰思考
    "elephant": 78,   // 柯基活跃，大象稳定后方
    "turtle": 68,     // 能量差较大，但龟能提供深度
    "cat": 65,     // 能量差过大，可能让cat有压力
  },
  
  "rooster": {
    "corgi": 88,
    "rooster": 75,     // 双太阳温暖但可能缺乏变化
    "hamster_praise": 85,     // 温暖+鼓励=超级正能量场
    "fox": 80,     // 稳定温暖给探索提供安全基地
    "dolphin_calm": 88,   // 温暖+平衡=和谐基调
    "spider": 82,     // 温暖氛围助力蜘蛛织网
    "koala": 87,     // 双重温暖，情感连接深厚
    "octopus": 83,   // 温暖包容章鱼的奇思妙想
    "owl": 72, // 温暖融化猫鹰的严肃
    "elephant": 85,   // 温暖+稳定=超级安全感
    "turtle": 70,     // 温暖鼓励龟开口
    "cat": 68,     // 温暖不施压，给猫舒适空间
  },
  
  "hamster_praise": {
    "corgi": 90,
    "rooster": 85,
    "hamster_praise": 70,     // 双夸夸可能过于热情缺乏深度
    "fox": 82,     // 鼓励探索发现，激励创新
    "dolphin_calm": 80,   // 热情被海豚调节，避免过度
    "spider": 85,     // 鼓励连接者大胆织网
    "koala": 88,     // 鼓励+倾听=完美支持系统
    "octopus": 84,   // 鼓励脑洞，激发更多创意
    "owl": 73, // 鼓励思考者表达见解
    "elephant": 80,   // 鼓励+稳定=安心成长
    "turtle": 69,     // 鼓励低频发言者开口
    "cat": 66,     // 热情可能让cat不适
  },
  
  "fox": {
    "corgi": 85,
    "rooster": 80,
    "hamster_praise": 82,
    "fox": 72,     // 双狐探索欲强但可能分散
    "dolphin_calm": 83,   // 探索被海豚引导，不失焦
    "spider": 90,     // 发现+连接=社交扩张组合
    "koala": 84,     // 新鲜发现+故事讲述=精彩
    "octopus": 92,   // 新奇体验+创意脑洞=探索绝配
    "owl": 78, // 好奇心+深度思考=知识碰撞
    "elephant": 75,   // 探索有稳定后盾，安心冒险
    "turtle": 72,     // 探索+洞察=发现新视角
    "cat": 60,     // 探索欲vs社恐，节奏不匹配
  },
  
  "dolphin_calm": {
    "corgi": 82,
    "rooster": 88,
    "hamster_praise": 80,
    "fox": 83,
    "dolphin_calm": 75,   // 双海豚平衡但可能缺乏驱动力
    "spider": 88,     // 调节+连接=社交协调大师
    "koala": 85,     // 平衡+倾听=情感智慧组合
    "octopus": 81,   // 平衡章鱼的发散思维
    "owl": 80, // 调节思考节奏，避免过于严肃
    "elephant": 90,   // 调频+定心=团队压舱石
    "turtle": 77,     // 平衡低频高质的节奏
    "cat": 73,     // 不施压的陪伴，舒适共处
  },
  
  "spider": {
    "corgi": 83,
    "rooster": 82,
    "hamster_praise": 85,
    "fox": 90,
    "dolphin_calm": 88,
    "spider": 78,     // 双蜘蛛连接但可能过于networking
    "koala": 86,     // 连接+情感=深度关系建立
    "octopus": 87,   // 连接+创意=网络节点创新
    "owl": 82, // 连接思想者，促进深度交流
    "elephant": 84,   // 连接+稳定=可靠社交网络
    "turtle": 76,     // 连接低调观察者，引出洞察
    "cat": 71,     // 轻度连接，不强求社恐参与
  },
  
  "koala": {
    "corgi": 92,
    "rooster": 87,
    "hamster_praise": 88,
    "fox": 84,
    "dolphin_calm": 85,
    "spider": 86,
    "koala": 80,     // 双熊温暖但可能缺乏方向
    "octopus": 82,   // 倾听+创意=脑洞被理解
    "owl": 88, // 情感共鸣+深度思考=心灵对话
    "elephant": 87,   // 倾听+稳定=超级支持系统
    "turtle": 85,     // 倾听鼓励龟分享洞察
    "cat": 79,     // 温暖倾听，给猫安全空间
  },
  
  "octopus": {
    "corgi": 86,
    "rooster": 83,
    "hamster_praise": 84,
    "fox": 92,
    "dolphin_calm": 81,
    "spider": 87,
    "koala": 82,
    "octopus": 73,   // 双章鱼创意但可能过于发散
    "owl": 84, // 创意+思考=哲学脑暴
    "elephant": 78,   // 创意有稳定框架，落地性强
    "turtle": 80,     // 创意+洞察=深度创新
    "cat": 68,     // 章鱼多线程可能让猫疲惫
  },
  
  "owl": {
    "corgi": 75,
    "rooster": 72,
    "hamster_praise": 73,
    "fox": 78,
    "dolphin_calm": 80,
    "spider": 82,
    "koala": 88,
    "octopus": 84,
    "owl": 77, // 双猫鹰深度但可能过于严肃
    "elephant": 85,   // 思考+稳定=哲学安全基地
    "turtle": 92,     // 深度思考双人组，哲学对话巅峰
    "cat": 82,     // 低压深度对话，社恐友好
  },
  
  "elephant": {
    "corgi": 78,
    "rooster": 85,
    "hamster_praise": 80,
    "fox": 75,
    "dolphin_calm": 90,
    "spider": 84,
    "koala": 87,
    "octopus": 78,
    "owl": 85,
    "elephant": 80,   // 双象稳定但可能缺乏活力
    "turtle": 88,     // 稳定+洞察=可靠智慧
    "cat": 85,     // 稳定后盾，给猫绝对安全感
  },
  
  "turtle": {
    "corgi": 68,
    "rooster": 70,
    "hamster_praise": 69,
    "fox": 72,
    "dolphin_calm": 77,
    "spider": 76,
    "koala": 85,
    "octopus": 80,
    "owl": 92,
    "elephant": 88,
    "turtle": 75,     // 双龟深度但可能过于安静
    "cat": 90,     // 低频高质+安静陪伴=社恐天堂
  },
  
  "cat": {
    "corgi": 65,
    "rooster": 68,
    "hamster_praise": 66,
    "fox": 60,
    "dolphin_calm": 73,
    "spider": 71,
    "koala": 79,
    "octopus": 68,
    "owl": 82,
    "elephant": 85,
    "turtle": 90,
    "cat": 70,     // 双猫安静但可能缺乏互动
  },
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
export function getChemistryScore(archetype1: ArchetypeName, archetype2: ArchetypeName): number {
  return chemistryMatrix[archetype1]?.[archetype2] ?? 50; // 默认中等兼容
}

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
