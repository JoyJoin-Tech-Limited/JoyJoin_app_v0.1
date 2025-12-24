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

export type ArchetypeName = 
  | "开心柯基" | "太阳鸡" | "夸夸豚" | "机智狐"     // 高能量区
  | "淡定海豚" | "织网蛛" | "暖心熊" | "灵感章鱼"   // 中能量区
  | "沉思猫头鹰" | "定心大象"                     // 低能量区
  | "稳如龟" | "隐身猫";                         // 超低能量区

// 社交能量值映射 (0-100)
export const ARCHETYPE_ENERGY: Record<ArchetypeName, number> = {
  "开心柯基": 95,    // 摇尾点火官 - 团队永动机
  "太阳鸡": 90,      // 咯咯小太阳 - 人间小暖气
  "夸夸豚": 85,      // 掌声发动机 - 首席鼓掌官
  "机智狐": 82,      // 巷口密探 - 城市探险家
  "淡定海豚": 75,    // 气氛冲浪手 - 气氛调频手
  "织网蛛": 72,      // 关系织网师 - 社交黏合剂
  "暖心熊": 70,      // 怀抱故事熊 - 故事收藏家
  "灵感章鱼": 68,    // 脑洞喷墨章 - 创意喷射器
  "沉思猫头鹰": 55,  // 推镜思考官 - 哲学带师
  "定心大象": 52,    // 象鼻定心锚 - 团队定盘星
  "稳如龟": 38,      // 慢语真知龟 - 人间观察家
  "隐身猫": 30,      // 安静伴伴猫 - 安静陪伴者
};

// 化学反应矩阵：每对原型的兼容性评分
export const chemistryMatrix: Record<ArchetypeName, Record<ArchetypeName, number>> = {
  "开心柯基": {
    "开心柯基": 70,   // 双柯基能量爆棚，但可能竞争主导
    "太阳鸡": 88,     // 破冰+温暖=完美氛围基础
    "夸夸豚": 90,     // 点火+鼓掌=双向正能量循环
    "机智狐": 85,     // 破冰+新鲜=惊喜连连
    "淡定海豚": 82,   // 热情被海豚平衡，节奏舒适
    "织网蛛": 83,     // 破冰后蜘蛛连接深化关系
    "暖心熊": 92,     // 破冰→走心，完美的"热场→深度"
    "灵感章鱼": 86,   // 活力+创意=脑洞大开
    "沉思猫头鹰": 75, // 能量差适中，柯基带动猫鹰思考
    "定心大象": 78,   // 柯基活跃，大象稳定后方
    "稳如龟": 68,     // 能量差较大，但龟能提供深度
    "隐身猫": 65,     // 能量差过大，可能让隐身猫有压力
  },
  
  "太阳鸡": {
    "开心柯基": 88,
    "太阳鸡": 75,     // 双太阳温暖但可能缺乏变化
    "夸夸豚": 85,     // 温暖+鼓励=超级正能量场
    "机智狐": 80,     // 稳定温暖给探索提供安全基地
    "淡定海豚": 88,   // 温暖+平衡=和谐基调
    "织网蛛": 82,     // 温暖氛围助力蜘蛛织网
    "暖心熊": 87,     // 双重温暖，情感连接深厚
    "灵感章鱼": 83,   // 温暖包容章鱼的奇思妙想
    "沉思猫头鹰": 72, // 温暖融化猫鹰的严肃
    "定心大象": 85,   // 温暖+稳定=超级安全感
    "稳如龟": 70,     // 温暖鼓励龟开口
    "隐身猫": 68,     // 温暖不施压，给猫舒适空间
  },
  
  "夸夸豚": {
    "开心柯基": 90,
    "太阳鸡": 85,
    "夸夸豚": 70,     // 双夸夸可能过于热情缺乏深度
    "机智狐": 82,     // 鼓励探索发现，激励创新
    "淡定海豚": 80,   // 热情被海豚调节，避免过度
    "织网蛛": 85,     // 鼓励连接者大胆织网
    "暖心熊": 88,     // 鼓励+倾听=完美支持系统
    "灵感章鱼": 84,   // 鼓励脑洞，激发更多创意
    "沉思猫头鹰": 73, // 鼓励思考者表达见解
    "定心大象": 80,   // 鼓励+稳定=安心成长
    "稳如龟": 69,     // 鼓励低频发言者开口
    "隐身猫": 66,     // 热情可能让隐身猫不适
  },
  
  "机智狐": {
    "开心柯基": 85,
    "太阳鸡": 80,
    "夸夸豚": 82,
    "机智狐": 72,     // 双狐探索欲强但可能分散
    "淡定海豚": 83,   // 探索被海豚引导，不失焦
    "织网蛛": 90,     // 发现+连接=社交扩张组合
    "暖心熊": 84,     // 新鲜发现+故事讲述=精彩
    "灵感章鱼": 92,   // 新奇体验+创意脑洞=探索绝配
    "沉思猫头鹰": 78, // 好奇心+深度思考=知识碰撞
    "定心大象": 75,   // 探索有稳定后盾，安心冒险
    "稳如龟": 72,     // 探索+洞察=发现新视角
    "隐身猫": 60,     // 探索欲vs社恐，节奏不匹配
  },
  
  "淡定海豚": {
    "开心柯基": 82,
    "太阳鸡": 88,
    "夸夸豚": 80,
    "机智狐": 83,
    "淡定海豚": 75,   // 双海豚平衡但可能缺乏驱动力
    "织网蛛": 88,     // 调节+连接=社交协调大师
    "暖心熊": 85,     // 平衡+倾听=情感智慧组合
    "灵感章鱼": 81,   // 平衡章鱼的发散思维
    "沉思猫头鹰": 80, // 调节思考节奏，避免过于严肃
    "定心大象": 90,   // 调频+定心=团队压舱石
    "稳如龟": 77,     // 平衡低频高质的节奏
    "隐身猫": 73,     // 不施压的陪伴，舒适共处
  },
  
  "织网蛛": {
    "开心柯基": 83,
    "太阳鸡": 82,
    "夸夸豚": 85,
    "机智狐": 90,
    "淡定海豚": 88,
    "织网蛛": 78,     // 双蜘蛛连接但可能过于networking
    "暖心熊": 86,     // 连接+情感=深度关系建立
    "灵感章鱼": 87,   // 连接+创意=网络节点创新
    "沉思猫头鹰": 82, // 连接思想者，促进深度交流
    "定心大象": 84,   // 连接+稳定=可靠社交网络
    "稳如龟": 76,     // 连接低调观察者，引出洞察
    "隐身猫": 71,     // 轻度连接，不强求社恐参与
  },
  
  "暖心熊": {
    "开心柯基": 92,
    "太阳鸡": 87,
    "夸夸豚": 88,
    "机智狐": 84,
    "淡定海豚": 85,
    "织网蛛": 86,
    "暖心熊": 80,     // 双熊温暖但可能缺乏方向
    "灵感章鱼": 82,   // 倾听+创意=脑洞被理解
    "沉思猫头鹰": 88, // 情感共鸣+深度思考=心灵对话
    "定心大象": 87,   // 倾听+稳定=超级支持系统
    "稳如龟": 85,     // 倾听鼓励龟分享洞察
    "隐身猫": 79,     // 温暖倾听，给猫安全空间
  },
  
  "灵感章鱼": {
    "开心柯基": 86,
    "太阳鸡": 83,
    "夸夸豚": 84,
    "机智狐": 92,
    "淡定海豚": 81,
    "织网蛛": 87,
    "暖心熊": 82,
    "灵感章鱼": 73,   // 双章鱼创意但可能过于发散
    "沉思猫头鹰": 84, // 创意+思考=哲学脑暴
    "定心大象": 78,   // 创意有稳定框架，落地性强
    "稳如龟": 80,     // 创意+洞察=深度创新
    "隐身猫": 68,     // 章鱼多线程可能让猫疲惫
  },
  
  "沉思猫头鹰": {
    "开心柯基": 75,
    "太阳鸡": 72,
    "夸夸豚": 73,
    "机智狐": 78,
    "淡定海豚": 80,
    "织网蛛": 82,
    "暖心熊": 88,
    "灵感章鱼": 84,
    "沉思猫头鹰": 77, // 双猫鹰深度但可能过于严肃
    "定心大象": 85,   // 思考+稳定=哲学安全基地
    "稳如龟": 92,     // 深度思考双人组，哲学对话巅峰
    "隐身猫": 82,     // 低压深度对话，社恐友好
  },
  
  "定心大象": {
    "开心柯基": 78,
    "太阳鸡": 85,
    "夸夸豚": 80,
    "机智狐": 75,
    "淡定海豚": 90,
    "织网蛛": 84,
    "暖心熊": 87,
    "灵感章鱼": 78,
    "沉思猫头鹰": 85,
    "定心大象": 80,   // 双象稳定但可能缺乏活力
    "稳如龟": 88,     // 稳定+洞察=可靠智慧
    "隐身猫": 85,     // 稳定后盾，给猫绝对安全感
  },
  
  "稳如龟": {
    "开心柯基": 68,
    "太阳鸡": 70,
    "夸夸豚": 69,
    "机智狐": 72,
    "淡定海豚": 77,
    "织网蛛": 76,
    "暖心熊": 85,
    "灵感章鱼": 80,
    "沉思猫头鹰": 92,
    "定心大象": 88,
    "稳如龟": 75,     // 双龟深度但可能过于安静
    "隐身猫": 90,     // 低频高质+安静陪伴=社恐天堂
  },
  
  "隐身猫": {
    "开心柯基": 65,
    "太阳鸡": 68,
    "夸夸豚": 66,
    "机智狐": 60,
    "淡定海豚": 73,
    "织网蛛": 71,
    "暖心熊": 79,
    "灵感章鱼": 68,
    "沉思猫头鹰": 82,
    "定心大象": 85,
    "稳如龟": 90,
    "隐身猫": 70,     // 双猫安静但可能缺乏互动
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
  "开心柯基": {
    nickname: "摇尾点火官",
    emoji: "🐶",
    coreContribution: "破冰启动，创造欢乐氛围",
    keyTraits: ["能量充沛", "幽默感强", "善于调动气氛"],
  },
  "太阳鸡": {
    nickname: "咯咯小太阳",
    emoji: "🐔",
    coreContribution: "散发温暖能量，提升整体幸福感",
    keyTraits: ["乐观开朗", "感染力强", "情绪稳定"],
  },
  "夸夸豚": {
    nickname: "掌声发动机",
    emoji: "🐹",
    coreContribution: "提供积极反馈，增强团队信心",
    keyTraits: ["鼓励性强", "反应热情", "正能量满满"],
  },
  "机智狐": {
    nickname: "巷口密探",
    emoji: "🦊",
    coreContribution: "引入新鲜体验，拓展活动边界",
    keyTraits: ["好奇心强", "信息灵通", "勇于尝试"],
  },
  "淡定海豚": {
    nickname: "气氛冲浪手",
    emoji: "🐬",
    coreContribution: "平衡群体氛围，化解潜在冲突",
    keyTraits: ["情商高", "应变力强", "包容性好"],
  },
  "织网蛛": {
    nickname: "关系织网师",
    emoji: "🕷️",
    coreContribution: "连接不同人群，构建社交网络",
    keyTraits: ["观察敏锐", "善于发现共同点", "人脉广泛"],
  },
  "暖心熊": {
    nickname: "怀抱故事熊",
    emoji: "🐨",
    coreContribution: "建立情感连接，营造深度交流",
    keyTraits: ["善于倾听", "共情力强", "故事力丰富"],
  },
  "灵感章鱼": {
    nickname: "脑洞喷墨章",
    emoji: "🐙",
    coreContribution: "多线程发散思维，激发集体脑暴",
    keyTraits: ["思维跳跃", "联想丰富", "创意无穷"],
  },
  "沉思猫头鹰": {
    nickname: "推镜思考官",
    emoji: "🦉",
    coreContribution: "提升对话质量，激发深度思考",
    keyTraits: ["逻辑性强", "善于提问", "追求真理"],
  },
  "定心大象": {
    nickname: "象鼻定心锚",
    emoji: "🐘",
    coreContribution: "提供稳定支持，奠定安心基调",
    keyTraits: ["稳重可靠", "包容豁达", "给人安全感"],
  },
  "稳如龟": {
    nickname: "慢语真知龟",
    emoji: "🐢",
    coreContribution: "提供深度洞察，贡献独到见解",
    keyTraits: ["思考深入", "言简意赅", "洞察力强"],
  },
  "隐身猫": {
    nickname: "安静伴伴猫",
    emoji: "🐱",
    coreContribution: "提供安静陪伴，营造轻松氛围",
    keyTraits: ["存在感低", "不施加压力", "享受旁观"],
  },
};

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
