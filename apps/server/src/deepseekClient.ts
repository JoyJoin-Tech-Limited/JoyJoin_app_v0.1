import OpenAI from "openai";
import https from "https";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { getDeepseekModel } from "./ai/deepseekClient";
import { logger } from "./lib/logger";
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

// HTTP Keep-Alive agent for connection reuse (saves 80-120ms per request)
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
});

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
  // @ts-expect-error - httpAgent is supported by the underlying fetch but not typed
  httpAgent: keepAliveAgent,
});

// DeepSeek cache monitoring helper
function logCacheStats(usage: any, context: string) {
  if (usage?.prompt_cache_hit_tokens !== undefined) {
    const hitTokens = usage.prompt_cache_hit_tokens || 0;
    const missTokens = usage.prompt_cache_miss_tokens || 0;
    const hitRate =
      hitTokens + missTokens > 0
        ? Math.round((hitTokens / (hitTokens + missTokens)) * 100)
        : 0;
    logger.info('DeepSeek cache stats', { context, hitTokens, missTokens, hitRate: `${hitRate}%` });
  }
}

/**
 * 精确年龄计算函数
 * @param birthYear 出生年份
 * @param birthMonth 出生月份 (1-12)，可选
 * @param birthDay 出生日期 (1-31)，可选
 * @returns 精确年龄
 */
export function calculatePreciseAge(
  birthYear: number,
  birthMonth?: number,
  birthDay?: number,
): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
  const currentDay = now.getDate();

  let age = currentYear - birthYear;

  // 如果提供了月份和日期，检查生日是否已过
  if (birthMonth !== undefined) {
    if (currentMonth < birthMonth) {
      age -= 1; // 生日还没到
    } else if (currentMonth === birthMonth && birthDay !== undefined) {
      if (currentDay < birthDay) {
        age -= 1; // 生日还没到
      }
    }
  }

  return age;
}

/**
 * 从用户输入解析生日信息
 * 支持格式: "1998-10-02", "1998年10月2日", "1998/10/02", "1998.10.02"
 * @returns { birthYear, birthMonth?, birthDay? }
 */
export function parseBirthDateFromInput(input: string): {
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
} {
  // 完整日期格式: 1998-10-02, 1998年10月2日, 1998/10/02, 1998.10.02
  const fullDatePatterns = [
    /(\d{4})[-\/\.年](\d{1,2})[-\/\.月](\d{1,2})日?/,
    /(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/,
  ];

  for (const pattern of fullDatePatterns) {
    const match = input.match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      if (
        year >= 1960 &&
        year <= 2010 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= 31
      ) {
        return { birthYear: year, birthMonth: month, birthDay: day };
      }
    }
  }

  // 仅年月格式: 1998年10月, 1998-10
  const yearMonthPatterns = [/(\d{4})[-\/\.年](\d{1,2})月?/];

  for (const pattern of yearMonthPatterns) {
    const match = input.match(pattern);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      if (year >= 1960 && year <= 2010 && month >= 1 && month <= 12) {
        return { birthYear: year, birthMonth: month };
      }
    }
  }

  // 仅年份: 1998年, 1998
  const yearPattern = /(\d{4})年?/;
  const match = input.match(yearPattern);
  if (match) {
    const year = parseInt(match[1], 10);
    if (year >= 1960 && year <= 2010) {
      return { birthYear: year };
    }
  }

  return {};
}

// ============ 智能洞察类型定义 ============

// 智能洞察条目 - LLM自由记录的有价值信息
export interface SmartInsight {
  category:
    | "career"
    | "personality"
    | "lifestyle"
    | "preference"
    | "background"
    | "social";
  insight: string; // 洞察内容，如"资深金融从业者，一级市场背景"
  evidence: string; // 证据来源，如"用户提到做一级并购"
  confidence: number; // 置信度 0-1，建议>=0.7才输出
  timestamp?: string; // 提取时间
}

// 推断的深度特征 - 从对话风格推断的人格特征
export interface InferredTraits {
  // 认知风格
  riskTolerance?: "high" | "medium" | "low"; // 风险偏好
  decisionStyle?: "analytical" | "intuitive" | "balanced"; // 决策风格
  thinkingMode?: "logical" | "creative" | "mixed"; // 思维方式
  // 沟通风格
  communicationStyle?: "direct" | "diplomatic" | "adaptive"; // 沟通风格
  expressionDepth?: "surface" | "moderate" | "deep"; // 表达深度
  humorStyle?: "witty" | "playful" | "dry" | "none"; // 幽默风格
  // 社交特征
  socialInitiative?: "proactive" | "reactive" | "balanced"; // 社交主动性
  leadershipTendency?: "leader" | "collaborator" | "follower"; // 领导倾向
  groupPreference?: "small" | "large" | "flexible"; // 群体偏好
  // 情绪特征
  emotionalOpenness?: "open" | "guarded" | "selective"; // 情绪开放度
  stressResponse?: "calm" | "adaptive" | "sensitive"; // 压力响应
  // 总体置信度
  overallConfidence?: number;
}

export interface XiaoyueCollectedInfo {
  displayName?: string;
  gender?: string;
  birthYear?: number;
  currentCity?: string;
  occupationDescription?: string;
  interestsTop?: string[];
  primaryInterests?: string[];
  venueStylePreference?: string;
  topicAvoidances?: string[];
  socialStyle?: string;
  additionalNotes?: string;
  // 新增字段：与传统问卷对齐
  intent?: string[]; // networking/friends/discussion/fun/romance/flexible
  hasPets?: boolean;
  petTypes?: string[]; // 猫/狗/仓鼠/鱼等
  hasSiblings?: boolean;
  relationshipStatus?: string; // 单身/恋爱中/已婚/不透露
  hometown?: string; // 老家/家乡
  languagesComfort?: string[]; // 语言偏好
  // 美食偏好深度收集
  cuisinePreference?: string[]; // 菜系偏好：日料/粤菜/火锅/西餐/东南亚等
  favoriteRestaurant?: string; // 宝藏餐厅推荐
  favoriteRestaurantReason?: string; // 喜欢这家店的原因
  // 新增字段：教育背景与家庭
  children?: string; // 有孩子/没有/不透露
  educationLevel?: string; // 高中/大专/本科/硕士/博士
  fieldOfStudy?: string; // 专业领域
  // 人生阶段与年龄匹配偏好
  lifeStage?: string; // 学生党/职场新人/职场老手/创业中/自由职业/退休享乐
  ageMatchPreference?: string; // mixed/same_generation/flexible (希望匹配的年龄段，避免younger/older以免催婚感)
  ageDisplayPreference?: string; // decade/range/hidden (年龄显示偏好)
  // 对话行为画像（隐性信号收集）
  conversationalProfile?: {
    responseLength: "brief" | "moderate" | "detailed";
    emojiUsage: "none" | "few" | "many";
    formalityLevel: "casual" | "neutral" | "formal";
    proactiveness: "passive" | "neutral" | "proactive";
    registrationTime: string;
    completionSpeed: "fast" | "medium" | "slow";
  };
  // 社交能量维度（新增）
  energyRechargeMethod?: string; // alone/small_group/exercise/sleep - 能量恢复方式
  idealSocialDuration?: string; // 1h/2h/3h_plus/flexible - 理想社交时长
  socialFrequency?: string; // weekly/biweekly/monthly/flexible - 社交频率需求
  activityTimePreference?: string; // 工作日晚上/周末白天/周末晚上/都可以 - 活动时段偏好
  // 社交场景偏好（新增）
  activityPace?: string; // slow_deep/fast_varied/flexible - 活动节奏偏好
  breakingIceRole?: string; // initiator/follower/observer - 破冰角色
  socialContinuity?: string; // fixed_circle/new_faces/flexible - 社交延续偏好

  // ============ 智能信息收集系统新增字段 ============

  // 结构化职业信息（替代模糊的occupationDescription）
  industry?: string; // 行业大类：金融/科技/医疗/法律/咨询/教育等
  industrySegment?: string; // 细分领域：PE/VC/并购/投行（金融）、前端/后端/AI（科技）等
  occupation?: string; // 具体职位：投资经理/产品经理/医生等
  companyType?: string; // 公司类型：外资/国企/民企/创业公司/自由职业
  seniority?: string; // 资历：实习/初级/中级/高级/总监/VP+

  // 智能洞察数组 - LLM自由记录任何有价值的推断
  smartInsights?: SmartInsight[];

  // 推断的深度特征 - 从对话风格推断的人格特征
  inferredTraits?: InferredTraits;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// ============ 对话历史裁剪函数（V3 状态驱动摘要）============

/**
 * 生成已收集信息的结构化摘要
 * 用于替代简单的"已完成X轮对话"占位符
 */
function buildCollectedInfoSummary(
  collected?: Partial<XiaoyueCollectedInfo>,
): string {
  if (!collected) return "";

  const fields: string[] = [];
  const currentYear = new Date().getFullYear();

  if (collected.displayName) fields.push(`昵称:${collected.displayName}`);
  if (collected.gender) fields.push(`性别:${collected.gender}`);
  if (collected.birthYear)
    fields.push(`年龄:${currentYear - collected.birthYear}岁`);
  if (collected.currentCity) fields.push(`城市:${collected.currentCity}`);
  if (collected.industry) fields.push(`行业:${collected.industry}`);
  if (collected.industrySegment)
    fields.push(`细分:${collected.industrySegment}`);
  if (collected.occupation) fields.push(`职位:${collected.occupation}`);
  if (collected.seniority) fields.push(`资历:${collected.seniority}`);
  if (collected.interestsTop?.length)
    fields.push(`兴趣:${collected.interestsTop.slice(0, 3).join(",")}`);
  if (collected.hometown) fields.push(`家乡:${collected.hometown}`);
  if (collected.relationshipStatus)
    fields.push(`感情:${collected.relationshipStatus}`);

  if (fields.length === 0) return "";
  return `[已收集] ${fields.join(" | ")}`;
}

/**
 * 检测待追问项（帮助模型继续追问）
 */
function detectPendingFollowups(
  collected?: Partial<XiaoyueCollectedInfo>,
): string[] {
  if (!collected) return [];
  const pending: string[] = [];

  // 有行业但没细分 → 需要追问细分
  if (collected.industry && !collected.industrySegment) {
    pending.push("待追问:行业细分");
  }
  // 有细分但没资历 → 需要追问资历
  if (collected.industrySegment && !collected.seniority) {
    pending.push("待追问:资历");
  }

  return pending;
}

/** Max turns for Xiaoyue chat history. DeepSeek V4 supports 1M context;
 *  raising this reduces summary loss from truncation. */
const DEFAULT_XIAOYUE_MAX_TURNS = parseInt(process.env.XIAOYUE_MAX_TURNS || '4', 10);
const DEFAULT_XIAOYUE_MAX_TURNS_WITH_FOLLOWUPS = parseInt(
  process.env.XIAOYUE_MAX_TURNS_WITH_FOLLOWUPS || '6',
  10,
);

/**
 * 裁剪对话历史以减少token数量（V3 优化版）
 * - 使用状态驱动摘要，保留已收集字段信息
 * - 自适应历史窗口：默认4轮，有待追问项时扩展到6轮（或 env 覆盖值）
 * - DeepSeek V4 supports 1M context; raise XIAOYUE_MAX_TURNS to leverage it.
 * @param history 完整对话历史
 * @param collected 已收集的用户信息（可选，用于生成结构化摘要）
 * @param baseMaxTurns 基础保留轮数（默认从 XIAOYUE_MAX_TURNS 读取）
 * @returns 裁剪后的对话历史
 */
export function trimConversationHistory(
  history: ChatMessage[],
  collected?: Partial<XiaoyueCollectedInfo>,
  baseMaxTurns: number = DEFAULT_XIAOYUE_MAX_TURNS,
): ChatMessage[] {
  // 分离system消息和对话消息
  const systemMessages = history.filter((m) => m.role === "system");
  const dialogueMessages = history.filter((m) => m.role !== "system");

  // 自适应历史窗口：有待追问项时扩展到覆盖值（默认6轮）
  const pendingFollowups = detectPendingFollowups(collected);
  const maxTurns =
    pendingFollowups.length > 0
      ? Math.min(baseMaxTurns + 2, DEFAULT_XIAOYUE_MAX_TURNS_WITH_FOLLOWUPS)
      : baseMaxTurns;

  // 如果对话消息不超过限制，直接返回
  if (dialogueMessages.length <= maxTurns * 2) {
    return history;
  }

  // 保留最近 maxTurns 轮对话
  const recentHistory = dialogueMessages.slice(-maxTurns * 2);
  const trimmedCount = dialogueMessages.length - maxTurns * 2;
  const trimmedTurns = Math.floor(trimmedCount / 2);

  // 生成状态驱动摘要（V3 优化）
  const collectedSummary = buildCollectedInfoSummary(collected);
  const pendingInfo =
    pendingFollowups.length > 0 ? ` | ${pendingFollowups.join(", ")}` : "";

  const summaryContent = collectedSummary
    ? `${collectedSummary}${pendingInfo} | 已完成${trimmedTurns}轮对话`
    : `[早期对话：已完成${trimmedTurns}轮，请继续推进]`;

  const summaryMessage: ChatMessage = {
    role: "system",
    content: summaryContent,
  };

  logger.info('HistoryTrim V3', { beforeCount: dialogueMessages.length, afterCount: recentHistory.length, maxTurns, summaryPreview: summaryContent.substring(0, 50) });

  return [...systemMessages, summaryMessage, ...recentHistory];
}


// Re-export Xiaoyue chat & inference APIs for backward compatibility
export {
  startXiaoyueChatEnrichment,
  getSessionInsights,
  addSessionInsights,
  getSessionInferenceState,
  updateSessionInferenceState,
  continueXiaoyueChatWithInference,
  continueXiaoyueChatStreamWithInference,
  testQuickInference,
  getInferenceLogs,
} from "./deepseekClientXiaoyue";

export default deepseekClient;
