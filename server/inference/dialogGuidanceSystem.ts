/**
 * 6维度对话引导系统
 * 
 * 基于心理学原则设计的对话流程：
 * 兴趣/爱好 → 生活方式 → 性格特质 → 社交偏好 → 职业/城市 → 期待/背景
 * 
 * 核心原则：
 * 1. 循序渐进 - 从低风险到高风险话题
 * 2. 场景化提问 - 用具体场景代替抽象标签
 * 3. 行为描述 - 问行为而不是问定义
 * 4. 柔性追问 - 回答模糊时换种问法再问
 */

import type { SmartInsight } from '../deepseekClient';

// ============ 6大维度定义 ============

export type InsightDimension = 
  | 'interest'      // 兴趣爱好
  | 'lifestyle'     // 生活方式
  | 'personality'   // 性格特质
  | 'social'        // 社交偏好
  | 'career'        // 职业城市
  | 'expectation';  // 期待背景

export const DIMENSION_ORDER: InsightDimension[] = [
  'interest',
  'lifestyle', 
  'personality',
  'social',
  'career',
  'expectation'
];

export const DIMENSION_NAMES: Record<InsightDimension, string> = {
  interest: '兴趣爱好',
  lifestyle: '生活方式',
  personality: '性格特质',
  social: '社交偏好',
  career: '职业城市',
  expectation: '交友期待'
};

// 维度到SmartInsight类别的映射
export const DIMENSION_TO_INSIGHT_CATEGORY: Record<InsightDimension, SmartInsight['category']> = {
  interest: 'preference',
  lifestyle: 'lifestyle',
  personality: 'personality',
  social: 'social',
  career: 'career',
  expectation: 'background'
};

// ============ 问题库 ============

export interface GuidanceQuestion {
  id: string;
  dimension: InsightDimension;
  question: string;
  followUp?: string;           // 追问语（用户回答模糊时）
  extractionHints: string[];   // 提取提示词
  priority: number;            // 1-5, 5最高
}

export const GUIDANCE_QUESTIONS: GuidanceQuestion[] = [
  // ===== 兴趣爱好 (开场轻松话题) =====
  {
    id: 'interest_1',
    dimension: 'interest',
    question: '最近有什么让你特别开心或者上头的事吗？追剧、打游戏、搞副业都算~',
    followUp: '比如最近在玩什么游戏，或者追什么剧？',
    extractionHints: ['游戏', '剧', '电影', '音乐', '运动', '爱好', '兴趣'],
    priority: 5
  },
  {
    id: 'interest_2',
    dimension: 'interest',
    question: '如果周末有一整天自由时间，你会怎么安排？',
    followUp: '是宅家还是出门？一般会做什么？',
    extractionHints: ['周末', '休息', '放松', '娱乐', '活动'],
    priority: 4
  },
  {
    id: 'interest_3',
    dimension: 'interest',
    question: '有没有什么小众爱好是朋友们不太了解的？',
    followUp: '比如收集什么东西，或者特别喜欢研究什么？',
    extractionHints: ['爱好', '喜欢', '收集', '研究', '特别'],
    priority: 3
  },
  {
    id: 'interest_4',
    dimension: 'interest',
    question: '最近有没有新学的技能或者想尝试的新事物？',
    extractionHints: ['学习', '尝试', '新', '技能', '兴趣'],
    priority: 3
  },
  {
    id: 'interest_5',
    dimension: 'interest',
    question: '平时喜欢刷什么类型的内容？B站、小红书、抖音都算~',
    extractionHints: ['刷', '看', '关注', '内容', '博主'],
    priority: 4
  },

  // ===== 生活方式 =====
  {
    id: 'lifestyle_1',
    dimension: 'lifestyle',
    question: '平时下班或周末一般怎么给自己充电呀？',
    followUp: '是喜欢运动、看书、还是跟朋友聚会？',
    extractionHints: ['下班', '周末', '充电', '放松', '休息', '运动', '健身'],
    priority: 5
  },
  {
    id: 'lifestyle_2',
    dimension: 'lifestyle',
    question: '你是早睡早起型还是夜猫子型的？',
    followUp: '一般几点睡觉呀？',
    extractionHints: ['早睡', '熬夜', '作息', '睡觉', '起床'],
    priority: 4
  },
  {
    id: 'lifestyle_3',
    dimension: 'lifestyle',
    question: '吃东西方面有什么特别的偏好吗？比如重口味还是清淡，爱探店还是自己做？',
    followUp: '有没有特别喜欢的菜系或者餐厅？',
    extractionHints: ['吃', '美食', '餐厅', '口味', '做饭', '外卖'],
    priority: 4
  },
  {
    id: 'lifestyle_4',
    dimension: 'lifestyle',
    question: '平时会健身运动吗？喜欢什么类型的？',
    extractionHints: ['健身', '运动', '跑步', '游泳', '瑜伽', '球类'],
    priority: 3
  },
  {
    id: 'lifestyle_5',
    dimension: 'lifestyle',
    question: '旅行的话喜欢什么风格？city walk、户外探险、还是度假躺平？',
    extractionHints: ['旅行', '旅游', '出行', '度假', '探险'],
    priority: 3
  },

  // ===== 性格特质 (用行为场景代替标签) =====
  {
    id: 'personality_1',
    dimension: 'personality',
    question: '跟新朋友第一次见面，你一般是先观察一会儿，还是主动找话题聊？',
    followUp: '那熟了之后呢，会变得话多吗？',
    extractionHints: ['社交', '内向', '外向', '主动', '观察', '聊天'],
    priority: 5
  },
  {
    id: 'personality_2',
    dimension: 'personality',
    question: '朋友们一般怎么评价你的性格？',
    followUp: '你自己觉得准吗？',
    extractionHints: ['性格', '评价', '朋友', '觉得', '认为'],
    priority: 5
  },
  {
    id: 'personality_3',
    dimension: 'personality',
    question: '做决定的时候，你是那种想清楚再行动，还是边做边调整的类型？',
    extractionHints: ['决定', '计划', '行动', '思考', '随性'],
    priority: 4
  },
  {
    id: 'personality_4',
    dimension: 'personality',
    question: '压力大的时候一般怎么处理？找人聊还是自己消化？',
    extractionHints: ['压力', '情绪', '处理', '聊天', '独处'],
    priority: 4
  },
  {
    id: 'personality_5',
    dimension: 'personality',
    question: '你觉得自己是那种需要很多独处时间充电的人吗？',
    extractionHints: ['独处', '充电', '社交', '内向', '外向'],
    priority: 3
  },

  // ===== 社交偏好 =====
  {
    id: 'social_1',
    dimension: 'social',
    question: '你理想中的朋友聚会是什么样子的？小范围深聊还是热闹的大party？',
    followUp: '一般多少人的聚会你会觉得刚刚好？',
    extractionHints: ['聚会', '朋友', '社交', '人数', '活动'],
    priority: 5
  },
  {
    id: 'social_2',
    dimension: 'social',
    question: '交朋友的时候，你比较看重什么？聊得来、三观合、还是有共同爱好？',
    followUp: '有没有特别不能接受的点？',
    extractionHints: ['朋友', '看重', '三观', '爱好', '聊天'],
    priority: 5
  },
  {
    id: 'social_3',
    dimension: 'social',
    question: '跟朋友相处的时候，你是照顾别人多一点，还是被照顾多一点？',
    extractionHints: ['相处', '照顾', '朋友', '关系', '角色'],
    priority: 4
  },
  {
    id: 'social_4',
    dimension: 'social',
    question: '聊天的时候喜欢深度话题还是轻松吐槽？',
    extractionHints: ['聊天', '话题', '深度', '轻松', '吐槽'],
    priority: 4
  },
  {
    id: 'social_5',
    dimension: 'social',
    question: '你是那种朋友遍天下型的，还是有几个铁哥们/闺蜜就够了？',
    extractionHints: ['朋友', '社交', '圈子', '铁哥们', '闺蜜'],
    priority: 3
  },

  // ===== 职业城市 (已建立信任后) =====
  {
    id: 'career_1',
    dimension: 'career',
    question: '方便聊聊你现在主要在忙什么吗？工作或者其他都行~这样我能帮你匹配到同频的朋友',
    followUp: '具体是什么行业或者岗位呀？',
    extractionHints: ['工作', '行业', '职业', '岗位', '公司', '做什么'],
    priority: 5
  },
  {
    id: 'career_2',
    dimension: 'career',
    question: '你平时在哪个城市活动比较多呀？',
    followUp: '是在那边工作还是生活？',
    extractionHints: ['城市', '地方', '在哪', '深圳', '香港', '广州'],
    priority: 5
  },
  {
    id: 'career_3',
    dimension: 'career',
    question: '工作几年啦？还是还在读书？',
    extractionHints: ['工作', '年', '学生', '读书', '毕业'],
    priority: 4
  },
  {
    id: 'career_4',
    dimension: 'career',
    question: '对现在的工作状态满意吗？有什么想吐槽的？',
    extractionHints: ['工作', '满意', '吐槽', '状态', '压力'],
    priority: 3
  },
  {
    id: 'career_5',
    dimension: 'career',
    question: '将来有什么计划或者目标吗？比如跳槽、创业、或者换个城市？',
    extractionHints: ['计划', '目标', '将来', '跳槽', '创业'],
    priority: 3
  },

  // ===== 期待/背景 (正向收尾) =====
  {
    id: 'expectation_1',
    dimension: 'expectation',
    question: '来这里最希望认识什么样的朋友呀？',
    followUp: '有没有特别期待的交友场景？',
    extractionHints: ['希望', '期待', '朋友', '认识', '交友'],
    priority: 5
  },
  {
    id: 'expectation_2',
    dimension: 'expectation',
    question: '如果能遇到一个超合拍的新朋友，你们会一起做什么？',
    extractionHints: ['一起', '做什么', '朋友', '合拍', '活动'],
    priority: 4
  },
  {
    id: 'expectation_3',
    dimension: 'expectation',
    question: '你是土生土长的本地人，还是来这边发展的？',
    extractionHints: ['本地', '家乡', '来自', '发展', '定居'],
    priority: 4
  },
  {
    id: 'expectation_4',
    dimension: 'expectation',
    question: '家里有养宠物吗？猫猫狗狗？',
    extractionHints: ['宠物', '猫', '狗', '养'],
    priority: 3
  },
  {
    id: 'expectation_5',
    dimension: 'expectation',
    question: '现在是单身还是有对象呀？',
    extractionHints: ['单身', '对象', '恋爱', '结婚'],
    priority: 4
  }
];

// ============ 维度追踪器 ============

export interface DimensionCoverage {
  dimension: InsightDimension;
  covered: boolean;
  confidence: number;        // 0-1, 信息收集的置信度
  questionAsked: number;     // 已问问题数
  insights: string[];        // 收集到的洞察
}

export interface ConversationTracker {
  userId?: number;
  dimensions: Map<InsightDimension, DimensionCoverage>;
  currentDimension: InsightDimension;
  questionsAsked: GuidanceQuestion[];
  totalTurns: number;
}

export function createConversationTracker(): ConversationTracker {
  const dimensions = new Map<InsightDimension, DimensionCoverage>();
  
  for (const dim of DIMENSION_ORDER) {
    dimensions.set(dim, {
      dimension: dim,
      covered: false,
      confidence: 0,
      questionAsked: 0,
      insights: []
    });
  }
  
  return {
    dimensions,
    currentDimension: DIMENSION_ORDER[0],
    questionsAsked: [],
    totalTurns: 0
  };
}

// ============ 智能问题选择 ============

/**
 * 获取下一个应该问的问题
 */
export function getNextQuestion(tracker: ConversationTracker): GuidanceQuestion | null {
  // 找到第一个未覆盖的维度
  let targetDimension: InsightDimension | null = null;
  
  for (const dim of DIMENSION_ORDER) {
    const coverage = tracker.dimensions.get(dim);
    if (coverage && !coverage.covered) {
      targetDimension = dim;
      break;
    }
  }
  
  if (!targetDimension) {
    return null; // 所有维度已覆盖
  }
  
  // 获取该维度的问题，排除已问过的
  const askedIds = new Set(tracker.questionsAsked.map(q => q.id));
  const availableQuestions = GUIDANCE_QUESTIONS
    .filter(q => q.dimension === targetDimension && !askedIds.has(q.id))
    .sort((a, b) => b.priority - a.priority);
  
  return availableQuestions[0] || null;
}

/**
 * 获取追问问题（当用户回答模糊时）
 */
export function getFollowUpQuestion(
  tracker: ConversationTracker, 
  dimension: InsightDimension
): GuidanceQuestion | null {
  const askedIds = new Set(tracker.questionsAsked.map(q => q.id));
  
  // 找一个同维度但不同的问题
  const alternatives = GUIDANCE_QUESTIONS
    .filter(q => q.dimension === dimension && !askedIds.has(q.id))
    .sort((a, b) => b.priority - a.priority);
  
  return alternatives[0] || null;
}

// ============ 扩展同义词库 ============

const SYNONYM_EXPANSIONS: Record<string, string[]> = {
  // 兴趣相关
  '游戏': ['打游戏', '玩游戏', 'steam', '原神', '王者', 'switch', 'ps5', 'xbox', '手游', '端游', '网游', '桌游', '剧本杀'],
  '电影': ['看电影', '看片', '追剧', '电视剧', '综艺', '纪录片', '美剧', '日剧', '韩剧', '动漫', '二次元', 'b站'],
  '音乐': ['听歌', '听音乐', '唱歌', 'k歌', '乐器', '吉他', '钢琴', '演唱会', '音乐节', 'livehouse'],
  '运动': ['健身', '跑步', '游泳', '篮球', '足球', '羽毛球', '乒乓球', '网球', '瑜伽', '普拉提', '徒步', '爬山', '骑行', '滑雪', '冲浪'],
  '阅读': ['看书', '读书', '小说', '书', '漫画', '阅读', '读', '文学'],
  '摄影': ['拍照', '摄影', '相机', '照片', '修图', 'ps', 'lr'],
  '旅行': ['旅游', '出行', '度假', '穷游', '自驾', '出国', '旅行'],
  '美食': ['吃', '探店', '餐厅', '美食', '做饭', '下厨', '烹饪', '烘焙'],
  '咖啡': ['咖啡', '咖啡厅', '咖啡馆', '手冲', '拿铁', '星巴克'],
  // 生活方式
  '熬夜': ['熬夜', '夜猫子', '晚睡', '凌晨', '失眠', '12点', '1点', '2点'],
  '早起': ['早睡早起', '早起', '6点', '7点', '规律作息'],
  '宅': ['宅', '宅家', '不出门', '躺平', '葛优躺'],
  // 性格相关
  '内向': ['内向', 'i人', 'infj', 'intp', 'intj', 'isfp', '慢热', '害羞', '社恐', '不太主动', '安静'],
  '外向': ['外向', 'e人', 'enfp', 'entp', 'esfp', '自来熟', '话多', '话痨', '社牛', '主动'],
  '随性': ['随性', '随缘', '佛系', '无所谓', '都行', '随便'],
  // 社交相关
  '小范围': ['小范围', '几个人', '三五个', '小圈子', '深度', '质量'],
  '热闹': ['热闹', 'party', '大家', '很多人', '人多', '聚会'],
  // 职业相关
  '程序员': ['程序员', '码农', '开发', '工程师', '写代码', '敲代码', 'it', 'tech', '技术'],
  '产品': ['产品', 'pm', '产品经理', '需求', 'prd'],
  '设计': ['设计', 'ui', 'ux', '美工', '视觉', 'figma', 'sketch'],
  // 城市相关
  '深圳': ['深圳', '南山', '福田', '罗湖', '宝安', '龙华', '前海', '科技园', '粤海'],
  '香港': ['香港', 'hk', '港岛', '九龙', '新界', '中环', '旺角', '铜锣湾', '尖沙咀'],
  '广州': ['广州', '天河', '越秀', '海珠', '番禺', '珠江新城'],
  '北京': ['北京', '帝都', '朝阳', '海淀', '西城', '东城'],
  '上海': ['上海', '魔都', '浦东', '静安', '徐汇', '黄浦', '陆家嘴'],
};

function expandSynonyms(hints: string[]): string[] {
  const expanded = new Set<string>();
  for (const hint of hints) {
    expanded.add(hint.toLowerCase());
    const synonyms = SYNONYM_EXPANSIONS[hint];
    if (synonyms) {
      synonyms.forEach(s => expanded.add(s.toLowerCase()));
    }
  }
  return Array.from(expanded);
}

function matchWithSynonyms(text: string, hints: string[]): string[] {
  const lowerText = text.toLowerCase();
  const expandedHints = expandSynonyms(hints);
  return expandedHints.filter(hint => lowerText.includes(hint));
}

// ============ 维度覆盖检测 ============

export interface ExtractionResult {
  dimension: InsightDimension;
  insights: string[];
  confidence: number;
  rawEvidence: string[];
}

/**
 * 从用户回复中提取洞察并更新维度覆盖
 * 
 * 核心原则：必须实际提取到洞察才能标记覆盖
 * - 仅回答长度不能作为覆盖依据
 * - 需要匹配到关键词或提取到具体洞察
 */
export function extractAndUpdateCoverage(
  text: string,
  tracker: ConversationTracker,
  currentQuestion: GuidanceQuestion
): ExtractionResult[] {
  const results: ExtractionResult[] = [];
  
  // 检查所有维度的提取
  for (const dim of DIMENSION_ORDER) {
    const questions = GUIDANCE_QUESTIONS.filter(q => q.dimension === dim);
    const allHints = questions.flatMap(q => q.extractionHints);
    
    // 使用同义词扩展匹配
    const matchedHints = matchWithSynonyms(text, allHints);
    
    // 生成洞察（必须先生成，判断是否有实质内容）
    const insights = generateInsightsFromText(text, dim, matchedHints);
    
    const coverage = tracker.dimensions.get(dim)!;
    
    // 核心改进：必须有实际信号才能计算置信度
    // 信号包括：匹配到关键词 OR 提取到洞察
    const hasSignal = matchedHints.length > 0 || insights.length > 0;
    
    if (!hasSignal && dim !== currentQuestion.dimension) {
      continue; // 没有信号且不是当前问的维度，跳过
    }
    
    // 计算置信度 - 基于实际信号而非回答长度
    let confidence = 0;
    
    if (insights.length > 0) {
      // 提取到具体洞察 - 高置信度
      confidence = Math.min(0.95, 0.7 + insights.length * 0.1);
    } else if (matchedHints.length > 0) {
      // 匹配到关键词但未提取洞察 - 中等置信度
      confidence = Math.min(0.75, 0.4 + matchedHints.length * 0.15);
    } else if (dim === currentQuestion.dimension) {
      // 主动问的维度但没有信号 - 低置信度，需要追问
      confidence = text.length > 15 ? 0.3 : 0.15;
    }
    
    if (confidence > 0) {
      results.push({
        dimension: dim,
        insights,
        confidence,
        rawEvidence: matchedHints
      });
      
      // 更新tracker
      coverage.insights.push(...insights);
      coverage.confidence = Math.max(coverage.confidence, confidence);
      coverage.questionAsked++;
      
      // 核心改进：必须有洞察才能标记覆盖
      // 仅有关键词匹配但无洞察，置信度上限0.75，需要追问
      if (insights.length > 0 && coverage.confidence >= 0.7) {
        coverage.covered = true;
      }
    }
  }
  
  return results;
}

/**
 * 从文本生成洞察描述
 * 扩展的匹配规则库，覆盖更多表达方式
 */
function generateInsightsFromText(
  text: string, 
  dimension: InsightDimension,
  matchedHints: string[]
): string[] {
  const insights: string[] = [];
  const lowerText = text.toLowerCase();
  
  switch (dimension) {
    case 'interest':
      // 游戏相关
      if (/游戏|打游|玩游|steam|原神|王者|switch|ps5|xbox|手游|端游|网游|桌游|剧本杀/i.test(text)) {
        insights.push('游戏爱好者');
      }
      // 影视相关
      if (/剧|电影|看片|追剧|综艺|纪录片|美剧|日剧|韩剧|动漫|二次元|b站/i.test(text)) {
        insights.push('影视爱好者');
      }
      // 音乐相关
      if (/音乐|听歌|唱歌|k歌|乐器|吉他|钢琴|演唱会|音乐节|livehouse/i.test(text)) {
        insights.push('音乐爱好者');
      }
      // 阅读相关
      if (/读书|看书|小说|书|漫画|阅读|文学/i.test(text)) {
        insights.push('阅读爱好者');
      }
      // 摄影相关
      if (/摄影|拍照|相机|照片|修图/i.test(text)) {
        insights.push('摄影爱好者');
      }
      // 咖啡/生活品质
      if (/咖啡|咖啡厅|手冲|拿铁|逛展|艺术|画画|画/i.test(text)) {
        insights.push('注重生活品质');
      }
      // 旅行
      if (/旅行|旅游|出行|度假|自驾|出国|穷游/i.test(text)) {
        insights.push('热爱旅行探索');
      }
      break;
      
    case 'lifestyle':
      // 运动健身
      if (/健身|运动|跑步|游泳|篮球|足球|羽毛球|网球|瑜伽|普拉提|徒步|爬山|骑行|滑雪|冲浪|打球/i.test(text)) {
        insights.push('运动达人，注重健康');
      }
      // 夜猫子
      if (/熬夜|夜猫|晚睡|凌晨|失眠|12点|1点|2点/i.test(text)) {
        insights.push('夜猫子型，活跃时间较晚');
      }
      // 早起
      if (/早睡早起|早起|6点|7点|规律作息|规律/i.test(text)) {
        insights.push('作息规律，早睡早起');
      }
      // 下厨
      if (/做饭|下厨|烹饪|烘焙|自己做/i.test(text)) {
        insights.push('喜欢下厨，享受生活');
      }
      // 美食探店
      if (/探店|美食|餐厅|吃|火锅|日料|川菜|粤菜|西餐/i.test(text)) {
        insights.push('美食探索者');
      }
      // 宅
      if (/宅|宅家|不出门|躺平|葛优躺|追剧/i.test(text)) {
        insights.push('宅家型，享受独处时光');
      }
      // 外出
      if (/出门|逛街|聚餐|聚会|朋友|户外/i.test(text)) {
        insights.push('喜欢外出社交活动');
      }
      break;
      
    case 'personality':
      // 内向/慢热
      if (/内向|i人|infj|intp|intj|isfp|慢热|害羞|社恐|不太主动|安静|观察/i.test(text)) {
        insights.push('慢热型，需要时间建立信任');
      }
      // 外向/活跃
      if (/外向|e人|enfp|entp|esfp|自来熟|话多|话痨|社牛|主动|搭话/i.test(text)) {
        insights.push('主动外向，社交能量强');
      }
      // 随性
      if (/随性|随缘|佛系|无所谓|都行|随便/i.test(text)) {
        insights.push('随性洒脱，不拘小节');
      }
      // 有规划
      if (/计划|想清楚|想好|有规划|理性|逻辑/i.test(text)) {
        insights.push('做事有规划，思虑周全');
      }
      // 靠谱
      if (/靠谱|可靠|负责|稳重|踏实/i.test(text)) {
        insights.push('可靠稳重');
      }
      // 好相处
      if (/好相处|随和|温和|easy-going|不计较/i.test(text)) {
        insights.push('好相处，性格随和');
      }
      // 闷骚/反差
      if (/闷骚|反差|表面.+实际|外表.+内心|熟了.+话/i.test(text)) {
        insights.push('有反差感，熟悉后很健谈');
      }
      // 压力处理
      if (/找朋友聊|倾诉|发泄|运动发泄|自己消化|独处/i.test(text)) {
        insights.push('有自己的解压方式');
      }
      break;
      
    case 'social':
      // 小范围深度
      if (/小范围|深聊|几个人|3-5|三五|小圈子|质量|深度交流/i.test(text)) {
        insights.push('偏好小范围深度社交');
      }
      // 热闹活跃
      if (/热闹|party|大家|很多人|人多|聚会|开放|广泛/i.test(text)) {
        insights.push('喜欢热闹氛围，社交活跃');
      }
      // 三观契合
      if (/三观|价值观|志同道合|同频/i.test(text)) {
        insights.push('注重三观契合');
      }
      // 共同爱好
      if (/共同爱好|兴趣|爱好|一起.+玩|聊得来/i.test(text)) {
        insights.push('看重共同兴趣爱好');
      }
      // 真诚
      if (/真诚|坦诚|真实|不装/i.test(text)) {
        insights.push('看重真诚交流');
      }
      // 选择性社交
      if (/选择性|不太喜欢应酬|看情况|随缘/i.test(text)) {
        insights.push('选择性社交，看重质量');
      }
      // 照顾型
      if (/照顾别人|照顾|付出|关心|体贴/i.test(text)) {
        insights.push('社交中偏向照顾他人');
      }
      // 话题偏好
      if (/深度话题|轻松吐槽|什么都能聊|聊天/i.test(text)) {
        insights.push('话题开放，好聊天');
      }
      // 铁哥们/闺蜜
      if (/铁哥们|闺蜜|知心|好友|老朋友/i.test(text)) {
        insights.push('注重深度友谊');
      }
      break;
      
    case 'career':
      // 职业相关 - 更丰富的提取
      if (/程序员|码农|开发|工程师|写代码|敲代码|it|tech|技术/i.test(text)) {
        insights.push('技术/开发岗位');
      }
      if (/产品|pm|产品经理|需求|prd/i.test(text)) {
        insights.push('产品岗位');
      }
      if (/设计|ui|ux|美工|视觉|figma|sketch/i.test(text)) {
        insights.push('设计岗位');
      }
      if (/金融|投资|银行|基金|证券|量化|投行|pe|vc/i.test(text)) {
        insights.push('金融行业');
      }
      if (/咨询|四大|mbb|麦肯锡|bcg|贝恩|德勤|普华|安永|毕马威/i.test(text)) {
        insights.push('咨询行业');
      }
      if (/律师|法务|法律|律所/i.test(text)) {
        insights.push('法律行业');
      }
      if (/医生|医疗|医院|医药|护士/i.test(text)) {
        insights.push('医疗行业');
      }
      if (/老师|教师|教育|培训/i.test(text)) {
        insights.push('教育行业');
      }
      // 城市
      if (/深圳|南山|福田|罗湖|宝安|龙华|前海|科技园|粤海/i.test(text)) {
        insights.push('深圳');
      }
      if (/香港|hk|港岛|九龙|新界|中环|旺角|铜锣湾|尖沙咀/i.test(text)) {
        insights.push('香港');
      }
      if (/广州|天河|越秀|海珠|番禺|珠江新城/i.test(text)) {
        insights.push('广州');
      }
      if (/北京|帝都|朝阳|海淀|西城|东城/i.test(text)) {
        insights.push('北京');
      }
      if (/上海|魔都|浦东|静安|徐汇|黄浦|陆家嘴/i.test(text)) {
        insights.push('上海');
      }
      // 工作年限/阶段
      if (/打工人|社畜|上班族|工作/i.test(text)) {
        insights.push('职场打工人');
      }
      break;
      
    case 'expectation':
      // 聊得来
      if (/同频|合拍|聊得来|有话聊|聊天/i.test(text)) {
        insights.push('期待找到聊得来的朋友');
      }
      // 共同活动
      if (/一起|活动|周末|玩|约|探店|吃饭|运动/i.test(text)) {
        insights.push('期待有共同活动的伙伴');
      }
      // 有趣
      if (/有趣|好玩|新鲜|有意思/i.test(text)) {
        insights.push('期待认识有趣的人');
      }
      // 单身
      if (/单身|没对象|空窗|母胎solo/i.test(text)) {
        insights.push('单身状态');
      }
      // 有对象
      if (/有对象|恋爱|男朋友|女朋友|另一半/i.test(text)) {
        insights.push('恋爱中');
      }
      // 本地人
      if (/本地|土生土长|本地人/i.test(text)) {
        insights.push('本地人');
      }
      // 外地发展
      if (/来.+发展|外地|搬来|来了.+年|来这边/i.test(text)) {
        insights.push('外地来发展');
      }
      // 宠物
      if (/猫|狗|宠物|养|毛孩子/i.test(text)) {
        insights.push('有宠物/喜欢宠物');
      }
      // 交流行业
      if (/行业|交流|学习|经验|资源/i.test(text)) {
        insights.push('希望拓展行业人脉');
      }
      // 扩大社交圈
      if (/扩大|认识更多|社交圈|交友|朋友/i.test(text)) {
        insights.push('希望扩大社交圈');
      }
      break;
  }
  
  return insights;
}

// ============ 覆盖率统计 ============

export interface CoverageStats {
  totalDimensions: number;
  coveredDimensions: number;
  coverageRate: number;
  dimensionDetails: Array<{
    dimension: InsightDimension;
    name: string;
    covered: boolean;
    confidence: number;
    insightCount: number;
  }>;
  overallConfidence: number;
  questionsAsked: number;
}

export function getCoverageStats(tracker: ConversationTracker): CoverageStats {
  const details: CoverageStats['dimensionDetails'] = [];
  let coveredCount = 0;
  let totalConfidence = 0;
  
  for (const dim of DIMENSION_ORDER) {
    const coverage = tracker.dimensions.get(dim)!;
    details.push({
      dimension: dim,
      name: DIMENSION_NAMES[dim],
      covered: coverage.covered,
      confidence: coverage.confidence,
      insightCount: coverage.insights.length
    });
    
    if (coverage.covered) coveredCount++;
    totalConfidence += coverage.confidence;
  }
  
  return {
    totalDimensions: DIMENSION_ORDER.length,
    coveredDimensions: coveredCount,
    coverageRate: coveredCount / DIMENSION_ORDER.length,
    dimensionDetails: details,
    overallConfidence: totalConfidence / DIMENSION_ORDER.length,
    questionsAsked: tracker.questionsAsked.length
  };
}

// ============ 转换为SmartInsight格式 ============

export function toSmartInsights(tracker: ConversationTracker): SmartInsight[] {
  const insights: SmartInsight[] = [];
  
  for (const dim of DIMENSION_ORDER) {
    const coverage = tracker.dimensions.get(dim)!;
    const category = DIMENSION_TO_INSIGHT_CATEGORY[dim];
    
    for (const insight of coverage.insights) {
      insights.push({
        category,
        insight,
        evidence: `通过${DIMENSION_NAMES[dim]}维度对话提取`,
        confidence: coverage.confidence,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return insights;
}

// ============ 导出 ============

export default {
  DIMENSION_ORDER,
  DIMENSION_NAMES,
  GUIDANCE_QUESTIONS,
  createConversationTracker,
  getNextQuestion,
  getFollowUpQuestion,
  extractAndUpdateCoverage,
  getCoverageStats,
  toSmartInsights
};
