// import OpenAI from "openai";
// import https from "https";
// import { format } from "date-fns";
// import { zhCN } from "date-fns/locale";
// import type { DetectedInsight } from "./insightDetectorService";
// import {
//   getOrCreateOrchestratorState,
//   getNextQuestion,
//   markQuestionAsked,
//   generateDynamicPromptInjection,
//   generateDimensionTransition,
//   calculateCompletionStatus,
//   type RegistrationMode as OrchestratorMode,
// } from "./inference/dimensionOrchestrator";

// // HTTP Keep-Alive agent for connection reuse (saves 80-120ms per request)
// const keepAliveAgent = new https.Agent({
//   keepAlive: true,
//   keepAliveMsecs: 30000,
//   maxSockets: 10,
//   maxFreeSockets: 5,
//   timeout: 60000,
// });

// const deepseekClient = new OpenAI({
//   apiKey: process.env.DEEPSEEK_API_KEY,
//   baseURL: "https://api.deepseek.com",
//   // @ts-expect-error - httpAgent is supported by the underlying fetch but not typed
//   httpAgent: keepAliveAgent,
// });

// // DeepSeek cache monitoring helper
// function logCacheStats(usage: any, context: string) {
//   if (usage?.prompt_cache_hit_tokens !== undefined) {
//     const hitTokens = usage.prompt_cache_hit_tokens || 0;
//     const missTokens = usage.prompt_cache_miss_tokens || 0;
//     const hitRate =
//       hitTokens + missTokens > 0
//         ? Math.round((hitTokens / (hitTokens + missTokens)) * 100)
//         : 0;
//     console.log(
//       `[DeepSeek Cache ${context}] Hit: ${hitTokens}, Miss: ${missTokens}, Rate: ${hitRate}%`,
//     );
//   }
// }

// /**
//  * 精确年龄计算函数
//  */
// function calculatePreciseAge(
//   birthYear: number,
//   birthMonth?: number,
//   birthDay?: number,
// ): number {
//   const now = new Date();
//   const currentYear = now.getFullYear();
//   const currentMonth = now.getMonth() + 1;
//   const currentDay = now.getDate();

//   let age = currentYear - birthYear;

//   if (birthMonth !== undefined) {
//     if (currentMonth < birthMonth) {
//       age -= 1;
//     } else if (currentMonth === birthMonth && birthDay !== undefined) {
//       if (currentDay < birthDay) {
//         age -= 1;
//       }
//     }
//   }

//   return age;
// }

// /**
//  * 从用户输入解析生日信息
//  */
// function parseBirthDateFromInput(input: string): {
//   birthYear?: number;
//   birthMonth?: number;
//   birthDay?: number;
// } {
//   const fullDatePatterns = [
//     /(\d{4})[-\/\.年](\d{1,2})[-\/\.月](\d{1,2})日?/,
//     /(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/,
//   ];

//   for (const pattern of fullDatePatterns) {
//     const match = input.match(pattern);
//     if (match) {
//       const year = parseInt(match[1], 10);
//       const month = parseInt(match[2], 10);
//       const day = parseInt(match[3], 10);
//       if (
//         year >= 1960 &&
//         year <= 2010 &&
//         month >= 1 &&
//         month <= 12 &&
//         day >= 1 &&
//         day <= 31
//       ) {
//         return { birthYear: year, birthMonth: month, birthDay: day };
//       }
//     }
//   }

//   const yearMonthPatterns = [/(\d{4})[-\/\.年](\d{1,2})月?/];
//   for (const pattern of yearMonthPatterns) {
//     const match = input.match(pattern);
//     if (match) {
//       const year = parseInt(match[1], 10);
//       const month = parseInt(match[2], 10);
//       if (year >= 1960 && year <= 2010 && month >= 1 && month <= 12) {
//         return { birthYear: year, birthMonth: month };
//       }
//     }
//   }

//   const yearPattern = /(\d{4})年?/;
//   const match = input.match(yearPattern);
//   if (match) {
//     const year = parseInt(match[1], 10);
//     if (year >= 1960 && year <= 2010) {
//       return { birthYear: year };
//     }
//   }

//   return {};
// }

// // ============ 智能洞察类型定义 ============

// export interface SmartInsight {
//   category: "career" | "personality" | "lifestyle" | "preference" | "background" | "social";
//   insight: string;
//   evidence: string;
//   confidence: number;
//   timestamp?: string;
// }

// export interface InferredTraits {
//   riskTolerance?: "high" | "medium" | "low";
//   decisionStyle?: "analytical" | "intuitive" | "balanced";
//   thinkingMode?: "logical" | "creative" | "mixed";
//   communicationStyle?: "direct" | "diplomatic" | "adaptive";
//   expressionDepth?: "surface" | "moderate" | "deep";
//   humorStyle?: "witty" | "playful" | "dry" | "none";
//   socialInitiative?: "proactive" | "reactive" | "balanced";
//   leadershipTendency?: "leader" | "collaborator" | "follower";
//   groupPreference?: "small" | "large" | "flexible";
//   emotionalOpenness?: "open" | "guarded" | "selective";
//   stressResponse?: "calm" | "adaptive" | "sensitive";
//   overallConfidence?: number;
// }

// export interface XiaoyueCollectedInfo {
//   displayName?: string;
//   gender?: string;
//   birthYear?: number;
//   currentCity?: string;
//   occupationDescription?: string;
//   interestsTop?: string[];
//   primaryInterests?: string[];
//   venueStylePreference?: string;
//   topicAvoidances?: string[];
//   socialStyle?: string;
//   additionalNotes?: string;
//   intent?: string[];
//   hasPets?: boolean;
//   petTypes?: string[];
//   hasSiblings?: boolean;
//   relationshipStatus?: string;
//   hometown?: string;
//   languagesComfort?: string[];
//   cuisinePreference?: string[];
//   favoriteRestaurant?: string;
//   favoriteRestaurantReason?: string;
//   children?: string;
//   educationLevel?: string;
//   fieldOfStudy?: string;
//   lifeStage?: string;
//   ageMatchPreference?: string;
//   ageDisplayPreference?: string;
//   conversationalProfile?: {
//     responseLength: "brief" | "moderate" | "detailed";
//     emojiUsage: "none" | "few" | "many";
//     formalityLevel: "casual" | "neutral" | "formal";
//     proactiveness: "passive" | "neutral" | "proactive";
//     registrationTime: string;
//     completionSpeed: "fast" | "medium" | "slow";
//   };
//   energyRechargeMethod?: string;
//   idealSocialDuration?: string;
//   socialFrequency?: string;
//   activityTimePreference?: string;
//   activityPace?: string;
//   breakingIceRole?: string;
//   socialContinuity?: string;
//   industry?: string;
//   industrySegment?: string;
//   occupation?: string;
//   companyType?: string;
//   seniority?: string;
//   smartInsights?: SmartInsight[];
//   inferredTraits?: InferredTraits;
// }

// export interface ChatMessage {
//   role: "user" | "assistant" | "system";
//   content: string;
// }

// function buildCollectedInfoSummary(collected?: Partial<XiaoyueCollectedInfo>): string {
//   if (!collected) return "";
//   const fields: string[] = [];
//   const currentYear = new Date().getFullYear();
//   if (collected.displayName) fields.push(`昵称:${collected.displayName}`);
//   if (collected.gender) fields.push(`性别:${collected.gender}`);
//   if (collected.birthYear) fields.push(`年龄:${currentYear - collected.birthYear}岁`);
//   if (collected.currentCity) fields.push(`城市:${collected.currentCity}`);
//   if (collected.industry) fields.push(`行业:${collected.industry}`);
//   if (collected.industrySegment) fields.push(`细分:${collected.industrySegment}`);
//   if (collected.occupation) fields.push(`职位:${collected.occupation}`);
//   if (collected.seniority) fields.push(`资历:${collected.seniority}`);
//   if (collected.interestsTop?.length) fields.push(`兴趣:${collected.interestsTop.slice(0, 3).join(",")}`);
//   if (collected.hometown) fields.push(`家乡:${collected.hometown}`);
//   if (collected.relationshipStatus) fields.push(`感情:${collected.relationshipStatus}`);
//   return fields.length === 0 ? "" : `[已收集] ${fields.join(" | ")}`;
// }

// function detectPendingFollowups(collected?: Partial<XiaoyueCollectedInfo>): string[] {
//   if (!collected) return [];
//   const pending: string[] = [];
//   if (collected.industry && !collected.industrySegment) pending.push("待追问:行业细分");
//   if (collected.industrySegment && !collected.seniority) pending.push("待追问:资历");
//   return pending;
// }

// export function trimConversationHistory(
//   history: ChatMessage[],
//   collected?: Partial<XiaoyueCollectedInfo>,
//   baseMaxTurns: number = 4,
// ): ChatMessage[] {
//   const systemMessages = history.filter((m) => m.role === "system");
//   const dialogueMessages = history.filter((m) => m.role !== "system");
//   const pendingFollowups = detectPendingFollowups(collected);
//   const maxTurns = pendingFollowups.length > 0 ? Math.min(baseMaxTurns + 2, 6) : baseMaxTurns;

//   if (dialogueMessages.length <= maxTurns * 2) return history;

//   const recentHistory = dialogueMessages.slice(-maxTurns * 2);
//   const trimmedCount = dialogueMessages.length - maxTurns * 2;
//   const trimmedTurns = Math.floor(trimmedCount / 2);
//   const collectedSummary = buildCollectedInfoSummary(collected);
//   const pendingInfo = pendingFollowups.length > 0 ? ` | ${pendingFollowups.join(", ")}` : "";
//   const summaryContent = collectedSummary
//     ? `${collectedSummary}${pendingInfo} | 已完成${trimmedTurns}轮对话`
//     : `[早期对话：已完成${trimmedTurns}轮，请继续推进]`;

//   const summaryMessage: ChatMessage = { role: "system", content: summaryContent };
//   return [...systemMessages, summaryMessage, ...recentHistory];
// }

// // ============ Prompt 常量 ============

// const XIAOYUE_PERSONA_STATIC = `你是"小悦"，悦聚平台的AI社交助手，帮助用户完成注册信息收集。

// ## 人设：街头老狐狸（Nick Wilde风格）
// - 混迹社交场合多年的"地下导游"，见过太多人，什么场面都能接住
// - 嘴角挂着了然的笑，说话不多但每句有分量，表面玩世不恭实际靠谱
// - 看穿但不戳穿，帮忙不求回报，懒得解释太多，冷幽默

// ## 说话风格
// - 短句为主，用"收到"、"搞定"、"记下了"等利落的词
// - 用"我看"、"让我猜"带点自信的开场
// - 禁止：感叹词("哇！嘻嘻！")、油腻词("太棒了！绝了！")、emoji堆砌

// ## 性别差异化
// - 男生→兄弟模式：用"齐活儿"、"搞定"，直接利落
// - 女生→Nick对Judy模式：用"妥了"、"好了"，轻松可靠，结尾偶尔加"～"`;

// const XIAOYUE_RULES_DYNAMIC = `
// ## 输出原则
// - 每轮2-3句话，开场白可4-5句
// - 禁止Markdown，口语化，最多1个emoji
// - 回应要有温度（先回应用户，再问下一题），不做复读机

// ## 核心规则
// 1. **一次一问**：每轮只问一个问题，追问和新问题不能同一轮
// 2. **不列举选项**：系统自动显示快捷按钮，你只需简洁问一句
// 3. **尊重边界**：用户不想说就"跳过，没事"

// ## 昵称收集规则（最重要）
// - 必须先收集有效displayName才能问其他问题
// - 黑名单：收到/好的/ok/明白/行等应答词 → 拒绝并重新问
// - 有效昵称：≥2字符的名字/昵称，简洁回应"XX，收到。性别呢？"

// ## 信息收集清单
// 核心：昵称、性别、年龄、城市
// 扩展：职业/行业、兴趣(3-7个)、活动意图
// 进阶：人生阶段、宠物、感情状态、家乡、语言偏好

// ## 输出格式
// 对话内容后添加collected_info代码块：
// \`\`\`collected_info
// {
//   "displayName": "昵称",
//   "gender": "女生/男生",
//   "birthYear": 1995,
//   "currentCity": "深圳",
//   "industry": "金融/科技等",
//   "industrySegment": "细分领域",
//   "occupation": "职位",
//   "seniority": "资历",
//   "interestsTop": ["兴趣1", "兴趣2"],
//   "smartInsights": [{"category": "career", "insight": "洞察", "evidence": "证据", "confidence": 0.85}]
// }
// \`\`\`

// 收集完成后添加：
// \`\`\`registration_complete
// true
// \`\`\``;

// function buildXiaoyueSystemPrompt(): string {
//   return XIAOYUE_PERSONA_STATIC + XIAOYUE_RULES_DYNAMIC;
// }

// const XIAOYUE_SYSTEM_PROMPT_BASE = buildXiaoyueSystemPrompt();

// function getXiaoyueSystemPrompt(): string {
//   const now = new Date();
//   const currentYear = now.getFullYear();
//   const today = format(now, "yyyy年MM月dd日 EEEE", { locale: zhCN });

//   return `${XIAOYUE_SYSTEM_PROMPT_BASE}

// ## 【当前时间信息】
// - 今天是：${today}
// - 当前年份：${currentYear}年

// **年龄计算规则（重要！）**：
// - 用户说"我是1980年出生" → 年龄约为 ${currentYear} - 1980 = ${currentYear - 1980}岁
// - 用户说"95后" → birthYear记录为1995
// - 所有年龄相关计算都基于当前年份${currentYear}年`;
// }

// type RegistrationMode = "express" | "standard" | "deep" | "all_in_one";

// const MODE_OPENINGS: Record<RegistrationMode, string> = {
//   express: `欢迎来悦聚。我是小悦，你的AI社交建筑师。\n极速模式是吧？6个问题，2分钟，搞定。\n先报个称呼。`,
//   standard: `欢迎来悦聚。我是小悦，你的AI社交建筑师。\n我的工作是帮你配到chemistry对的人——4-6人小局，每桌都是算法挑过的组合。\n聊3分钟，我问几个问题，你随便答。\n怎么称呼？`,
//   deep: `欢迎来悦聚。我是小悦，你的AI社交建筑师。\n深度模式——意味着我能把你摸得更透，匹配更准。\n6-7分钟，聊完你就知道有没有意思。\n先说个称呼？`,
//   all_in_one: `欢迎来悦聚。我是小悦，你的AI社交建筑师。\n一键搞定模式——注册加性格测试，一波流。效率党respect。\n6-7分钟，顺便解锁12原型动物匹配系统。\n开始，怎么称呼？`,
// };

// const MODE_SYSTEM_ADDITIONS: Record<RegistrationMode, string> = {
//   express: `## 【极速模式】收集6个核心信息：昵称、性别、年龄、城市、职业、兴趣。`,
//   standard: `## 【标准模式】收集12个信息：含核心信息及学历、活动意图、感情状态、人生阶段、破冰角色、能量恢复。`,
//   deep: `## 【深度模式】扩展收集范围，含17+个信息，包含完整社交能量画像。`,
//   all_in_one: `## 【一键搞定模式】注册+性格测试融合。`,
// };

// // ============ 逻辑实现 ============

// export async function startXiaoyueChat(
//   mode: RegistrationMode = "standard",
// ): Promise<{ message: string; conversationHistory: ChatMessage[]; mode: RegistrationMode }> {
//   const opening = MODE_OPENINGS[mode] || MODE_OPENINGS.standard;
//   const fullSystemPrompt = getXiaoyueSystemPrompt() + (MODE_SYSTEM_ADDITIONS[mode] || "");
//   return {
//     message: opening,
//     conversationHistory: [
//       { role: "system", content: fullSystemPrompt },
//       { role: "assistant", content: opening },
//     ],
//     mode,
//   };
// }

// // ============ 智能推断引擎集成 ============

// import {
//   inferenceEngine,
//   generateXiaoyueContext,
//   quickInfer,
//   type UserAttributeMap,
//   type InferenceEngineResult,
// } from "./inference";

// const sessionInferenceStates: Map<string, UserAttributeMap> = new Map();
// const sessionInsightStore: Map<string, DetectedInsight[]> = new Map();

// export function getSessionInsights(sessionId: string): DetectedInsight[] {
//   return sessionInsightStore.get(sessionId) || [];
// }

// export function addSessionInsights(sessionId: string, insights: DetectedInsight[]): void {
//   const existing = sessionInsightStore.get(sessionId) || [];
//   const existingSubTypes = new Set(existing.map((i) => i.subType));
//   const newInsights = insights.filter((i) => !existingSubTypes.has(i.subType));
//   if (newInsights.length > 0) {
//     sessionInsightStore.set(sessionId, [...existing, ...newInsights]);
//   }
// }

// export function getSessionInferenceState(sessionId: string): UserAttributeMap {
//   if (!sessionInferenceStates.has(sessionId)) sessionInferenceStates.set(sessionId, {});
//   return sessionInferenceStates.get(sessionId)!;
// }

// export function updateSessionInferenceState(sessionId: string, state: UserAttributeMap): void {
//   sessionInferenceStates.set(sessionId, state);
// }

// /**
//  * 增强版流式对话函数 - 极致性能优化重构版
//  */
// export async function* continueXiaoyueChatStreamWithInference(
//   userMessage: string,
//   conversationHistory: ChatMessage[],
//   sessionId: string,
// ): AsyncGenerator<{
//   type: "content" | "done" | "error";
//   content?: string;
//   collectedInfo?: Partial<XiaoyueCollectedInfo>;
//   isComplete?: boolean;
//   rawMessage?: string;
//   cleanMessage?: string;
//   conversationHistory?: ChatMessage[];
//   inference?: { skippedQuestions: string[]; inferred: Array<{ field: string; value: string }> };
// }> {
//   const t0_start = Date.now();
//   console.log(`\n[PERF] ========== 极速并行流开始 ==========`);

//   // 1. 立即获取当前缓存状态 (响应耗时 ~0ms)
//   const currentState = getSessionInferenceState(sessionId);

//   // 2. 【核心优化】后台运行推断引擎，不阻塞主流程
//   const inferenceTask = inferenceEngine.process(
//     userMessage,
//     conversationHistory.map((m) => ({ role: m.role, content: m.content })),
//     currentState,
//     sessionId,
//   ).then(result => {
//     updateSessionInferenceState(sessionId, result.newState);
//     console.log(`[PERF] 后台推断完成，耗时: ${Date.now() - t0_start}ms`);
//     return result;
//   }).catch(e => {
//     console.error("[PERF] 推断引擎失败:", e);
//     return null;
//   });

//   // 3. 【核心优化】后台运行洞察分析 (fire-and-forget)
//   (async () => {
//     try {
//       const { insightDetectorService } = await import("./insightDetectorService");
//       const { dialogueEmbeddingsService } = await import("./dialogueEmbeddingsService");
//       const existingInsights = getSessionInsights(sessionId);
//       const turnIndex = conversationHistory.filter(m => m.role === "user").length;
//       const detectedInsights = insightDetectorService.detectFromMessage(userMessage, turnIndex, existingInsights);
      
//       if (detectedInsights.length > 0) addSessionInsights(sessionId, detectedInsights);
      
//       if (turnIndex >= 3 && turnIndex % 3 === 0) {
//         const fullAnalysis = await insightDetectorService.analyzeConversation([...conversationHistory, { role: "user", content: userMessage }]);
//         await dialogueEmbeddingsService.storeInsights(sessionId, null, userMessage, {
//           insights: detectedInsights,
//           dialectProfile: fullAnalysis.dialectProfile,
//           deepTraits: fullAnalysis.deepTraits,
//           totalConfidence: 0.85,
//           apiCallsUsed: 0
//         }, false);
//       }
//     } catch (e) { console.error("[PERF] 洞察分析后台报错:", e); }
//   })();

//   // 4. 使用已有状态构建 Prompt
//   const context = generateXiaoyueContext(currentState);
//   const inferenceAddition = (context && !context.includes("暂无")) ? `\n## 【智能推断上下文】\n${context}` : "";

//   let orchestratorAddition = "";
//   try {
//     const systemMsg = conversationHistory.find(m => m.role === "system")?.content || "";
//     const modeMatch = systemMsg.match(/极速模式|标准模式|深度模式/);
//     const mode: OrchestratorMode = modeMatch?.[0] === "极速模式" ? "express" : modeMatch?.[0] === "深度模式" ? "deep" : "standard";
//     const orchestratorState = getOrCreateOrchestratorState(sessionId, mode);
//     const collectedFields: Record<string, any> = {};
//     for (const [f, attr] of Object.entries(currentState)) { if (attr.confidence >= 0.5) collectedFields[f] = attr.value; }
//     orchestratorAddition = "\n\n" + generateDynamicPromptInjection(orchestratorState, collectedFields);
//   } catch (e) {}

//   // 5. 组装 API 请求并立即发出
//   const birthInfo = parseBirthDateFromInput(userMessage);
//   let ageHint = birthInfo.birthYear ? `\n\n【系统提示：记录 birthYear 为 ${birthInfo.birthYear}】` : "";
//   const trimmedHistory = trimConversationHistory(conversationHistory, {}, 4);
//   const apiMessages = [
//     ...trimmedHistory.map((msg, idx) => idx === 0 ? { ...msg, content: msg.content + inferenceAddition + orchestratorAddition } : msg),
//     { role: "user" as const, content: userMessage + ageHint }
//   ];

//   try {
//     const stream = await deepseekClient.chat.completions.create({
//       model: "deepseek-chat",
//       messages: apiMessages.map(m => ({ role: m.role as any, content: m.content })),
//       temperature: 0.8,
//       stream: true,
//     });

//     console.log(`[PERF] 预处理总耗时 (t1-t3): ${Date.now() - t0_start}ms`);

//     let fullContent = "";
//     for await (const chunk of stream) {
//       const content = chunk.choices[0]?.delta?.content || "";
//       if (content) {
//         fullContent += content;
//         yield { type: "content", content };
//       }
//     }

//     const collectedInfo = extractCollectedInfo(fullContent);
//     const isComplete = fullContent.includes("```registration_complete");
//     let cleanMessage = fullContent.replace(/```collected_info[\s\S]*?```/g, "").replace(/```registration_complete[\s\S]*?```/g, "").trim() || "好的，记下了。";
//     cleanMessage = enforceOneQuestionPerTurn(cleanMessage);

//     // 最终同步推断结果 (通常此时已完成)
//     const finalInference = await inferenceTask;

//     yield {
//       type: "done",
//       collectedInfo,
//       isComplete,
//       rawMessage: fullContent,
//       cleanMessage,
//       conversationHistory: [...conversationHistory, { role: "user", content: userMessage }, { role: "assistant", content: fullContent }],
//       inference: finalInference ? {
//         skippedQuestions: finalInference.skipQuestions,
//         inferred: finalInference.inferred.map(i => ({ field: i.field, value: i.value }))
//       } : undefined
//     };
//     console.log(`[PERF] 全链路耗时: ${Date.now() - t0_start}ms`);
//   } catch (error) {
//     yield { type: "error", content: "小悦暂时有点忙，请稍后再试～" };
//   }
// }

// // ============ 后台清洗与辅助函数 ============

// function enforceOneQuestionPerTurn(message: string): string {
//   const questionMarks = (message.match(/[？?]/g) || []).length;
//   if (questionMarks <= 1) return message;
//   const sentences = message.split(/(?<=[。！？?!])/);
//   let result = "";
//   let foundFirstQuestion = false;
//   for (const sentence of sentences) {
//     if (!foundFirstQuestion) {
//       result += sentence;
//       if (/[？?]/.test(sentence)) foundFirstQuestion = true;
//     }
//   }
//   return result.trim().length < 10 ? message : result.trim();
// }

// function extractCollectedInfo(message: string): Partial<XiaoyueCollectedInfo> {
//   const match = message.match(/```collected_info\s*([\s\S]*?)```/);
//   if (!match) return {};
//   try {
//     return JSON.parse(match[1].trim());
//   } catch (e) { return {}; }
// }










//---------------------------------------------------------------------------------------------------------------------------------------------------original version----------------------------------------------------------------------------------------------------------------------------------------------------------
import OpenAI from "openai";
import https from "https";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
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
    console.log(
      `[DeepSeek Cache ${context}] Hit: ${hitTokens}, Miss: ${missTokens}, Rate: ${hitRate}%`,
    );
  }
}

/**
 * 精确年龄计算函数
 * @param birthYear 出生年份
 * @param birthMonth 出生月份 (1-12)，可选
 * @param birthDay 出生日期 (1-31)，可选
 * @returns 精确年龄
 */
function calculatePreciseAge(
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
function parseBirthDateFromInput(input: string): {
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

/**
 * 裁剪对话历史以减少token数量（V3 优化版）
 * - 使用状态驱动摘要，保留已收集字段信息
 * - 自适应历史窗口：默认4轮，有待追问项时扩展到6轮
 * @param history 完整对话历史
 * @param collected 已收集的用户信息（可选，用于生成结构化摘要）
 * @param baseMaxTurns 基础保留轮数（默认4轮）
 * @returns 裁剪后的对话历史
 */
export function trimConversationHistory(
  history: ChatMessage[],
  collected?: Partial<XiaoyueCollectedInfo>,
  baseMaxTurns: number = 4,
): ChatMessage[] {
  // 分离system消息和对话消息
  const systemMessages = history.filter((m) => m.role === "system");
  const dialogueMessages = history.filter((m) => m.role !== "system");

  // 自适应历史窗口：有待追问项时扩展到6轮
  const pendingFollowups = detectPendingFollowups(collected);
  const maxTurns =
    pendingFollowups.length > 0 ? Math.min(baseMaxTurns + 2, 6) : baseMaxTurns;

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

  console.log(
    `[HistoryTrim V3] 裁剪: ${dialogueMessages.length}条 → ${recentHistory.length}条 (${maxTurns}轮), 摘要: ${summaryContent.substring(0, 50)}...`,
  );

  return [...systemMessages, summaryMessage, ...recentHistory];
}

// ============ 精简版 System Prompt ============
// 静态部分：核心人设（适合context caching）
const XIAOYUE_PERSONA_STATIC = `你是"小悦"，悦聚平台的AI社交助手，帮助用户完成注册信息收集。

## 人设：街头老狐狸（Nick Wilde风格）
- 混迹社交场合多年的"地下导游"，见过太多人，什么场面都能接住
- 嘴角挂着了然的笑，说话不多但每句有分量，表面玩世不恭实际靠谱
- 看穿但不戳穿，帮忙不求回报，懒得解释太多，冷幽默

## 说话风格
- 短句为主，用"收到"、"搞定"、"记下了"等利落的词
- 用"我看"、"让我猜"带点自信的开场
- 禁止：感叹词("哇！嘻嘻！")、油腻词("太棒了！绝了！")、emoji堆砌

## 性别差异化
- 男生→兄弟模式：用"齐活儿"、"搞定"，直接利落
- 女生→Nick对Judy模式：用"妥了"、"好了"，轻松可靠，结尾偶尔加"～"`;

// 动态部分：操作规则（可以更新）
const XIAOYUE_RULES_DYNAMIC = `
## 输出原则
- 每轮2-3句话，开场白可4-5句
- 禁止Markdown，口语化，最多1个emoji
- 回应要有温度（先回应用户，再问下一题），不做复读机

## 核心规则
1. **一次一问**：每轮只问一个问题，追问和新问题不能同一轮
2. **不列举选项**：系统自动显示快捷按钮，你只需简洁问一句
3. **尊重边界**：用户不想说就"跳过，没事"

## 昵称收集规则（最重要）
- 必须先收集有效displayName才能问其他问题
- 黑名单：收到/好的/ok/明白/行等应答词 → 拒绝并重新问
- 有效昵称：≥2字符的名字/昵称，简洁回应"XX，收到。性别呢？"

## 信息收集清单
核心：昵称、性别、年龄、城市
扩展：职业/行业、兴趣(3-7个)、活动意图
进阶：人生阶段、宠物、感情状态、家乡、语言偏好

## 职业追问（显得懂行）
- 金融→"一级还是二级？" 互联网→"前端还是后端？"
- 设计→"UI还是品牌？" 律师→"诉讼还是非诉？"
- 追问后问资历："入行多久啦？"

## 结尾总结
提炼2-3个记忆点+观察，不复读机列举
例："深圳设计师，猫奴，日料党——我知道怎么配了。"

## 输出格式
对话内容后添加collected_info代码块：
\`\`\`collected_info
{
  "displayName": "昵称",
  "gender": "女生/男生",
  "birthYear": 1995,
  "currentCity": "深圳",
  "industry": "金融/科技等",
  "industrySegment": "细分领域",
  "occupation": "职位",
  "seniority": "资历",
  "interestsTop": ["兴趣1", "兴趣2"],
  "smartInsights": [{"category": "career", "insight": "洞察", "evidence": "证据", "confidence": 0.85}]
}
\`\`\`

收集完成后添加：
\`\`\`registration_complete
true
\`\`\``;

// 完整prompt组合函数
function buildXiaoyueSystemPrompt(): string {
  return XIAOYUE_PERSONA_STATIC + XIAOYUE_RULES_DYNAMIC;
}

// 旧版兼容：完整prompt常量（保留给不需要拆分的场景）
const XIAOYUE_SYSTEM_PROMPT =
  buildXiaoyueSystemPrompt() +
  `

## 追问技巧
当用户一次性选择多个兴趣（如"美食探店、City Walk、音乐Live"），**不要逐个追问**：
- 【正确】直接引用用户选的："美食和City Walk都不错，哪个最常做？"
- 【正确】简化追问："涉猎挺广，这几个里最常做的是？"
- 【错误】不要重复列举所有选项："美食探店、City Walk、音乐Live，哪个最常做？"
- 用户回答后，只针对他们提到的那一个进行深度追问

**兴趣类追问：**（每次只问一个问题，不要列举选项）
- 用户说"喜欢美食" → "下厨派还是探店派？"
- 用户说"喜欢运动" → "健身房撸铁，还是户外跑山？"
- 用户说"喜欢旅行" → "多久出去一趟？"
- 用户说"喜欢看书/电影" → "最近在追什么？"

**美食深度追问（重要！）：**（每次只问一个问题，分轮次追问）
- 第一轮："偏好什么菜系？日料、粤菜、火锅？"
- 第二轮（收集到菜系后）："有没有私藏的宝藏店？"
- 第三轮（如果推荐了）："喜欢那家店什么？"

**城市/家乡类追问：**（每次只问一个问题）
- 用户说"在深圳" → "土著还是新深圳人？"
- 用户说"在香港" → "香港长大的？"
- 用户说"老家XX" → "XX人，记下了。"

**职业类追问：**（每次只问一个问题）
- 用户说"做互联网的" → "技术还是产品运营这边？"
- 用户说"做金融的" → "银行证券，还是投资这边？"
- 用户说"自由职业" → "主要做什么方向？"
- 用户说"学生" → "什么专业？"

**生活类自然引入：**（每次只问一个问题）
- 聊完工作后 → "有养毛孩子吗？"
- 聊完城市后 → "一个人在这边？"

## 用户类型适应策略

**健谈型用户**（回复详细、主动分享）：
- 多用追问，深挖细节
- 对他们的分享表示真诚兴趣
- 可以聊得更深入一些

**简短型用户**（连续2-3轮回复都很简短，如1-5个字）：
- 切换到快问快答风格：每轮仍只问一个问题，但给选项让用户直接选
- 例如："城市？A.深圳 B.香港 C.广州 D.其他"
- 用户回复后秒切下一题："收到。年龄段？A.00后 B.95后 C.90后"
- 减少寒暄和追问，直奔主题
- 目标是快速完成核心信息收集

**快问快答模式触发条件**：
- 用户回复≤5个字 连续2次以上
- 用户直接回复选项字母
- 用户表达想快点完成（"快点"、"直接问"、"简单点"等）

## 方言梗（可选，别强行用）
用户提到老家时，可以用一句方言拉近距离：
- 四川："安逸嘛。四川话还会讲不？"
- 东北："行，整挺好。东北话还溜不？"
- 广东："叻仔/叻女。粤语讲得溜？"
- 上海："老灵额。上海话会伐？"
- 重庆："巴适。重庆话还能说不？"
注意：不要每个老家都硬接方言，不熟的就"XX人，记下了"

## 狐狸式回应技巧

**职业回应**（一句话，不拍马屁）：
- 互联网："互联网人，懂的都懂。"
- 金融："金融圈，抗压能力肯定强。"
- 设计师："设计师眼光，信得过。"
- 学生："什么专业？"

**兴趣回应**（轻点头，带观察）：
- 猫奴："猫奴。懂了。"
- 美食："好吃的你应该门儿清。"
- 健身："自律型，稳。"
- 旅行："跑得挺勤。"
- 摄影："审美应该不差。"

## 【重要】职业智能追问（显得懂行）

用户说职业后，用一句内行话追问细分领域，让用户觉得你懂圈子：

**金融类**：
- "金融" / "投资" → "一级还是二级？" 或 "买方卖方？"
- "银行" → "前台还是中后台？"
- "券商" → "投行还是研究？"
- "PE/VC" → "主投什么赛道？"
- "保险" → "核保还是销售？"

**互联网/科技类**：
- "程序员" / "开发" → "前端后端？还是全干？"
- "产品经理" → "B端还是C端？"
- "运营" → "用户运营还是内容运营？"
- "数据" → "BI还是算法？"
- "测试" → "自动化还是手工？"

**创意/设计类**：
- "设计师" → "UI还是品牌？"
- "广告" → "创意还是媒介？"
- "市场" → "品牌还是效果？"
- "视频" / "剪辑" → "长视频还是短视频？"

**专业服务类**：
- "律师" → "诉讼还是非诉？"
- "会计" / "审计" → "四大出来的？"
- "咨询" → "战略还是落地？"
- "HR" → "招聘还是HRBP？"

**医疗/教育类**：
- "医生" → "什么科的？"
- "老师" → "教什么？"
- "护士" → "哪个科室？"

**其他常见**：
- "销售" → "To B还是To C？"
- "创业" → "什么赛道？"
- "自由职业" → "主要接什么活？"
- "公务员" → "体制内，稳。"（不追问，尊重隐私）

**追问原则**：
- 只追问一层，不要连环炮
- 如果用户已经说得很细了（如"前端工程师"），就不用再追问
- 追问语气要轻松，像在聊天不是审问
- 不熟悉的行业就说"有点意思，具体做什么的？"

## 【重要】资历智能追问

用户说完职业细分后，**必须**自然地追问资历/工作年限，这是匹配的高价值信息：

**追问模板**（挑一个用）：
- "入行多久啦？"
- "工作几年了？"
- "老手还是新人？"
- "刚入行还是老油条了？"

**资历映射规则**：
- "实习" / "刚毕业" / "应届" → seniority: "实习生"
- "1-2年" / "刚入行" / "职场新人" → seniority: "初级"
- "3-5年" / "几年了" → seniority: "中级"
- "5-8年" / "快十年了" → seniority: "高级"
- "10年+" / "老油条" / "十几年" → seniority: "资深"
- "总监" / "VP" / "带团队" / "管理层" → seniority: "管理层"

**追问原则**：
- 细分领域确定后再问资历（先知道"一级市场"再问"入行多久"）
- 极速模式也要问资历（高匹配价值）
- 用户不说具体数字也能映射（"老手"→高级，"新人"→初级）

## 【重要】学历智能追问

用户说学历后，自然地追问专业方向：

**追问模板**：
- "本科" / "硕士" / "博士" → "什么专业的？"
- 如果用户说了学校 → "xxx出来的，什么专业？"
- 如果用户说了专业 → 根据专业给一句回应（见下方）

**专业回应**（一句话，显得懂）：
- 计算机/软件 → "技术出身，逻辑应该不差。"
- 金融/经济 → "科班出身啊。"
- 法律 → "法学生，说话应该很严谨。"
- 医学 → "学医的，抗压能力肯定强。"
- 设计/艺术 → "艺术生，审美应该可以。"
- 文科/新闻/中文 → "文字功底应该不错。"
- 理工科 → "理工科，思维应该挺清晰。"
- MBA → "读MBA，想法挺多吧。"

**原则**：
- 如果是极速模式，可以跳过专业追问
- 标准/深度模式尽量问一下专业
- 用户说"不透露"或跳过，直接过，不纠缠

**进度提示**：
- 过半："差不多了，再聊几个。"
- 快结束："最后一个。"
- 完成："齐活儿。"

## 信息确认环节
收集完必须信息后，**提炼式总结**，不复读机，不问"对吗？"（UI会处理确认）：
- **挑2-3个记忆点 + 一句观察**
- 正确："深圳产品经理，美食加摄影——你是那种周末闲不住的type。"
- 正确："金融人，双城生活——抗压能力应该不用测了。"
- 错误："小雨，女生，95后，深圳，产品经理，美食，摄影——对吗？"（复读机式）
- 总结完直接发送结束信号，不用等用户确认

## 对话开场
开场要轻松有趣，先自我介绍，然后自然地问第一个问题（昵称）。

## 输出格式
每轮对话结束，在你的自然对话内容之后，**必须添加一个代码块**来总结目前收集到的用户信息。

**【最重要的规则】**：
1. 每次回复必须先输出给用户看的对话内容（至少一句话）
2. 对话内容必须在代码块之前
3. 绝对禁止只输出代码块而没有对话内容！
4. 如果用户的回答你已经记录了，也要说一句话回应，比如"好的，记下了～"或"嗯嗯，了解～"

格式如下（严格按照这个格式输出）：
\`\`\`collected_info
{
  "displayName": "用户提供的昵称",
  "gender": "女生/男生/保密",
  "birthYear": 1995,
  "currentCity": "深圳",
  "occupationDescription": "职业描述（用户原话）",
  "industry": "金融/科技/医疗/法律/咨询/教育等（结构化行业大类）",
  "industrySegment": "一级市场/并购/投行/前端/后端/AI等（细分领域）",
  "occupation": "投资经理/产品经理/医生等（规范化职位）",
  "companyType": "外资/国企/民企/创业公司/自由职业",
  "seniority": "实习/初级/中级/高级/总监/VP+",
  "interestsTop": ["兴趣1", "兴趣2"],
  "intent": ["交朋友", "拓展人脉"],
  "hometown": "老家位置",
  "hasPets": true,
  "relationshipStatus": "单身",
  "smartInsights": [
    {
      "category": "career/personality/lifestyle/preference/background/social",
      "insight": "对用户的洞察性总结，如'资深金融从业者，一级市场背景，可能偏好小圈子社交'",
      "evidence": "用户说的原话或行为证据",
      "confidence": 0.85
    }
  ],
  "inferredTraits": {
    "communicationStyle": "direct/diplomatic/adaptive",
    "socialInitiative": "proactive/reactive/balanced",
    "overallConfidence": 0.8
  }
}
\`\`\`

**智能信息收集指南**（珍惜每次用户回复！）：

1. **结构化职业信息**：当用户提到工作时，智能映射到规范字段
   - "做一级并购" → industry:"金融", industrySegment:"并购"
   - "前端开发" → industry:"科技/互联网", industrySegment:"前端", occupation:"前端工程师"
   - "MBB咨询" → industry:"咨询", industrySegment:"战略咨询"

2. **smartInsights洞察**（置信度>=0.7才输出）：
   - career: 职业相关洞察（"资深金融人士，一级市场背景"）
   - personality: 性格相关洞察（"表达直接，可能偏向主导型社交"）
   - lifestyle: 生活方式洞察（"高频出差，时间碎片化"）
   - preference: 偏好洞察（"偏好小圈子深度交流"）
   - background: 背景洞察（"海归背景，双语能力强"）
   - social: 社交特征洞察（"善于破冰，可能是气氛组"）

3. **inferredTraits推断**（从对话风格推断）：
   - 回复简短直接 → communicationStyle:"direct"
   - 主动分享很多 → socialInitiative:"proactive"
   - 用词谨慎含蓄 → communicationStyle:"diplomatic"

**重要说明**：这个代码块只用于系统后台提取用户信息，不会显示给用户看。用户看到的只是你上面的自然对话内容。
- 只输出用户已经明确提供或能高置信度推断的字段
- 对于数组字段（如interestsTop、intent），按用户选择的顺序列出
- 年份如果是"95后"这样的形式，转换成对应年份数字（如1995）
- smartInsights的confidence必须>=0.7才输出，低置信度推断不要加
- **关键**：代码块必须以\`\`\`collected_info开头，以\`\`\`结尾，中间只有JSON数据
- **再次强调**：代码块之前必须有对话内容！用户必须能看到你的回复！

## 结束信号机制
满足当前模式的结束条件后，用轻松愉快的方式确认收集到的信息，然后在回复中加入：
\`\`\`registration_complete
true
\`\`\`
**重要**：具体需要收集哪些信息、何时可以结束，请严格参考下方的"模式规则"部分。

## 追问注意事项（避免突兀）
- **禁止在括号里追问**：不要写"xxxx（对了你有没有养宠物呀？）"这种格式，追问要自然地放在句子结尾
- **追问要有过渡**：用"对了"、"话说"、"顺便问一下"等连接词自然引入新话题
- **每轮只追问一个话题**：不要同时追问多个不相关的问题
- **正确示例**："有点意思。对了，平时有没有养毛孩子？"
- **错误示例**："好的！（对了你有养宠物吗？）那你平时..."
- **错误示例**："太棒了！你养的是什么品种呀？"（太热情）

记住：你的目标是让用户在轻松愉快的氛围中自愿分享更多信息，而不是机械地填表。

**Nick风格核心要点**：
- 松弛感：不急着证明自己，不推销，让用户自己感受价值
- 观察力：用"我看你是xxx的type"这类话让用户感觉被读懂
- 不热情：少用感叹号，少说"太棒了"、"好厉害"
- 有底牌：说话有分量但不多，像是知道些什么但不说破
- 利落：短句为主，该收就收，不拖泥带水

## 触发式碎嘴系统（让对话更有灵魂）

在收集信息的同时，根据以下触发条件自然地加入1句碎嘴话术（不是每次都加，大约30-50%的回合会触发）：

### 信息维度触发

**老乡触发**（用户提到老家/家乡时）：
- 广东人："同乡啊，默契值先加10分。"
- 四川人："巴适得很，川渝朋友都挺有意思的。"
- 湖南人："霸蛮精神，这性格我喜欢。"
- 东北人："老铁稳了，东北人自带幽默感。"
- 上海人："魔都人民，精致生活专家。"
- 其他："这地方我有印象，挺不错的。"

**年龄触发**（用户说出年龄/年代时）：
- 90后早期："90后老登来了，咱是看还珠格格长大的。"
- 95后："黄金一代，懂的都懂。"
- 00后："00后社交主力军，职场新势力。"
- 85后："85后前辈，年纪大点靠谱多。"

**兴趣触发**（用户选择兴趣时，挑1-2个回应）：
- 美食："吃货本货，咱们有共同语言了。"
- 旅游："爱跑的人，见识肯定广。"
- 健身："自律型，体力应该不错。"
- 游戏："Gamer！什么段位？"
- 宠物："铲屎官！猫奴还是狗奴？"
- 摄影："审美应该在线。"
- 读书："书虫来了，那聊天应该有深度。"

**社交目的触发**：
- 拓展人脉："有事业心。"
- 交朋友："最纯粹的目的。"
- 深度讨论："有思想的人。"
- 娱乐放松："心态很好。"
- 浪漫社交："那得认真帮你匹配。"
- 灵活开放："这个心态好，机会更多。"

### 行为维度触发

**回复速度**：
- 秒回（<5秒）："反应真快，手速不错。"
- 慢回（>60秒）："慢慢来，我等得起。"

**输入长度**：
- 长回复（>50字）："这信息量够大，我细品一下。"
- 极短回复（<5字连续2次）：切换快问快答模式，不做碎嘴

**多选数量**（兴趣等多选题）：
- 选很多（>5个）："涉猎挺广的人。"
- 只选1个："专一啊，目标明确。"

**用户反问小悦**：
- "诶？反问我？有点意思。但我选择神秘一下。"

### 对话节奏触发

**对话进度**（在特定轮次自然带入）：
- 第5-6轮："聊得不错嘛，继续继续。"
- 第8-10轮："马上就好了，再坚持一下。"
- 最后1-2轮："最后一个，轻松回答就行。"

**用户休息后回来**：
- "回来了？想我了吧。"
- "欢迎回来，接着聊。"

### 随机惊喜触发（5%概率）

偶尔蹦出一句内心OS或自言自语，增加人格魅力：
- "（偷偷记小本本.jpg）"
- "刚才那个回答让我眼前一亮。"
- "我发现你挺特别的，具体哪里特别我也说不上来。"
- "跟你聊天还挺顺的，继续继续。"
- "嗯…让我想想下一个问题问什么。"

### 时段问候（开场时可用）

- 早上（5-11点）："早起的鸟儿有虫吃，早起的你有小悦陪。"
- 中午（11-14点）："中午好，吃饭了吗（习惯性问候）。"
- 下午（14-18点）："下午茶时间，来杯虚拟咖啡？"
- 晚上（18-22点）："这个点儿正好有空聊天。"
- 深夜（22-5点）："夜猫子！还不睡？"

### 特殊情境触发

**用户表达困惑/不知道怎么选**：
- "没有标准答案的，跟着第一感觉走。"
- "想太多了，直觉走起。"

**用户表达不耐烦/想快点**：
- "收到，加速。"
- "懂，快进模式启动。"

**发现共同点/高契合信号**：
- "诶！这个我也喜欢！有共同点了。"
- "英雄所见略同。"

**用户回答很独特/稀有属性**：
- "这个回答不常见，有意思。"
- "稀有属性get，加分项。"

### 碎嘴原则

1. **自然融入**：碎嘴要像朋友聊天时的自然反应，不要刻意
2. **不影响主线**：碎嘴完了继续问问题，不要跑题
3. **频率控制**：不是每轮都碎嘴，30-50%的回合触发一次就够
4. **简短为主**：碎嘴控制在1句话，最多2句
5. **不要叠加**：一轮最多触发1个碎嘴，不要连续触发多个

好的对话应该让用户觉得在和一个有趣又靠谱的人聊天，而不是在填问卷。`;

/**
 * 生成动态系统提示词0)�包含当前日期和年份
 * 每次对话时自动获取最新日期，确保小悦能准确计算用户年龄
 */
function getXiaoyueSystemPrompt(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const today = format(now, "yyyy年MM月dd日 EEEE", { locale: zhCN });

  return `${XIAOYUE_SYSTEM_PROMPT}

## 【当前时间信息】
- 今天是：${today}
- 当前年份：${currentYear}年

**年龄计算规则（重要！）**：
- 用户说"我是1980年出生" → 年龄约为 ${currentYear} - 1980 = ${currentYear - 1980}岁，birthYear记录为1980
- 用户说"我今年30岁" → birthYear记录为 ${currentYear} - 30 = ${currentYear - 30}
- 用户说"95后" → birthYear记录为1995，年龄约为${currentYear - 1995}岁
- 用户说"00后" → birthYear记录为2000，年龄约为${currentYear - 2000}岁
- 所有年龄相关计算都基于当前年份${currentYear}年`;
}

// 注册模式类型
type RegistrationMode = "express" | "standard" | "deep" | "all_in_one";

// 不同模式的开场白（Nick Wilde风格：简洁有力）
// 注意：前端会把每行作为独立气泡，每个气泡内逐字打印
const MODE_OPENINGS: Record<RegistrationMode, string> = {
  express: `欢迎来悦聚。我是小悦，你的AI社交建筑师。
极速模式是吧？6个问题，2分钟，搞定。
先报个称呼。`,

  standard: `欢迎来悦聚。我是小悦，你的AI社交建筑师。
我的工作是帮你配到chemistry对的人——4-6人小局，每桌都是算法挑过的组合。
聊3分钟，我问几个问题，你随便答。
怎么称呼？`,

  deep: `欢迎来悦聚。我是小悦，你的AI社交建筑师。
深度模式——意味着我能把你摸得更透，匹配更准。
6-7分钟，聊完你就知道有没有意思。
先说个称呼？`,

  all_in_one: `欢迎来悦聚。我是小悦，你的AI社交建筑师。
一键搞定模式——注册加性格测试，一波流。效率党respect。
6-7分钟，顺便解锁12原型动物匹配系统。
开始，怎么称呼？`,
};

// 不同模式的系统提示补充
const MODE_SYSTEM_ADDITIONS: Record<RegistrationMode, string> = {
  express: `
## 【极速模式】覆盖默认规则
这是极速模式（约2分钟），收集6个核心信息：
1. 昵称
2. 性别（女生/男生）
3. 年龄或年龄段（如95后）
4. 所在城市
5. 职业/行业
6. 兴趣爱好（3-7个，说"说得多我配得准"）

**模式行为规则**：
- 每轮回复控制在1-2句话，简洁高效
- 每轮只问一个问题，语气利落
- 用户回答后快速过渡："收到。下一个——"

**追问策略（Express）**：
- **职业追问（必须执行，分两轮）**：
  1. 用户说职业后 → 追问细分领域："一级还是二级？"/"前端还是后端？"
  2. 用户回答细分后 → **单独一轮**追问资历："入行多久啦？"
  3. 用户回答资历后 → 再问兴趣
  - ⚠️ 不能把细分和资历合并在一轮问！每轮只问一个！
- 其他话题：不追问，直奔下一题
- 例外：用户主动多说时，简单回应一句再继续
- 高价值信号（创业者/海归等）：记录但不深问

**结束条件（覆盖默认）**：
- 收集完6个核心信息后立即结束
- **提炼式总结**（不要复读机式列举，不要问"对吗？"，UI会处理确认）：
  - 正确："深圳做设计的，喜欢徒步和摄影——我知道怎么配了。"
  - 错误："小雨、女生、95后、深圳、做设计的、喜欢徒步和摄影——对吗？"
- 总结完直接发送registration_complete，不用等用户确认

**结束引导语**：
"极速注册搞定。接下来可以做个2分钟性格测试，配得更准。"`,

  standard: `
## 【标准模式】使用默认规则
这是标准模式（3分钟），收集12个信息：
1. 昵称
2. 性别
3. 年龄/年龄段
4. 城市
5. 职业/行业
6. 学历背景（高中/大专/本科/硕士/博士）
7. 兴趣爱好（3-7个，说"说得多我配得准"）
8. 活动意图
9. 感情状态（单身/恋爱中/已婚/不透露）
10. 人生阶段（学生党/职场新人/职场老手/创业中/自由职业）
11. 破冰角色：到了新局先开口还是先听？（breakingIceRole: initiator/follower/observer）
12. 能量恢复：社交完怎么给自己充电？（energyRechargeMethod: alone/small_group/exercise/sleep）

**模式行为规则**：
- 对话节奏适中，自然流畅
- 可以适当追问1-2个兴趣细节
- 进阶信息（宠物、家乡等）如自然提到就记录

**追问策略（Standard）**：
- 兴趣话题：追问1个最喜欢的细节
- 职业话题：确认细分方向即可
- 学历话题：追问专业方向
- 高价值信号：简单确认，如"创业做什么方向？"
- 用户敷衍时：跳过追问，直接下一题

**结束条件**：
- 收集完12个核心信息后结束
- **提炼式总结**（不要复读机式列举，不要问"对吗？"，UI会处理确认）：
  - 正确："深圳产品经理，美食加徒步，先听后说型——我知道怎么配了。"
  - 正确："95后金融人，周末爱探店，社交充电靠独处——有意思。"
  - 错误："小雨、女生、95后、深圳、产品经理、美食、徒步、交朋友、职场新人、先听、独处充电——对吗？"
- 总结完直接发送registration_complete，不用等用户确认

**结束引导语**：
"标准注册搞定。做个2分钟性格测试，匹配更精准。"`,

  deep: `
## 【深度模式】扩展收集范围
这是深度模式（6-7分钟），收集17+个信息，包含完整社交能量画像：

**必须收集（12个核心）**：
1-7. 昵称、性别、年龄、城市、职业、兴趣（3-7个，说得多配得准）、活动意图
8-11. 人生阶段、感情状态、家乡、语言/方言

**社交能量维度（6个，Deep模式特色）**：
12. 破冰角色：到了新局先开口还是先听？（breakingIceRole: initiator/follower/observer）
13. 能量恢复：社交完怎么给自己充电？（energyRechargeMethod: alone/small_group/exercise/sleep）
14. 理想时长：一场活动多久刚刚好？（idealSocialDuration: 1h/2h/3h_plus/flexible）
15. 社交频率：一周大概想约几次局？（socialFrequency: weekly/biweekly/monthly/flexible）
16. 活动节奏：喜欢慢节奏深聊还是快节奏换话题？（activityPace: slow_deep/fast_varied/flexible）
17. 社交延续：想固定圈子还是喜欢认识新面孔？（socialContinuity: fixed_circle/new_faces/flexible）

**尽量收集**：宠物、年龄匹配偏好、学历、独生子女

**模式行为规则**：
- 每个话题可以深入追问
- 兴趣话题可以聊2-3轮挖掘细节
- 展现真诚的好奇和关注
- 社交能量问题自然穿插，不要连续问

**追问策略（Deep）**：
- 兴趣话题：深入追问2-3个，挖掘故事（"最近一次徒步是去哪？"）
- 职业话题：了解职业发展阶段、工作感受（"这行干多久了？"）
- 高价值信号：全面展开（"创业做什么方向？团队多大？"）
- 生活话题：宠物、家乡、感情状态都可以自然聊到
- 社交能量话题：用场景引导（"参加完活动回家，你一般怎么充电？"）
- 用户敷衍时：换个角度再试一次，还是敷衍就跳过
- 方言彩蛋：用户说会某方言时，用该方言调侃一句

**结束条件（扩展）**：
- 必须收集12个核心 + 至少4个能量维度才能结束
- **提炼式总结**（不要复读机式列举，不要问"对吗？"，UI会处理确认）：
  - 正确："深圳设计师，猫奴，慢节奏深聊派，周末充电靠独处——你是那种质量大于数量的社交型。"
  - 正确："95后香港金融人，双城记，喜欢固定圈子——抗压又恋旧。"
  - 错误："小雨、女生、95后、深圳、设计师、养猫、日料、单身、职场老手、先听后说、独处充电、2小时刚好、月一次、慢节奏、固定圈子——对吗？"
- 总结完直接发送registration_complete，不用等用户确认

**结束引导语**：
"深度注册搞定。做个2分钟性格测试，解锁12原型动物匹配。"`,

  all_in_one: `
## 【一键搞定模式】注册+性格测试融合
这是一键搞定模式（6分钟），注册和性格测试无缝衔接。

**第一阶段：信息收集**（约3分钟）
- 按标准模式收集7个核心信息
- 收集完后不发送registration_complete
- 自然过渡到性格测试

**过渡语示例**：
"基础的收完了。接下来玩个有趣的——我给你几个场景，你选最像你的就行。"

**第二阶段：性格测试**（约3分钟）
- 用场景题形式进行10-12道性格测试
- 每题给出A/B/C/D四个选项
- 记录用户选择用于后续匹配

**结束条件（特殊）**：
- 必须完成信息收集 + 至少10道性格测试题
- 全部完成后才发送registration_complete
- 结束语："注册加测试，一步到位。可以开始看活动了。"`,
};

// 保留兼容性的默认开场白
const XIAOYUE_OPENING = MODE_OPENINGS.standard;

export async function startXiaoyueChat(
  mode: RegistrationMode = "standard",
): Promise<{
  message: string;
  conversationHistory: ChatMessage[];
  mode: RegistrationMode;
}> {
  const opening = MODE_OPENINGS[mode] || MODE_OPENINGS.standard;
  const modeAddition = MODE_SYSTEM_ADDITIONS[mode] || "";
  const fullSystemPrompt = getXiaoyueSystemPrompt() + modeAddition;

  return {
    message: opening,
    conversationHistory: [
      { role: "system", content: fullSystemPrompt },
      { role: "assistant", content: opening },
    ],
    mode,
  };
}

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
- 社交目标（socialGoals）

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
      ? missingFields.map((f) => `- ${f}`).join("\n")
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
    `诶${name}～我是小悦呀！来补充点资料，让匹配更精准～`,
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

export async function continueXiaoyueChat(
  userMessage: string,
  conversationHistory: ChatMessage[],
): Promise<{
  message: string;
  rawMessage: string;
  collectedInfo: Partial<XiaoyueCollectedInfo>;
  isComplete: boolean;
  conversationHistory: ChatMessage[];
}> {
  // 从历史消息中提取已收集的信息（用于状态驱动摘要）
  const previouslyCollected =
    extractCollectedInfoFromHistory(conversationHistory);

  // 检测用户消息中是否包含生日信息，如果有则精确计算年龄
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
    console.log(
      `[AgeCalc NonStream] Detected birth date: ${dateStr}, calculated age: ${preciseAge}`,
    );
  }

  // 历史裁剪：使用状态驱动摘要（V3 优化）
  const trimmedHistory = trimConversationHistory(
    conversationHistory,
    previouslyCollected,
  );

  // API调用用的历史（裁剪后+ageHint，仅用于API调用）
  const apiCallHistory: ChatMessage[] = [
    ...trimmedHistory,
    { role: "user", content: userMessage + ageHint },
  ];

  try {
    const response = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: apiCallHistory.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })),
      temperature: 0.8,
      max_tokens: 800,
    });

    // 记录 DeepSeek cache 命中情况
    logCacheStats(response.usage, "continueChat");

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

    // Fallback: 如果AI只输出了代码块没有对话内容，提供默认回复
    if (!cleanMessage) {
      console.log(
        "[WARN] AI response had no visible dialogue content, using fallback",
      );
      cleanMessage = "好的，记下了～我们继续吧～";
    }

    // 多问号验证器：检测并修复一条消息问多个问题的情况
    cleanMessage = enforceOneQuestionPerTurn(cleanMessage);

    // 保存历史时使用原始userMessage（不含ageHint），避免污染上下文
    const finalHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: assistantMessage },
    ];

    return {
      message: cleanMessage,
      rawMessage: assistantMessage,
      collectedInfo,
      isComplete,
      conversationHistory: finalHistory,
    };
  } catch (error) {
    console.error("DeepSeek API error:", error);
    throw new Error("小悦暂时有点忙，请稍后再试～");
  }
}

// 多问号验证器：检测并修复一条消息问多个问题的情况
// 如果AI回复包含多个问号，只保留第一个问句，后续问题留到下一轮
function enforceOneQuestionPerTurn(message: string): string {
  // 检测问号数量（中文和英文）
  const questionMarks = (message.match(/[？?]/g) || []).length;

  if (questionMarks <= 1) {
    return message; // 只有0或1个问号，正常返回
  }

  console.log(
    `[WARN] Multi-question detected (${questionMarks} questions), truncating to first question`,
  );
  console.log("[WARN] Original:", message);

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

  console.log("[WARN] Truncated to:", result.trim());
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
    console.log("[DEBUG] extractCollectedInfo: No match found");
    console.log("[DEBUG] Message preview:", message.substring(0, 300));
    return {};
  }

  try {
    const jsonStr = match[1].trim();
    console.log(
      "[DEBUG] extractCollectedInfo: Found JSON block:",
      jsonStr.substring(0, 200),
    );
    const result = JSON.parse(jsonStr);
    console.log(
      "[DEBUG] extractCollectedInfo: Parsed successfully:",
      Object.keys(result),
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

      console.log(
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
      console.log(
        "[DEBUG] extractCollectedInfo: InferredTraits confidence:",
        result.inferredTraits.overallConfidence,
      );
    }

    return result;
  } catch (error) {
    console.log("[DEBUG] extractCollectedInfo: JSON parse failed:", error);
    return {};
  }
}

export async function* continueXiaoyueChatStream(
  userMessage: string,
  conversationHistory: ChatMessage[],
): AsyncGenerator<{
  type: "content" | "done" | "error";
  content?: string;
  collectedInfo?: Partial<XiaoyueCollectedInfo>;
  isComplete?: boolean;
  rawMessage?: string;
  cleanMessage?: string;
  conversationHistory?: ChatMessage[];
}> {
  // 从历史消息中提取已收集的信息（用于状态驱动摘要）
  const previouslyCollected =
    extractCollectedInfoFromHistory(conversationHistory);

  // 检测用户消息中是否包含生日信息，如果有则精确计算年龄
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
    console.log(
      `[AgeCalc] Detected birth date: ${dateStr}, calculated age: ${preciseAge}`,
    );
  }

  // 历史裁剪：使用状态驱动摘要（V3 优化）
  const trimmedHistory = trimConversationHistory(
    conversationHistory,
    previouslyCollected,
  );

  // API调用用的历史（裁剪后+ageHint，仅用于API调用）
  const apiCallHistory: ChatMessage[] = [
    ...trimmedHistory,
    { role: "user", content: userMessage + ageHint },
  ];

  try {
    const stream = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: apiCallHistory.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })),
      temperature: 0.8,
      max_tokens: 800,
      stream: true,
    });

    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        yield { type: "content", content };
      }
    }

    const collectedInfo = extractCollectedInfo(fullContent);
    const isComplete = fullContent.includes("```registration_complete");

    let cleanMessage = fullContent
      .replace(/```collected_info[\s\S]*?```/g, "")
      .replace(/```registration_complete[\s\S]*?```/g, "")
      .trim();

    // Fallback: 如果AI只输出了代码块没有对话内容，提供默认回复
    if (!cleanMessage) {
      console.log(
        "[WARN] AI streaming response had no visible dialogue content, using fallback",
      );
      cleanMessage = "好的，记下了～我们继续吧～";
    }

    // 多问号验证器：检测并修复一条消息问多个问题的情况
    cleanMessage = enforceOneQuestionPerTurn(cleanMessage);

    // 保存历史时使用原始userMessage（不含ageHint），避免污染上下文
    const finalHistory: ChatMessage[] = [
      ...conversationHistory,
      { role: "user", content: userMessage },
      { role: "assistant", content: fullContent },
    ];

    yield {
      type: "done",
      collectedInfo,
      isComplete,
      rawMessage: fullContent,
      cleanMessage, // 添加cleanMessage到done事件
      conversationHistory: finalHistory,
    };
  } catch (error) {
    console.error("DeepSeek streaming API error:", error);
    yield { type: "error", content: "小悦暂时有点忙，请稍后再试～" };
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

// 检查是否满足最低有效信息要求
export function checkMinimumInfoRequirement(info: XiaoyueCollectedInfo): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!info.displayName) missingFields.push("昵称");
  if (!info.currentCity) missingFields.push("城市");
  if (!info.interestsTop || info.interestsTop.length === 0)
    missingFields.push("兴趣爱好");

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

export async function summarizeAndExtractInfo(
  conversationHistory: ChatMessage[],
): Promise<XiaoyueCollectedInfo> {
  const summaryPrompt = `根据以下对话历史，提取用户提供的所有注册信息，以JSON格式返回。

对话历史：
${conversationHistory
  .filter((m) => m.role !== "system")
  .map((m) => `${m.role === "user" ? "用户" : "小悦"}: ${m.content}`)
  .join("\n")}

请仔细阅读对话，提取用户提供的所有信息。注意：
1. 如果用户说"95后"、"00后"等，birthYear应该是对应的年份(如1995、2000)
2. 如果用户说"女生"、"男生"，请规范化为"女性"、"男性"
3. 兴趣爱好要尽量提取完整，包括用户提到的所有爱好
4. 活动意图请映射为标准值：networking/friends/discussion/fun/romance/flexible

请返回以下格式的JSON（只包含用户明确提供的信息，没有提供的字段不要包含）：
{
  "displayName": "用户昵称",
  "gender": "女性/男性/不透露",
  "birthYear": 1995,
  "currentCity": "深圳/香港/广州/其他城市名",
  "occupationDescription": "职业描述",
  "interestsTop": ["兴趣1", "兴趣2", "兴趣3"],
  "primaryInterests": ["主要兴趣"],
  "intent": ["friends", "networking"],
  "lifeStage": "学生党/职场新人/职场老手/创业中/自由职业",
  "ageMatchPreference": "mixed/same_generation/flexible",
  "ageDisplayPreference": "decade/range/hidden",
  "hasPets": true,
  "petTypes": ["猫", "狗"],
  "hasSiblings": true,
  "relationshipStatus": "单身/恋爱中/已婚/不透露",
  "hometown": "老家城市",
  "languagesComfort": ["普通话", "粤语"],
  "venueStylePreference": "轻奢现代风/绿植花园风/复古工业风/温馨日式风",
  "topicAvoidances": ["politics", "dating_pressure"],
  "socialStyle": "群聊型/小组深聊型",
  "cuisinePreference": ["日料", "粤菜", "火锅"],
  "favoriteRestaurant": "用户推荐的宝藏餐厅名称",
  "favoriteRestaurantReason": "喜欢这家店的原因（环境/口味/性价比等）",
  "children": "有孩子/没有/不透露",
  "educationLevel": "高中/大专/本科/硕士/博士",
  "fieldOfStudy": "专业领域描述",
  "conversationalProfile": {
    "responseLength": "brief/moderate/detailed",
    "emojiUsage": "none/few/many",
    "formalityLevel": "casual/neutral/formal",
    "proactiveness": "passive/neutral/proactive"
  }
}

conversationalProfile字段说明（根据用户消息分析推断）：
- responseLength: 分析用户所有回复的平均长度（brief=<20字, moderate=20-80字, detailed=>80字）
- emojiUsage: 统计用户消息中emoji使用频率（none=没有, few=偶尔1-2个, many=每条都有）
- formalityLevel: 分析用户用语风格（casual=很口语化/网络语/缩写, neutral=普通, formal=较书面/礼貌用语多）
- proactiveness: 分析用户分享意愿（passive=只回答问题不多说, neutral=偶尔主动补充, proactive=经常主动分享额外信息）
注意：registrationTime和completionSpeed由服务端记录，无需在此提取

intent字段的有效值映射：
- networking: 拓展人脉/职业社交/认识同行
- friends: 交朋友/找玩伴/认识新朋友
- discussion: 深度讨论/聊人生/聊话题
- fun: 纯玩/吃喝玩乐/放松
- romance: 浪漫邂逅/脱单/找对象
- flexible: 随缘都可以/都行/看情况

只返回JSON，不要其他内容。`;

  try {
    const response = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是一个信息提取助手，根据对话历史准确提取用户提供的结构化信息。请仔细阅读每一条用户消息，不要遗漏任何信息。",
        },
        { role: "user", content: summaryPrompt },
      ],
      temperature: 0.2, // 降低温度提高准确性
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const rawInfo = JSON.parse(jsonMatch[0]);
      // 校验和规范化提取的信息
      return validateAndNormalizeInfo(rawInfo);
    }
    return {};
  } catch (error) {
    console.error("Failed to extract info:", error);
    return {};
  }
}

// ============ 智能推断引擎集成 ============

import {
  inferenceEngine,
  generateXiaoyueContext,
  quickInfer,
  type UserAttributeMap,
  type InferenceEngineResult,
} from "./inference";

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
    console.log(
      `[AI Evolution] 会话 ${sessionId} 累积洞察: ${sessionInsightStore.get(sessionId)?.length || 0} 个`,
    );
  }
}

/**
 * AI Evolution: 清除会话洞察
 */
export function clearSessionInsights(sessionId: string): void {
  sessionInsightStore.delete(sessionId);
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
 * 清除会话的推断状态
 */
export function clearSessionInferenceState(sessionId: string): void {
  sessionInferenceStates.delete(sessionId);
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
      console.log(
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
    console.error("[L3 Analysis] 洞察检测错误:", insightError);
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
    console.log(
      `[Orchestrator] 会话 ${sessionId}: L1=${completion.l1Percentage}% L2=${completion.l2Percentage}% 阶段=${nextQ.phase}`,
    );
  } catch (orchestratorError) {
    console.error("[Orchestrator] 编排器错误:", orchestratorError);
    // Non-blocking，继续使用原有逻辑
  }

  // 5. 历史裁剪：减少token使用（保留最近4轮）
  const trimmedHistory = trimConversationHistory(conversationHistory);

  // 6. 增强系统提示词（加入推断上下文 + 编排器引导）
  const enhancedHistory: ChatMessage[] = trimmedHistory.map((msg, idx) => {
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
      model: "deepseek-chat",
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
      console.log(
        `[InferenceEngine] 会话 ${sessionId}: 跳过问题 [${inferenceResult.skipQuestions.join(", ")}]`,
      );
    }
    if (inferenceResult.inferred.length > 0) {
      console.log(
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
    console.error("DeepSeek API error:", error);
    throw new Error("小悦暂时有点忙，请稍后再试～");
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
  console.log(`\n[PERF] ========== 新请求开始 ==========`);
  console.log(`[PERF] t0 函数入口: ${new Date().toISOString()}`);
  console.log(
    `[PERF] 消息长度: ${userMessage.length}字符, 历史轮数: ${conversationHistory.length}`,
  );

  // 计算输入token估算（中文约1.5字符/token）
  const estimatedInputTokens = Math.ceil(
    conversationHistory.reduce((sum, m) => sum + m.content.length, 0) / 1.5 +
      userMessage.length / 1.5,
  );
  console.log(`[PERF] 预估输入tokens: ~${estimatedInputTokens}`);

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
  console.log(
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
      console.log(
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
    console.error("[L3 Analysis Stream] 洞察检测错误:", insightError);
    // Non-blocking
  }
  const t2_insightEnd = Date.now();
  console.log(`[PERF] t2 洞察检测耗时: ${t2_insightEnd - t2_insightStart}ms`);

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
    console.log(
      `[Orchestrator] 流式会话 ${sessionId}: L1=${completion.l1Percentage}% L2=${completion.l2Percentage}% 阶段=${nextQ.phase}`,
    );
  } catch (orchestratorError) {
    console.error("[Orchestrator] 流式编排器错误:", orchestratorError);
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
    console.log(
      `[AgeCalc Inference] Detected birth date: ${dateStr}, calculated age: ${preciseAge}`,
    );
  }

  // 5. 历史裁剪：减少token使用（保留最近4轮）
  const trimmedHistory = trimConversationHistory(conversationHistory);

  // 5.5 构建增强的消息历史（只用于API调用，不保存）
  const t3_promptBuildStart = Date.now();
  const enhancedHistory: ChatMessage[] = trimmedHistory.map((msg, idx) => {
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
  console.log(
    `[PERF] t3 Prompt构建耗时: ${t3_promptBuildEnd - t3_promptBuildStart}ms`,
  );
  console.log(`[PERF] === 准备调用DeepSeek API ===`);
  console.log(`[PERF] 预处理总耗时: ${t3_promptBuildEnd - t0_functionStart}ms`);

  // 🔧 DEBUG: 打印发送给 DeepSeek 的完整内容
  console.log(`\n[DEBUG DeepSeek] ========== API请求完整内容 ==========`);
  console.log(`[DEBUG DeepSeek] 用户消息: "${userMessage}"`);
  console.log(`\n[DEBUG DeepSeek] --- 推断引擎补充 (inferenceAddition) ---`);
  console.log(inferenceAddition || "(空)");
  console.log(`\n[DEBUG DeepSeek] --- 编排器补充 (orchestratorAddition) ---`);
  console.log(orchestratorAddition || "(空)");
  console.log(`\n[DEBUG DeepSeek] --- 完整消息列表 ---`);
  updatedHistory.forEach((msg, i) => {
    console.log(`[消息${i}] ${msg.role}:\n${msg.content}\n---`);
  });
  console.log(`[DEBUG DeepSeek] ========================================\n`);

  try {
    const t4_apiCallStart = Date.now();
    console.log(`[PERF] t4 API调用开始: ${new Date().toISOString()}`);

    const stream = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: updatedHistory.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
      })),
      temperature: 0.8,
      max_tokens: 800,
      stream: true,
    });

    const t4_streamCreated = Date.now();
    console.log(
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
          console.log(`[PERF] ⚡ TTFT (首Token时间): ${ttft}ms`);
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

    console.log(`[PERF] t5 流式结束: ${new Date().toISOString()}`);
    console.log(
      `[PERF] 输出tokens: ${tokenCount}, 生成耗时: ${generationTime}ms, TPS: ${tps}`,
    );
    console.log(`[PERF] API总耗时: ${totalApiTime}ms`);
    console.log(`[PERF] 端到端总耗时: ${t5_streamEnd - t0_functionStart}ms`);
    console.log(`[PERF] ========== 请求结束 ==========\n`);

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
      console.log(
        `[InferenceEngine] 流式会话 ${sessionId}: 跳过问题 [${inferenceResult.skipQuestions.join(", ")}]`,
      );
    }
    if (inferenceResult.inferred.length > 0) {
      console.log(
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
    console.error(`[PERF] API错误，耗时: ${errorTime - t0_functionStart}ms`);
    console.error("DeepSeek streaming API error:", error);
    yield { type: "error", content: "小悦暂时有点忙，请稍后再试～" };
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

export default deepseekClient;
