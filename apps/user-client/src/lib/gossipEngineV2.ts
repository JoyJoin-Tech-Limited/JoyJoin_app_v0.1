/**
 * 小悦偷偷碎嘴系统 V2.0 - 全面优化版
 * 
 * 核心优化：
 * 1. 支柱配额矩阵（Identity≤45%, Energy≥35%, Value≥20%）
 * 2. 15+条Energy/Value新规则 + 稀有属性组合
 * 3. 动态模板系统（骨架句+变量槽+毒舌收尾库）
 * 4. 毒舌公式话术（我猜+轻微吐槽+反问+Soft Landing）
 * 5. 稀有度分级（普通/中等/稀有）+ 惊喜彩蛋
 * 6. 安全守护（禁止词+情绪风险评分）
 */

// ============ 类型定义 ============
export interface CollectedInfo {
  displayName?: string;
  gender?: string;
  birthYear?: string;
  birthdate?: string;
  currentCity?: string;
  hometown?: string;
  industry?: string;
  occupationDescription?: string;
  interestsTop?: string[];
  socialStyle?: string;
  intent?: string;
  hasPets?: boolean;
}

export interface FoxInsight {
  text: string;
  pillar: 'identity' | 'energy' | 'value';
  confidence: number;
  trigger: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  noveltyScore: number;
}

export type InferenceResult = 
  | { type: 'success'; insight: FoxInsight }
  | { type: 'cooldown'; reason: string }
  | { type: 'no_match'; reason: string };

// ============ 安全守护系统 ============
const FORBIDDEN_WORDS = [
  '丑', '胖', '矮', '穷', '笨', '蠢', '傻', '渣', '贱', '婊',
  '屌丝', '绿茶', '心机', '作', '装', '假', '虚伪', '势利',
  '老', '大龄', '剩', '嫁不出', '娶不到', '单身狗'
];

const SENSITIVE_PATTERNS = [
  /不行|不好|不够|很差/,
  /肯定是.*问题/,
  /你这种人/,
  /看不出.*优点/
];

function calculateEmotionalRisk(text: string): number {
  let risk = 0;
  for (const word of FORBIDDEN_WORDS) {
    if (text.includes(word)) risk += 0.3;
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) risk += 0.2;
  }
  if (text.includes('我猜') && !text.includes('？')) risk += 0.1;
  if (text.length > 80) risk += 0.05;
  return Math.min(risk, 1.0);
}

function isSafeInsight(text: string): boolean {
  return calculateEmotionalRisk(text) < 0.3;
}

// ============ 动态模板系统 ============
interface TemplateSlot {
  skeleton: string;
  variables: Record<string, (info: CollectedInfo) => string>;
  endings: string[];
}

function fillTemplate(slot: TemplateSlot, info: CollectedInfo): string {
  let result = slot.skeleton;
  for (const [key, getter] of Object.entries(slot.variables)) {
    result = result.replace(`{${key}}`, getter(info));
  }
  const randomEnding = slot.endings[Math.floor(Math.random() * slot.endings.length)];
  result = result.replace('{ending}', randomEnding);
  return result;
}

const SNARKY_ENDINGS = {
  question: [
    '——你自己说，我说得准不准？',
    '——被我说中了吧？',
    '——怎么样，敢承认吗？',
    '——不服来辩？',
    '——图啥呢你说？',
  ],
  challenge: [
    '——先说好别又鸽我',
    '——不过你可别让我失望啊',
    '——就看你能不能接住了',
    '——有本事证明给我看',
  ],
  tease: [
    '——我先记下了，后面对账',
    '——你这个我得观察观察',
    '——嘴上说不要，身体很诚实吧',
    '——行吧，暂且信你',
  ],
  curious: [
    '——说来听听？',
    '——展开讲讲',
    '——我倒要看看',
    '——有点意思，继续',
  ],
};

function getRandomEnding(type: keyof typeof SNARKY_ENDINGS): string {
  const endings = SNARKY_ENDINGS[type];
  return endings[Math.floor(Math.random() * endings.length)];
}

// ============ 稀有度系统 ============
type RarityLevel = 'common' | 'uncommon' | 'rare' | 'legendary';

function calculateRarity(trigger: string, matchCount: number): RarityLevel {
  if (trigger.includes('legendary') || matchCount >= 4) return 'legendary';
  if (trigger.includes('rare') || matchCount >= 3) return 'rare';
  if (trigger.includes('combo') || matchCount >= 2) return 'uncommon';
  return 'common';
}

function getRarityBonus(rarity: RarityLevel): number {
  switch (rarity) {
    case 'legendary': return 0.3;
    case 'rare': return 0.2;
    case 'uncommon': return 0.1;
    default: return 0;
  }
}

// ============ 支柱配额系统 ============
interface PillarQuota {
  identity: number;
  energy: number;
  value: number;
}

const TARGET_QUOTA: PillarQuota = {
  identity: 0.45,
  energy: 0.35,
  value: 0.20,
};

interface CadenceState {
  lastInsightTurn: number;
  shownInsights: Set<string>;
  pillarHistory: Array<'identity' | 'energy' | 'value'>;
  cooldownTurns: number;
}

const cadenceState: CadenceState = {
  lastInsightTurn: -10,
  shownInsights: new Set(),
  pillarHistory: [],
  cooldownTurns: 3,
};

export function resetCadence() {
  cadenceState.lastInsightTurn = -10;
  cadenceState.shownInsights.clear();
  cadenceState.pillarHistory = [];
}

function getPillarPenalty(pillar: 'identity' | 'energy' | 'value'): number {
  if (cadenceState.pillarHistory.length < 2) return 0;
  const recent = cadenceState.pillarHistory.slice(-3);
  const pillarCount = recent.filter(p => p === pillar).length;
  if (pillarCount >= 2) return 0.3;
  if (pillarCount >= 1) return 0.1;
  return 0;
}

function calculateFinalScore(insight: FoxInsight): number {
  const baseScore = insight.confidence;
  const rarityBonus = getRarityBonus(insight.rarity);
  const noveltyBonus = insight.noveltyScore * 0.2;
  const pillarPenalty = getPillarPenalty(insight.pillar);
  return baseScore + rarityBonus + noveltyBonus - pillarPenalty;
}

// ============ 规则引擎 V2 ============

function generateInsightsV2(info: CollectedInfo): FoxInsight[] {
  const insights: FoxInsight[] = [];
  const isFemale = info.gender?.includes('女');
  
  const birthYear = info.birthYear ? parseInt(info.birthYear) : 
    (info.birthdate ? parseInt(info.birthdate.split('-')[0]) : null);
  
  const interests = info.interestsTop || [];
  const hasOutdoor = interests.some(i => /户外|运动|健身|跑步|爬山|徒步|hiking/i.test(i));
  const hasFood = interests.some(i => /美食|探店|吃|烹饪|餐厅|咖啡/i.test(i));
  const hasDeep = interests.some(i => /读书|知识|讨论|学习|阅读|播客|TED/i.test(i));
  const hasMovie = interests.some(i => /电影|影视|追剧|综艺|看片|动漫/i.test(i));
  const hasMusic = interests.some(i => /音乐|乐器|唱歌|演唱会|livehouse/i.test(i));
  const hasTravel = interests.some(i => /旅行|旅游|探索|出游|度假/i.test(i));
  const hasArt = interests.some(i => /艺术|展览|博物馆|画廊|摄影|看展/i.test(i));
  const hasDrink = interests.some(i => /酒|小酌|威士忌|红酒|鸡尾酒|bar|清吧/i.test(i));
  const hasGaming = interests.some(i => /游戏|switch|ps5|steam|电竞|桌游/i.test(i));
  const hasPets = interests.some(i => /猫|狗|宠物|撸猫|遛狗/i.test(i)) || info.hasPets;
  const hasFitness = interests.some(i => /健身|瑜伽|普拉提|CrossFit|撸铁/i.test(i));
  const hasInvest = interests.some(i => /投资|理财|股票|基金|炒股/i.test(i));
  const hasPsych = interests.some(i => /心理|冥想|正念|MBTI|星座/i.test(i));
  const hasDrama = interests.some(i => /戏剧|话剧|舞台剧|音乐剧|脱口秀/i.test(i));
  const hasInstrument = interests.some(i => /钢琴|吉他|古筝|小提琴|架子鼓/i.test(i));
  const hasDancing = interests.some(i => /跳舞|街舞|拉丁|芭蕾|舞蹈/i.test(i));
  
  const isTech = info.industry?.match(/科技|互联网|IT|软件|程序|AI|大数据/);
  const isFinance = info.industry?.match(/金融|投资|银行|证券|保险|VC|PE/);
  const isCreative = info.industry?.match(/设计|创意|广告|美术|艺术/);
  const isMedia = info.industry?.match(/传媒|内容|媒体|编辑|记者|MCN/);
  const isLaw = info.industry?.match(/法律|律师|法务|咨询/);
  const isEducation = info.industry?.match(/教育|培训|老师|教授/);
  const isMedical = info.industry?.match(/医疗|健康|医生|护士|药/);
  const isStartup = info.industry?.includes("创业") || info.occupationDescription?.includes("创业");
  const isForeign = info.industry?.match(/外企|跨国|500强|世界五百强/);
  
  const inSZ = info.currentCity?.includes("深圳");
  const inHK = info.currentCity?.includes("香港");
  const inGZ = info.currentCity?.includes("广州");
  const inBJ = info.currentCity?.includes("北京");
  const inSH = info.currentCity?.includes("上海");
  
  const hometownShort = info.hometown?.replace(/省|市|自治区/g, '').slice(0, 2) || '';
  const cityShort = info.currentCity?.replace(/市/g, '') || '';
  
  // ========== 传说级稀有组合 ==========
  
  if (isTech && hasDrama) {
    insights.push({
      text: isFemale 
        ? `写代码的还爱看话剧？我猜你debug的时候脑子里都在排演内心戏${getRandomEnding('tease')}` 
        : `程序员+戏剧爱好者，这种反差萌可不多见——你是不是偷偷写过剧本？`,
      pillar: 'energy',
      confidence: 0.92,
      trigger: 'legendary_tech_drama',
      rarity: 'legendary',
      noveltyScore: 0.95,
    });
  }
  
  if (isFinance && hasDancing) {
    insights.push({
      text: isFemale 
        ? `白天看财报，晚上蹦迪去？我猜你excel用得贼溜，舞步更溜${getRandomEnding('challenge')}` 
        : `金融人还会跳舞，这种身心兼修的卷法我服——不过你真的有时间练吗？`,
      pillar: 'energy',
      confidence: 0.9,
      trigger: 'legendary_finance_dance',
      rarity: 'legendary',
      noveltyScore: 0.92,
    });
  }
  
  if (isForeign && hasInstrument) {
    insights.push({
      text: isFemale 
        ? `外企打工人还会乐器？我猜你开会用英文，练琴用中文骂自己${getRandomEnding('tease')}` 
        : `500强+乐器，这种优雅的卷法可以——你是古典派还是摇滚派？`,
      pillar: 'energy',
      confidence: 0.88,
      trigger: 'legendary_foreign_instrument',
      rarity: 'legendary',
      noveltyScore: 0.9,
    });
  }
  
  // ========== 稀有组合 ==========
  
  if (isLaw && hasGaming) {
    insights.push({
      text: isFemale 
        ? `律师还打游戏？我猜你在法庭上辩论的时候也想开麦喷对面${getRandomEnding('question')}` 
        : `法律人+游戏党，我猜你打排位的时候特别会甩锅${getRandomEnding('tease')}`,
      pillar: 'energy',
      confidence: 0.85,
      trigger: 'rare_law_gaming',
      rarity: 'rare',
      noveltyScore: 0.85,
    });
  }
  
  if (isMedical && hasDrink) {
    insights.push({
      text: isFemale 
        ? `医疗行业的还爱小酌？我猜你喝酒的时候都在分析酒精代谢路径${getRandomEnding('tease')}` 
        : `医生+酒鬼组合，职业病犯了吧——喝完还算热量吗？`,
      pillar: 'energy',
      confidence: 0.83,
      trigger: 'rare_medical_drink',
      rarity: 'rare',
      noveltyScore: 0.82,
    });
  }
  
  if (isEducation && hasFitness) {
    insights.push({
      text: isFemale 
        ? `教书的还撸铁？我猜你的学生都不敢惹你${getRandomEnding('question')}` 
        : `老师+健身达人，文武双全这种配置挺稀缺的——你是严师还是温柔派？`,
      pillar: 'energy',
      confidence: 0.82,
      trigger: 'rare_edu_fitness',
      rarity: 'rare',
      noveltyScore: 0.8,
    });
  }
  
  if (hasPsych && isFinance) {
    insights.push({
      text: isFemale 
        ? `搞金融还研究心理学？我猜你看K线的时候顺便在分析韭菜心理${getRandomEnding('tease')}` 
        : `金融+心理学，这种组合要么是投资大佬要么是PUA高手——你是哪种？`,
      pillar: 'value',
      confidence: 0.85,
      trigger: 'rare_finance_psych',
      rarity: 'rare',
      noveltyScore: 0.85,
    });
  }
  
  // ========== 支柱1：身份归属（优化后话术） ==========
  
  if (birthYear && info.currentCity && info.industry) {
    if (birthYear >= 2000 && isFinance && inHK) {
      insights.push({
        text: isFemale 
          ? `00后港漂金融人？我猜你朋友圈都是维港夜景和加班照——国际范儿是有了，睡眠还有吗？` 
          : `00后港漂金融人，见过世面但没架子——我猜你周末闲不住，不是在hiking就是在brunch`,
        pillar: 'identity',
        confidence: 0.88,
        trigger: 'combo_00_finance_hk',
        rarity: 'uncommon',
        noveltyScore: 0.7,
      });
    }
    else if (birthYear >= 1995 && isFinance && inHK) {
      insights.push({
        text: isFemale 
          ? `你在港岛盯盘那股劲儿，估计连海风都得排队见你${getRandomEnding('curious')}` 
          : `香港金融圈的兄弟，一级市场水深——你是投行卷王还是买方躺平派？`,
        pillar: 'identity',
        confidence: 0.88,
        trigger: 'combo_95_finance_hk',
        rarity: 'uncommon',
        noveltyScore: 0.7,
      });
    }
    else if (birthYear >= 1995 && isTech && inSZ) {
      insights.push({
        text: isFemale 
          ? `深圳科技圈95后，白天冲KPI晚上还想着组局？${getRandomEnding('challenge')}` 
          : `深圳科技圈95后，卷但清醒——我猜你副业比主业还认真`,
        pillar: 'identity',
        confidence: 0.82,
        trigger: 'combo_95_tech_sz',
        rarity: 'uncommon',
        noveltyScore: 0.65,
      });
    }
    else if (birthYear >= 2000 && isTech && inSZ) {
      insights.push({
        text: isFemale 
          ? `00后深圳互联网人，我猜你是团队里最会用AI工具的那个——老板知道你效率这么高吗？` 
          : `00后深圳互联网er，年轻但靠谱——我猜你已经是团队隐形扛把子了`,
        pillar: 'identity',
        confidence: 0.85,
        trigger: 'combo_00_tech_sz',
        rarity: 'uncommon',
        noveltyScore: 0.68,
      });
    }
    else if (isStartup) {
      insights.push({
        text: isFemale 
          ? `创业中的姐姐，又当老板又当牛马——我猜你的作息已经放弃治疗了吧？` 
          : `创业路上的兄弟，有想法有执行力——不过你真的不焦虑吗？`,
        pillar: 'identity',
        confidence: 0.78,
        trigger: 'combo_startup',
        rarity: 'uncommon',
        noveltyScore: 0.6,
      });
    }
    else if (isCreative && inSZ) {
      insights.push({
        text: isFemale 
          ? `深圳创意圈的姐姐，审美在线还能落地——我猜甲方改稿你都能优雅应对？` 
          : `深圳创意人，既有想法又能执行——不过甲方说"我再想想"的时候你什么表情？`,
        pillar: 'identity',
        confidence: 0.8,
        trigger: 'combo_creative_sz',
        rarity: 'uncommon',
        noveltyScore: 0.62,
      });
    }
    else if (isCreative && inHK) {
      insights.push({
        text: isFemale 
          ? `香港创意圈的，中西审美两手抓——我猜你的作品集很能打？` 
          : `香港创意人，国际范儿加本土味道——这种视野很难得，来聊聊最近在做什么？`,
        pillar: 'identity',
        confidence: 0.8,
        trigger: 'combo_creative_hk',
        rarity: 'uncommon',
        noveltyScore: 0.62,
      });
    }
    else if (isMedia) {
      insights.push({
        text: isFemale 
          ? `做内容的姐姐，讲故事能力应该拉满——我猜你朋友圈文案都比别人精彩？` 
          : `传媒人，敏感度和表达力都在线——来分享点行业八卦？`,
        pillar: 'identity',
        confidence: 0.78,
        trigger: 'combo_media',
        rarity: 'common',
        noveltyScore: 0.5,
      });
    }
    else if (isFinance && inSZ) {
      insights.push({
        text: isFemale 
          ? `深圳金融圈的，VC/PE氛围你应该很熟——我猜你看项目的眼光比看人还准？` 
          : `深圳金融人，创投圈的节奏你应该门儿清——聊聊你最近看好什么方向？`,
        pillar: 'identity',
        confidence: 0.82,
        trigger: 'combo_finance_sz',
        rarity: 'uncommon',
        noveltyScore: 0.6,
      });
    }
  }
  
  if (info.currentCity && info.hometown && info.currentCity !== info.hometown && hometownShort && cityShort) {
    insights.push({
      text: isFemale 
        ? `从${hometownShort}杀到${cityShort}，这股子狠劲儿我喜欢——你是主动出走还是被生活推着来的？` 
        : `从${hometownShort}到${cityShort}闯荡，不是安于现状的人——我猜你还有更大的野心？`,
      pillar: 'identity',
      confidence: 0.78,
      trigger: 'migration',
      rarity: 'common',
      noveltyScore: 0.45,
    });
  }
  
  // ========== 支柱2：社交能量（大幅扩充） ==========
  
  if (hasOutdoor && hasMovie) {
    insights.push({
      text: isFemale 
        ? `户外能撒欢，回家能追剧——我猜你周末行程全看心情？` 
        : `能动能静，这种平衡感很难得——不过你追剧是认真追还是当背景音？`,
      pillar: 'energy',
      confidence: 0.82,
      trigger: 'combo_outdoor_movie',
      rarity: 'uncommon',
      noveltyScore: 0.6,
    });
  }
  else if (hasOutdoor && hasFood) {
    insights.push({
      text: isFemale 
        ? `又能动又能吃，我猜你运动就是为了心安理得地干饭？` 
        : `运动完吃好的，这个逻辑我认可——不过你真的能消耗得掉吗？`,
      pillar: 'energy',
      confidence: 0.82,
      trigger: 'combo_outdoor_food',
      rarity: 'uncommon',
      noveltyScore: 0.58,
    });
  }
  else if (hasFood && hasDrink) {
    insights.push({
      text: isFemale 
        ? `美食配小酌，生活品味拉满——我猜你私藏店铺比公开推荐的多？` 
        : `探店加小酌，懂吃懂喝——不过你踩雷的店是不是比安利的还多？`,
      pillar: 'energy',
      confidence: 0.85,
      trigger: 'combo_food_drink',
      rarity: 'uncommon',
      noveltyScore: 0.65,
    });
  }
  else if (hasMusic && interests.some(i => /livehouse|现场|演出|音乐节/.test(i))) {
    insights.push({
      text: isFemale 
        ? `livehouse常客，我猜你的耳朵已经被养刁了——推个最近看的好演出？` 
        : `现场派，懂音乐的人——不过你是前排蹦的还是后排站着听的？`,
      pillar: 'energy',
      confidence: 0.83,
      trigger: 'combo_music_live',
      rarity: 'uncommon',
      noveltyScore: 0.62,
    });
  }
  else if (hasTravel && hasArt) {
    insights.push({
      text: isFemale 
        ? `旅拍爱好者，既会玩又会拍——我猜你的相册比朋友圈精彩十倍？` 
        : `旅拍达人，走过的地方多眼界开阔——不过你是真文艺还是装文艺？`,
      pillar: 'energy',
      confidence: 0.8,
      trigger: 'combo_travel_art',
      rarity: 'uncommon',
      noveltyScore: 0.58,
    });
  }
  else if (hasDeep && (info.socialStyle?.includes("内敛") || info.socialStyle?.includes("I人"))) {
    insights.push({
      text: isFemale 
        ? `安静但有深度，我猜你聊开了话比谁都多——就看跟谁聊了` 
        : `内敛派，聊深了你应该有很多独到的想法——不过你愿意分享吗？`,
      pillar: 'energy',
      confidence: 0.78,
      trigger: 'combo_deep_quiet',
      rarity: 'uncommon',
      noveltyScore: 0.55,
    });
  }
  else if (hasMovie && hasMusic) {
    insights.push({
      text: isFemale 
        ? `电影音乐都爱，文艺细胞满满——我猜你有专门的"私藏歌单"不轻易分享？` 
        : `影音双修，品味应该不错——不过你看电影是挑着看还是什么都看？`,
      pillar: 'energy',
      confidence: 0.78,
      trigger: 'combo_movie_music',
      rarity: 'common',
      noveltyScore: 0.5,
    });
  }
  else if (hasFitness && hasFood) {
    insights.push({
      text: isFemale 
        ? `健身+吃货，我猜你每次吃完都在心里默算热量——然后假装没算` 
        : `撸铁+探店，这种自律又放纵的状态挺有意思——你是增肌期还是减脂期？`,
      pillar: 'energy',
      confidence: 0.8,
      trigger: 'combo_fitness_food',
      rarity: 'uncommon',
      noveltyScore: 0.6,
    });
  }
  else if (hasGaming) {
    insights.push({
      text: isFemale 
        ? `游戏玩家，我猜你打游戏的时候完全是另一个人？` 
        : `游戏党，打游戏能看出一个人的性格——你是C位输出还是辅助型？`,
      pillar: 'energy',
      confidence: 0.72,
      trigger: 'interest_gaming',
      rarity: 'common',
      noveltyScore: 0.48,
    });
  }
  else if (hasPets) {
    insights.push({
      text: isFemale 
        ? `铲屎官一枚，我猜你的相册90%都是毛孩子——人类朋友都嫉妒了` 
        : `养宠达人，能照顾好小动物的人责任感应该很强——是猫奴还是狗党？`,
      pillar: 'energy',
      confidence: 0.78,
      trigger: 'interest_pets',
      rarity: 'common',
      noveltyScore: 0.5,
    });
  }
  else if (hasOutdoor) {
    insights.push({
      text: isFemale 
        ? `户外爱好者，阳光健康的状态很有感染力——不过你是真的爱动还是为了拍照？` 
        : `喜欢户外，精力充沛——我猜你周末闹钟比工作日还早？`,
      pillar: 'energy',
      confidence: 0.68,
      trigger: 'interest_outdoor',
      rarity: 'common',
      noveltyScore: 0.4,
    });
  }
  else if (hasFood) {
    insights.push({
      text: isFemale 
        ? `美食爱好者，舌尖品味在线——不过你是真的会吃还是只会拍照？` 
        : `吃货一枚，懂吃的人一般都懂生活——推个最近发现的宝藏店？`,
      pillar: 'energy',
      confidence: 0.68,
      trigger: 'interest_food',
      rarity: 'common',
      noveltyScore: 0.4,
    });
  }
  
  // ========== 支柱3：价值驱动（大幅扩充） ==========
  
  if (info.intent?.includes("深度讨论") || info.intent?.includes("知识")) {
    insights.push({
      text: isFemale 
        ? `喜欢深度讨论，说明你不满足于表面社交——我猜你聊天三句话就想挖深？` 
        : `追求深度交流，不是随便聊聊就行的那种——不过你能接受观点碰撞吗？`,
      pillar: 'value',
      confidence: 0.82,
      trigger: 'intent_deep',
      rarity: 'uncommon',
      noveltyScore: 0.6,
    });
  }
  else if (info.intent?.includes("拓展人脉") || info.intent?.includes("商业")) {
    insights.push({
      text: isFemale 
        ? `社交目标明确，务实又高效——我猜你的微信好友分类管理得很清楚？` 
        : `目标清晰，知道自己要什么——不过你是真networking还是假装在networking？`,
      pillar: 'value',
      confidence: 0.78,
      trigger: 'intent_network',
      rarity: 'common',
      noveltyScore: 0.5,
    });
  }
  else if (info.intent?.includes("找饭搭子") || info.intent?.includes("同好")) {
    insights.push({
      text: isFemale 
        ? `找搭子型社交，轻松又实在——我猜你约人吃饭从不放鸽子？` 
        : `找同好的务实派，不搞虚的——不过你对搭子有什么硬性要求？`,
      pillar: 'value',
      confidence: 0.75,
      trigger: 'intent_casual',
      rarity: 'common',
      noveltyScore: 0.45,
    });
  }
  
  if (hasInvest && !insights.some(i => i.pillar === 'value')) {
    insights.push({
      text: isFemale 
        ? `关注投资理财，财商应该在线——我猜你的记账app用得比社交app还勤？` 
        : `投资爱好者，说明你在认真规划未来——不过你是价值投资还是追涨杀跌？`,
      pillar: 'value',
      confidence: 0.78,
      trigger: 'interest_invest',
      rarity: 'uncommon',
      noveltyScore: 0.58,
    });
  }
  
  if (hasPsych && !insights.some(i => i.trigger.includes('psych'))) {
    insights.push({
      text: isFemale 
        ? `对心理学感兴趣，说明你在认真理解自己和他人——我猜你分析别人比分析自己多？` 
        : `研究心理学，有点意思——不过你是真想了解人心还是想看穿别人？`,
      pillar: 'value',
      confidence: 0.75,
      trigger: 'interest_psych',
      rarity: 'uncommon',
      noveltyScore: 0.55,
    });
  }
  
  if (info.socialStyle?.includes("活跃") || info.socialStyle?.includes("外向") || info.socialStyle?.includes("E人")) {
    insights.push({
      text: isFemale 
        ? `社交达人，氛围组担当——我猜你在任何场合都是第一个打破沉默的？` 
        : `社牛属性，聊什么都能接住——不过你累不累啊这么E？`,
      pillar: 'energy',
      confidence: 0.72,
      trigger: 'social_active',
      rarity: 'common',
      noveltyScore: 0.45,
    });
  }
  
  // ========== 行业单独推理（优化话术） ==========
  
  if (info.industry && !insights.some(i => i.trigger.includes('combo') || i.trigger.includes('industry'))) {
    if (isTech) {
      insights.push({
        text: isFemale 
          ? `互联网人的节奏感，我猜你连休息都在优化效率——累不累？` 
          : `互联网老炮，效率拉满——不过你是真的喜欢这行还是被裹挟着走？`,
        pillar: 'identity',
        confidence: 0.65,
        trigger: 'industry_tech',
        rarity: 'common',
        noveltyScore: 0.35,
      });
    } else if (isFinance) {
      insights.push({
        text: isFemale 
          ? `金融圈的，数字敏感度拉满——我猜你看什么都在算ROI？` 
          : `金融人，资本嗅觉灵敏——不过你是真的热爱还是为了钱？`,
        pillar: 'identity',
        confidence: 0.65,
        trigger: 'industry_finance',
        rarity: 'common',
        noveltyScore: 0.35,
      });
    } else if (isCreative) {
      insights.push({
        text: isFemale 
          ? `创意人，审美肯定在线——我猜你看到丑东西会生理性不适？` 
          : `设计圈的，艺术细胞爆棚——不过甲方审美让你头疼吗？`,
        pillar: 'identity',
        confidence: 0.65,
        trigger: 'industry_creative',
        rarity: 'common',
        noveltyScore: 0.35,
      });
    } else if (isLaw) {
      insights.push({
        text: isFemale 
          ? `法律人，逻辑严谨——我猜你吵架从来没输过？` 
          : `法律人，思维缜密——不过你是不是连聊天都在找对方漏洞？`,
        pillar: 'identity',
        confidence: 0.65,
        trigger: 'industry_law',
        rarity: 'common',
        noveltyScore: 0.35,
      });
    } else if (isEducation) {
      insights.push({
        text: isFemale 
          ? `教育工作者，耐心和表达能力应该都不错——我猜你解释事情特别清楚？` 
          : `做教育的，有耐心有方法——不过你是温柔派还是严师派？`,
        pillar: 'identity',
        confidence: 0.65,
        trigger: 'industry_edu',
        rarity: 'common',
        noveltyScore: 0.35,
      });
    }
  }
  
  // ========== 温暖兜底（保持安全分） ==========
  
  if (insights.length === 0) {
    if (info.displayName && info.gender) {
      insights.push({
        text: isFemale 
          ? `你给我的感觉挺有意思的，不过信息还不够我看透你——继续聊？` 
          : `初步印象还不错，不过我得再观察观察——继续？`,
        pillar: 'identity',
        confidence: 0.55,
        trigger: 'fallback_warm',
        rarity: 'common',
        noveltyScore: 0.3,
      });
    }
    
    if (info.currentCity && insights.length === 0) {
      insights.push({
        text: isFemale 
          ? `在${cityShort}生活的姐姐，这个城市挺有意思的——你是新来的还是老深圳了？` 
          : `${cityShort}的兄弟，这座城市有它独特的味道——你找到归属感了吗？`,
        pillar: 'identity',
        confidence: 0.55,
        trigger: 'fallback_city',
        rarity: 'common',
        noveltyScore: 0.25,
      });
    }
  }
  
  return insights.filter(i => isSafeInsight(i.text));
}

// ============ 主推理函数 ============

export function generateDynamicInferenceV2(
  info: CollectedInfo, 
  messageCount?: number
): InferenceResult {
  const currentTurn = messageCount ?? 0;
  
  if (currentTurn - cadenceState.lastInsightTurn < cadenceState.cooldownTurns) {
    return { type: 'cooldown', reason: `turn ${currentTurn} still in cooldown` };
  }
  
  const insights = generateInsightsV2(info);
  const availableInsights = insights.filter(i => !cadenceState.shownInsights.has(i.trigger));
  
  if (availableInsights.length === 0) {
    return { type: 'no_match', reason: 'no matching rules for current info' };
  }
  
  availableInsights.sort((a, b) => calculateFinalScore(b) - calculateFinalScore(a));
  const selected = availableInsights[0];
  
  cadenceState.lastInsightTurn = currentTurn;
  cadenceState.shownInsights.add(selected.trigger);
  cadenceState.pillarHistory.push(selected.pillar);
  if (cadenceState.pillarHistory.length > 5) {
    cadenceState.pillarHistory.shift();
  }
  
  return { type: 'success', insight: selected };
}

// ============ 导出测试用函数 ============

export function testGenerateInsightsV2(info: CollectedInfo): FoxInsight[] {
  return generateInsightsV2(info);
}

export { calculateEmotionalRisk, isSafeInsight, resetCadence };
