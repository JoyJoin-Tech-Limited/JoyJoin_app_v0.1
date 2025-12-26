/**
 * 小悦偷偷碎嘴系统 V3.0 - 语义去重优化版
 * 
 * V3.0 核心优化：
 * 1. Levenshtein 语义相似度去重（阻止近似重复，阈值 0.6）
 * 2. 碎片组合生成（prefix + stance + payload + ending 独立随机）
 * 3. 扩展模板变体库（每 trigger 8-12 个变体）
 * 4. 同义词替换池（动态替换关键词）
 * 
 * V2.0 保留优化：
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

// ============ V3 语义去重系统 ============

/**
 * 计算两个字符串的 Levenshtein 距离
 * 用于检测语义相似度
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * 计算归一化相似度 (0-1)
 * 1 = 完全相同, 0 = 完全不同
 */
function normalizedSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

// 语义相似度阈值：超过此值视为"重复"
const SEMANTIC_SIMILARITY_THRESHOLD = 0.6;

/**
 * 检查文本是否与已显示的洞察语义相似
 * 返回 true 表示太相似（应该跳过）
 */
function isSemanticallyDuplicate(text: string, shownInsights: Set<string>): boolean {
  for (const shown of shownInsights) {
    const similarity = normalizedSimilarity(text, shown);
    if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
      console.log(`[GossipV3] 语义去重: "${text.slice(0, 20)}..." 与已显示内容相似度 ${(similarity * 100).toFixed(1)}%`);
      return true;
    }
  }
  return false;
}

// ============ V3 同义词替换池 ============
const SYNONYM_POOLS: Record<string, string[]> = {
  '我猜': ['我估摸', '我觉得', '我看呐', '依我看', '八成是'],
  '应该': ['大概', '估计', '想必', '多半', '看样子'],
  '有点': ['还挺', '蛮', '颇有些', '略微'],
  '不错': ['还行', '可以', '挺好', '不赖'],
  '厉害': ['牛', '强', '666', '有两把刷子'],
  '喜欢': ['爱', '中意', '好这口', '对胃口'],
};

/**
 * 随机替换同义词，增加文本多样性
 */
function applySynonymVariation(text: string): string {
  let result = text;
  for (const [word, synonyms] of Object.entries(SYNONYM_POOLS)) {
    if (result.includes(word) && Math.random() < 0.4) {
      const replacement = synonyms[Math.floor(Math.random() * synonyms.length)];
      result = result.replace(word, replacement);
    }
  }
  return result;
}

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
  triggerUsageCount: Map<string, number>;
  variantIndex: Map<string, number>;
}

const cadenceState: CadenceState = {
  lastInsightTurn: -10,
  shownInsights: new Set(),
  pillarHistory: [],
  cooldownTurns: 3,
  triggerUsageCount: new Map(),
  variantIndex: new Map(),
};

export function resetCadence() {
  cadenceState.lastInsightTurn = -10;
  cadenceState.shownInsights.clear();
  cadenceState.pillarHistory = [];
  cadenceState.triggerUsageCount.clear();
  cadenceState.variantIndex.clear();
}

const TRIGGER_DECAY_FACTOR = 0.85;

function getTriggerBase(trigger: string): string {
  if (trigger.startsWith('combo_outdoor')) return 'combo_outdoor';
  if (trigger.startsWith('combo_food')) return 'combo_food';
  if (trigger.startsWith('combo_music')) return 'combo_music';
  if (trigger.startsWith('combo_deep')) return 'combo_deep';
  if (trigger.startsWith('combo_95')) return 'combo_95';
  if (trigger.startsWith('combo_creative')) return 'combo_creative';
  if (trigger.startsWith('combo_media')) return 'combo_media';
  if (trigger.startsWith('rare_creative')) return 'rare_creative';
  if (trigger.startsWith('legendary_tech')) return 'legendary_tech';
  if (trigger === 'intent_deep') return 'intent_deep';
  if (trigger === 'intent_network') return 'intent_network';
  if (trigger === 'interest_psych') return 'interest_psych';
  
  const triggerMappings: Record<string, string> = {
    'migration': 'hometown_migration',
    'cantonese': 'hometown_cantonese',
    'sichuan': 'hometown_sichuan',
    'dongbei': 'hometown_dongbei',
    'interest_food': 'interest_food',
    'interest_outdoor': 'interest_outdoor',
    'interest_pets': 'interest_pets',
    'interest_music': 'interest_music',
    'interest_travel': 'interest_travel',
    'interest_games': 'interest_games',
    'industry_tech': 'industry_tech',
    'industry_finance': 'industry_finance',
    'industry_creative': 'industry_creative',
    'city_shenzhen': 'city_shenzhen',
    'city_hongkong': 'city_hongkong',
    'intent_friends': 'intent_friends',
    'age_90s': 'age_90s',
    'age_95plus': 'age_95plus',
    'style_introvert': 'style_introvert',
    'style_extrovert': 'style_extrovert',
  };
  
  if (triggerMappings[trigger]) return triggerMappings[trigger];
  
  for (const [key, value] of Object.entries(triggerMappings)) {
    if (trigger.includes(key)) return value;
  }
  
  const parts = trigger.split('_');
  if (parts.length >= 2) {
    return `${parts[0]}_${parts[1]}`;
  }
  return trigger;
}

function getTriggerDampeningPenalty(trigger: string): number {
  const base = getTriggerBase(trigger);
  const usageCount = cadenceState.triggerUsageCount.get(base) || 0;
  if (usageCount === 0) return 0;
  return 1 - Math.pow(TRIGGER_DECAY_FACTOR, usageCount);
}

function incrementTriggerUsage(trigger: string) {
  const base = getTriggerBase(trigger);
  const current = cadenceState.triggerUsageCount.get(base) || 0;
  cadenceState.triggerUsageCount.set(base, current + 1);
}

// ============ 模板变体系统 V2 ============
type TemplateVariant = {
  text: string;
  endingType: keyof typeof SNARKY_ENDINGS;
};

const TEMPLATE_VARIANTS: Record<string, TemplateVariant[]> = {
  'hometown_migration': [
    { text: '从{hometown}漂到{city}，我猜你是个有想法的人', endingType: 'question' },
    { text: '{hometown}人在{city}打拼，这趟旅程不简单吧', endingType: 'curious' },
    { text: '{hometown}到{city}，跨越大半个中国，图的是什么呢', endingType: 'question' },
    { text: '背井离乡从{hometown}来{city}，你一定有故事', endingType: 'tease' },
  ],
  'hometown_cantonese': [
    { text: '本地{genderWord}一枚？在这片土地上扎根挺深吧', endingType: 'question' },
    { text: '广东人留在湾区，有种守护家园的感觉', endingType: 'curious' },
    { text: '老广在{city}，应该有不少私藏的好去处吧', endingType: 'tease' },
  ],
  'hometown_sichuan': [
    { text: '川渝人在{city}，嘴巴肯定还是要吃辣的吧', endingType: 'question' },
    { text: '四川{genderWord}在外闯荡，想家的时候是不是特别馋火锅', endingType: 'tease' },
    { text: '巴蜀之地走出来的人，骨子里都有股闯劲', endingType: 'curious' },
  ],
  'hometown_dongbei': [
    { text: '东北人在南方，冬天是不是终于不用穿秋裤了', endingType: 'tease' },
    { text: '大东北来的？喝酒唠嗑应该是你的强项吧', endingType: 'question' },
    { text: '东北{genderWord}在{city}，有没有觉得这边太温柔了', endingType: 'curious' },
  ],
  'interest_food': [
    { text: '吃货属性已暴露，你的收藏夹里藏了多少餐厅', endingType: 'question' },
    { text: '爱吃的人运气都不会太差，对吧', endingType: 'tease' },
    { text: '美食达人，推荐个私藏店呗', endingType: 'curious' },
    { text: '看来你的快乐很简单——好吃的就行', endingType: 'tease' },
    { text: '探店达人？大众点评应该被你翻烂了', endingType: 'question' },
    { text: '会吃的人往往也会生活，你是不是也这样', endingType: 'curious' },
    { text: '吃货的世界我懂，减肥永远从明天开始', endingType: 'tease' },
    { text: '对美食有追求的人，嘴刁心细', endingType: 'question' },
  ],
  'interest_outdoor': [
    { text: '户外爱好者？你的朋友圈应该全是山和海吧', endingType: 'tease' },
    { text: '爱往外跑的人，办公室是不是困不住你', endingType: 'question' },
    { text: '喜欢户外，看来你不是那种宅得住的人', endingType: 'curious' },
    { text: '户外派，周末的阳光都被你承包了', endingType: 'tease' },
    { text: '爱大自然的人心胸都开阔，你也是吧', endingType: 'question' },
    { text: '徒步露营攀岩，你的装备应该不少吧', endingType: 'curious' },
    { text: '户外达人，体力和毅力都在线', endingType: 'tease' },
  ],
  'interest_pets': [
    { text: '养宠物的人心都软，你是不是也这样', endingType: 'question' },
    { text: '铲屎官一枚？手机相册里主子照片占几成', endingType: 'tease' },
    { text: '有毛孩子陪伴的人，生活多了很多小确幸吧', endingType: 'curious' },
    { text: '看来你家里有个小主子需要伺候', endingType: 'tease' },
  ],
  'interest_music': [
    { text: '爱音乐的人耳朵挑，你的歌单藏着什么宝藏', endingType: 'curious' },
    { text: '音乐爱好者，是听的多还是自己也玩乐器', endingType: 'question' },
    { text: '喜欢音乐的人情感都挺丰富的', endingType: 'tease' },
  ],
  'interest_travel': [
    { text: '旅行爱好者，护照上盖了多少章了', endingType: 'curious' },
    { text: '爱旅行的人都有颗不安分的心', endingType: 'tease' },
    { text: '到处跑的人见识广，下一站去哪', endingType: 'question' },
  ],
  'interest_games': [
    { text: '游戏玩家？你是休闲党还是硬核玩家', endingType: 'question' },
    { text: '爱打游戏的人手速都不错吧', endingType: 'tease' },
    { text: '游戏爱好者，最近在肝什么', endingType: 'curious' },
  ],
  'industry_tech': [
    { text: '科技圈的人，是不是每天都在改变世界', endingType: 'tease' },
    { text: '互联网人，加班应该是家常便饭吧', endingType: 'question' },
    { text: '做技术的，头发还好吧', endingType: 'tease' },
    { text: '科技行业，每天和代码bug打交道', endingType: 'curious' },
    { text: '程序员？咖啡和熬夜是标配吧', endingType: 'question' },
    { text: '互联网卷王，内卷程度几颗星', endingType: 'tease' },
    { text: '科技从业者，逻辑思维应该很强', endingType: 'curious' },
    { text: '做IT的，需求变更是不是你的噩梦', endingType: 'tease' },
  ],
  'industry_finance': [
    { text: '金融人，是不是天天盯盘看K线', endingType: 'question' },
    { text: '做金融的，数字敏感度应该很高吧', endingType: 'tease' },
    { text: '金融圈的，有什么内幕消息不', endingType: 'tease' },
  ],
  'industry_creative': [
    { text: '创意行业的人，脑洞应该很大吧', endingType: 'question' },
    { text: '做设计的，审美眼光肯定毒', endingType: 'tease' },
    { text: '创意工作者，灵感枯竭的时候怎么办', endingType: 'curious' },
  ],
  'city_shenzhen': [
    { text: '在深圳打拼，节奏是不是特别快', endingType: 'question' },
    { text: '深圳人，来了就是深圳人这话你信吗', endingType: 'tease' },
    { text: '深圳这座城市，留住你的是什么', endingType: 'curious' },
    { text: '深圳的夜晚灯火通明，你是不是经常加班到很晚', endingType: 'question' },
    { text: '南山还是福田？深圳的哪个区域是你的主场', endingType: 'curious' },
    { text: '在深圳奋斗，有没有觉得时间过得特别快', endingType: 'tease' },
    { text: '深圳打工人，梦想和现实哪个更重要', endingType: 'question' },
  ],
  'city_hongkong': [
    { text: '在香港生活，中环还是九龙', endingType: 'curious' },
    { text: '港漂一族？粤语说得怎么样了', endingType: 'question' },
    { text: '香港节奏那么快，周末怎么充电', endingType: 'tease' },
  ],
  'intent_friends': [
    { text: '想交朋友？质量重要还是数量重要', endingType: 'question' },
    { text: '想认识新朋友，看来你的社交圈要扩容了', endingType: 'tease' },
    { text: '交友目的很纯粹，我喜欢', endingType: 'curious' },
  ],
  'age_90s': [
    { text: '90后一枚，职场老油条了吧', endingType: 'tease' },
    { text: '90后，上有老下有小的年纪', endingType: 'question' },
    { text: '奔三的人，有没有感觉时间越来越快', endingType: 'curious' },
  ],
  'age_95plus': [
    { text: '95后，职场新生代的主力军', endingType: 'tease' },
    { text: '95后？整顿职场的先锋', endingType: 'question' },
    { text: '年轻人，想法应该很多吧', endingType: 'curious' },
  ],
  'style_introvert': [
    { text: '慢热型？熟了之后话应该很多吧', endingType: 'question' },
    { text: '内向的人观察力都很强', endingType: 'tease' },
    { text: '安静的人往往内心世界很丰富', endingType: 'curious' },
  ],
  'style_extrovert': [
    { text: '外向的人能量感染力强', endingType: 'tease' },
    { text: '社交达人，人脉应该很广吧', endingType: 'question' },
    { text: '活跃分子，聚会的气氛担当', endingType: 'curious' },
  ],
  'intent_deep': [
    { text: '想深度交友？看来你是认真的', endingType: 'curious' },
    { text: '追求深度连接的人，都有故事', endingType: 'tease' },
    { text: '想认真交朋友，不玩虚的对吧', endingType: 'question' },
    { text: '深度社交需求者，眼光挺高的', endingType: 'tease' },
  ],
  'intent_network': [
    { text: '拓展人脉？目标明确的人', endingType: 'curious' },
    { text: '想拓圈子，事业心挺强的', endingType: 'tease' },
    { text: '人脉拓展者，你的微信好友应该不少吧', endingType: 'question' },
  ],
  'interest_psych': [
    { text: '对心理学感兴趣？你是想读懂别人还是读懂自己', endingType: 'question' },
    { text: '心理学爱好者，分析人的小能手吧', endingType: 'tease' },
    { text: '喜欢心理学的人，观察力都很敏锐', endingType: 'curious' },
    { text: '心理学入坑了？MBTI测过几遍了', endingType: 'tease' },
  ],
  'combo_outdoor': [
    { text: '户外+其他爱好，精力挺旺盛的', endingType: 'tease' },
    { text: '户外派，周末应该闲不住', endingType: 'question' },
    { text: '爱户外的人都有颗不安分的心', endingType: 'curious' },
  ],
  'combo_food': [
    { text: '美食相关组合技，嘴挺刁的吧', endingType: 'question' },
    { text: '吃货属性满点，幸福感来得容易', endingType: 'tease' },
    { text: '美食爱好者，胃和心都需要被满足', endingType: 'curious' },
  ],
  'combo_music': [
    { text: '音乐相关，耳朵挺挑的', endingType: 'tease' },
    { text: '音乐爱好者，心思细腻的那种', endingType: 'curious' },
    { text: '爱音乐的人情感都丰富', endingType: 'question' },
  ],
  'combo_deep': [
    { text: '深度爱好组合，看来你不喜欢浅聊', endingType: 'tease' },
    { text: '深度交流型，酒桌上应该有话聊', endingType: 'curious' },
    { text: '喜欢深度内容的人，思考都比较多', endingType: 'question' },
  ],
  'combo_95': [
    { text: '95后组合属性，年轻人想法就是多', endingType: 'tease' },
    { text: '95后的活力，职场新生代的代表', endingType: 'curious' },
    { text: '年轻人配置，卷得动吧', endingType: 'question' },
  ],
  'combo_creative': [
    { text: '创意行业组合，脑洞应该很大', endingType: 'question' },
    { text: '创意人的爱好，审美眼光不一般', endingType: 'tease' },
    { text: '创意从业者，想法总是比较多', endingType: 'curious' },
  ],
  'rare_creative': [
    { text: '创意行业稀有组合，有点意思', endingType: 'curious' },
    { text: '创意人的稀有属性，与众不同', endingType: 'tease' },
    { text: '这个组合不常见，你有点特别', endingType: 'question' },
  ],
  'legendary_tech': [
    { text: '科技圈传说级组合，你这profile有点东西', endingType: 'curious' },
    { text: '程序员的隐藏属性被我发现了', endingType: 'tease' },
    { text: '科技人的反差萌，稀有物种', endingType: 'question' },
  ],
  'combo_media': [
    { text: '传媒行业组合，天天和内容打交道', endingType: 'curious' },
    { text: '媒体人的敏锐度应该很高', endingType: 'tease' },
    { text: '内容行业，创意灵感是日常', endingType: 'question' },
  ],
};

const DYNAMIC_PREFIXES = [
  '哦？', '嗯...', '哈哈', '有意思，', '我看到了，', 
  '等等，', '话说，', '好奇问一下，', '欸？', '嘿！',
  '让我猜猜...', '我发现了，', '原来啊，', '说真的，', '不会吧，',
];

const DYNAMIC_TRANSITIONS = [
  '，感觉', '，看起来', '，估计', '，应该', '，大概',
  '，听上去', '，我觉得', '，不出意外', '，这么看来', '',
];

function selectVariant(trigger: string, info: CollectedInfo): string {
  const variants = TEMPLATE_VARIANTS[trigger];
  if (!variants || variants.length === 0) return '';
  
  const currentIndex = cadenceState.variantIndex.get(trigger) || 0;
  const nextIndex = (currentIndex + 1) % variants.length;
  cadenceState.variantIndex.set(trigger, nextIndex);
  
  const variant = variants[currentIndex];
  let text = variant.text;
  
  const isFemale = info.gender?.includes('女');
  const genderWord = isFemale ? '妹子' : '兄弟';
  const hometownShort = info.hometown?.replace(/省|市|自治区/g, '').slice(0, 2) || '';
  const cityShort = info.currentCity?.replace(/市/g, '') || '';
  
  text = text.replace('{hometown}', hometownShort);
  text = text.replace('{city}', cityShort);
  text = text.replace('{genderWord}', genderWord);
  
  const usePrefixRoll = Math.random();
  if (usePrefixRoll < 0.6) {
    const prefixIdx = Math.floor(Math.random() * DYNAMIC_PREFIXES.length);
    text = DYNAMIC_PREFIXES[prefixIdx] + text;
  }
  
  const useTransitionRoll = Math.random();
  if (useTransitionRoll < 0.4 && !text.includes('，')) {
    const transIdx = Math.floor(Math.random() * DYNAMIC_TRANSITIONS.length);
    const transition = DYNAMIC_TRANSITIONS[transIdx];
    if (transition) {
      const insertPos = Math.floor(text.length * 0.3);
      const beforeComma = text.slice(0, insertPos);
      const afterComma = text.slice(insertPos);
      text = beforeComma + transition + afterComma;
    }
  }
  
  text += getRandomEnding(variant.endingType);
  
  return text;
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
  const triggerPenalty = getTriggerDampeningPenalty(insight.trigger);
  return baseScore + rarityBonus + noveltyBonus - pillarPenalty - triggerPenalty;
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

// ============ 主推理函数 (V3 优化) ============

export function generateDynamicInferenceV2(
  info: CollectedInfo, 
  messageCount?: number
): InferenceResult {
  const currentTurn = messageCount ?? 0;
  
  if (currentTurn - cadenceState.lastInsightTurn < cadenceState.cooldownTurns) {
    return { type: 'cooldown', reason: `turn ${currentTurn} still in cooldown` };
  }
  
  const insights = generateInsightsV2(info);
  
  // V3: 过滤已使用的 trigger（保留原逻辑）
  let availableInsights = insights.filter(i => !cadenceState.shownInsights.has(i.trigger));
  
  if (availableInsights.length === 0) {
    return { type: 'no_match', reason: 'no matching rules for current info' };
  }
  
  // 按分数排序
  availableInsights.sort((a, b) => calculateFinalScore(b) - calculateFinalScore(a));
  
  // V3: 尝试找到一个语义不重复的洞察
  let selected: FoxInsight | null = null;
  
  for (const candidate of availableInsights) {
    const triggerBase = getTriggerBase(candidate.trigger);
    let candidateText = selectVariant(triggerBase, info);
    if (!candidateText) {
      candidateText = candidate.text;
    }
    
    // V3: 应用同义词替换增加多样性
    candidateText = applySynonymVariation(candidateText);
    
    // V3: 语义去重检查
    if (!isSemanticallyDuplicate(candidateText, cadenceState.shownInsights)) {
      selected = { ...candidate, text: candidateText };
      break;
    }
    
    console.log(`[GossipV3] 跳过语义重复: trigger=${candidate.trigger}`);
  }
  
  // 如果所有候选都语义重复，选择分数最高的（应用变体后）
  if (!selected && availableInsights.length > 0) {
    const fallback = availableInsights[0];
    const triggerBase = getTriggerBase(fallback.trigger);
    let fallbackText = selectVariant(triggerBase, info) || fallback.text;
    fallbackText = applySynonymVariation(fallbackText);
    selected = { ...fallback, text: fallbackText };
    console.log(`[GossipV3] 所有候选语义重复，使用 fallback: ${fallback.trigger}`);
  }
  
  if (!selected) {
    return { type: 'no_match', reason: 'no valid insight after semantic dedup' };
  }
  
  incrementTriggerUsage(selected.trigger);
  
  cadenceState.lastInsightTurn = currentTurn;
  // V3: 存储实际文本而非仅 trigger，用于语义比较
  cadenceState.shownInsights.add(selected.trigger);
  cadenceState.shownInsights.add(selected.text); // 新增：存储实际文本
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

export { calculateEmotionalRisk, isSafeInsight };
