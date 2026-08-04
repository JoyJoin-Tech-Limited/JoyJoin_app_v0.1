/**
 * ⚠️  DEPRECATION NOTICE — Xiaoyue Conversational Chat
 *
 * Xiaoyue chat-based onboarding is **deprecated** and **no longer used**
 * for new-user onboarding.  The active onboarding flow is server-driven:
 *
 *   GET /api/auth/user → nextStep
 *     → /onboarding/setup  (essential profile)
 *     → /onboarding/extended  (interests, etc.)
 *     → /onboarding/review  (personality result)
 *     → /discover
 *
 * Xiaoyue lives on **only as a mascot character** (visual expressions,
 * loading animations, empty states).  Do NOT route new onboarding work
 * through the chat functions below.
 *
 * What still works:
 *   - `startXiaoyueChatEnrichment`  → enrichment mode (post-onboarding)
 *   - `continueXiaoyueChatWithInference`  → existing chat sessions only
 *
 * What is banned for new features:
 *   - Chat-based registration / onboarding
 *   - Conversational profile collection as the primary onboarding path
 */

import { logger } from "./lib/logger";
import { getDeepseekModel } from "./ai/deepseekClient";
import { getXiaoyueSystemPrompt } from "./deepseekClientXiaoyuePrompts";
import type { DetectedInsight } from "./insightDetectorService";
import {
  getOrCreateOrchestratorState,
  getNextQuestion,
  markQuestionAsked,
  generateDynamicPromptInjection,
  generateDimensionTransition,
  calculateCompletionStatus,
  type RegistrationMode as OrchestratorMode,
} from "./inference/dimensionOrchestrator";
import {
  inferenceEngine,
  generateXiaoyueContext,
  quickInfer,
  type UserAttributeMap,
  type InferenceEngineResult,
} from "./inference";
import deepseekClient, {
  type SmartInsight,
  type InferredTraits,
  type XiaoyueCollectedInfo,
  type ChatMessage,
  trimConversationHistory,
  calculatePreciseAge,
  parseBirthDateFromInput,
} from "./deepseekClient";

export interface EnrichmentContext {
  existingProfile: {
    displayName?: string;
    gender?: string;
    birthdate?: string;
    currentCity?: string;
    occupation?: string;
    industry?: string;
    seniority?: string;
    topInterests?: string[];
    educationLevel?: string;
    relationshipStatus?: string;
    intent?: string;
    hometownCountry?: string;
    languagesComfort?: string[];
    socialStyle?: string;
    socialEnergyType?: string;
    activityTimePreferences?: string[];
    socialFrequency?: string;
    archetypeResult?: any;
    topicAvoidances?: string[];
  };
  missingFields: string[];
}

const ENRICHMENT_SYSTEM_ADDITION = `
## 【深度资料补充模式】
这是一位老朋友回来补充资料～用你Nick Wilde式的俏皮调侃风格，轻松愉快地聊天！

**你已经知道的信息（绝对不要再问！）**：
{KNOWN_INFO}

**需要补充的信息（按优先级问，每次只问一个）**：
{MISSING_FIELDS}

**【重要】以下信息在活动报名时已收集，千万不要问：**
- 预算范围（budgetRange）
- 语言偏好（preferredLanguages） 
- 饮食偏好（cuisinePreferences）
- 饮食限制（dietaryRestrictions）
- 装修风格偏好（decorStylePreferences）
- 社交目标（eventIntent）

**对话风格（Nick Wilde式）**：
1. 俏皮调侃但不油腻：
   - "诶，说起来你平时..."
   - "哈，我好奇问一下..."
   - "嘿嘿，那你一般..."
2. 性别适配的称呼（已知性别时）：
   - 男性："帅哥"、"兄弟"、"老铁"
   - 女性："美女"、"小姐姐"、"小可爱"
   - 未知："朋友"、"你"
3. 善于接话和调侃：根据用户回答自然延伸，不要生硬跳转
4. 轻松节奏：每轮只问一个问题，有时可以纯聊天不收集信息

**问题优先级（先问高影响字段）**：
- Tier 1 (高影响): 活动时间偏好、社交频率、社交能量类型、性格类型
- Tier 2 (中影响): 职业、行业、资历、学历
- Tier 3 (辅助): 兴趣爱好、感情状态、话题避开

**结束条件**：
- 收集到3-5个新信息后，自然收尾
- 用户表示想结束时，愉快收尾
- 收尾时先总结收获，表达期待，然后发送 \`\`\`registration_complete\`\`\`

**收尾话术示例**：
"好啦～今天聊得挺开心的！资料更完整了，下次给你匹配的活动伙伴肯定更合拍～期待你来参加活动呀！"
`;

function buildEnrichmentPrompt(context: EnrichmentContext): string {
  const { existingProfile, missingFields } = context;

  const knownInfoLines: string[] = [];
  if (existingProfile.displayName)
    knownInfoLines.push(`- 昵称：${existingProfile.displayName}`);
  if (existingProfile.gender)
    knownInfoLines.push(
      `- 性别：${existingProfile.gender === "male" ? "男" : existingProfile.gender === "female" ? "女" : existingProfile.gender}`,
    );
  if (existingProfile.birthdate)
    knownInfoLines.push(`- 生日：${existingProfile.birthdate}`);
  if (existingProfile.currentCity)
    knownInfoLines.push(`- 城市：${existingProfile.currentCity}`);
  if (existingProfile.occupation)
    knownInfoLines.push(`- 职业：${existingProfile.occupation}`);
  if (existingProfile.industry)
    knownInfoLines.push(`- 行业：${existingProfile.industry}`);
  if (existingProfile.seniority)
    knownInfoLines.push(`- 资历：${existingProfile.seniority}`);
  if (existingProfile.topInterests?.length)
    knownInfoLines.push(`- 兴趣：${existingProfile.topInterests.join("、")}`);
  if (existingProfile.educationLevel)
    knownInfoLines.push(`- 学历：${existingProfile.educationLevel}`);
  if (existingProfile.relationshipStatus)
    knownInfoLines.push(`- 感情状态：${existingProfile.relationshipStatus}`);
  if (existingProfile.intent)
    knownInfoLines.push(`- 社交意向：${existingProfile.intent}`);
  if (existingProfile.hometownCountry)
    knownInfoLines.push(`- 家乡：${existingProfile.hometownCountry}`);
  if (existingProfile.languagesComfort?.length)
    knownInfoLines.push(
      `- 语言：${existingProfile.languagesComfort.join("、")}`,
    );
  if (existingProfile.socialStyle)
    knownInfoLines.push(`- 社交风格：${existingProfile.socialStyle}`);
  if (existingProfile.socialEnergyType)
    knownInfoLines.push(`- 社交能量：${existingProfile.socialEnergyType}`);
  if (existingProfile.activityTimePreferences?.length)
    knownInfoLines.push(
      `- 活动时间偏好：${existingProfile.activityTimePreferences.join("、")}`,
    );
  if (existingProfile.socialFrequency)
    knownInfoLines.push(`- 社交频率：${existingProfile.socialFrequency}`);
  if (existingProfile.archetypeResult)
    knownInfoLines.push(`- 性格类型：已完成测试`);
  if (existingProfile.topicAvoidances?.length)
    knownInfoLines.push(
      `- 话题避开：${existingProfile.topicAvoidances.join("、")}`,
    );

  const knownInfo =
    knownInfoLines.length > 0 ? knownInfoLines.join("\n") : "（暂无已知信息）";
  const missing =
    missingFields.length > 0
      ? missingFields.map((f: string) => `- ${f}`).join("\n")
      : "（无缺失信息）";

  return ENRICHMENT_SYSTEM_ADDITION.replace("{KNOWN_INFO}", knownInfo).replace(
    "{MISSING_FIELDS}",
    missing,
  );
}

function generateEnrichmentOpening(context: EnrichmentContext): string {
  const { existingProfile, missingFields } = context;
  const name = existingProfile.displayName || "朋友";
  const gender = existingProfile.gender;

  // 性别适配称呼
  const genderAddress =
    gender === "male" ? "帅哥" : gender === "female" ? "小姐姐" : "朋友";

  const greetings = [
    `嘿～${name}${genderAddress}，又见面啦！想跟你多聊几句～`,
    `哟～${name}回来啦！上次聊得不过瘾，今天继续？`,
    `诶${name}～我是悦仔呀！来补充点资料，让匹配更精准～`,
  ];

  let opening = greetings[Math.floor(Math.random() * greetings.length)];

  if (missingFields.length > 0) {
    // Tier 1优先级字段的开场问题
    const fieldHints: Record<string, string> = {
      // Tier 1 - 高影响
      活动时间偏好: "话说你一般什么时候有空参加活动呀？工作日晚上还是周末？",
      社交频率: "你喜欢频繁社交还是偶尔来一场？",
      社交能量类型:
        "参加活动的时候，你是那种能量满满带动气氛的，还是更喜欢安静观察？",
      性格类型: "说起来，你觉得自己在社交场合是什么风格呀？",
      // Tier 2 - 中影响
      职业: "话说你现在是做什么工作的呀？",
      行业: "在什么行业发展呢？",
      资历: "工作几年啦？",
      学历: "读的什么专业呀？",
      性别: "先问个基础的，你是帅哥还是美女呀？",
      年龄: "大概是什么年龄段的呢？",
      // Tier 3 - 辅助
      兴趣爱好: "平时下班之后都喜欢做什么呀？",
      感情状态: "现在是一个人还是有伴儿呀？",
      话题避开: "有什么话题是你不太想在活动中聊的吗？",
      城市: "你现在在哪个城市呀？",
      家乡: "老家是哪里的呢？",
      社交风格: "参加活动的话，喜欢大家一起热闹还是小组深聊？",
    };

    const firstMissing = missingFields[0];
    const hint = fieldHints[firstMissing];
    if (hint) {
      opening += `\n\n${hint}`;
    }
  }

  return opening;
}

export async function startXiaoyueChatEnrichment(
  context: EnrichmentContext,
): Promise<{
  message: string;
  conversationHistory: ChatMessage[];
  mode: "enrichment";
}> {
  const enrichmentAddition = buildEnrichmentPrompt(context);
  const fullSystemPrompt = getXiaoyueSystemPrompt() + enrichmentAddition;
  const opening = generateEnrichmentOpening(context);

  return {
    message: opening,
    conversationHistory: [
      { role: "system", content: fullSystemPrompt },
      { role: "assistant", content: opening },
    ],
    mode: "enrichment",
  };
}

// 多问号验证器：检测并修复一条消息问多个问题的情况
// 如果AI回复包含多个问号，只保留第一个问句，后续问题留到下一轮
function enforceOneQuestionPerTurn(message: string): string {
  // 检测问号数量（中文和英文）
  const questionMarks = (message.match(/[？?]/g) || []).length;

  if (questionMarks <= 1) {
    return message; // 只有0或1个问号，正常返回
  }

  logger.info(
    `[WARN] Multi-question detected (${questionMarks} questions), truncating to first question`,
  );
  logger.info("[WARN] Original:", { value: message });

  // 按句子分割（保留问号）
  const sentences = message.split(/(?<=[。！？?!])/);

  // 找到第一个问句的位置
  let result = "";
  let foundFirstQuestion = false;

  for (const sentence of sentences) {
    if (!foundFirstQuestion) {
      result += sentence;
      if (/[？?]/.test(sentence)) {
        foundFirstQuestion = true;
      }
    }
  }

  // 如果截断后内容太短，返回原始消息（避免过度截断）
  if (result.trim().length < 10) {
    return message;
  }

  logger.info("[WARN] Truncated to: " + result.trim());
  return result.trim();
}

/**
 * 从对话历史中提取已收集的信息（合并所有 assistant 消息中的 collected_info）
 * 用于状态驱动摘要
 */
function extractCollectedInfoFromHistory(
  history: ChatMessage[],
): Partial<XiaoyueCollectedInfo> {
  const merged: Partial<XiaoyueCollectedInfo> = {};

  for (const msg of history) {
    if (msg.role === "assistant") {
      const info = extractCollectedInfo(msg.content);
      // 合并非空字段
      Object.entries(info).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          (merged as any)[key] = value;
        }
      });
    }
  }

  return merged;
}

function extractCollectedInfo(message: string): Partial<XiaoyueCollectedInfo> {
  const match = message.match(/```collected_info\s*([\s\S]*?)```/);

  // Debug日志
  if (!match) {
    logger.info("[DEBUG] extractCollectedInfo: No match found");
    logger.info("[DEBUG] Message preview: " + message.substring(0, 300));
    return {};
  }

  try {
    const jsonStr = match[1].trim();
    logger.info(
      `[DEBUG] extractCollectedInfo: Found JSON block: ${jsonStr.substring(0, 200)}`,
    );
    const result = JSON.parse(jsonStr);
    logger.info(
      `[DEBUG] extractCollectedInfo: Parsed successfully: ${Object.keys(result).join(", ")}`,
    );

    // 智能洞察处理：验证和过滤smartInsights
    if (result.smartInsights && Array.isArray(result.smartInsights)) {
      const validCategories = [
        "career",
        "personality",
        "lifestyle",
        "preference",
        "background",
        "social",
      ];
      result.smartInsights = result.smartInsights
        .filter((insight: any) => {
          // 验证必需字段和置信度阈值
          return (
            insight &&
            typeof insight.category === "string" &&
            validCategories.includes(insight.category) &&
            typeof insight.insight === "string" &&
            insight.insight.length > 0 &&
            typeof insight.confidence === "number" &&
            insight.confidence >= 0.7 // 最低置信度阈值
          );
        })
        .map((insight: any) => ({
          ...insight,
          timestamp: new Date().toISOString(),
        }));

      logger.info(
        "[DEBUG] extractCollectedInfo: Validated smartInsights count:",
        result.smartInsights.length,
      );
    }

    // 推断特征处理：验证inferredTraits
    if (result.inferredTraits && typeof result.inferredTraits === "object") {
      // 确保置信度字段存在
      if (typeof result.inferredTraits.overallConfidence !== "number") {
        result.inferredTraits.overallConfidence = 0.7;
      }
      logger.info(
        "[DEBUG] extractCollectedInfo: InferredTraits confidence:",
        result.inferredTraits.overallConfidence,
      );
    }

    return result;
  } catch (error) {
    logger.error("[DEBUG] extractCollectedInfo: JSON parse failed:", { error: error instanceof Error ? error.message : String(error) });
    return {};
  }
}

// 字段校验和规范化
function validateAndNormalizeInfo(
  info: Partial<XiaoyueCollectedInfo>,
): XiaoyueCollectedInfo {
  const normalized: XiaoyueCollectedInfo = {};

  // displayName - 去除空白，过滤无效值
  if (info.displayName && typeof info.displayName === "string") {
    const name = info.displayName.trim();
    if (name && name !== "保密" && name !== "不透露" && name.length >= 1) {
      normalized.displayName = name;
    }
  }

  // gender - 规范化性别表达
  if (info.gender && typeof info.gender === "string") {
    const g = info.gender.toLowerCase();
    if (g.includes("女") || g === "female") {
      normalized.gender = "女性";
    } else if (g.includes("男") || g === "male") {
      normalized.gender = "男性";
    } else if (g.includes("保密") || g.includes("不透露")) {
      normalized.gender = "不透露";
    } else {
      normalized.gender = info.gender;
    }
  }

  // birthYear - 规范化年龄/年代表达
  if (info.birthYear !== undefined) {
    let year = info.birthYear;
    // 如果是两位数年份(如95)，转换为完整年份
    if (typeof year === "number" && year < 100) {
      year = year >= 0 && year <= 25 ? 2000 + year : 1900 + year;
    }
    // 如果是字符串如"95后"
    if (typeof year === "string") {
      const match = (year as string).match(/(\d{2,4})/);
      if (match) {
        let y = parseInt(match[1], 10);
        if (y < 100) {
          y = y >= 0 && y <= 25 ? 2000 + y : 1900 + y;
        }
        year = y;
      }
    }
    if (typeof year === "number" && year >= 1960 && year <= 2010) {
      normalized.birthYear = year;
    }
  }

  // currentCity - 规范化城市
  if (info.currentCity && typeof info.currentCity === "string") {
    const city = info.currentCity.trim();
    if (city && city !== "保密" && city !== "不透露") {
      normalized.currentCity = city;
    }
  }

  // occupationDescription - 职业描述
  if (
    info.occupationDescription &&
    typeof info.occupationDescription === "string"
  ) {
    const occ = info.occupationDescription.trim();
    if (occ && occ !== "保密" && occ !== "不透露" && occ.length >= 1) {
      normalized.occupationDescription = occ;
    }
  }

  // interestsTop - 兴趣数组
  if (info.interestsTop && Array.isArray(info.interestsTop)) {
    const interests = info.interestsTop
      .filter((i) => typeof i === "string" && i.trim())
      .map((i) => i.trim());
    if (interests.length > 0) {
      normalized.interestsTop = interests;
    }
  }

  // primaryInterests
  if (info.primaryInterests && Array.isArray(info.primaryInterests)) {
    const primary = info.primaryInterests
      .filter((i) => typeof i === "string" && i.trim())
      .map((i) => i.trim());
    if (primary.length > 0) {
      normalized.primaryInterests = primary;
    }
  }

  // intent - 活动意图
  const validIntents = [
    "networking",
    "friends",
    "discussion",
    "fun",
    "explore",
    "romance",
    "flexible",
  ];
  if (info.intent && Array.isArray(info.intent)) {
    const intents = info.intent.filter((i) => validIntents.includes(i));
    if (intents.length > 0) {
      normalized.intent = intents;
    }
  }

  // lifeStage - 人生阶段
  if (info.lifeStage && typeof info.lifeStage === "string") {
    normalized.lifeStage = info.lifeStage.trim();
  }

  // ageMatchPreference - 年龄匹配偏好 (更新：用mixed替代younger/older以减少催婚感)
  const validAgePrefs = ["mixed", "same_generation", "flexible"];
  if (info.ageMatchPreference && typeof info.ageMatchPreference === "string") {
    const agePref = info.ageMatchPreference
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    if (validAgePrefs.includes(agePref)) {
      normalized.ageMatchPreference = agePref;
    } else {
      // 兼容旧值：younger/older 映射到 mixed
      if (agePref === "younger" || agePref === "older") {
        normalized.ageMatchPreference = "mixed";
      } else {
        normalized.ageMatchPreference = info.ageMatchPreference.trim();
      }
    }
  }

  // ageDisplayPreference - 年龄显示偏好
  const validDisplayPrefs = ["decade", "range", "hidden"];
  if (
    info.ageDisplayPreference &&
    typeof info.ageDisplayPreference === "string"
  ) {
    const displayPref = info.ageDisplayPreference.trim().toLowerCase();
    if (validDisplayPrefs.includes(displayPref)) {
      normalized.ageDisplayPreference = displayPref;
    }
  }

  // hasPets
  if (typeof info.hasPets === "boolean") {
    normalized.hasPets = info.hasPets;
  }

  // petTypes
  if (info.petTypes && Array.isArray(info.petTypes)) {
    const pets = info.petTypes.filter((p) => typeof p === "string" && p.trim());
    if (pets.length > 0) {
      normalized.petTypes = pets;
    }
  }

  // hasSiblings
  if (typeof info.hasSiblings === "boolean") {
    normalized.hasSiblings = info.hasSiblings;
  }

  // relationshipStatus
  if (info.relationshipStatus && typeof info.relationshipStatus === "string") {
    normalized.relationshipStatus = info.relationshipStatus.trim();
  }

  // hometown
  if (info.hometown && typeof info.hometown === "string") {
    const ht = info.hometown.trim();
    if (ht && ht !== "保密" && ht !== "不透露") {
      normalized.hometown = ht;
    }
  }

  // languagesComfort
  if (info.languagesComfort && Array.isArray(info.languagesComfort)) {
    const langs = info.languagesComfort.filter(
      (l) => typeof l === "string" && l.trim(),
    );
    if (langs.length > 0) {
      normalized.languagesComfort = langs;
    }
  }

  // venueStylePreference
  if (
    info.venueStylePreference &&
    typeof info.venueStylePreference === "string"
  ) {
    normalized.venueStylePreference = info.venueStylePreference.trim();
  }

  // topicAvoidances
  if (info.topicAvoidances && Array.isArray(info.topicAvoidances)) {
    const avoid = info.topicAvoidances.filter(
      (t) => typeof t === "string" && t.trim(),
    );
    if (avoid.length > 0) {
      normalized.topicAvoidances = avoid;
    }
  }

  // socialStyle
  if (info.socialStyle && typeof info.socialStyle === "string") {
    normalized.socialStyle = info.socialStyle.trim();
  }

  // additionalNotes
  if (info.additionalNotes && typeof info.additionalNotes === "string") {
    normalized.additionalNotes = info.additionalNotes.trim();
  }

  // cuisinePreference
  if (info.cuisinePreference && Array.isArray(info.cuisinePreference)) {
    const cuisine = info.cuisinePreference.filter(
      (c) => typeof c === "string" && c.trim(),
    );
    if (cuisine.length > 0) {
      normalized.cuisinePreference = cuisine;
    }
  }

  // favoriteRestaurant
  if (info.favoriteRestaurant && typeof info.favoriteRestaurant === "string") {
    const rest = info.favoriteRestaurant.trim();
    if (rest) {
      normalized.favoriteRestaurant = rest;
    }
  }

  // favoriteRestaurantReason
  if (
    info.favoriteRestaurantReason &&
    typeof info.favoriteRestaurantReason === "string"
  ) {
    const reason = info.favoriteRestaurantReason.trim();
    if (reason) {
      normalized.favoriteRestaurantReason = reason;
    }
  }

  // children
  if (info.children && typeof info.children === "string") {
    const child = info.children.trim();
    if (child) {
      normalized.children = child;
    }
  }

  // educationLevel
  if (info.educationLevel && typeof info.educationLevel === "string") {
    const edu = info.educationLevel.trim();
    if (edu) {
      normalized.educationLevel = edu;
    }
  }

  // fieldOfStudy
  if (info.fieldOfStudy && typeof info.fieldOfStudy === "string") {
    const field = info.fieldOfStudy.trim();
    if (field) {
      normalized.fieldOfStudy = field;
    }
  }

  // conversationalProfile - with type guards for proper validation
  if (
    info.conversationalProfile &&
    typeof info.conversationalProfile === "object"
  ) {
    const cp = info.conversationalProfile;
    const validResponseLength = ["brief", "moderate", "detailed"];
    const validEmojiUsage = ["none", "few", "many"];
    const validFormalityLevel = ["casual", "neutral", "formal"];
    const validProactiveness = ["passive", "neutral", "proactive"];

    const profile: XiaoyueCollectedInfo["conversationalProfile"] = {
      responseLength: validResponseLength.includes(cp.responseLength)
        ? cp.responseLength
        : "moderate",
      emojiUsage: validEmojiUsage.includes(cp.emojiUsage)
        ? cp.emojiUsage
        : "few",
      formalityLevel: validFormalityLevel.includes(cp.formalityLevel)
        ? cp.formalityLevel
        : "neutral",
      proactiveness: validProactiveness.includes(cp.proactiveness)
        ? cp.proactiveness
        : "neutral",
      registrationTime: cp.registrationTime || new Date().toISOString(),
      completionSpeed: ["fast", "medium", "slow"].includes(cp.completionSpeed)
        ? cp.completionSpeed
        : "medium",
    };
    normalized.conversationalProfile = profile;
  }

  // 社交能量维度（新增）
  if (
    info.energyRechargeMethod &&
    typeof info.energyRechargeMethod === "string"
  ) {
    normalized.energyRechargeMethod = info.energyRechargeMethod.trim();
  }
  if (
    info.idealSocialDuration &&
    typeof info.idealSocialDuration === "string"
  ) {
    normalized.idealSocialDuration = info.idealSocialDuration.trim();
  }
  if (info.socialFrequency && typeof info.socialFrequency === "string") {
    normalized.socialFrequency = info.socialFrequency.trim();
  }

  // activityTimePreference - 活动时段偏好
  if (
    info.activityTimePreference &&
    typeof info.activityTimePreference === "string"
  ) {
    normalized.activityTimePreference = info.activityTimePreference.trim();
  }

  // 社交场景偏好（新增）
  if (info.activityPace && typeof info.activityPace === "string") {
    normalized.activityPace = info.activityPace.trim();
  }
  if (info.breakingIceRole && typeof info.breakingIceRole === "string") {
    normalized.breakingIceRole = info.breakingIceRole.trim();
  }
  if (info.socialContinuity && typeof info.socialContinuity === "string") {
    normalized.socialContinuity = info.socialContinuity.trim();
  }

  return normalized;
}

// 会话状态存储（内存中）
const sessionInferenceStates: Map<string, UserAttributeMap> = new Map();

// ===== AI Evolution: Session Insight Store =====
const sessionInsightStore: Map<string, DetectedInsight[]> = new Map();

/**
 * AI Evolution: 获取会话累积的洞察
 */
export function getSessionInsights(sessionId: string): DetectedInsight[] {
  return sessionInsightStore.get(sessionId) || [];
}

/**
 * AI Evolution: 添加洞察到会话累积
 */
export function addSessionInsights(
  sessionId: string,
  insights: DetectedInsight[],
): void {
  const existing = sessionInsightStore.get(sessionId) || [];
  const existingSubTypes = new Set(existing.map((i) => i.subType));
  const newInsights = insights.filter((i) => !existingSubTypes.has(i.subType));

  if (newInsights.length > 0) {
    sessionInsightStore.set(sessionId, [...existing, ...newInsights]);
    logger.info(
      `[AI Evolution] 会话 ${sessionId} 累积洞察: ${sessionInsightStore.get(sessionId)?.length || 0} 个`,
    );
  }
}

/**
 * 获取或创建会话的推断状态
 */
export function getSessionInferenceState(sessionId: string): UserAttributeMap {
  if (!sessionInferenceStates.has(sessionId)) {
    sessionInferenceStates.set(sessionId, {});
  }
  return sessionInferenceStates.get(sessionId)!;
}

/**
 * 更新会话的推断状态
 */
export function updateSessionInferenceState(
  sessionId: string,
  state: UserAttributeMap,
): void {
  sessionInferenceStates.set(sessionId, state);
}

/**
 * 生成推断增强的系统提示词补充
 */
function generateInferencePromptAddition(state: UserAttributeMap): string {
  const context = generateXiaoyueContext(state);

  if (!context || context.includes("暂无")) {
    return "";
  }

  return `

## 【智能推断上下文 - 重要！】
${context}

**推断行为准则**：
1. 对于"不要问的问题"列表中的字段，绝对不要再问，这些信息已经从用户之前的回答中推断出来了
2. 对于"可以确认的信息"，可以用确认式提问简单确认，而不是开放式提问
3. 如果用户之前说过类似"我在创业"，不要再问"人生阶段"，因为已经推断出来了
4. 保持对话连贯性，不要让用户觉得你没有在听他说话`;
}

/**
 * 增强版对话继续函数 - 带推断引擎
 */
export async function continueXiaoyueChatWithInference(
  userMessage: string,
  conversationHistory: ChatMessage[],
  sessionId: string,
): Promise<{
  message: string;
  rawMessage: string;
  collectedInfo: Partial<XiaoyueCollectedInfo>;
  isComplete: boolean;
  conversationHistory: ChatMessage[];
  inferenceResult?: InferenceEngineResult;
}> {
  // 1. 获取当前推断状态
  const currentState = getSessionInferenceState(sessionId);

  // 2. 运行推断引擎
  const inferenceResult = await inferenceEngine.process(
    userMessage,
    conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    currentState,
    sessionId,
  );

  // 3. 更新推断状态
  updateSessionInferenceState(sessionId, inferenceResult.newState);

  // 3.5 AI Evolution: 实时洞察检测 (per-message) + L3完整分析 + 累积存储 + 持久化
  try {
    const { insightDetectorService } = await import("./insightDetectorService");
    const { dialogueEmbeddingsService } = await import(
      "./dialogueEmbeddingsService"
    );
    const existingInsights = getSessionInsights(sessionId);
    const turnIndex = conversationHistory.filter(
      (m) => m.role === "user",
    ).length;
    const detectedInsights = insightDetectorService.detectFromMessage(
      userMessage,
      turnIndex,
      existingInsights,
    );

    // L3完整分析：每3轮或有足够消息时运行dialectProfile和deepTraits分析
    let dialectProfile = null;
    let deepTraits = null;
    const userMessages = conversationHistory.filter((m) => m.role === "user");
    if (turnIndex >= 3 && turnIndex % 3 === 0) {
      // 运行完整L3分析（方言画像 + 深度特质）
      const fullAnalysis = await insightDetectorService.analyzeConversation([
        ...conversationHistory,
        { role: "user", content: userMessage },
      ]);
      dialectProfile = fullAnalysis.dialectProfile;
      deepTraits = fullAnalysis.deepTraits;
      logger.info(
        `[L3 Analysis] 会话 ${sessionId}: 方言=${dialectProfile?.primaryDialect || "未检测"}, 深度特质已提取`,
      );
    }

    if (detectedInsights.length > 0 || dialectProfile || deepTraits) {
      // 累积到内存
      if (detectedInsights.length > 0) {
        addSessionInsights(sessionId, detectedInsights);
      }

      // 持久化到数据库（防止用户中途退出丢失洞察）
      await dialogueEmbeddingsService.storeInsights(
        sessionId,
        null,
        userMessage,
        {
          insights: detectedInsights,
          dialectProfile,
          deepTraits,
          totalConfidence: 0.85,
          apiCallsUsed: 0,
        },
        false, // isSuccessful = false indicates partial/in-progress
      );
    }
  } catch (insightError) {
    logger.error("[L3 Analysis] 洞察检测错误:", { error: insightError instanceof Error ? insightError.message : String(insightError) });
    // Non-blocking
  }

  // 4. 生成推断上下文补充
  const inferenceAddition = generateInferencePromptAddition(
    inferenceResult.newState,
  );

  // 4.5 【新增】6维度编排器动态prompt注入
  let orchestratorAddition = "";
  try {
    // 从conversationHistory第一条系统消息中提取mode（极速/标准/深度）
    const systemMsg =
      conversationHistory.find((m) => m.role === "system")?.content || "";
    const modeMatch = systemMsg.match(/极速模式|标准模式|深度模式/);
    const mode: OrchestratorMode =
      modeMatch?.[0] === "极速模式"
        ? "express"
        : modeMatch?.[0] === "深度模式"
          ? "deep"
          : "standard";

    // 获取编排器状态
    const orchestratorState = getOrCreateOrchestratorState(sessionId, mode);

    // 构建已收集字段Map（从inferenceResult.newState提取）
    // 使用0.5阈值以捕获更多待确认字段，提高维度覆盖检测准确性
    const collectedFields: Record<string, unknown> = {};
    for (const [field, attr] of Object.entries(inferenceResult.newState)) {
      if (attr.confidence >= 0.5) {
        collectedFields[field] = attr.value;
      }
    }

    // 生成动态prompt注入
    orchestratorAddition =
      "\n\n" +
      generateDynamicPromptInjection(orchestratorState, collectedFields);

    // 获取下一个推荐问题，记录已问
    const nextQ = getNextQuestion(orchestratorState, collectedFields);
    if (nextQ.question && nextQ.dimension) {
      markQuestionAsked(orchestratorState, nextQ.question.id, nextQ.dimension);
    }

    // 计算完成度（用于日志）
    const completion = calculateCompletionStatus(
      collectedFields,
      orchestratorState,
    );
    logger.info(
      `[Orchestrator] 会话 ${sessionId}: L1=${completion.l1Percentage}% L2=${completion.l2Percentage}% 阶段=${nextQ.phase}`,
    );
  } catch (orchestratorError) {
    logger.error("[Orchestrator] 编排器错误:", { error: orchestratorError instanceof Error ? orchestratorError.message : String(orchestratorError) });
    // Non-blocking，继续使用原有逻辑
  }

  // 5. 历史裁剪：减少token使用（保留最近4轮）
  const trimmedHistory = trimConversationHistory(conversationHistory);

  // 6. 增强系统提示词（加入推断上下文 + 编排器引导）
  const enhancedHistory: ChatMessage[] = trimmedHistory.map((msg: ChatMessage, idx: number) => {
    if (idx === 0 && msg.role === "system") {
      return {
        ...msg,
        content: msg.content + inferenceAddition + orchestratorAddition,
      };
    }
    return msg;
  });

  // 7. 添加用户消息
  const updatedHistory: ChatMessage[] = [
    ...enhancedHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await deepseekClient.chat.completions.create({
      model: getDeepseekModel('flash'),
      messages: updatedHistory.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })),
      temperature: 0.8,
      max_tokens: 800,
    });

    const assistantMessage =
      response.choices[0]?.message?.content ||
      "抱歉，我走神了一下，你刚才说什么来着？";

    const collectedInfo = extractCollectedInfo(assistantMessage);
    const isComplete = assistantMessage.includes("```registration_complete");

    // 强制清理输出中的调试信息块
    let cleanMessage = assistantMessage
      .replace(/```collected_info[\s\S]*?```/gi, "")
      .replace(/```registration_complete[\s\S]*?```/gi, "")
      .replace(/collected_info\s*\{[\s\S]*?\}/gi, "")
      .replace(/```json[\s\S]*?```/gi, "")
      .replace(/\{"displayName"[\s\S]*?\}|collected_info/gi, "")
      .replace(/```[\s\S]*?```/gi, "")
      .trim();

    if (!cleanMessage) {
      cleanMessage = "好的，记下了～我们继续吧～";
    }

    // 使用原始history（不含推断补充）保存，避免上下文膨胀
    const finalHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage },
    ];

    // 7. 日志记录推断效果
    if (inferenceResult.skipQuestions.length > 0) {
      logger.info(
        `[InferenceEngine] 会话 ${sessionId}: 跳过问题 [${inferenceResult.skipQuestions.join(", ")}]`,
      );
    }
    if (inferenceResult.inferred.length > 0) {
      logger.info(
        `[InferenceEngine] 会话 ${sessionId}: 推断 ${inferenceResult.inferred.map((i) => `${i.field}=${i.value}`).join(", ")}`,
      );
    }

    return {
      message: cleanMessage,
      rawMessage: assistantMessage,
      collectedInfo,
      isComplete,
      conversationHistory: finalHistory,
      inferenceResult,
    };
  } catch (error) {
    logger.error("DeepSeek API error:", { error: error instanceof Error ? error.message : String(error) });
    throw new Error("悦仔暂时有点忙，请稍后再试～");
  }
}

/**
 * 增强版流式对话函数 - 带推断引擎
 */
export async function* continueXiaoyueChatStreamWithInference(
  userMessage: string,
  conversationHistory: ChatMessage[],
  sessionId: string,
): AsyncGenerator<{
  type: "content" | "done" | "error";
  content?: string;
  collectedInfo?: Partial<XiaoyueCollectedInfo>;
  isComplete?: boolean;
  rawMessage?: string;
  cleanMessage?: string;
  conversationHistory?: ChatMessage[];
  inference?: {
    skippedQuestions: string[];
    inferred: Array<{ field: string; value: string }>;
  };
}> {
  // ============ 性能计时 ============
  const t0_functionStart = Date.now();
  logger.info(`\n[PERF] ========== 新请求开始 ==========`);
  logger.info(`[PERF] t0 函数入口: ${new Date().toISOString()}`);
  logger.info(
    `[PERF] 消息长度: ${userMessage.length}字符, 历史轮数: ${conversationHistory.length}`,
  );

  // 计算输入token估算（中文约1.5字符/token）
  const estimatedInputTokens = Math.ceil(
    conversationHistory.reduce((sum, m) => sum + m.content.length, 0) / 1.5 +
      userMessage.length / 1.5,
  );
  logger.info(`[PERF] 预估输入tokens: ~${estimatedInputTokens}`);

  // 1. 获取当前推断状态
  const currentState = getSessionInferenceState(sessionId);

  // 2. 运行推断引擎
  const t1_inferenceStart = Date.now();
  const inferenceResult = await inferenceEngine.process(
    userMessage,
    conversationHistory.map((m) => ({ role: m.role, content: m.content })),
    currentState,
    sessionId,
  );
  const t1_inferenceEnd = Date.now();
  logger.info(
    `[PERF] t1 推断引擎耗时: ${t1_inferenceEnd - t1_inferenceStart}ms`,
  );

  // 3. 更新推断状态
  updateSessionInferenceState(sessionId, inferenceResult.newState);

  // 3.5 AI Evolution: 实时洞察检测 (per-message) + L3完整分析 + 累积存储 + 持久化
  const t2_insightStart = Date.now();
  try {
    const { insightDetectorService } = await import("./insightDetectorService");
    const { dialogueEmbeddingsService } = await import(
      "./dialogueEmbeddingsService"
    );
    const existingInsights = getSessionInsights(sessionId);
    const turnIndex = conversationHistory.filter(
      (m) => m.role === "user",
    ).length;
    const detectedInsights = insightDetectorService.detectFromMessage(
      userMessage,
      turnIndex,
      existingInsights,
    );

    // L3完整分析：每3轮或有足够消息时运行dialectProfile和deepTraits分析
    let dialectProfile = null;
    let deepTraits = null;
    if (turnIndex >= 3 && turnIndex % 3 === 0) {
      // 运行完整L3分析（方言画像 + 深度特质）
      const fullAnalysis = await insightDetectorService.analyzeConversation([
        ...conversationHistory,
        { role: "user", content: userMessage },
      ]);
      dialectProfile = fullAnalysis.dialectProfile;
      deepTraits = fullAnalysis.deepTraits;
      logger.info(
        `[L3 Analysis Stream] 会话 ${sessionId}: 方言=${dialectProfile?.primaryDialect || "未检测"}, 深度特质已提取`,
      );
    }

    if (detectedInsights.length > 0 || dialectProfile || deepTraits) {
      // 累积到内存
      if (detectedInsights.length > 0) {
        addSessionInsights(sessionId, detectedInsights);
      }

      // 持久化到数据库（防止用户中途退出丢失洞察）
      await dialogueEmbeddingsService.storeInsights(
        sessionId,
        null,
        userMessage,
        {
          insights: detectedInsights,
          dialectProfile,
          deepTraits,
          totalConfidence: 0.85,
          apiCallsUsed: 0,
        },
        false, // isSuccessful = false indicates partial/in-progress
      );
    }
  } catch (insightError) {
    logger.error("[L3 Analysis Stream] 洞察检测错误:", { error: insightError instanceof Error ? insightError.message : String(insightError) });
    // Non-blocking
  }
  const t2_insightEnd = Date.now();
  logger.info(`[PERF] t2 洞察检测耗时: ${t2_insightEnd - t2_insightStart}ms`);

  // 4. 生成推断上下文补充
  const context = generateXiaoyueContext(inferenceResult.newState);
  let inferenceAddition = "";
  if (context && !context.includes("暂无")) {
    inferenceAddition = `

## 【智能推断上下文 - 重要！】
${context}

**推断行为准则**：
1. 对于"不要问的问题"列表中的字段，绝对不要再问，这些信息已经从用户之前的回答中推断出来了
2. 对于"可以确认的信息"，可以用确认式提问简单确认，而不是开放式提问
3. 如果用户之前说过类似"我在创业"，不要再问"人生阶段"，因为已经推断出来了
4. 保持对话连贯性，不要让用户觉得你没有在听他说话`;
  }

  // 4.5 【新增】6维度编排器动态prompt注入
  let orchestratorAddition = "";
  try {
    const systemMsg =
      conversationHistory.find((m) => m.role === "system")?.content || "";
    const modeMatch = systemMsg.match(/极速模式|标准模式|深度模式/);
    const mode: OrchestratorMode =
      modeMatch?.[0] === "极速模式"
        ? "express"
        : modeMatch?.[0] === "深度模式"
          ? "deep"
          : "standard";

    const orchestratorState = getOrCreateOrchestratorState(sessionId, mode);

    // 使用0.5阈值以捕获更多待确认字段，提高维度覆盖检测准确性
    const collectedFields: Record<string, unknown> = {};
    for (const [field, attr] of Object.entries(inferenceResult.newState)) {
      if (attr.confidence >= 0.5) {
        collectedFields[field] = attr.value;
      }
    }

    orchestratorAddition =
      "\n\n" +
      generateDynamicPromptInjection(orchestratorState, collectedFields);

    const nextQ = getNextQuestion(orchestratorState, collectedFields);
    if (nextQ.question && nextQ.dimension) {
      markQuestionAsked(orchestratorState, nextQ.question.id, nextQ.dimension);
    }

    const completion = calculateCompletionStatus(
      collectedFields,
      orchestratorState,
    );
    logger.info(
      `[Orchestrator] 流式会话 ${sessionId}: L1=${completion.l1Percentage}% L2=${completion.l2Percentage}% 阶段=${nextQ.phase}`,
    );
  } catch (orchestratorError) {
    logger.error("[Orchestrator] 流式编排器错误:", { error: orchestratorError instanceof Error ? orchestratorError.message : String(orchestratorError) });
  }

  // 4.6 【新增】精确年龄计算：检测用户消息中的生日信息
  const birthInfo = parseBirthDateFromInput(userMessage);
  let ageHint = "";
  if (birthInfo.birthYear) {
    const preciseAge = calculatePreciseAge(
      birthInfo.birthYear,
      birthInfo.birthMonth,
      birthInfo.birthDay,
    );
    const now = new Date();
    const dateStr =
      birthInfo.birthMonth && birthInfo.birthDay
        ? `${birthInfo.birthYear}年${birthInfo.birthMonth}月${birthInfo.birthDay}日`
        : birthInfo.birthMonth
          ? `${birthInfo.birthYear}年${birthInfo.birthMonth}月`
          : `${birthInfo.birthYear}年`;
    ageHint = `\n\n【系统提示：用户提到的生日是${dateStr}，根据今天${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日计算，TA今年${preciseAge}岁。请使用这个准确年龄，记录birthYear为${birthInfo.birthYear}】`;
    logger.info(
      `[AgeCalc Inference] Detected birth date: ${dateStr}, calculated age: ${preciseAge}`,
    );
  }

  // 5. 历史裁剪：减少token使用（保留最近4轮）
  const trimmedHistory = trimConversationHistory(conversationHistory);

  // 5.5 构建增强的消息历史（只用于API调用，不保存）
  const t3_promptBuildStart = Date.now();
  const enhancedHistory: ChatMessage[] = trimmedHistory.map((msg: ChatMessage, idx: number) => {
    if (idx === 0 && msg.role === "system") {
      return {
        ...msg,
        content: msg.content + inferenceAddition + orchestratorAddition,
      };
    }
    return msg;
  });

  const updatedHistory: ChatMessage[] = [
    ...enhancedHistory,
    { role: "user", content: userMessage + ageHint },
  ];
  const t3_promptBuildEnd = Date.now();
  logger.info(
    `[PERF] t3 Prompt构建耗时: ${t3_promptBuildEnd - t3_promptBuildStart}ms`,
  );
  logger.info(`[PERF] === 准备调用DeepSeek API ===`);
  logger.info(`[PERF] 预处理总耗时: ${t3_promptBuildEnd - t0_functionStart}ms`);

  // 🔧 DEBUG: 打印发送给 DeepSeek 的完整内容
  logger.info(`\n[DEBUG DeepSeek] ========== API请求完整内容 ==========`);
  logger.info(`[DEBUG DeepSeek] 用户消息: "${userMessage}"`);
  logger.info(`\n[DEBUG DeepSeek] --- 推断引擎补充 (inferenceAddition) ---`);
  logger.info(inferenceAddition || "(空)");
  logger.info(`\n[DEBUG DeepSeek] --- 编排器补充 (orchestratorAddition) ---`);
  logger.info(orchestratorAddition || "(空)");
  logger.info(`\n[DEBUG DeepSeek] --- 完整消息列表 ---`);
  updatedHistory.forEach((msg, i) => {
    logger.info(`[消息${i}] ${msg.role}:\n${msg.content}\n---`);
  });
  logger.info(`[DEBUG DeepSeek] ========================================\n`);

  try {
    const t4_apiCallStart = Date.now();
    logger.info(`[PERF] t4 API调用开始: ${new Date().toISOString()}`);

    const stream = await deepseekClient.chat.completions.create({
      model: getDeepseekModel('flash'),
      messages: updatedHistory.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })),
      temperature: 0.8,
      max_tokens: 800,
      stream: true,
    });

    const t4_streamCreated = Date.now();
    logger.info(
      `[PERF] t4 Stream创建耗时: ${t4_streamCreated - t4_apiCallStart}ms (连接建立+首次握手)`,
    );

    let fullContent = "";
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        if (firstTokenTime === null) {
          firstTokenTime = Date.now();
          const ttft = firstTokenTime - t4_apiCallStart;
          logger.info(`[PERF] ⚡ TTFT (首Token时间): ${ttft}ms`);
        }
        tokenCount++;
        fullContent += content;
        yield { type: "content", content };
      }
    }

    const t5_streamEnd = Date.now();
    const totalApiTime = t5_streamEnd - t4_apiCallStart;
    const generationTime = firstTokenTime ? t5_streamEnd - firstTokenTime : 0;
    const tps =
      generationTime > 0
        ? (tokenCount / (generationTime / 1000)).toFixed(1)
        : "N/A";

    logger.info(`[PERF] t5 流式结束: ${new Date().toISOString()}`);
    logger.info(
      `[PERF] 输出tokens: ${tokenCount}, 生成耗时: ${generationTime}ms, TPS: ${tps}`,
    );
    logger.info(`[PERF] API总耗时: ${totalApiTime}ms`);
    logger.info(`[PERF] 端到端总耗时: ${t5_streamEnd - t0_functionStart}ms`);
    logger.info(`[PERF] ========== 请求结束 ==========\n`);

    const collectedInfo = extractCollectedInfo(fullContent);
    const isComplete = fullContent.includes("```registration_complete");

    let cleanMessage = fullContent
      .replace(/```collected_info[\s\S]*?```/g, "")
      .replace(/```registration_complete[\s\S]*?```/g, "")
      .trim();

    if (!cleanMessage) {
      cleanMessage = "好的，记下了～我们继续吧～";
    }

    // 使用原始history保存，避免上下文膨胀
    const finalHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: fullContent },
    ];

    // 日志记录推断效果
    if (inferenceResult.skipQuestions.length > 0) {
      logger.info(
        `[InferenceEngine] 流式会话 ${sessionId}: 跳过问题 [${inferenceResult.skipQuestions.join(", ")}]`,
      );
    }
    if (inferenceResult.inferred.length > 0) {
      logger.info(
        `[InferenceEngine] 流式会话 ${sessionId}: 推断 ${inferenceResult.inferred.map((i) => `${i.field}=${i.value}`).join(", ")}`,
      );
    }

    yield {
      type: "done",
      collectedInfo,
      isComplete,
      rawMessage: fullContent,
      cleanMessage,
      conversationHistory: finalHistory,
      inference: {
        skippedQuestions: inferenceResult.skipQuestions,
        inferred: inferenceResult.inferred.map((i) => ({
          field: i.field,
          value: i.value,
        })),
      },
    };
  } catch (error) {
    const errorTime = Date.now();
    logger.error(`[PERF] API错误，耗时: ${errorTime - t0_functionStart}ms`);
    logger.error("DeepSeek streaming API error:", { error: error instanceof Error ? error.message : String(error) });
    yield { type: "error", content: "悦仔暂时有点忙，请稍后再试～" };
  }
}

/**
 * 快速推断测试函数（不调用LLM）
 */
export function testQuickInference(userMessage: string): {
  inferences: Array<{ field: string; value: string; confidence: number }>;
  skipQuestions: string[];
} {
  return quickInfer(userMessage);
}

/**
 * 获取推断引擎日志
 */
export function getInferenceLogs(sessionId?: string) {
  return inferenceEngine.getLogs(sessionId);
}

