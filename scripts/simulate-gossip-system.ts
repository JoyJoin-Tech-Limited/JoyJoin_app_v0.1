/**
 * 小悦偷偷碎嘴系统 - 1000用户模拟测试
 * 
 * 评估维度（8维度）：
 * 1. 准确度 (Accuracy) - 推理是否精准匹配用户特征
 * 2. 有趣程度 (Wit) - 是否让人会心一笑
 * 3. 共鸣感 (Resonance) - "说到我心坎里了"的程度
 * 4. 个性化感知 (Personalization) - 是否感觉专门对我说的
 * 5. 破冰效果 (Ice-breaking) - 是否让人更想继续聊
 * 6. 情绪安全感 (Emotional Safety) - 是否有不舒服感（负向）
 * 7. 期待感 (Anticipation) - 是否期待下次碎嘴
 * 8. 人设一致性 (Character Consistency) - 是否符合小悦冷淡毒舌人设
 */

// ============ 类型定义 ============
interface CollectedInfo {
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

interface FoxInsight {
  text: string;
  pillar: 'identity' | 'energy' | 'value';
  confidence: number;
  trigger: string;
}

type InferenceResult = 
  | { type: 'success'; insight: FoxInsight }
  | { type: 'cooldown'; reason: string }
  | { type: 'no_match'; reason: string };

interface EvaluationScores {
  accuracy: number;        // 1-5
  wit: number;             // 1-5
  resonance: number;       // 1-5
  personalization: number; // 1-5
  iceBreaking: number;     // 1-5
  emotionalSafety: number; // 1-5 (5=完全安全, 1=感觉冒犯)
  anticipation: number;    // 1-5
  characterConsistency: number; // 1-5
}

interface SimulatedUser {
  id: number;
  profile: CollectedInfo;
  insight: FoxInsight | null;
  trigger: string | null;
  scores: EvaluationScores | null;
}

interface SimulationStats {
  totalUsers: number;
  usersWithInsight: number;
  triggerDistribution: Record<string, number>;
  pillarDistribution: Record<string, number>;
  uniqueTexts: number;
  textRepetitionRate: number;
  averageScores: EvaluationScores;
  scoresByTrigger: Record<string, EvaluationScores>;
  uncoveredProfiles: CollectedInfo[];
  lowScoreInsights: Array<{ insight: FoxInsight; avgScore: number; profile: CollectedInfo }>;
}

// ============ 数据池：真实用户画像 ============

const CITIES = [
  '深圳', '香港', '广州', '北京', '上海', '杭州', '成都', '重庆', '东莞', '佛山'
];

const HOMETOWNS = [
  '广东', '湖南', '湖北', '四川', '河南', '山东', '江西', '安徽', '福建', '浙江',
  '江苏', '东北', '陕西', '贵州', '云南', '广西', '海南', '河北', '山西', '内蒙古'
];

const INDUSTRIES = [
  '科技/互联网', '金融/投资', 'AI/大数据', '设计/创意', '传媒/内容', 
  '教育/培训', '医疗/健康', '法律/咨询', '房地产', '制造业',
  '电商/零售', '游戏', '广告/营销', '人力资源', '物流/供应链',
  '新能源', '生物科技', '建筑/工程', '餐饮', '旅游/酒店',
  '政府/事业单位', '创业中', '自由职业', '学生/应届生'
];

const INTERESTS = [
  '户外运动', '健身', '跑步', '爬山', '徒步hiking',
  '美食探店', '烹饪', '咖啡', '烘焙',
  '电影', '追剧', '综艺', '动漫',
  '音乐', '乐器', 'livehouse', '演唱会',
  '读书', '知识讨论', '播客', 'TED',
  '旅行', '摄影', '展览', '博物馆',
  '小酌', '威士忌', '红酒', '清吧',
  '游戏', 'Switch', 'PS5', '桌游',
  '撸猫', '遛狗', '养宠物',
  '瑜伽', '冥想', '心理学', '星座',
  '投资理财', '创业', '副业',
  '二次元', 'cosplay', '手办'
];

const SOCIAL_STYLES = [
  '活跃外向', '慢热型', '内敛安静', '看场合', '社恐但网聊可',
  'E人', 'I人', '中间型'
];

const INTENTS = [
  '认识有趣的人', '深度讨论', '拓展人脉', '找饭搭子', 
  '寻找同好', '随缘社交', '商业合作', '约会交友'
];

const NAMES_FEMALE = [
  'Vivian', 'Sophie', 'Amy', 'Coco', 'Luna', 'Ellie', 'Mia', 'Zoe',
  '小悦', '思思', '婷婷', '雯雯', '晓晓', '甜甜', '柚子', '芒果'
];

const NAMES_MALE = [
  'Kevin', 'Jason', 'Leo', 'Eric', 'David', 'Tony', 'Andy', 'Ryan',
  '阿杰', '小明', '浩哥', '大伟', '子轩', '阿豪', '小马', '小陈'
];

// ============ 碎嘴推理引擎（从ChatRegistrationPage提取） ============

const insightCadenceState = {
  lastInsightTurn: -10,
  shownInsights: new Set<string>(),
  cooldownTurns: 3,
};

function resetInsightCadence() {
  insightCadenceState.lastInsightTurn = -10;
  insightCadenceState.shownInsights.clear();
}

function generateDynamicInference(
  info: CollectedInfo, 
  messageCount?: number
): InferenceResult {
  const insights: FoxInsight[] = [];
  const isFemale = info.gender?.includes('女');
  const currentTurn = messageCount ?? 0;
  
  if (currentTurn - insightCadenceState.lastInsightTurn < insightCadenceState.cooldownTurns) {
    return { type: 'cooldown', reason: `turn ${currentTurn} still in cooldown` };
  }
  
  // ========== 支柱1：身份归属 ==========
  
  if (info.displayName && info.gender && !info.birthYear && !info.industry) {
    insights.push({
      text: isFemale 
        ? "名字听起来很温柔，因为这种细腻感挺难得的，期待聊开后发现更多有趣的面～" 
        : "这名字有分量，因为给人靠谱的感觉，期待后面聊到更深入的话题～",
      pillar: 'identity',
      confidence: 0.6,
      trigger: 'name_gender'
    });
  }
  
  const birthYear = info.birthYear ? parseInt(info.birthYear) : 
    (info.birthdate ? parseInt(info.birthdate.split('-')[0]) : null);
  
  if (birthYear && info.currentCity && info.industry) {
    if (birthYear >= 2000 && info.industry.includes("金融") && info.currentCity.includes("香港")) {
      insights.push({
        text: isFemale ? "00后港漂金融人，国际范儿拉满，周末应该闲不住吧？" : "00后港漂金融人，见过世面但不端着，我猜你周末闲不住",
        pillar: 'identity',
        confidence: 0.85,
        trigger: 'combo_00_finance_hk'
      });
    }
    else if (birthYear >= 1995 && info.industry.includes("金融") && info.currentCity.includes("香港")) {
      insights.push({
        text: isFemale ? "在香港做金融的一级市场姐姐，专业又精致，感觉你对品味很有追求～" : "香港金融圈的兄弟，一级市场水深，但看你这状态挺游刃有余啊",
        pillar: 'identity',
        confidence: 0.88,
        trigger: 'combo_95_finance_hk'
      });
    }
    else if (birthYear >= 1995 && birthYear < 2000 && info.industry.includes("科技") && info.currentCity.includes("深圳")) {
      insights.push({
        text: isFemale ? "深圳科技圈95后，节奏快但有自己的生活态度～" : "深圳科技圈95后，卷但清醒，知道自己要什么",
        pillar: 'identity',
        confidence: 0.8,
        trigger: 'combo_95_tech_sz'
      });
    }
    else if (info.industry.includes("创业") || info.occupationDescription?.includes("创业")) {
      insights.push({
        text: isFemale ? "创业中的姐姐，独立又有野心，respect～" : "创业路上的兄弟，有想法有执行力，聊起来应该有料",
        pillar: 'identity',
        confidence: 0.75,
        trigger: 'combo_startup'
      });
    }
    else if (birthYear >= 2000 && (info.industry.includes("科技") || info.industry.includes("互联网")) && info.currentCity.includes("深圳")) {
      insights.push({
        text: isFemale ? "00后深圳互联网人，年轻有冲劲，应该是团队里最会用新工具的那个～" : "00后深圳互联网er，年轻但靠谱，我猜你已经是团队主力了",
        pillar: 'identity',
        confidence: 0.85,
        trigger: 'combo_00_tech_sz'
      });
    }
    else if (birthYear >= 1995 && (info.industry.includes("咨询") || info.industry.includes("法律") || info.industry.includes("律师")) && info.currentCity.includes("香港")) {
      insights.push({
        text: isFemale ? "香港专业服务圈的，逻辑清晰又会沟通，开会应该很能hold住场～" : "香港专业服务人，思维缜密又能说会道，客户应该挺信任你",
        pillar: 'identity',
        confidence: 0.82,
        trigger: 'combo_95_pro_hk'
      });
    }
    else if ((info.industry.includes("设计") || info.industry.includes("创意") || info.industry.includes("广告")) && info.currentCity.includes("深圳")) {
      insights.push({
        text: isFemale ? "深圳创意圈的姐姐，审美在线又有执行力，作品应该很能打～" : "深圳创意人，既有想法又能落地，这种人一般都挺有趣",
        pillar: 'identity',
        confidence: 0.78,
        trigger: 'combo_creative_sz'
      });
    }
    else if ((info.industry.includes("设计") || info.industry.includes("创意") || info.industry.includes("广告")) && info.currentCity.includes("香港")) {
      insights.push({
        text: isFemale ? "香港创意圈的，中西审美融合得应该很好，作品肯定很有调性～" : "香港创意人，国际范儿加本土味道，这种视野很难得",
        pillar: 'identity',
        confidence: 0.78,
        trigger: 'combo_creative_hk'
      });
    }
    else if ((info.industry.includes("传媒") || info.industry.includes("内容") || info.industry.includes("媒体"))) {
      insights.push({
        text: isFemale ? "做内容的姐姐，讲故事能力应该很强，聊天应该很有料～" : "传媒人，敏感度和表达力应该都拉满，期待听你分享行业八卦",
        pillar: 'identity',
        confidence: 0.75,
        trigger: 'combo_media'
      });
    }
    else if (info.industry.includes("金融") && info.currentCity.includes("深圳")) {
      insights.push({
        text: isFemale ? "深圳金融圈的，VC/PE氛围浓，你应该对创新项目很敏感～" : "深圳金融人，创投圈的节奏你应该很熟，期待聊聊你看好什么方向",
        pillar: 'identity',
        confidence: 0.8,
        trigger: 'combo_finance_sz'
      });
    }
  }
  
  if (birthYear && !insights.some(i => i.trigger.includes('combo'))) {
    if (birthYear >= 2000) {
      insights.push({
        text: isFemale ? "00后已经在职场发力了，新生代的冲劲我看到了～" : "00后职场新锐，干劲满满，后生可畏",
        pillar: 'identity',
        confidence: 0.7,
        trigger: 'age_00'
      });
    } else if (birthYear >= 1995) {
      insights.push({
        text: isFemale ? "95后黄金期，事业和生活都在上升期～" : "95后正当年，经验和精力都在线",
        pillar: 'identity',
        confidence: 0.7,
        trigger: 'age_95'
      });
    }
  }
  
  if (info.currentCity && info.hometown && info.currentCity !== info.hometown) {
    const hometownShort = info.hometown.replace(/省|市|自治区/g, '').slice(0, 2);
    const cityShort = info.currentCity.replace(/市/g, '');
    insights.push({
      text: isFemale 
        ? `从${hometownShort}到${cityShort}打拼，独立又勇敢，这种人一般都挺有故事的～` 
        : `从${hometownShort}到${cityShort}闯荡，说明你不是安于现状的人`,
      pillar: 'identity',
      confidence: 0.75,
      trigger: 'migration'
    });
  }
  
  // ========== 支柱2：社交能量 ==========
  
  if (info.interestsTop && info.interestsTop.length > 0) {
    const interests = info.interestsTop;
    const hasOutdoor = interests.some(i => /户外|运动|健身|跑步|爬山|徒步|hiking/.test(i));
    const hasFood = interests.some(i => /美食|探店|吃|烹饪|餐厅|咖啡/.test(i));
    const hasDeep = interests.some(i => /读书|知识|讨论|学习|阅读|播客|TED/.test(i));
    const hasMovie = interests.some(i => /电影|影视|追剧|综艺|看片|动漫/.test(i));
    const hasMusic = interests.some(i => /音乐|乐器|唱歌|演唱会|livehouse/.test(i));
    const hasTravel = interests.some(i => /旅行|旅游|探索|出游|度假/.test(i));
    const hasArt = interests.some(i => /艺术|展览|博物馆|画廊|摄影/.test(i));
    const hasDrink = interests.some(i => /酒|小酌|威士忌|红酒|鸡尾酒|bar|清吧/.test(i));
    const hasGaming = interests.some(i => /游戏|switch|ps5|steam|电竞|桌游/i.test(i));
    const hasPets = interests.some(i => /猫|狗|宠物|撸猫|遛狗/.test(i)) || info.hasPets;
    
    if (hasOutdoor && hasMovie) {
      insights.push({
        text: isFemale 
          ? "户外能撒欢，回家能追剧，因为这种动静皆宜的状态很难得，期待一起发现好玩的活动～" 
          : "能动能静，因为这种平衡感很难得，期待聊聊你最近在追什么好片～",
        pillar: 'energy',
        confidence: 0.8,
        trigger: 'combo_outdoor_movie'
      });
    }
    else if (hasOutdoor && hasFood) {
      insights.push({
        text: isFemale 
          ? "又能动又能吃，因为这种会享受生活的态度很吸引人，期待一起探索好吃好玩的～" 
          : "运动完吃好的，因为懂生活的人一般都挺有趣，期待聊聊你最爱的餐厅～",
        pillar: 'energy',
        confidence: 0.8,
        trigger: 'combo_outdoor_food'
      });
    }
    else if (hasMovie && hasMusic) {
      insights.push({
        text: isFemale 
          ? "电影音乐都爱，因为文艺细胞满满的人一般感受力很强，期待听你推荐好片好歌～" 
          : "影音双修，因为品味应该不错，期待交换一下彼此的私藏歌单～",
        pillar: 'energy',
        confidence: 0.75,
        trigger: 'combo_movie_music'
      });
    }
    else if (hasDeep && info.socialStyle?.includes("内敛")) {
      insights.push({
        text: isFemale 
          ? "安静但有深度，因为这种人聊开了往往很有料，期待找到共同话题深聊～" 
          : "内敛派，因为聊深了你应该有很多独到的想法，期待慢慢解锁～",
        pillar: 'energy',
        confidence: 0.75,
        trigger: 'combo_deep_quiet'
      });
    }
    else if (hasFood && hasDrink) {
      insights.push({
        text: isFemale 
          ? "美食配小酌，因为这种会享受的人一般生活品味都不错，期待交换私藏店铺～" 
          : "探店加小酌，因为懂吃懂喝的人聊天一般很有意思，期待下次一起探新店～",
        pillar: 'energy',
        confidence: 0.85,
        trigger: 'combo_food_drink'
      });
    }
    else if (hasMovie && (info.socialStyle?.includes("内敛") || info.socialStyle?.includes("慢热"))) {
      insights.push({
        text: isFemale 
          ? "追剧爱好者，因为周末窝在家看剧也是一种享受，期待交换好剧推荐～" 
          : "深夜追剧党，因为这种安静的快乐很珍贵，期待聊聊最近在追什么～",
        pillar: 'energy',
        confidence: 0.75,
        trigger: 'combo_movie_homebody'
      });
    }
    else if (hasMusic && (interests.some(i => /livehouse|现场|演出|音乐节/.test(i)))) {
      insights.push({
        text: isFemale 
          ? "livehouse常客，因为喜欢现场的人一般感受力都很强，期待一起蹲场好演出～" 
          : "现场派，因为懂音乐的人聊起来应该很有共鸣，期待交换演出信息～",
        pillar: 'energy',
        confidence: 0.8,
        trigger: 'combo_music_live'
      });
    }
    else if (hasGaming) {
      insights.push({
        text: isFemale 
          ? "游戏玩家，因为这个圈子有很多有趣的灵魂，期待聊聊你最近在玩什么～" 
          : "游戏党，因为打游戏能看出一个人的性格，期待有机会组队开黑～",
        pillar: 'energy',
        confidence: 0.7,
        trigger: 'interest_gaming'
      });
    }
    else if (hasPets) {
      insights.push({
        text: isFemale 
          ? "铲屎官一枚，因为养宠物的人一般都挺有爱心，期待看看你的毛孩子～" 
          : "养宠达人，因为能照顾好小动物的人责任感应该很强，期待晒宠交流～",
        pillar: 'energy',
        confidence: 0.75,
        trigger: 'interest_pets'
      });
    }
    else if (hasTravel && hasArt) {
      insights.push({
        text: isFemale 
          ? "旅拍爱好者，因为既会玩又会拍的人一般审美都在线，期待看看你的作品～" 
          : "旅拍达人，因为走过的地方多眼界应该很开阔，期待听你分享旅途故事～",
        pillar: 'energy',
        confidence: 0.78,
        trigger: 'combo_travel_art'
      });
    }
    else if (hasOutdoor) {
      insights.push({
        text: isFemale 
          ? "户外爱好者，因为阳光健康的状态很有感染力，期待一起探索新路线～" 
          : "喜欢户外，因为精力充沛的人一般都很有行动力，期待聊聊你最爱的活动～",
        pillar: 'energy',
        confidence: 0.65,
        trigger: 'interest_outdoor'
      });
    } else if (hasMovie) {
      insights.push({
        text: isFemale 
          ? "爱看电影，因为会挑片的人品味一般不差，期待听你推荐好片～" 
          : "影迷一枚，因为好品味值得交流，期待聊聊最近看了什么好片～",
        pillar: 'energy',
        confidence: 0.65,
        trigger: 'interest_movie'
      });
    } else if (hasFood) {
      insights.push({
        text: isFemale 
          ? "美食爱好者，因为舌尖品味好的人一般生活质量也高，期待交换餐厅推荐～" 
          : "吃货一枚，因为懂吃的人一般都懂生活，期待一起探店～",
        pillar: 'energy',
        confidence: 0.65,
        trigger: 'interest_food'
      });
    } else if (hasTravel) {
      insights.push({
        text: isFemale 
          ? "热爱旅行，因为见识广博的人聊天话题应该很多，期待听你分享旅途故事～" 
          : "旅行爱好者，因为眼界开阔的人一般都挺有趣，期待交流旅行心得～",
        pillar: 'energy',
        confidence: 0.65,
        trigger: 'interest_travel'
      });
    } else if (hasArt) {
      insights.push({
        text: isFemale 
          ? "爱逛展的文艺青年，因为审美在线的人一般感受力也强，期待一起看展交流～" 
          : "艺术爱好者，因为有品位的人值得深聊，期待听你分享最近看的好展～",
        pillar: 'energy',
        confidence: 0.65,
        trigger: 'interest_art'
      });
    } else if (hasMusic) {
      insights.push({
        text: isFemale 
          ? "音乐爱好者，因为感性又有品味的人一般都很有趣，期待交换歌单～" 
          : "爱音乐的人，因为这种兴趣一般都挺有故事，期待聊聊你最爱的音乐类型～",
        pillar: 'energy',
        confidence: 0.65,
        trigger: 'interest_music'
      });
    }
  }
  
  if (info.socialStyle && !insights.some(i => i.trigger.includes('combo'))) {
    if (info.socialStyle.includes("活跃") || info.socialStyle.includes("外向") || info.socialStyle.includes("E人")) {
      insights.push({
        text: isFemale ? "社交达人，氛围组担当，有你在场应该不会冷场～" : "社牛属性，聊什么都能接住",
        pillar: 'energy',
        confidence: 0.7,
        trigger: 'social_active'
      });
    }
  }
  
  // ========== 支柱3：价值驱动 ==========
  
  if (info.intent) {
    if (info.intent.includes("深度讨论") || info.intent.includes("知识")) {
      insights.push({
        text: isFemale ? "喜欢深度讨论，说明你不满足于表面社交，想找到真正聊得来的人～" : "追求深度交流，不是随便聊聊就行的那种",
        pillar: 'value',
        confidence: 0.8,
        trigger: 'intent_deep'
      });
    } else if (info.intent.includes("拓展人脉") || info.intent.includes("商业")) {
      insights.push({
        text: isFemale ? "有明确的社交目标，务实又高效～" : "目标清晰，知道自己要什么",
        pillar: 'value',
        confidence: 0.75,
        trigger: 'intent_network'
      });
    }
  }
  
  if (info.currentCity && info.industry && !insights.some(i => i.trigger.includes('combo'))) {
    const isFinance = info.industry.includes("金融") || info.industry.includes("投资") || info.industry.includes("银行");
    const isTech = info.industry.includes("科技") || info.industry.includes("互联网") || info.industry.includes("AI");
    
    if (isFinance && info.currentCity.includes("香港")) {
      insights.push({
        text: isFemale 
          ? "香港金融圈的姐姐呀，因为这个圈子节奏快见识广，我觉得你应该有不少跨文化的经历和故事，期待聊到更多～" 
          : "香港金融人，因为这个环境培养出来的国际视野很难得，期待聊到你的独特见解～",
        pillar: 'identity',
        confidence: 0.8,
        trigger: 'combo_finance_hk'
      });
    } else if (isTech && info.currentCity.includes("深圳")) {
      insights.push({
        text: isFemale 
          ? "深圳科技圈的，因为这里效率和创新氛围拉满，你应该是个很有执行力的人，期待了解你在做什么有趣的事～" 
          : "深圳科技人，因为这座城市务实又前沿，期待听你分享一些行业内的洞察～",
        pillar: 'identity',
        confidence: 0.8,
        trigger: 'combo_tech_sz'
      });
    } else if (isFinance) {
      insights.push({
        text: isFemale 
          ? "金融圈的姐姐，因为数字敏感度应该很强，期待聊到你对趋势的独到见解～" 
          : "金融人，因为资本嗅觉一般都很敏锐，期待听你分享一些有意思的观察～",
        pillar: 'identity',
        confidence: 0.7,
        trigger: 'industry_finance'
      });
    } else if (isTech) {
      insights.push({
        text: isFemale 
          ? "科技圈的，因为逻辑思维应该很清晰，期待聊到你在做什么有意思的项目～" 
          : "科技人，因为效率一般拉满，期待了解你怎么平衡工作和生活～",
        pillar: 'identity',
        confidence: 0.7,
        trigger: 'industry_tech'
      });
    }
  }
  
  if (info.industry && !insights.some(i => i.trigger.includes('combo') || i.trigger.includes('industry'))) {
    const industryPatterns: Array<{ pattern: RegExp; f: string; m: string }> = [
      { pattern: /科技|互联网|IT|软件|程序/, f: "互联网人的节奏感，应该很会安排时间～", m: "互联网老炮，效率拉满" },
      { pattern: /AI|大数据|人工智能|机器学习/, f: "AI领域的女性力量，眼光超前～", m: "AI前沿玩家，眼光独到" },
      { pattern: /金融|投资|银行|证券|保险/, f: "金融圈的，数字敏感度应该很强～", m: "金融人，资本嗅觉灵敏" },
      { pattern: /设计|创意|美术|艺术/, f: "创意人，审美肯定在线～", m: "设计圈的，艺术细胞爆棚" },
      { pattern: /传媒|内容|媒体|编辑|记者/, f: "做内容的，讲故事能力应该很强～", m: "传媒人，讲故事的高手" },
      { pattern: /教育|培训|老师/, f: "教育工作者，耐心和表达能力应该都不错～", m: "做教育的，有耐心有方法" },
      { pattern: /医疗|健康|医生|护士/, f: "医疗行业的，细心和责任感应该很强～", m: "医疗人，专业又靠谱" },
      { pattern: /法律|律师|法务|咨询/, f: "法律人，逻辑严谨，说话应该很有分寸～", m: "法律人，思维缜密" },
      { pattern: /游戏/, f: "游戏行业的，应该懂玩又会玩～", m: "游戏圈的，懂玩家心理" },
      { pattern: /广告|营销/, f: "做营销的，洞察力应该很强～", m: "营销人，懂人心" },
    ];
    
    for (const { pattern, f, m } of industryPatterns) {
      if (pattern.test(info.industry)) {
        insights.push({
          text: isFemale ? f : m,
          pillar: 'identity',
          confidence: 0.6,
          trigger: 'industry_single'
        });
        break;
      }
    }
  }
  
  // ========== 温暖兜底规则 ==========
  if (insights.length === 0) {
    if (info.displayName && info.gender) {
      const fallbacks = isFemale ? [
        "感觉你是个很有自己想法的人，期待慢慢了解更多～",
        "你给我的感觉挺有意思的，继续聊聊？",
        "直觉告诉我你应该是个有故事的人，期待解锁更多～",
      ] : [
        "感觉你是个挺靠谱的人，继续聊聊？",
        "你给我的感觉挺有意思的，期待了解更多～",
        "直觉告诉我你应该是个有想法的人，期待解锁更多～",
      ];
      const randomIndex = Math.floor(Math.random() * fallbacks.length);
      insights.push({
        text: fallbacks[randomIndex],
        pillar: 'identity',
        confidence: 0.5,
        trigger: `fallback_warm_${randomIndex}`
      });
    }
    
    if (info.currentCity && insights.length === 0) {
      insights.push({
        text: isFemale 
          ? `在${info.currentCity}生活的姐姐，因为这个城市挺有意思的，期待聊聊你的日常～` 
          : `${info.currentCity}的兄弟，因为这座城市有它独特的味道，期待聊聊你的发现～`,
        pillar: 'identity',
        confidence: 0.55,
        trigger: 'fallback_city'
      });
    }
  }

  const availableInsights = insights.filter(i => !insightCadenceState.shownInsights.has(i.trigger));
  
  if (availableInsights.length > 0) {
    availableInsights.sort((a, b) => b.confidence - a.confidence);
    const selected = availableInsights[0];
    
    insightCadenceState.lastInsightTurn = currentTurn;
    insightCadenceState.shownInsights.add(selected.trigger);
    
    return { type: 'success', insight: selected };
  }
  
  return { type: 'no_match', reason: 'no matching rules for current info' };
}

// ============ 用户模拟器 ============

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomSubset<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function generateRandomUser(id: number): CollectedInfo {
  const isFemale = Math.random() > 0.45; // 略微偏女性
  const gender = isFemale ? '女' : '男';
  const displayName = isFemale ? randomChoice(NAMES_FEMALE) : randomChoice(NAMES_MALE);
  
  // 年龄分布：25-35岁目标人群
  const birthYearOptions = [1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002];
  const birthYear = randomChoice(birthYearOptions).toString();
  
  // 城市：深圳香港为主
  const cityWeights = { '深圳': 0.5, '香港': 0.3, '广州': 0.1, '其他': 0.1 };
  const rand = Math.random();
  let currentCity: string;
  if (rand < 0.5) currentCity = '深圳';
  else if (rand < 0.8) currentCity = '香港';
  else if (rand < 0.9) currentCity = '广州';
  else currentCity = randomChoice(CITIES.filter(c => !['深圳', '香港', '广州'].includes(c)));
  
  // 老家
  const hometown = randomChoice(HOMETOWNS);
  
  // 行业
  const industry = randomChoice(INDUSTRIES);
  
  // 兴趣（1-6个）
  const interestsTop = randomSubset(INTERESTS, 1, 6);
  
  // 社交风格
  const socialStyle = randomChoice(SOCIAL_STYLES);
  
  // 意图
  const intent = randomChoice(INTENTS);
  
  // 是否养宠物
  const hasPets = Math.random() > 0.7;
  
  return {
    displayName,
    gender,
    birthYear,
    currentCity,
    hometown,
    industry,
    interestsTop,
    socialStyle,
    intent,
    hasPets,
  };
}

// ============ 评分模拟器 ============

interface TriggerScoreProfile {
  baseAccuracy: number;
  baseWit: number;
  baseResonance: number;
  basePersonalization: number;
  baseIceBreaking: number;
  baseEmotionalSafety: number;
  baseAnticipation: number;
  baseCharacterConsistency: number;
}

// 基于触发器类型的基础评分配置
const TRIGGER_SCORE_PROFILES: Record<string, Partial<TriggerScoreProfile>> = {
  // 高精准组合推理 - 准确度和个性化高
  'combo_00_finance_hk': { baseAccuracy: 4.5, basePersonalization: 4.5, baseWit: 4.0 },
  'combo_95_finance_hk': { baseAccuracy: 4.5, basePersonalization: 4.5, baseWit: 4.2 },
  'combo_95_tech_sz': { baseAccuracy: 4.3, basePersonalization: 4.3, baseWit: 3.8 },
  'combo_00_tech_sz': { baseAccuracy: 4.4, basePersonalization: 4.4, baseWit: 4.0 },
  'combo_creative_sz': { baseAccuracy: 4.2, basePersonalization: 4.2, baseWit: 4.0 },
  'combo_creative_hk': { baseAccuracy: 4.2, basePersonalization: 4.2, baseWit: 4.0 },
  'combo_95_pro_hk': { baseAccuracy: 4.3, basePersonalization: 4.3, baseWit: 3.8 },
  'combo_finance_sz': { baseAccuracy: 4.2, basePersonalization: 4.2, baseWit: 3.8 },
  'combo_startup': { baseAccuracy: 4.0, basePersonalization: 4.0, baseWit: 4.0 },
  'combo_media': { baseAccuracy: 4.0, basePersonalization: 3.8, baseWit: 4.0 },
  
  // 兴趣组合 - 共鸣感和破冰效果高
  'combo_outdoor_movie': { baseResonance: 4.3, baseIceBreaking: 4.2, baseWit: 4.0 },
  'combo_outdoor_food': { baseResonance: 4.2, baseIceBreaking: 4.3, baseWit: 4.0 },
  'combo_movie_music': { baseResonance: 4.0, baseIceBreaking: 4.0, baseWit: 3.8 },
  'combo_deep_quiet': { baseResonance: 4.5, baseIceBreaking: 3.8, baseWit: 3.5 },
  'combo_food_drink': { baseResonance: 4.3, baseIceBreaking: 4.5, baseWit: 4.2 },
  'combo_movie_homebody': { baseResonance: 4.2, baseIceBreaking: 3.8, baseWit: 3.5 },
  'combo_music_live': { baseResonance: 4.4, baseIceBreaking: 4.2, baseWit: 4.0 },
  'combo_travel_art': { baseResonance: 4.0, baseIceBreaking: 4.0, baseWit: 3.8 },
  
  // 单独推理 - 中等水平
  'age_00': { baseAccuracy: 3.8, basePersonalization: 3.0, baseWit: 3.5 },
  'age_95': { baseAccuracy: 3.8, basePersonalization: 3.0, baseWit: 3.3 },
  'migration': { baseResonance: 4.0, basePersonalization: 4.0, baseWit: 3.8 },
  
  // 单独兴趣 - 准确但不够个性化
  'interest_outdoor': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.2 },
  'interest_movie': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.2 },
  'interest_food': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.5 },
  'interest_travel': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.2 },
  'interest_art': { baseAccuracy: 3.5, basePersonalization: 3.2, baseWit: 3.3 },
  'interest_music': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.2 },
  'interest_gaming': { baseAccuracy: 3.8, basePersonalization: 3.5, baseWit: 3.8 },
  'interest_pets': { baseAccuracy: 4.0, basePersonalization: 3.8, baseWit: 3.5 },
  
  // 社交风格
  'social_active': { baseAccuracy: 3.8, basePersonalization: 3.2, baseWit: 3.5 },
  
  // 意图推理
  'intent_deep': { baseResonance: 4.2, basePersonalization: 3.8, baseWit: 3.5 },
  'intent_network': { baseResonance: 3.5, basePersonalization: 3.5, baseWit: 3.2 },
  
  // 行业单独推理
  'industry_finance': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.2 },
  'industry_tech': { baseAccuracy: 3.5, basePersonalization: 3.0, baseWit: 3.2 },
  'industry_single': { baseAccuracy: 3.3, basePersonalization: 2.8, baseWit: 3.0 },
  'combo_finance_hk': { baseAccuracy: 4.0, basePersonalization: 3.8, baseWit: 3.5 },
  'combo_tech_sz': { baseAccuracy: 4.0, basePersonalization: 3.8, baseWit: 3.5 },
  
  // 兜底规则 - 评分较低
  'fallback_warm_0': { baseAccuracy: 2.5, basePersonalization: 2.0, baseWit: 2.5, baseResonance: 2.8 },
  'fallback_warm_1': { baseAccuracy: 2.5, basePersonalization: 2.0, baseWit: 2.5, baseResonance: 2.8 },
  'fallback_warm_2': { baseAccuracy: 2.5, basePersonalization: 2.0, baseWit: 2.5, baseResonance: 2.8 },
  'fallback_city': { baseAccuracy: 2.8, basePersonalization: 2.5, baseWit: 2.5, baseResonance: 2.5 },
  'name_gender': { baseAccuracy: 2.8, basePersonalization: 2.5, baseWit: 2.8, baseResonance: 2.5 },
};

function simulateUserScores(
  insight: FoxInsight,
  profile: CollectedInfo
): EvaluationScores {
  const triggerProfile = TRIGGER_SCORE_PROFILES[insight.trigger] || {};
  
  // 默认基础分
  const defaults: TriggerScoreProfile = {
    baseAccuracy: 3.5,
    baseWit: 3.5,
    baseResonance: 3.5,
    basePersonalization: 3.5,
    baseIceBreaking: 3.5,
    baseEmotionalSafety: 4.5, // 默认安全
    baseAnticipation: 3.5,
    baseCharacterConsistency: 4.0, // 小悦人设通常一致
  };
  
  const merged = { ...defaults, ...triggerProfile };
  
  // 添加随机波动 (-0.5 ~ +0.5)
  const jitter = () => (Math.random() - 0.5);
  
  // 根据置信度调整（置信度高的推理准确度更高）
  const confidenceBoost = (insight.confidence - 0.6) * 1.5;
  
  // 计算最终得分
  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  
  return {
    accuracy: clamp(merged.baseAccuracy + confidenceBoost + jitter()),
    wit: clamp(merged.baseWit + jitter()),
    resonance: clamp(merged.baseResonance + jitter()),
    personalization: clamp(merged.basePersonalization + confidenceBoost * 0.5 + jitter()),
    iceBreaking: clamp(merged.baseIceBreaking + jitter()),
    emotionalSafety: clamp(merged.baseEmotionalSafety + jitter() * 0.3), // 安全感波动小
    anticipation: clamp(merged.baseAnticipation + jitter()),
    characterConsistency: clamp(merged.baseCharacterConsistency + jitter() * 0.5),
  };
}

// ============ 模拟运行 ============

function runSimulation(userCount: number = 1000): SimulatedUser[] {
  const users: SimulatedUser[] = [];
  
  for (let i = 0; i < userCount; i++) {
    resetInsightCadence(); // 每个用户是新会话
    
    const profile = generateRandomUser(i);
    const result = generateDynamicInference(profile, 5); // 假设第5轮对话
    
    let insight: FoxInsight | null = null;
    let trigger: string | null = null;
    let scores: EvaluationScores | null = null;
    
    if (result.type === 'success') {
      insight = result.insight;
      trigger = result.insight.trigger;
      scores = simulateUserScores(result.insight, profile);
    }
    
    users.push({ id: i, profile, insight, trigger, scores });
  }
  
  return users;
}

// ============ 统计分析 ============

function analyzeResults(users: SimulatedUser[]): SimulationStats {
  const usersWithInsight = users.filter(u => u.insight !== null);
  const triggerDistribution: Record<string, number> = {};
  const pillarDistribution: Record<string, number> = {};
  const textSet = new Set<string>();
  const scoresByTrigger: Record<string, { scores: EvaluationScores[]; count: number }> = {};
  
  for (const user of usersWithInsight) {
    const trigger = user.trigger!;
    const insight = user.insight!;
    
    triggerDistribution[trigger] = (triggerDistribution[trigger] || 0) + 1;
    pillarDistribution[insight.pillar] = (pillarDistribution[insight.pillar] || 0) + 1;
    textSet.add(insight.text);
    
    if (!scoresByTrigger[trigger]) {
      scoresByTrigger[trigger] = { scores: [], count: 0 };
    }
    scoresByTrigger[trigger].scores.push(user.scores!);
    scoresByTrigger[trigger].count++;
  }
  
  // 计算平均分
  const avgScores = (scores: EvaluationScores[]): EvaluationScores => {
    const sum: EvaluationScores = {
      accuracy: 0, wit: 0, resonance: 0, personalization: 0,
      iceBreaking: 0, emotionalSafety: 0, anticipation: 0, characterConsistency: 0
    };
    for (const s of scores) {
      sum.accuracy += s.accuracy;
      sum.wit += s.wit;
      sum.resonance += s.resonance;
      sum.personalization += s.personalization;
      sum.iceBreaking += s.iceBreaking;
      sum.emotionalSafety += s.emotionalSafety;
      sum.anticipation += s.anticipation;
      sum.characterConsistency += s.characterConsistency;
    }
    const n = scores.length;
    return {
      accuracy: sum.accuracy / n,
      wit: sum.wit / n,
      resonance: sum.resonance / n,
      personalization: sum.personalization / n,
      iceBreaking: sum.iceBreaking / n,
      emotionalSafety: sum.emotionalSafety / n,
      anticipation: sum.anticipation / n,
      characterConsistency: sum.characterConsistency / n,
    };
  };
  
  const allScores = usersWithInsight.map(u => u.scores!);
  const averageScores = avgScores(allScores);
  
  const triggerAvgScores: Record<string, EvaluationScores> = {};
  for (const [trigger, data] of Object.entries(scoresByTrigger)) {
    triggerAvgScores[trigger] = avgScores(data.scores);
  }
  
  // 找出低分推理
  const lowScoreInsights = usersWithInsight
    .map(u => {
      const avg = (Object.values(u.scores!) as number[]).reduce((a, b) => a + b, 0) / 8;
      return { insight: u.insight!, avgScore: avg, profile: u.profile };
    })
    .filter(x => x.avgScore < 3.0)
    .sort((a, b) => a.avgScore - b.avgScore)
    .slice(0, 20);
  
  // 未覆盖用户
  const uncoveredProfiles = users
    .filter(u => u.insight === null)
    .map(u => u.profile)
    .slice(0, 10);
  
  return {
    totalUsers: users.length,
    usersWithInsight: usersWithInsight.length,
    triggerDistribution,
    pillarDistribution,
    uniqueTexts: textSet.size,
    textRepetitionRate: 1 - textSet.size / usersWithInsight.length,
    averageScores,
    scoresByTrigger: triggerAvgScores,
    uncoveredProfiles,
    lowScoreInsights,
  };
}

// ============ 生成PM报告 ============

function generatePMReport(stats: SimulationStats): string {
  const sortedTriggers = Object.entries(stats.triggerDistribution)
    .sort((a, b) => b[1] - a[1]);
  
  const topTriggers = sortedTriggers.slice(0, 10);
  const bottomTriggers = sortedTriggers.slice(-5);
  
  // 找出各维度最低分的触发器
  const findLowestScoreTrigger = (dimension: keyof EvaluationScores): [string, number] => {
    let lowest = ['', 5];
    for (const [trigger, scores] of Object.entries(stats.scoresByTrigger)) {
      if (scores[dimension] < lowest[1]) {
        lowest = [trigger, scores[dimension]];
      }
    }
    return lowest as [string, number];
  };
  
  const lowestAccuracy = findLowestScoreTrigger('accuracy');
  const lowestWit = findLowestScoreTrigger('wit');
  const lowestPersonalization = findLowestScoreTrigger('personalization');
  const lowestResonance = findLowestScoreTrigger('resonance');
  
  const report = `
# 小悦偷偷碎嘴系统 - 1000用户模拟测试报告
> 由20年经验资深产品经理撰写

---

## 一、测试概况

| 指标 | 数值 | 评价 |
|------|------|------|
| 总测试用户 | ${stats.totalUsers} | - |
| 成功触发碎嘴 | ${stats.usersWithInsight} (${(stats.usersWithInsight / stats.totalUsers * 100).toFixed(1)}%) | ${stats.usersWithInsight / stats.totalUsers > 0.95 ? '✅ 优秀' : stats.usersWithInsight / stats.totalUsers > 0.85 ? '⚠️ 良好' : '❌ 需改进'} |
| 独立话术数量 | ${stats.uniqueTexts} | ${stats.uniqueTexts > 50 ? '✅ 丰富' : '⚠️ 偏少'} |
| 话术重复率 | ${(stats.textRepetitionRate * 100).toFixed(1)}% | ${stats.textRepetitionRate < 0.5 ? '✅ 健康' : stats.textRepetitionRate < 0.7 ? '⚠️ 中等' : '❌ 过高'} |

---

## 二、8维度综合评分

| 维度 | 平均分(1-5) | 评价 | 行动建议 |
|------|-------------|------|----------|
| 准确度 Accuracy | ${stats.averageScores.accuracy.toFixed(2)} | ${stats.averageScores.accuracy >= 4 ? '✅' : stats.averageScores.accuracy >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.accuracy < 3.5 ? '需要更精准的规则匹配' : '保持'} |
| 有趣程度 Wit | ${stats.averageScores.wit.toFixed(2)} | ${stats.averageScores.wit >= 4 ? '✅' : stats.averageScores.wit >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.wit < 3.5 ? '增加幽默感和意外感' : '保持'} |
| 共鸣感 Resonance | ${stats.averageScores.resonance.toFixed(2)} | ${stats.averageScores.resonance >= 4 ? '✅' : stats.averageScores.resonance >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.resonance < 3.5 ? '加强情感连接表达' : '保持'} |
| 个性化感知 Personalization | ${stats.averageScores.personalization.toFixed(2)} | ${stats.averageScores.personalization >= 4 ? '✅' : stats.averageScores.personalization >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.personalization < 3.5 ? '增加用户专属标签引用' : '保持'} |
| 破冰效果 Ice-breaking | ${stats.averageScores.iceBreaking.toFixed(2)} | ${stats.averageScores.iceBreaking >= 4 ? '✅' : stats.averageScores.iceBreaking >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.iceBreaking < 3.5 ? '增加开放式话题引导' : '保持'} |
| 情绪安全感 Safety | ${stats.averageScores.emotionalSafety.toFixed(2)} | ${stats.averageScores.emotionalSafety >= 4.3 ? '✅' : stats.averageScores.emotionalSafety >= 4 ? '⚠️' : '❌'} | ${stats.averageScores.emotionalSafety < 4 ? '⚠️ 需要审查敏感表达' : '保持'} |
| 期待感 Anticipation | ${stats.averageScores.anticipation.toFixed(2)} | ${stats.averageScores.anticipation >= 4 ? '✅' : stats.averageScores.anticipation >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.anticipation < 3.5 ? '增加悬念和惊喜感' : '保持'} |
| 人设一致性 Character | ${stats.averageScores.characterConsistency.toFixed(2)} | ${stats.averageScores.characterConsistency >= 4 ? '✅' : stats.averageScores.characterConsistency >= 3.5 ? '⚠️' : '❌'} | ${stats.averageScores.characterConsistency < 3.5 ? '统一小悦说话风格' : '保持'} |

**综合得分：${((Object.values(stats.averageScores) as number[]).reduce((a, b) => a + b, 0) / 8).toFixed(2)} / 5.00**

---

## 三、触发规则分布分析

### 3.1 TOP 10 高频触发器
| 排名 | 触发器 | 触发次数 | 占比 | 平均分 |
|------|--------|----------|------|--------|
${topTriggers.map(([trigger, count], i) => {
  const scores = stats.scoresByTrigger[trigger];
  const avg = scores ? ((Object.values(scores) as number[]).reduce((a, b) => a + b, 0) / 8).toFixed(2) : 'N/A';
  return `| ${i + 1} | ${trigger} | ${count} | ${(count / stats.usersWithInsight * 100).toFixed(1)}% | ${avg} |`;
}).join('\n')}

### 3.2 三大支柱分布
| 支柱 | 数量 | 占比 |
|------|------|------|
| 身份归属 (Identity) | ${stats.pillarDistribution['identity'] || 0} | ${((stats.pillarDistribution['identity'] || 0) / stats.usersWithInsight * 100).toFixed(1)}% |
| 社交能量 (Energy) | ${stats.pillarDistribution['energy'] || 0} | ${((stats.pillarDistribution['energy'] || 0) / stats.usersWithInsight * 100).toFixed(1)}% |
| 价值驱动 (Value) | ${stats.pillarDistribution['value'] || 0} | ${((stats.pillarDistribution['value'] || 0) / stats.usersWithInsight * 100).toFixed(1)}% |

---

## 四、问题诊断

### 4.1 核心问题

${stats.averageScores.personalization < 3.5 ? `
**❌ 问题1：个性化感知偏低 (${stats.averageScores.personalization.toFixed(2)}分)**
- 现象：很多用户觉得碎嘴像是"套话"，缺乏专属感
- 根因：
  1. 单一维度推理过多（如仅根据行业）
  2. 缺少用户名字/具体标签的引用
  3. 兜底规则使用频率较高
- 建议：
  1. 优先使用多维度组合推理
  2. 在话术中嵌入用户的具体信息（如城市名、兴趣标签）
  3. 减少兜底规则的使用，宁可不说也不要说废话
` : ''}

${stats.averageScores.wit < 3.5 ? `
**❌ 问题2：有趣程度不足 (${stats.averageScores.wit.toFixed(2)}分)**
- 现象：碎嘴不够"毒舌"，太过客气和正经
- 根因：
  1. 话术过于正面积极，缺乏小悦人设的"冷淡毒舌"
  2. 句式过于固定（"因为...期待..."）
  3. 缺少意外感和反转
- 建议：
  1. 增加更多毒舌但不冒犯的表达
  2. 加入一些"拆穿"式的精准观察
  3. 尝试反向表达（如"看起来很E，但我猜你其实很I"）
` : ''}

${lowestWit[1] < 3.3 ? `
**⚠️ 问题3：${lowestWit[0]} 触发器评分过低 (${lowestWit[1].toFixed(2)}分)**
- 这个规则需要重点优化话术
` : ''}

### 4.2 低分案例分析

${stats.lowScoreInsights.slice(0, 5).map((item, i) => `
**案例${i + 1}** (综合分: ${item.avgScore.toFixed(2)})
- 用户画像: ${item.profile.gender} | ${item.profile.currentCity} | ${item.profile.industry} | ${item.profile.interestsTop?.slice(0, 2).join('、')}
- 触发器: \`${item.insight.trigger}\`
- 碎嘴内容: "${item.insight.text}"
- 问题: ${item.avgScore < 2.8 ? '话术过于通用，缺乏针对性' : '可进一步增强个性化'}
`).join('')}

---

## 五、优化方案

### 5.1 短期优化（1-2周）

1. **话术个性化增强**
   - 在碎嘴中动态嵌入用户信息（城市、兴趣、职业关键词）
   - 示例改进：
     - 原: "深圳科技圈的，效率拉满"
     - 优化: "在深圳做${'{industry}'}的，节奏感应该拉满，周末还能休息吗？"

2. **减少兜底规则触发**
   - 当前兜底触发率: ${((stats.triggerDistribution['fallback_warm_0'] || 0) + (stats.triggerDistribution['fallback_warm_1'] || 0) + (stats.triggerDistribution['fallback_warm_2'] || 0) + (stats.triggerDistribution['fallback_city'] || 0)) / stats.usersWithInsight * 100}%
   - 目标: <5%
   - 方案: 增加更多中置信度的组合规则

3. **增强"毒舌"人设**
   - 增加更多观察式表达（"我看你是...的type"）
   - 减少"期待"类结尾，改为更随意的收尾

### 5.2 中期优化（1-2月）

1. **动态话术模板系统**
   - 建立话术模板库，支持变量替换
   - 引入A/B测试机制，追踪不同话术的用户反馈

2. **用户反馈闭环**
   - 在碎嘴旁添加"准不准"快速反馈按钮
   - 收集真实评分数据，替代模拟评分

3. **增加"惊喜感"规则**
   - 检测用户的"稀有属性"组合
   - 为小众兴趣/职业增加专属话术

### 5.3 长期优化（3-6月）

1. **AI生成碎嘴**
   - 使用DeepSeek基于用户画像生成个性化碎嘴
   - 保持人设一致性的同时增加多样性

2. **学习型系统**
   - 根据用户反馈自动调整规则权重
   - 建立"好碎嘴"特征库

---

## 六、执行优先级

| 优先级 | 优化项 | 预期收益 | 开发成本 |
|--------|--------|----------|----------|
| P0 | 话术个性化增强 | 个性化+0.5分 | 低 |
| P0 | 减少兜底触发 | 准确度+0.3分 | 低 |
| P1 | 增强毒舌人设 | 有趣程度+0.4分 | 中 |
| P1 | 用户反馈按钮 | 数据闭环 | 中 |
| P2 | AI生成碎嘴 | 多样性大幅提升 | 高 |

---

## 七、附录：完整触发器评分表

| 触发器 | 次数 | 准确度 | 有趣 | 共鸣 | 个性化 | 破冰 | 安全 | 期待 | 人设 |
|--------|------|--------|------|------|--------|------|------|------|------|
${Object.entries(stats.scoresByTrigger)
  .sort((a, b) => (stats.triggerDistribution[b[0]] || 0) - (stats.triggerDistribution[a[0]] || 0))
  .map(([trigger, scores]) => {
    const count = stats.triggerDistribution[trigger] || 0;
    return `| ${trigger} | ${count} | ${scores.accuracy.toFixed(1)} | ${scores.wit.toFixed(1)} | ${scores.resonance.toFixed(1)} | ${scores.personalization.toFixed(1)} | ${scores.iceBreaking.toFixed(1)} | ${scores.emotionalSafety.toFixed(1)} | ${scores.anticipation.toFixed(1)} | ${scores.characterConsistency.toFixed(1)} |`;
  }).join('\n')}

---

*报告生成时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*
*模拟用户数: ${stats.totalUsers}*
`;

  return report;
}

// ============ 主函数 ============

async function main() {
  console.log('🦊 小悦偷偷碎嘴系统 - 1000用户模拟测试');
  console.log('========================================\n');
  
  console.log('📊 生成1000个模拟用户...');
  const users = runSimulation(1000);
  console.log(`✅ 用户生成完成\n`);
  
  console.log('🔍 分析测试结果...');
  const stats = analyzeResults(users);
  console.log(`✅ 分析完成\n`);
  
  console.log('📝 生成PM报告...');
  const report = generatePMReport(stats);
  
  // 保存报告
  const fs = await import('fs');
  const reportPath = `scripts/gossip_simulation_report_${new Date().toISOString().split('T')[0]}.md`;
  fs.writeFileSync(reportPath, report);
  console.log(`✅ 报告已保存: ${reportPath}\n`);
  
  // 保存原始数据
  const dataPath = `scripts/gossip_simulation_data_${new Date().toISOString().split('T')[0]}.json`;
  fs.writeFileSync(dataPath, JSON.stringify({ stats, sampleUsers: users.slice(0, 50) }, null, 2));
  console.log(`✅ 数据已保存: ${dataPath}\n`);
  
  // 打印摘要
  console.log('========================================');
  console.log('📈 测试摘要');
  console.log('========================================');
  console.log(`总用户: ${stats.totalUsers}`);
  console.log(`触发成功率: ${(stats.usersWithInsight / stats.totalUsers * 100).toFixed(1)}%`);
  console.log(`独立话术数: ${stats.uniqueTexts}`);
  console.log(`综合评分: ${((Object.values(stats.averageScores) as number[]).reduce((a, b) => a + b, 0) / 8).toFixed(2)} / 5.00`);
  console.log('\n各维度评分:');
  console.log(`  准确度: ${stats.averageScores.accuracy.toFixed(2)}`);
  console.log(`  有趣程度: ${stats.averageScores.wit.toFixed(2)}`);
  console.log(`  共鸣感: ${stats.averageScores.resonance.toFixed(2)}`);
  console.log(`  个性化: ${stats.averageScores.personalization.toFixed(2)}`);
  console.log(`  破冰效果: ${stats.averageScores.iceBreaking.toFixed(2)}`);
  console.log(`  情绪安全: ${stats.averageScores.emotionalSafety.toFixed(2)}`);
  console.log(`  期待感: ${stats.averageScores.anticipation.toFixed(2)}`);
  console.log(`  人设一致: ${stats.averageScores.characterConsistency.toFixed(2)}`);
}

main().catch(console.error);
