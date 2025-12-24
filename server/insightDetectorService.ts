/**
 * 统一洞察检测服务 (Insight Detector Service)
 * 
 * 整合现有推理模块，实现6维度信息检测：
 * 1. 安全约束 (Safety) - 过敏、禁忌、创伤话题
 * 2. 情绪调节 (Emotional) - 充电方式、压力应对
 * 3. 生活节奏 (Lifestyle) - 养宠、健身、作息
 * 4. 感情阶段 (Relationship) - 分手、异地、单身
 * 5. 人生转折 (Career) - 跳槽、创业、移民
 * 6. 隐藏偏好 (Preference) - 话题禁区、活动节奏
 * 
 * 额外维度：
 * 7. 方言特征 (Dialect) - 8种方言检测
 * 8. 对话签名 (Signature) - 深度特征提取
 */

import { detectCantoneseUsage, isCantoneseSpeaker, CANTONESE_PATTERN } from './inference/cantoneseVocabulary';
import { analyzeDialectsFromMessages } from './inference/dialectVocabulary';
import { generateConversationSignature, extractDeepTraits, type DeepTraits } from './inference/conversationSignature';
import { applySmartInference, validateAndCleanInput, SMART_INFERENCE_RULES, type InferenceRule } from './inference/smartInference';
import type { DialectProfile, Level3HiddenInsights } from './inference/informationTiers';

// ============ 6维度洞察类型 ============

export type InsightCategory = 
  | 'safety'      // 安全约束
  | 'emotional'   // 情绪调节
  | 'lifestyle'   // 生活节奏
  | 'relationship'// 感情阶段
  | 'career'      // 人生转折
  | 'preference'  // 隐藏偏好
  | 'dialect'     // 方言特征
  | 'signature';  // 对话签名

export interface DetectedInsight {
  id: string;
  category: InsightCategory;
  subType: string;
  value: string;
  confidence: number;
  evidenceSnippet: string;
  sourceTurnIndex: number;
  needsConfirmation: boolean;
  confirmationTemplate?: string;
}

export interface InsightDetectionResult {
  insights: DetectedInsight[];
  dialectProfile: DialectProfile | null;
  deepTraits: DeepTraits | null;
  totalConfidence: number;
  apiCallsUsed: number;
}

// ============ 6维度检测规则 ============

interface DetectionRule {
  category: InsightCategory;
  subType: string;
  patterns: RegExp[];
  value: string;
  confirmationTemplate: string;
}

const SAFETY_RULES: DetectionRule[] = [
  {
    category: 'safety',
    subType: 'alcohol_allergy',
    patterns: [
      /酒精过敏/,
      /不能喝酒/,
      /喝酒.*过敏/,
      /一喝酒就.*(?:红|过敏|难受)/,
      /酒.*(?:过敏|不行)/,
    ],
    value: '酒精过敏',
    confirmationTemplate: '观察到你提到酒精过敏，因为这对活动安排很重要，期待帮你避开酒局~',
  },
  {
    category: 'safety',
    subType: 'seafood_allergy',
    patterns: [
      /海鲜过敏/,
      /(?:虾|蟹|贝).*过敏/,
      /吃.*海鲜.*(?:过敏|不行)/,
    ],
    value: '海鲜过敏',
    confirmationTemplate: '观察到你对海鲜过敏，因为这影响餐厅选择，期待帮你避开海鲜局~',
  },
  {
    category: 'safety',
    subType: 'vegetarian',
    patterns: [
      /(?:我是|我吃).*素/,
      /素食(?:主义|者)/,
      /不吃(?:肉|荤)/,
      /纯素/,
    ],
    value: '素食',
    confirmationTemplate: '观察到你是素食者，因为这影响餐厅选择，期待帮你找合适的活动~',
  },
  {
    category: 'safety',
    subType: 'spicy_intolerance',
    patterns: [
      /不能吃辣/,
      /吃不了辣/,
      /完全不吃辣/,
      /一点辣都不行/,
    ],
    value: '不吃辣',
    confirmationTemplate: '观察到你不太能吃辣，因为这影响餐厅选择，期待帮你避开火锅局~',
  },
  {
    category: 'safety',
    subType: 'social_anxiety',
    patterns: [
      /社恐/,
      /社交恐惧/,
      /人多.*(?:紧张|害怕|焦虑)/,
      /不太敢.*(?:说话|社交)/,
    ],
    value: '社交焦虑',
    confirmationTemplate: '观察到你可能对社交有些紧张，因为我们想让你舒服，期待帮你配小型温馨局~',
  },
  {
    category: 'safety',
    subType: 'trauma_topic',
    patterns: [
      /(?:不想|不要|别).*(?:提|聊|说).*(?:前任|父母|原生家庭|童年)/,
      /(?:前任|分手).*(?:创伤|阴影|不想提)/,
    ],
    value: '敏感话题',
    confirmationTemplate: '观察到有些话题可能让你不舒服，因为尊重你的边界很重要，期待帮你避开这些话题~',
  },
];

const EMOTIONAL_RULES: DetectionRule[] = [
  {
    category: 'emotional',
    subType: 'introvert_recharge',
    patterns: [
      /(?:需要|喜欢).*(?:独处|自己待)/,
      /(?:社交|聚会).*(?:累|疲|消耗)/,
      /充电.*(?:独处|一个人)/,
    ],
    value: '独处充电',
    confirmationTemplate: '观察到你可能需要独处来充电，因为理解你的节奏很重要，期待帮你配适合的活动~',
  },
  {
    category: 'emotional',
    subType: 'stress_outlet',
    patterns: [
      /压力.*(?:大|很)/,
      /(?:最近|好).*(?:焦虑|烦躁)/,
      /(?:工作|生活).*(?:压力|累)/,
    ],
    value: '压力较大',
    confirmationTemplate: '观察到你可能有些压力，因为放松很重要，期待帮你找轻松解压的活动~',
  },
  {
    category: 'emotional',
    subType: 'seeking_connection',
    patterns: [
      /(?:想|希望).*(?:认识|交).*(?:朋友|人)/,
      /(?:圈子|社交).*(?:小|窄)/,
      /(?:孤独|寂寞)/,
    ],
    value: '渴望连接',
    confirmationTemplate: '观察到你想扩大社交圈，因为这正是我们的使命，期待帮你认识志同道合的朋友~',
  },
  {
    category: 'emotional',
    subType: 'positive_energy',
    patterns: [
      /(?:开心|快乐|积极)/,
      /(?:喜欢|爱).*(?:笑|热闹)/,
      /(?:乐观|阳光)/,
    ],
    value: '正能量',
    confirmationTemplate: '观察到你很有正能量，因为氛围很重要，期待帮你配到同样阳光的朋友~',
  },
];

const LIFESTYLE_RULES: DetectionRule[] = [
  {
    category: 'lifestyle',
    subType: 'pet_owner_cat',
    patterns: [
      /(?:养|有|我的).*猫/,
      /猫奴/,
      /铲屎官/,
      /(?:主子|喵星人)/,
    ],
    value: '养猫',
    confirmationTemplate: '观察到你是猫奴，因为宠物爱好者容易聊到一起，期待帮你配到同好~',
  },
  {
    category: 'lifestyle',
    subType: 'pet_owner_dog',
    patterns: [
      /(?:养|有|我的).*(?:狗|狗狗)/,
      /遛狗/,
      /狗子/,
    ],
    value: '养狗',
    confirmationTemplate: '观察到你养狗狗，因为宠物爱好者容易聊到一起，期待帮你配到同好~',
  },
  {
    category: 'lifestyle',
    subType: 'fitness_enthusiast',
    patterns: [
      /(?:健身|撸铁|举铁)/,
      /(?:每天|经常).*(?:跑步|运动)/,
      /健身房/,
      /私教/,
    ],
    value: '健身爱好者',
    confirmationTemplate: '观察到你爱健身，因为运动习惯影响生活节奏，期待帮你配到同频的人~',
  },
  {
    category: 'lifestyle',
    subType: 'night_owl',
    patterns: [
      /夜猫子/,
      /晚睡/,
      /(?:凌晨|半夜).*(?:睡|醒)/,
      /熬夜/,
    ],
    value: '夜猫子',
    confirmationTemplate: '观察到你是夜猫子，因为作息影响活动时间，期待帮你配晚间活动~',
  },
  {
    category: 'lifestyle',
    subType: 'morning_person',
    patterns: [
      /早起/,
      /(?:六|七)点.*起/,
      /晨跑/,
      /早睡早起/,
    ],
    value: '早起型',
    confirmationTemplate: '观察到你是早起型人，因为作息影响活动时间，期待帮你配合适时段~',
  },
];

const RELATIONSHIP_RULES: DetectionRule[] = [
  {
    category: 'relationship',
    subType: 'recently_single',
    patterns: [
      /刚分手/,
      /(?:最近|刚).*(?:分|单身)/,
      /前任.*(?:刚|最近)/,
    ],
    value: '刚分手',
    confirmationTemplate: '观察到你可能经历了一些情感变化，因为我们想让你舒服，期待帮你找轻松的活动~',
  },
  {
    category: 'relationship',
    subType: 'long_distance',
    patterns: [
      /异地/,
      /(?:对象|男朋友|女朋友).*(?:在|不在)/,
      /两地/,
    ],
    value: '异地恋',
    confirmationTemplate: '观察到你可能在异地恋中，因为理解你的情况，期待帮你找合适的社交~',
  },
  {
    category: 'relationship',
    subType: 'single_long_time',
    patterns: [
      /单身.*(?:很久|多年|几年)/,
      /(?:好几|很多)年.*单身/,
      /母胎solo/,
    ],
    value: '长期单身',
    confirmationTemplate: '观察到你单身一段时间了，因为了解你的状态很重要，期待帮你配合适的活动~',
  },
];

const CAREER_RULES: DetectionRule[] = [
  {
    category: 'career',
    subType: 'job_hunting',
    patterns: [
      /(?:在|正在).*(?:找工作|求职)/,
      /投简历/,
      /面试/,
      /离职.*(?:中|了)/,
      /gap.*year/i,
    ],
    value: '求职中',
    confirmationTemplate: '观察到你可能在找工作，因为职业转换期需要支持，期待帮你认识靠谱的人~',
  },
  {
    category: 'career',
    subType: 'startup_phase',
    patterns: [
      /(?:在|正在).*创业/,
      /自己.*公司/,
      /合伙人/,
      /(?:刚|新).*(?:开|创).*(?:公司|店)/,
    ],
    value: '创业中',
    confirmationTemplate: '观察到你在创业，因为创业者需要特定的社交圈，期待帮你认识志同道合的人~',
  },
  {
    category: 'career',
    subType: 'immigration_plan',
    patterns: [
      /(?:想|打算|考虑).*(?:移民|出国)/,
      /(?:办|申请).*(?:签证|绿卡|PR)/,
      /(?:润|移|去).*(?:国外|海外)/,
    ],
    value: '考虑移民',
    confirmationTemplate: '观察到你在考虑出国，因为这是人生大事，期待帮你认识有经验的人~',
  },
  {
    category: 'career',
    subType: 'burnout',
    patterns: [
      /(?:好|很).*(?:累|疲|倦)/,
      /加班.*(?:多|累)/,
      /(?:工作|上班).*(?:压力|累)/,
      /想躺平/,
    ],
    value: '职业倦怠',
    confirmationTemplate: '观察到你可能有些累，因为放松很重要，期待帮你找轻松有趣的活动~',
  },
];

const PREFERENCE_RULES: DetectionRule[] = [
  {
    category: 'preference',
    subType: 'avoid_large_groups',
    patterns: [
      /(?:不喜欢|不想).*(?:人多|大群)/,
      /小(?:型|圈子)/,
      /(?:三|四|五)个人.*(?:刚好|够)/,
    ],
    value: '偏好小型活动',
    confirmationTemplate: '观察到你喜欢小型聚会，因为人数影响氛围，期待帮你配5-8人的局~',
  },
  {
    category: 'preference',
    subType: 'no_karaoke',
    patterns: [
      /(?:不|讨厌).*(?:唱歌|KTV|K歌)/,
      /(?:唱歌|KTV).*(?:不行|不会|恐惧)/,
      /五音不全/,
    ],
    value: '不喜欢KTV',
    confirmationTemplate: '观察到你不太喜欢唱K，因为活动类型很重要，期待帮你避开KTV局~',
  },
  {
    category: 'preference',
    subType: 'outdoor_lover',
    patterns: [
      /(?:喜欢|爱).*(?:户外|徒步|爬山|露营)/,
      /户外.*(?:活动|运动)/,
      /(?:周末|经常).*(?:爬山|徒步)/,
    ],
    value: '户外爱好者',
    confirmationTemplate: '观察到你喜欢户外活动，因为活动类型很重要，期待帮你找户外局~',
  },
];

const ALL_DETECTION_RULES: DetectionRule[] = [
  ...SAFETY_RULES,
  ...EMOTIONAL_RULES,
  ...LIFESTYLE_RULES,
  ...RELATIONSHIP_RULES,
  ...CAREER_RULES,
  ...PREFERENCE_RULES,
];

// ============ 检测服务类 ============

export class InsightDetectorService {
  private apiCallCount = 0;
  private maxApiCalls = 2; // 每用户最多2次API调用

  /**
   * 从单条消息中检测洞察
   */
  detectFromMessage(
    message: string,
    turnIndex: number,
    existingInsights: DetectedInsight[] = []
  ): DetectedInsight[] {
    const newInsights: DetectedInsight[] = [];
    const existingSubTypes = new Set(existingInsights.map(i => i.subType));

    for (const rule of ALL_DETECTION_RULES) {
      // 跳过已检测到的子类型
      if (existingSubTypes.has(rule.subType)) continue;

      for (const pattern of rule.patterns) {
        if (pattern.test(message)) {
          // 提取证据片段
          const match = message.match(pattern);
          const evidenceSnippet = match ? match[0] : message.slice(0, 50);

          newInsights.push({
            id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            category: rule.category,
            subType: rule.subType,
            value: rule.value,
            confidence: 0.85, // 正则匹配的默认置信度
            evidenceSnippet,
            sourceTurnIndex: turnIndex,
            needsConfirmation: rule.category === 'safety', // 安全类需要确认
            confirmationTemplate: rule.confirmationTemplate,
          });
          
          existingSubTypes.add(rule.subType);
          break; // 一个规则只匹配一次
        }
      }
    }

    return newInsights;
  }

  /**
   * 检测方言特征
   */
  detectDialect(messages: Array<{ role: string; content: string }>): DialectProfile | null {
    try {
      const userMessages = messages.filter(m => m.role === 'user');

      if (userMessages.length === 0) return null;

      // 使用现有的方言分析函数 - 传递完整消息格式
      const dialectProfile = analyzeDialectsFromMessages(userMessages);
      
      return dialectProfile;
    } catch (error) {
      console.error('[InsightDetector] Dialect detection error:', error);
      return null;
    }
  }

  /**
   * 生成对话签名和深度特征
   */
  generateSignature(
    messages: Array<{ role: string; content: string }>,
    dialectProfile: DialectProfile | null
  ): DeepTraits | null {
    try {
      if (messages.length < 4) return null; // 至少4轮对话才能提取特征

      const deepTraits = extractDeepTraits(messages);
      return deepTraits;
    } catch (error) {
      console.error('[InsightDetector] Signature generation error:', error);
      return null;
    }
  }

  /**
   * 完整的对话洞察检测
   */
  async analyzeConversation(
    messages: Array<{ role: string; content: string }>
  ): Promise<InsightDetectionResult> {
    const insights: DetectedInsight[] = [];
    
    // 1. 逐条消息检测规则匹配的洞察
    messages.forEach((msg, index) => {
      if (msg.role === 'user') {
        const detected = this.detectFromMessage(msg.content, index, insights);
        insights.push(...detected);
      }
    });

    // 2. 检测方言特征
    const dialectProfile = this.detectDialect(messages);

    // 3. 生成对话签名
    const deepTraits = this.generateSignature(messages, dialectProfile);

    // 4. 计算总体置信度
    const totalConfidence = insights.length > 0
      ? insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length
      : 0;

    return {
      insights,
      dialectProfile,
      deepTraits,
      totalConfidence,
      apiCallsUsed: this.apiCallCount,
    };
  }

  /**
   * 获取需要确认的洞察
   */
  getInsightsNeedingConfirmation(insights: DetectedInsight[]): DetectedInsight[] {
    return insights.filter(i => i.needsConfirmation && i.confirmationTemplate);
  }

  /**
   * 生成治愈系确认消息
   */
  generateConfirmationMessage(insight: DetectedInsight): string {
    return insight.confirmationTemplate || 
      `观察到你提到了${insight.value}，因为这对匹配很重要，期待帮你找到更合适的活动~`;
  }

  /**
   * 重置API调用计数
   */
  resetApiCallCount(): void {
    this.apiCallCount = 0;
  }
}

export const insightDetectorService = new InsightDetectorService();
