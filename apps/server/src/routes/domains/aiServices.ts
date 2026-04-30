import type { Express, Request } from "express";
import { db } from "../../db";
import { eq, and, sql } from "drizzle-orm";
import { users, industryAiLogs, industrySeedCandidates } from "@shared/schema";
import { matchIndustryFromText } from "../../inference/industryOntology";
import { INDUSTRY_OPTIONS } from "@shared/constants";
import { aiEndpointLimiter } from "../../rateLimiter";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { isPhoneAuthenticated } from "../../phoneAuth";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getAuthenticatedUserId } from "../../lib/requestAuth";

function getActingAdminId(req: any): string {
  return req.adminAccount?.id ?? req.session?.userId ?? "unknown";
}

function firstNonEmptyString(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

async function requireAuth(req: Request, res: any, next: any) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export function registerAIServiceRoutes(app: Express): void {
  const INDUSTRY_MATCHERS: { value: string; keywords: string[] }[] = [
    { value: "tech", keywords: ["互联网", "科技", "tech", "ai", "it", "大厂", "程序员", "码农", "字节", "腾讯", "阿里", "百度", "美团", "华为", "bat", "tmd", "软件", "开发", "社畜", "打工人", "大疆", "小米", "oppo", "vivo", "网易", "京东", "拼多多", "快手", "硬科技", "芯片", "半导体", "ic", "嵌入式", "硬件", "电子", "新能源", "汽车", "电动车", "比亚迪", "特斯拉", "蔚来", "理想", "小鹏", "电池", "自动驾驶"] },
    { value: "finance", keywords: ["金融", "finance", "bank", "investment", "投资", "银行", "基金", "pe", "vc", "投行", "量化", "证券", "保险", "会计", "审计", "四大"] },
    { value: "media", keywords: ["媒体", "内容", "传媒", "博主", "kol", "网红", "主播", "直播", "自媒体", "公众号", "小红书", "抖音", "b站", "up主", "创意", "设计", "creative", "design", "舞蹈", "跳舞", "表演", "演员", "歌手", "音乐", "文化", "娱乐", "文娱", "艺术", "艺人", "街舞", "芭蕾", "编舞", "摄影", "视频", "剪辑", "插画", "画画", "美工", "ui", "ux", "dj", "打碟", "唱歌", "乐队"] },
    { value: "education", keywords: ["教育", "education", "edu", "老师", "教师", "培训", "讲师", "教授", "学校", "大学"] },
    { value: "consulting", keywords: ["咨询", "consulting", "mbb", "麦肯锡", "波士顿", "贝恩", "埃森哲", "猎头", "hr", "人力", "法律", "legal", "律师", "律所", "法务", "合规", "金杜", "中伦", "方达"] },
    { value: "healthcare", keywords: ["医疗", "医药", "健康", "health", "医生", "护士", "医院", "制药", "生物", "心理咨询"] },
    { value: "manufacturing", keywords: ["制造", "工业", "engineering", "工厂", "生产"] },
    { value: "retail", keywords: ["零售", "消费", "retail", "电商", "跨境", "亚马逊", "淘宝", "天猫", "独立站", "shopify", "运营", "选品", "生活服务", "lifestyle", "健身", "瑜伽", "咖啡", "美容", "美发", "宠物", "餐饮", "私教", "教练", "厨师", "调酒", "茶艺", "花艺", "酒店", "旅游", "航空", "空乘", "导游", "旅行", "空姐", "空少", "机场"] },
    { value: "real_estate", keywords: ["地产", "房地产", "real estate", "建筑", "物业", "装修", "室内设计", "景观"] },
    { value: "government", keywords: ["政府", "公共", "gov", "公务员", "事业单位", "体制内", "国企", "央企"] },
    { value: "other", keywords: ["自由职业", "创业", "外企", "500强"] },
  ];

  const INDUSTRY_OPTIONS_MAP = INDUSTRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  function mapIndustryNameToOption(industryName: string | undefined) {
    const fallback = INDUSTRY_OPTIONS_MAP.find((o) => o.value === "other") || INDUSTRY_OPTIONS_MAP[INDUSTRY_OPTIONS_MAP.length - 1];
    if (!industryName) return fallback;
    const name = industryName.toLowerCase();

    const scored = INDUSTRY_MATCHERS.map((matcher) => {
      const score = matcher.keywords.reduce((acc, keyword) => acc + (name.includes(keyword.toLowerCase()) ? 1 : 0), 0);
      return { value: matcher.value, score };
    }).sort((a, b) => b.score - a.score);

    const matchedValue = scored[0]?.score > 0 ? scored[0].value : "other";
    return INDUSTRY_OPTIONS_MAP.find((o) => o.value === matchedValue) || fallback;
  }

// ============ AI 时刻 API ============

  /** Fallback copy used when no profile data is available. */
  const VIBE_BRIEF_FALLBACK = {
    insight: '我们的算法已初步读懂你的社交画像',
    matchingPromise: '我们会以此为基础，为你匹配更对 vibe 的小组',
  } as const;

  // Archetype-keyed insight copy (12 archetypes)
  const ARCHETYPE_INSIGHTS: Record<string, string> = {
    '开心柯基': '你天生自带暖场能量，最容易让整桌气氛活跃起来',
    '太阳鸡': '你的热情感染力强，适合引领话题的群体节奏',
    '捧场王仓鼠': '你善于欣赏他人，最容易在轻松氛围里建立连接',
    '机智狐': '你对话题的洞察快，适合那种先破冰、再深聊的群体',
    '淡定海豚': '你不需要刻意表现，真实感反而是你最强的社交优势',
    '织网蛛': '你擅长把不同背景的人串联在一起，天然的社交节点',
    '情绪树洞考拉': '你给人安全感，最容易在小群体里慢慢成为大家信任的人',
    '灵感章鱼': '你的跨界联想力强，适合多元背景交汇的小组',
    '沉思猫头鹰': '你更适合先观察、再发言的节奏，深聊比破冰更适合你',
    '定心大象': '你的稳定感让整个群体更有安全感，适合偏深度的小聚',
    '稳如龟': '你不求一夜深交，但会让别人记住你的踏实感',
    '隐身猫': '你慢热但有质感，在对的氛围里往往是最让人印象深刻的那个',
  };

  // WorkMode-keyed matching promise variants
  const WORK_MODE_PROMISES: Record<string, string> = {
    founder: '我们会为你匹配同样有主见、聊得来的同频小组',
    self_employed: '我们会优先把你放进背景多元、互相启发的小组',
    employed: '我们会以此为基础，为你匹配更对 vibe 的小组',
    student: '我们会帮你找到同样好奇心旺盛、愿意交流的小组',
  };

  // Archetype-keyed fit reasons per event type (饭局 / 酒局)
  const ARCHETYPE_FIT_REASONS: Record<string, { 饭局: string; 酒局: string }> = {
    '开心柯基':    { 饭局: '你的暖场感很适合围桌聊天', 酒局: '你的活力能自然带热气氛' },
    '太阳鸡':     { 饭局: '你的感染力很适合带动全桌', 酒局: '你的热情能帮陌生人快些破冰' },
    '捧场王仓鼠':     { 饭局: '轻松饭局最能发挥你的共情力', 酒局: '你的温柔让酒局不只热闹' },
    '机智狐':     { 饭局: '话题型饭局很适合你的机智', 酒局: '自由节奏给你更多即兴空间' },
    '淡定海豚':   { 饭局: '你的真实感很适合轻松饭局', 酒局: '你的松弛感在酒局里很加分' },
    '织网蛛':     { 饭局: '你擅长把一桌人自然串联', 酒局: '多元背景更容易被你聊开' },
    '情绪树洞考拉':     { 饭局: '你的安全感适合慢慢熟络', 酒局: '你的体贴会让酒局更有温度' },
    '灵感章鱼':   { 饭局: '跨界话题里你更容易发光', 酒局: '松弛酒局最能放大你的灵感' },
    '沉思猫头鹰': { 饭局: '饭局的慢节奏适合你深入聊', 酒局: '你偶尔的深刻观点会很出彩' },
    '定心大象':   { 饭局: '你的稳定感适合有温度的小聚', 酒局: '你的沉稳会让热闹更舒服' },
    '稳如龟':     { 饭局: '你的踏实感适合慢慢熟悉彼此', 酒局: '热闹过后别人更容易记住你' },
    '隐身猫':     { 饭局: '饭局给你更自然的展开空间', 酒局: '松弛环境适合你慢慢打开自己' },
  };

  // WorkMode-keyed social goal reasons
  const WORK_MODE_GOAL_REASONS: Record<string, string> = {
    founder: '同桌多半有主见，也更有聊头',
    self_employed: '多元背景更容易带来新灵感',
    employed: '小而精的局更容易留下真连接',
    student: '年纪相近的话题更容易接住',
  };

  // Valid event types for type-safe checks across VibeBrief logic
  const VALID_EVENT_TYPES = ['饭局', '酒局'] as const;
  type VibeBriefEventType = typeof VALID_EVENT_TYPES[number];

  function isValidEventType(v: string | null | undefined): v is VibeBriefEventType {
    return VALID_EVENT_TYPES.includes(v as VibeBriefEventType);
  }

  // Generic area/format fit reason
  function buildAreaReason(area: string | null | undefined): string | null {
    if (!area || !area.trim()) return null;
    return `在${area}附近，更容易轻松赴约`;
  }

  /**
   * Generate a deterministic vibe brief from profile fields.
   * No LLM call — uses curated copy variants keyed on archetype/workMode.
   */
  function generateVibeBrief(
    archetype: string | null | undefined,
    workMode: string | null | undefined,
    industry: string | null | undefined,
    eventType?: string | null,
    area?: string | null,
  ): { insight: string; matchingPromise: string; reasons: string[] } {
    let insight: string;
    if (archetype && ARCHETYPE_INSIGHTS[archetype]) {
      insight = ARCHETYPE_INSIGHTS[archetype];
    } else if (industry) {
      insight = `我们已读懂你在${industry}领域的社交画像`;
    } else {
      insight = VIBE_BRIEF_FALLBACK.insight;
    }

    const matchingPromise = (workMode && WORK_MODE_PROMISES[workMode])
      ? WORK_MODE_PROMISES[workMode]
      : VIBE_BRIEF_FALLBACK.matchingPromise;

    // Build 2-3 pool-specific fit reasons
    const reasons: string[] = [];
    const normalizedEventType = isValidEventType(eventType) ? eventType : null;

    // Reason 1: archetype × event type
    if (archetype && ARCHETYPE_FIT_REASONS[archetype] && normalizedEventType) {
      reasons.push(ARCHETYPE_FIT_REASONS[archetype][normalizedEventType]);
    } else if (normalizedEventType === '饭局') {
      reasons.push('轻松饭局更适合自然拉近距离');
    } else if (normalizedEventType === '酒局') {
      reasons.push('松弛酒局让初见没那么拘束');
    }

    // Reason 2: workMode-based social dynamic
    if (workMode && WORK_MODE_GOAL_REASONS[workMode]) {
      reasons.push(WORK_MODE_GOAL_REASONS[workMode]);
    } else {
      reasons.push('小规模聚会更容易建立真实连接');
    }

    // Reason 3: area-based (only if area is available, to keep it specific)
    const areaReason = buildAreaReason(area);
    if (areaReason) {
      reasons.push(areaReason);
    }

    if (reasons.length < 2) {
      return { insight, matchingPromise, reasons: [] };
    }

    return { insight, matchingPromise, reasons };
  }

  // GET /api/ai/pre-join-vibe-brief - Compact pre-join vibe brief for conversion
  // Returns a personalized insight + matching promise + 2-3 pool fit reasons.
  // Always returns content — meta.fallbackUsed indicates live vs deterministic.
  // Optional query params: eventType ("饭局"|"酒局"), area (e.g. "南山区")
  app.get('/api/ai/pre-join-vibe-brief', requireAuth, async (req: any, res) => {
    const { buildFallbackAIMeta } = await import('@shared/types/aiMeta');
    try {
      const userId = req.session.userId as string;
      const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : null;
      const area = typeof req.query.area === 'string' ? req.query.area : null;

      const [profile] = await db
        .select({
          primaryArchetype: users.primaryArchetype,
          workMode: users.workMode,
          industryNicheLabel: users.industryNicheLabel,
          industryCategoryLabel: users.industryCategoryLabel,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!profile) {
        return res.json({
          insight: VIBE_BRIEF_FALLBACK.insight,
          matchingPromise: VIBE_BRIEF_FALLBACK.matchingPromise,
          reasons: [],
          meta: buildFallbackAIMeta('user_not_found'),
        });
      }

      const brief = generateVibeBrief(
        profile.primaryArchetype,
        profile.workMode,
        profile.industryNicheLabel ?? profile.industryCategoryLabel,
        eventType,
        area,
      );

      return res.json({
        insight: brief.insight,
        matchingPromise: brief.matchingPromise,
        reasons: brief.reasons,
        meta: buildFallbackAIMeta(),
      });
    } catch (err) {
      console.error('[VibeBrief] Failed to generate pre-join vibe brief:', err);
      return res.json({
        insight: VIBE_BRIEF_FALLBACK.insight,
        matchingPromise: VIBE_BRIEF_FALLBACK.matchingPromise,
        reasons: [],
        meta: buildFallbackAIMeta('server_error'),
      });
    }
  });

// ============ 推断引擎API ============


  // POST /api/inference/parse-industry - semantic industry parsing
  app.post("/api/inference/parse-industry", isPhoneAuthenticated, async (req, res) => {
    try {
      const text = (req.body?.text || '').toString();
      if (!text.trim()) {
        return res.status(400).json({ message: "text is required" });
      }

      const match = matchIndustryFromText(text);
      const primaryOption = mapIndustryNameToOption(match?.industry);
      const primaryConfidence = match?.confidence ?? 0.68;
      const primary = {
        value: primaryOption.value,
        label: primaryOption.label,
        confidence: primaryConfidence,
      };

      // Derive alternatives based on similarity to the primary label and confidence.
      // If confidence is low, do not return arbitrary alternatives.
      let alternatives: { value: string; label: string; confidence: number }[] = [];

      if (primary.label && primaryConfidence >= 0.7) {
        const primaryWords = primary.label
          .toLowerCase()
          .split(/[\s\/,&()-]+/)
          .filter(Boolean);

        const scoredOptions = INDUSTRY_OPTIONS_MAP
          .filter((o) => o.value !== primary.value)
          .map((o, index) => {
            const optionWords = o.label
              .toLowerCase()
              .split(/[\s\/,&()-]+/)
              .filter(Boolean);
            const overlap = optionWords.reduce((count, w) => {
              return count + (primaryWords.includes(w) ? 1 : 0);
            }, 0);
            return { option: o, overlap, index };
          })
          .filter(({ overlap }) => overlap > 0)
          .sort((a, b) => {
            if (b.overlap !== a.overlap) return b.overlap - a.overlap;
            return a.index - b.index;
          });

        alternatives = scoredOptions
          .slice(0, 3)
          .map(({ option }) => ({
            value: option.value,
            label: option.label,
            confidence: Math.max(0, primaryConfidence - 0.05),
          }));
      }
      res.json({ primary, alternatives });
    } catch (error: any) {
      console.error("parse-industry error", error);
      res.status(500).json({ message: "Failed to parse industry" });
    }
  });

  // POST /api/inference/test - 测试快速推断（不调用LLM）
  app.post("/api/inference/test", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Missing message parameter" });
      }
      
      const { testQuickInference } = await import("../../deepseekClient");
      const result = testQuickInference(message);
      
      res.json(result);
    } catch (error: any) {
      console.error("Inference test error:", error);
      res.status(500).json({ message: "Inference test failed", error: error.message });
    }
  });
  
  // POST /api/inference/classify-industry - 三层行业智能分类
  app.post("/api/inference/classify-industry", isPhoneAuthenticated, async (req, res) => {
    try {
      const { description, context } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: "Description is required" });
      }
      
      const { classifyIndustryUnified } = await import("../../inference/industryClassifier");
      const result = await classifyIndustryUnified({ description, context });
      
      // 记录AI分类日志
      if (result.source === "ai" && req.session?.userId) {
        try {
          await db.insert(industryAiLogs).values({
            userId: req.session.userId,
            rawInput: description,
            aiCategory: result.category.id,
            aiSegment: result.segment.id,
            aiNiche: result.niche?.id,
            aiConfidence: result.confidence.toString(),
            aiReasoning: result.reasoning,
            processingTimeMs: result.processingTimeMs,
            modelVersion: "v1",
          });
          
          // 如果置信度高，添加到seed候选库
          if (result.confidence >= 0.85) {
            await db.insert(industrySeedCandidates).values({
              rawInput: description,
              frequency: 1,
              aiCategory: result.category.id,
              aiSegment: result.segment.id,
              aiNiche: result.niche?.id,
              avgConfidence: result.confidence.toString(),
              status: "pending",
            }).onConflictDoUpdate({
              target: industrySeedCandidates.rawInput,
              set: {
                frequency: sql`${industrySeedCandidates.frequency} + 1`,
                avgConfidence: sql`(${industrySeedCandidates.avgConfidence}::numeric * ${industrySeedCandidates.frequency} + ${result.confidence}) / (${industrySeedCandidates.frequency} + 1)`,
                updatedAt: new Date(),
              },
            });
          }
        } catch (logError) {
          console.error("Failed to log AI classification:", logError);
          // 不影响主流程
        }
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Industry classification error:", error);
      res.status(500).json({ error: "Classification failed", message: error.message });
    }
  });
  
  // POST /api/profile/update-industry - 更新用户三层行业分类
  
  // GET /api/inference/logs - 获取推断日志
  app.get("/api/inference/logs", requireAdmin, async (req, res) => {
    try {
      const { sessionId } = req.query;
      const { getInferenceLogs } = await import("../../deepseekClient");
      const logs = getInferenceLogs(sessionId as string | undefined);
      
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching inference logs:", error);
      res.status(500).json({ message: "Failed to fetch logs", error: error.message });
    }
  });
  
  // POST /api/inference/evaluate - 运行评估（需要Admin权限）
  app.post("/api/inference/evaluate", requireAdmin, async (req, res) => {
    try {
      const { scenarioCount } = req.body;
      const { runEvaluation } = await import("../../inference/evaluator");
      
      console.log(`[Evaluation] Starting evaluation with ${scenarioCount || 'all'} scenarios...`);
      const result = await runEvaluation(scenarioCount);
      
      res.json({
        metrics: result.metrics,
        report: result.markdownReport
      });
    } catch (error: any) {
      console.error("Evaluation error:", error);
      res.status(500).json({ message: "Evaluation failed", error: error.message });
    }
  });

  // ============ 专家评估系统 API ============
  
  // POST /api/inference/expert-evaluation - 运行10位AI专家评估
  app.post("/api/inference/expert-evaluation", requireAdmin, async (req, res) => {
    try {
      console.log("[ExpertEval] 开始专家评估...");
      
      // 先获取系统性能指标
      const { runEvaluation } = await import("../../inference/evaluator");
      const evalResult = await runEvaluation(50); // 用50个场景获取性能指标
      
      // 运行专家评估
      const { runExpertEvaluation, generateExpertReportMarkdown } = await import("../../inference/expertEvaluation");
      const { getRandomScenarios } = await import("../../inference/scenarios");
      
      const sampleScenarios = getRandomScenarios(10);
      const report = await runExpertEvaluation(evalResult.metrics, sampleScenarios);
      
      res.json({
        report,
        markdownReport: generateExpertReportMarkdown(report)
      });
    } catch (error: any) {
      console.error("Expert evaluation error:", error);
      res.status(500).json({ message: "Expert evaluation failed", error: error.message });
    }
  });
  
  // GET /api/inference/expert-personas - 获取专家人设列表
  app.get("/api/inference/expert-personas", async (req, res) => {
    try {
      const { EXPERT_PERSONAS, EVALUATION_DIMENSIONS } = await import("../../inference/expertEvaluation");
      res.json({
        experts: EXPERT_PERSONAS,
        dimensions: EVALUATION_DIMENSIONS
      });
    } catch (error: any) {
      console.error("Error fetching expert personas:", error);
      res.status(500).json({ message: "Failed to fetch experts", error: error.message });
    }
  });
  
  // GET /api/inference/questionnaire - 获取评估问卷模板
  app.get("/api/inference/questionnaire", async (req, res) => {
    try {
      const { generateEvaluationQuestionnaire } = await import("../../inference/expertEvaluation");
      const questionnaire = generateEvaluationQuestionnaire();
      res.json(questionnaire);
    } catch (error: any) {
      console.error("Error generating questionnaire:", error);
      res.status(500).json({ message: "Failed to generate questionnaire", error: error.message });
    }
  });
  
  // GET /api/inference/scenario-stats - 获取测试场景统计
  app.get("/api/inference/scenario-stats", async (req, res) => {
    try {
      const { getScenarioStats } = await import("../../inference/scenarios");
      const stats = getScenarioStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching scenario stats:", error);
      res.status(500).json({ message: "Failed to fetch stats", error: error.message });
    }
  });
  
  // POST /api/inference/full-evaluation - 运行完整评测（500场景 + 专家评审）
  app.post("/api/inference/full-evaluation", requireAdmin, async (req, res) => {
    try {
      console.log("[FullEval] 开始完整评测...");
      
      // 运行500场景自动化评测
      const { runEvaluation } = await import("../../inference/evaluator");
      console.log("[FullEval] 运行500场景自动化评测...");
      const autoEval = await runEvaluation(500);
      
      // 运行专家评估
      const { runExpertEvaluation, generateExpertReportMarkdown } = await import("../../inference/expertEvaluation");
      const { getRandomScenarios } = await import("../../inference/scenarios");
      console.log("[FullEval] 运行10位AI专家评估...");
      const sampleScenarios = getRandomScenarios(20);
      const expertReport = await runExpertEvaluation(autoEval.metrics, sampleScenarios);
      
      // 生成综合报告
      const combinedReport = {
        timestamp: new Date().toISOString(),
        automatedEvaluation: {
          metrics: autoEval.metrics,
          report: autoEval.markdownReport
        },
        expertEvaluation: {
          report: expertReport,
          markdownReport: generateExpertReportMarkdown(expertReport)
        },
        overallGrade: expertReport.grade,
        overallScore: expertReport.overallScore,
        summary: `悦仔智能推断引擎完整评测完成。自动化测试覆盖${autoEval.metrics.totalScenarios}个场景，推断准确率${(autoEval.metrics.inferenceAccuracy * 100).toFixed(1)}%。10位AI专家综合评分${expertReport.overallScore.toFixed(2)}/10，评级${expertReport.grade}。`
      };
      
      console.log(`[FullEval] 评测完成！综合评分：${expertReport.overallScore.toFixed(2)}，评级：${expertReport.grade}`);
      
      res.json(combinedReport);
    } catch (error: any) {
      console.error("Full evaluation error:", error);
      res.status(500).json({ message: "Full evaluation failed", error: error.message });
    }
  });

  // ============ 小悦进化系统 API - AI Evolution System ============
  
  // 获取当前匹配权重配置
  app.get('/api/admin/evolution/weights', requireAdmin, async (req: any, res) => {
    try {
      const { matchingWeightsService } = await import('../../matchingWeightsService');
      const config = await matchingWeightsService.getActiveConfig();
      const weights = await matchingWeightsService.getActiveWeights();
      const rollout = await matchingWeightsService.getRolloutStatus();
      res.json({ config, weights, rollout });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get weights:', error);
      res.status(500).json({ message: 'Failed to get weights', error: error.message });
    }
  });

  app.post('/api/admin/evolution/weights/activation', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { enabled } = req.body ?? {};
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled must be a boolean' });
      }

      const { matchingWeightsService } = await import('../../matchingWeightsService');
      const before = await matchingWeightsService.getRolloutStatus();
      const after = await matchingWeightsService.setAdaptiveWeightsEnabled(enabled);

      logAdminAudit({
        action: enabled ? 'MATCHING_WEIGHTS_ACTIVATED' : 'MATCHING_WEIGHTS_DISABLED',
        adminId: getActingAdminId(req),
        adminRole: req.adminRole,
        targetEntityType: 'matching_weights_config',
        targetEntityId: firstNonEmptyString(after.activeConfigId, before.activeConfigId),
        before: {
          adaptiveWeightsEnabled: before.adaptiveWeightsEnabled,
          liveConfigName: before.liveConfigName,
          activeWeights: before.activeWeights,
        },
        after: {
          adaptiveWeightsEnabled: after.adaptiveWeightsEnabled,
          liveConfigName: after.liveConfigName,
          activeWeights: after.activeWeights,
        },
        context: {
          maxWeightMovementPercent: after.maxWeightMovementPercent,
          fallbackConfigName: after.fallbackConfigName,
        },
      });

      return res.json(after);
    } catch (error: any) {
      console.error('[Evolution API] Failed to toggle adaptive weights:', error);
      return res.status(500).json({ message: 'Failed to toggle adaptive weights', error: error.message });
    }
  });

  app.post('/api/admin/evolution/weights/rollback', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { matchingWeightsService } = await import('../../matchingWeightsService');
      const before = await matchingWeightsService.getRolloutStatus();

      if (!before.adaptiveWeightsEnabled) {
        return res.status(409).json({ message: 'Adaptive weights must be active before rollback' });
      }

      const after = await matchingWeightsService.rollbackAdaptiveWeights();

      logAdminAudit({
        action: 'MATCHING_WEIGHTS_ROLLED_BACK',
        adminId: getActingAdminId(req),
        adminRole: req.adminRole,
        targetEntityType: 'matching_weights_config',
        targetEntityId: firstNonEmptyString(after.activeConfigId, before.activeConfigId),
        before: {
          liveConfigName: before.liveConfigName,
          activeWeights: before.activeWeights,
        },
        after: {
          liveConfigName: after.liveConfigName,
          activeWeights: after.activeWeights,
        },
        context: {
          maxWeightMovementPercent: after.maxWeightMovementPercent,
        },
      });

      return res.json(after);
    } catch (error: any) {
      console.error('[Evolution API] Failed to rollback adaptive weights:', error);
      return res.status(500).json({ message: 'Failed to rollback adaptive weights', error: error.message });
    }
  });

  // 获取权重变化历史
  app.get('/api/admin/evolution/weights-history', requireAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const { matchingWeightsService } = await import('../../matchingWeightsService');
      const history = await matchingWeightsService.getWeightsHistory(limit);
      res.json(history);
    } catch (error: any) {
      console.error('[Evolution API] Failed to get weights history:', error);
      res.status(500).json({ message: 'Failed to get history', error: error.message });
    }
  });

  app.get('/api/admin/evolution/weight-recommendations', requireAdmin, async (req: any, res) => {
    try {
      const parsedLimit = Number.parseInt(req.query.limit?.toString() ?? '', 10);
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 20;
      const { matchingWeightsService } = await import('../../matchingWeightsService');
      const recommendations = await matchingWeightsService.getShadowRecommendations(limit);
      res.json({
        latest: recommendations[0] ?? null,
        recommendations,
      });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get shadow recommendations:', error);
      res.status(500).json({ message: 'Failed to get shadow recommendations', error: error.message });
    }
  });

  // 获取触发器性能统计
  app.get('/api/admin/evolution/triggers', requireAdmin, async (req: any, res) => {
    try {
      const { triggerPerformanceService } = await import('../../triggerPerformanceService');
      const stats = await triggerPerformanceService.getAllTriggerStats();
      const top = await triggerPerformanceService.getTopPerformingTriggers(10);
      const underperforming = await triggerPerformanceService.getUnderperformingTriggers(0.3);
      res.json({ all: stats, topPerforming: top, underperforming });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get trigger stats:', error);
      res.status(500).json({ message: 'Failed to get trigger stats', error: error.message });
    }
  });

  // 获取黄金话术列表
  app.get('/api/admin/evolution/golden-dialogues', requireAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const category = req.query.category as string;
      const { goldenDialogueService } = await import('../../goldenDialogueService');
      
      let dialogues;
      if (category) {
        dialogues = await goldenDialogueService.findByCategory(category, limit);
      } else {
        dialogues = await goldenDialogueService.getAllDialogues(limit);
      }
      const stats = await goldenDialogueService.getStatistics();
      res.json({ dialogues, stats });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get golden dialogues:', error);
      res.status(500).json({ message: 'Failed to get dialogues', error: error.message });
    }
  });

  // 标记黄金话术
  app.post('/api/admin/evolution/golden-dialogues', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const { dialogueContent, category, sourceSessionId, sourceUserId } = req.body;
      
      if (!dialogueContent || !category) {
        return res.status(400).json({ message: 'dialogueContent and category are required' });
      }

      const { goldenDialogueService } = await import('../../goldenDialogueService');
      const result = await goldenDialogueService.tagAsGolden(
        dialogueContent,
        category,
        adminId,
        sourceSessionId,
        sourceUserId
      );
      
      res.json({ success: true, dialogue: result });
    } catch (error: any) {
      console.error('[Evolution API] Failed to tag golden dialogue:', error);
      res.status(500).json({ message: 'Failed to tag dialogue', error: error.message });
    }
  });

  // 更新黄金话术精炼版本
  app.patch('/api/admin/evolution/golden-dialogues/:id', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { refinedVersion, isActive } = req.body;
      
      const { goldenDialogueService } = await import('../../goldenDialogueService');
      
      if (refinedVersion !== undefined) {
        await goldenDialogueService.updateRefinedVersion(id, refinedVersion);
      }
      if (isActive === false) {
        await goldenDialogueService.deactivateDialogue(id);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Evolution API] Failed to update golden dialogue:', error);
      res.status(500).json({ message: 'Failed to update dialogue', error: error.message });
    }
  });

  // 进化系统总览统计
  app.get('/api/admin/evolution/overview', requireAdmin, async (req: any, res) => {
    try {
      const { matchingWeightsService } = await import('../../matchingWeightsService');
      const { triggerPerformanceService } = await import('../../triggerPerformanceService');
      const { goldenDialogueService } = await import('../../goldenDialogueService');
      const { dialogueEmbeddingsService } = await import('../../dialogueEmbeddingsService');

      const [weightsConfig, triggerStats, dialogueStats, insightStats] = await Promise.all([
        matchingWeightsService.getActiveConfig(),
        triggerPerformanceService.getAllTriggerStats(),
        goldenDialogueService.getStatistics(),
        dialogueEmbeddingsService.getInsightStats(),
      ]);

      const overview = {
        weights: {
          totalMatches: weightsConfig?.totalMatches || 0,
          successfulMatches: weightsConfig?.successfulMatches || 0,
          avgSatisfaction: parseFloat(weightsConfig?.averageSatisfaction || '0'),
          lastUpdated: weightsConfig?.updatedAt,
        },
        triggers: {
          total: triggerStats.length,
          avgEffectiveness: triggerStats.length > 0
            ? triggerStats.reduce((sum: number, t: any) => sum + t.effectivenessScore, 0) / triggerStats.length
            : 0,
          totalActivations: triggerStats.reduce((sum: number, t: any) => sum + t.totalTriggers, 0),
        },
        dialogues: dialogueStats,
        insights: {
          total: insightStats.totalInsights,
          byCategory: insightStats.byCategory,
          avgConfidence: insightStats.avgConfidence,
        },
        systemHealth: 'healthy',
        lastAnalyzed: new Date().toISOString(),
      };

      res.json(overview);
    } catch (error: any) {
      console.error('[Evolution API] Failed to get overview:', error);
      res.status(500).json({ message: 'Failed to get overview', error: error.message });
    }
  });

  // 洞察统计详情
  app.get('/api/admin/evolution/insights', requireAdmin, async (req: any, res) => {
    try {
      const { dialogueEmbeddingsService } = await import('../../dialogueEmbeddingsService');
      const stats = await dialogueEmbeddingsService.getInsightStats();
      res.json(stats);
    } catch (error: any) {
      console.error('[Evolution API] Failed to get insight stats:', error);
      res.status(500).json({ message: 'Failed to get insight stats', error: error.message });
    }
  });
}
