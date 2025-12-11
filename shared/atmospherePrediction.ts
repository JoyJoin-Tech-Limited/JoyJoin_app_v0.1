/**
 * 动态氛围预测引擎
 * 根据参与者角色能量等级和组合特点，生成个性化的氛围预测
 */

// 角色能量等级配置（与 client/src/lib/archetypes.ts 保持同步）
export const archetypeEnergyLevels: Record<string, number> = {
  "开心柯基": 95,
  "太阳鸡": 90,
  "夸夸豚": 85,
  "机智狐": 82,
  "淡定海豚": 75,
  "织网蛛": 72,
  "暖心熊": 70,
  "灵感章鱼": 68,
  "沉思猫头鹰": 55,
  "定心大象": 52,
  "稳如龟": 38,
  "隐身猫": 30,
};

// 角色特质标签（用于生成话题推荐）
export const archetypeTraitTags: Record<string, string[]> = {
  "开心柯基": ["破冰", "幽默", "活力"],
  "太阳鸡": ["温暖", "乐观", "治愈"],
  "夸夸豚": ["鼓励", "赞美", "正能量"],
  "机智狐": ["探索", "新鲜", "冒险"],
  "淡定海豚": ["平衡", "情商", "包容"],
  "织网蛛": ["连接", "社交", "发现共同点"],
  "暖心熊": ["倾听", "故事", "共情"],
  "灵感章鱼": ["创意", "脑洞", "惊喜"],
  "沉思猫头鹰": ["深度", "思考", "洞察"],
  "定心大象": ["稳重", "安全感", "守护"],
  "稳如龟": ["观察", "真知", "简约"],
  "隐身猫": ["陪伴", "细腻", "安静"],
};

// 角色描述短语（用于动态生成亮点）
export const archetypeHighlights: Record<string, string> = {
  "开心柯基": "破冰达人",
  "太阳鸡": "氛围担当",
  "夸夸豚": "鼓励高手",
  "机智狐": "趣味发现者",
  "淡定海豚": "节奏把控者",
  "织网蛛": "话题连接者",
  "暖心熊": "温暖倾听者",
  "灵感章鱼": "创意点子王",
  "沉思猫头鹰": "深度思考者",
  "定心大象": "稳定之锚",
  "稳如龟": "沉稳观察者",
  "隐身猫": "细腻伙伴",
};

// 氛围类型定义
export type AtmosphereType = 
  | "high_energy"      // 高能量：欢乐热闹
  | "warm_cozy"        // 温暖治愈
  | "balanced"         // 动静结合
  | "deep_connect"     // 深度交流
  | "creative_spark";  // 创意碰撞

// 氛围预测结果
export interface AtmospherePrediction {
  type: AtmosphereType;
  title: string;           // 简短标题
  description: string;     // 氛围描述
  energyScore: number;     // 平均能量分
  energyVariance: number;  // 能量方差（用于判断组合多样性）
  highlight: string;       // 本局亮点（动态生成）
  suggestedTopics: string[]; // 推荐话题方向
  dominantArchetypes: string[]; // 主导角色类型
}

/**
 * 计算能量方差（用于判断高低能量混合程度）
 */
function calculateEnergyVariance(energyScores: number[], avgEnergy: number): number {
  if (energyScores.length <= 1) return 0;
  const squaredDiffs = energyScores.map(e => Math.pow(e - avgEnergy, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / energyScores.length);
}

/**
 * 分析组合中的能量分布特征
 */
function analyzeEnergyDistribution(archetypes: string[]) {
  const energyScores = archetypes.map(a => archetypeEnergyLevels[a] || 60);
  const avgEnergy = energyScores.reduce((a, b) => a + b, 0) / energyScores.length;
  const variance = calculateEnergyVariance(energyScores, avgEnergy);
  
  // 分类统计
  const highEnergy = archetypes.filter(a => (archetypeEnergyLevels[a] || 0) >= 80);
  const midEnergy = archetypes.filter(a => {
    const e = archetypeEnergyLevels[a] || 60;
    return e >= 55 && e < 80;
  });
  const lowEnergy = archetypes.filter(a => (archetypeEnergyLevels[a] || 100) < 55);
  
  // 特殊角色类型统计
  const warmArchetypes = archetypes.filter(a => 
    ["太阳鸡", "夸夸豚", "暖心熊", "定心大象"].includes(a)
  );
  const creativeArchetypes = archetypes.filter(a =>
    ["灵感章鱼", "机智狐", "开心柯基"].includes(a)
  );
  const icebreakers = archetypes.filter(a =>
    ["开心柯基", "太阳鸡", "夸夸豚", "织网蛛"].includes(a)
  );
  const listeners = archetypes.filter(a =>
    ["暖心熊", "沉思猫头鹰", "隐身猫", "稳如龟"].includes(a)
  );
  
  return {
    avgEnergy,
    variance,
    highEnergy,
    midEnergy,
    lowEnergy,
    warmArchetypes,
    creativeArchetypes,
    icebreakers,
    listeners,
    total: archetypes.length,
  };
}

/**
 * 生成动态亮点描述（基于实际角色组合）
 */
function generateDynamicHighlight(
  archetypes: string[],
  distribution: ReturnType<typeof analyzeEnergyDistribution>,
  type: AtmosphereType
): string {
  const highlights: string[] = [];
  
  // 根据实际角色生成具体亮点
  if (distribution.icebreakers.length > 0 && distribution.listeners.length > 0) {
    const icebreaker = distribution.icebreakers[0];
    const listener = distribution.listeners[0];
    highlights.push(`有${archetypeHighlights[icebreaker]}暖场，${archetypeHighlights[listener]}助力`);
  }
  
  if (distribution.highEnergy.length >= 2) {
    highlights.push("活力担当齐聚，笑声不断");
  }
  
  if (distribution.warmArchetypes.length >= 2) {
    highlights.push("暖系角色在线，氛围温馨自在");
  }
  
  if (distribution.creativeArchetypes.length >= 2) {
    highlights.push("创意担当聚首，脑洞即将打开");
  }
  
  if (distribution.listeners.length >= 2 && distribution.highEnergy.length === 0) {
    highlights.push("节奏舒适，适合深度倾诉");
  }
  
  // 高方差组合：有明显的高低能量对比
  if (distribution.variance >= 20) {
    if (distribution.highEnergy.length > 0 && distribution.lowEnergy.length > 0) {
      highlights.push("动静结合，各有精彩");
    }
  }
  
  // 选择最相关的亮点，或使用兜底描述
  if (highlights.length > 0) {
    return highlights[0];
  }
  
  // 兜底：根据氛围类型生成
  switch (type) {
    case "high_energy":
      return "活力组合，气氛超嗨";
    case "warm_cozy":
      return "温暖相遇，轻松自在";
    case "creative_spark":
      return "创意碰撞，惊喜连连";
    case "deep_connect":
      return "深度对话，走心交流";
    default:
      return "精心搭配，恰到好处";
  }
}

/**
 * 根据参与者角色列表生成氛围预测
 */
export function predictAtmosphere(archetypes: string[]): AtmospherePrediction {
  if (archetypes.length === 0) {
    return getDefaultPrediction();
  }

  const distribution = analyzeEnergyDistribution(archetypes);
  const { avgEnergy, variance, highEnergy, midEnergy, lowEnergy, warmArchetypes, creativeArchetypes } = distribution;

  // 收集所有特质标签
  const allTags = archetypes.flatMap(a => archetypeTraitTags[a] || []);
  const tagCounts = allTags.reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // 取出现次数最多的3个标签作为推荐话题方向
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  // 判断氛围类型（改进算法：优先检测混合能量组合）
  let type: AtmosphereType;
  let title: string;
  let description: string;

  // 核心规则：任何有≥2高能量 AND ≥2低能量的组合都是"动静结合"
  // 这避免了之前的比例阈值导致的误分类
  const hasMixedEnergy = highEnergy.length >= 2 && lowEnergy.length >= 2;
  const hasHighLowContrast = highEnergy.length >= 1 && lowEnergy.length >= 1 && variance >= 20;
  
  const lowEnergyRatio = lowEnergy.length / archetypes.length;
  const highEnergyRatio = highEnergy.length / archetypes.length;

  if (hasMixedEnergy || (hasHighLowContrast && variance >= 25)) {
    // 明显的高低能量混合组 → 动静结合
    type = "balanced";
    title = "动静结合型";
    description = "有人暖场有人走心，节奏刚刚好";
  } else if (avgEnergy >= 80 && lowEnergy.length <= 1) {
    // 高能量组（最多1个低能量者）
    type = "high_energy";
    title = "欢乐热闹型";
    description = "笑声不断，气氛超嗨，边吃边聊越聊越嗨";
  } else if (avgEnergy >= 70 && highEnergy.length >= 2 && lowEnergy.length === 0) {
    // 活力主导但不极端
    type = "high_energy";
    title = "欢乐热闘型";
    description = "活力满满，气氛轻松愉快";
  } else if (warmArchetypes.length >= archetypes.length * 0.4 && avgEnergy >= 60) {
    // 温暖治愈型
    type = "warm_cozy";
    title = "温暖治愈型";
    description = "像和老朋友小聚的轻松感，温馨又自在";
  } else if (creativeArchetypes.length >= 2 && avgEnergy >= 55) {
    // 创意碰撞型
    type = "creative_spark";
    title = "创意碰撞型";
    description = "脑洞大开，惊喜连连，聊天变头脑风暴";
  } else if (lowEnergyRatio >= 0.6 || (avgEnergy < 50 && highEnergy.length === 0)) {
    // 深度交流型（低能量明显主导）
    type = "deep_connect";
    title = "深度交流型";
    description = "不用尬聊，慢慢打开，深度对话更走心";
  } else {
    // 默认：动静结合型
    type = "balanced";
    title = "动静结合型";
    description = "有人暖场有人走心，节奏刚刚好";
  }

  // 动态生成亮点
  const highlight = generateDynamicHighlight(archetypes, distribution, type);

  // 根据特质生成话题推荐
  const suggestedTopics = generateTopicSuggestions(topTags, type);

  // 识别主导角色
  const dominantArchetypes = [...highEnergy, ...warmArchetypes, ...creativeArchetypes]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3);

  return {
    type,
    title,
    description,
    energyScore: Math.round(avgEnergy),
    energyVariance: Math.round(variance),
    highlight,
    suggestedTopics,
    dominantArchetypes,
  };
}

/**
 * 根据特质标签和氛围类型生成话题推荐
 */
function generateTopicSuggestions(tags: string[], type: AtmosphereType): string[] {
  const topicMap: Record<string, string[]> = {
    "破冰": ["最近让你笑出声的事", "周末都在干嘛"],
    "幽默": ["你听过最离谱的段子", "社死名场面分享"],
    "活力": ["最想尝试的极限运动", "最近的小确幸"],
    "温暖": ["被陌生人温暖到的瞬间", "想对过去的自己说什么"],
    "乐观": ["遇到困难时怎么开导自己", "最近的好消息"],
    "治愈": ["解压方式大公开", "私藏的治愈歌单"],
    "鼓励": ["你觉得自己最棒的特质", "夸夸身边的人"],
    "赞美": ["欣赏的品质", "被夸过最开心的一次"],
    "正能量": ["每天的小习惯", "分享一个好习惯"],
    "探索": ["最想去的小众目的地", "最近发现的宝藏店"],
    "新鲜": ["想尝试的新事物", "最近学到的新技能"],
    "冒险": ["做过最勇敢的事", "想挑战的极限"],
    "平衡": ["工作生活怎么平衡", "如何保持好心态"],
    "情商": ["化解尴尬的小妙招", "读懂人心的秘诀"],
    "包容": ["接受不完美的自己", "理解与被理解"],
    "连接": ["和朋友保持联系的方式", "社交中的小心得"],
    "社交": ["拓展社交圈的经验", "认识新朋友的契机"],
    "发现共同点": ["你们有什么共同爱好", "神奇的巧合经历"],
    "倾听": ["最想被倾听的心事", "你是哪种倾听者"],
    "故事": ["人生中的转折点", "影响你最深的一个人"],
    "共情": ["最能共情的电影情节", "换位思考的时刻"],
    "创意": ["最有创意的点子", "如果可以发明一样东西"],
    "脑洞": ["异想天开的假设", "如果有超能力"],
    "惊喜": ["收到过最惊喜的礼物", "制造惊喜的经历"],
    "深度": ["人生的意义是什么", "最近在思考的问题"],
    "思考": ["改变你想法的一本书", "颠覆认知的经历"],
    "洞察": ["观察人的小发现", "看透本质的瞬间"],
    "稳重": ["面对压力的方式", "给你安全感的事物"],
    "安全感": ["什么让你感到安心", "可以依赖的人或事"],
    "守护": ["最想保护的人或事", "责任感的来源"],
    "观察": ["细节控的日常", "观察到的有趣现象"],
    "真知": ["人生感悟", "一句话总结近况"],
    "简约": ["断舍离的经验", "少即是多的体会"],
    "陪伴": ["最珍贵的陪伴时刻", "陪伴的意义"],
    "细腻": ["注意到的小细节", "细腻的心思"],
    "安静": ["享受独处的方式", "安静的力量"],
  };

  const suggestions: string[] = [];
  for (const tag of tags) {
    const topics = topicMap[tag];
    if (topics && topics.length > 0) {
      suggestions.push(topics[Math.floor(Math.random() * topics.length)]);
    }
  }

  // 如果不够3个，根据氛围类型补充
  const fallbackTopics: Record<AtmosphereType, string[]> = {
    high_energy: ["最近让你笑出声的事", "周末计划分享", "社死名场面"],
    warm_cozy: ["最近的小确幸", "私藏的解压方式", "被温暖到的瞬间"],
    balanced: ["工作生活小趣事", "最近在追的剧", "周末都在干嘛"],
    deep_connect: ["影响你最深的一个人", "人生的转折点", "最近在思考的事"],
    creative_spark: ["脑洞大开的假设", "想发明的东西", "创意点子分享"],
  };

  while (suggestions.length < 3) {
    const fallbacks = fallbackTopics[type];
    const next = fallbacks[suggestions.length % fallbacks.length];
    if (!suggestions.includes(next)) {
      suggestions.push(next);
    } else {
      break;
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * 默认预测（无角色数据时使用）
 */
function getDefaultPrediction(): AtmospherePrediction {
  return {
    type: "balanced",
    title: "轻松愉快型",
    description: "边吃边聊，自然熟络",
    energyScore: 65,
    energyVariance: 0,
    highlight: "小悦已精心安排",
    suggestedTopics: ["周末都在干嘛", "最近的小确幸", "私藏的美食店"],
    dominantArchetypes: [],
  };
}

// 通知文案变体（避免重复）
const matchTitleVariants = [
  "小悦已为你安排妥当",
  "你的社交局已就绪",
  "精心安排，只等你来",
  "专属局已配好",
];

const matchMessageVariants = [
  (count: number, desc: string, venue: string, date: string) =>
    `你即将与${count}位伙伴相遇 · 氛围预测：${desc} · ${date}，${venue}见`,
  (count: number, desc: string, venue: string, date: string) =>
    `${count}位志趣相投的伙伴在等你 · 预计氛围：${desc} · ${date}，${venue}`,
  (count: number, desc: string, venue: string, date: string) =>
    `本局${count}人已就位 · ${desc} · ${date}，${venue}不见不散`,
];

/**
 * 生成通知文案（无emoji版本，支持变体）
 */
export function generateNotificationCopy(
  archetypes: string[],
  participantCount: number,
  dateTime: Date,
  venue: string,
  variant?: number
): { title: string; message: string } {
  const prediction = predictAtmosphere(archetypes);
  const dateStr = formatDateTime(dateTime);
  
  // 使用变体或随机选择
  const variantIndex = variant !== undefined 
    ? variant % matchTitleVariants.length 
    : Math.floor(Math.random() * matchTitleVariants.length);
  
  const title = matchTitleVariants[variantIndex];
  const messageTemplate = matchMessageVariants[variantIndex % matchMessageVariants.length];
  const message = messageTemplate(participantCount - 1, prediction.description, venue, dateStr);

  return { title, message };
}

/**
 * 生成取消通知文案（包含下一步指引）
 */
export function generateCancellationCopy(reason?: string): { title: string; message: string } {
  const title = "活动有变动";
  let message = "这场聚会未能成行，我们会尽快为你安排下一场";
  
  if (reason) {
    message = `${reason}，小悦会为你安排更合适的下一场`;
  }
  
  return { title, message };
}

/**
 * 生成活动提醒通知文案
 */
export function generateReminderCopy(
  archetypes: string[],
  venue: string,
  dateTime: Date
): { title: string; message: string } {
  const prediction = predictAtmosphere(archetypes);
  const dateStr = formatDateTime(dateTime);
  
  const reminderTitles = [
    "明天见",
    "活动即将开始",
    "准备好了吗",
  ];
  
  const reminderMessages = [
    `${dateStr}，${venue}，${prediction.title}的一局等你开场`,
    `${dateStr}我们在${venue}等你，${prediction.highlight}`,
    `明日之约：${venue}，${prediction.description}`,
  ];
  
  const idx = Math.floor(Math.random() * reminderTitles.length);
  
  return {
    title: reminderTitles[idx],
    message: reminderMessages[idx],
  };
}

/**
 * 生成首次匹配介绍文案（用户第一次获得匹配）
 */
export function generateFirstMatchIntro(): { title: string; message: string } {
  const title = "小悦来啦";
  const message = "我是悦聚的AI社交建筑师，根据你们的性格、兴趣和社交风格，精心搭建了这一局~ 现在就去看看你的伙伴吧";
  
  return { title, message };
}

/**
 * 格式化日期时间为中文描述
 */
function formatDateTime(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
  
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekDay = weekDays[date.getDay()];
  
  if (diffDays === 0) {
    return `今天 ${timeStr}`;
  } else if (diffDays === 1) {
    return `明天 ${timeStr}`;
  } else if (diffDays === 2) {
    return `后天 ${timeStr}`;
  } else if (diffDays <= 7) {
    return `${weekDay} ${timeStr}`;
  } else {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日 ${weekDay} ${timeStr}`;
  }
}
