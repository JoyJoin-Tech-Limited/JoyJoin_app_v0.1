import type { Express, Request } from "express";
import { z } from "zod";
import { getAuthenticatedUserId } from "../../lib/requestAuth";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getDeepseekClient, getDeepseekModel } from "../../ai/deepseekClient";
import { logger } from "../../lib/logger";
import { classifyIndustryUnified, classifyIndustry } from "../../inference/industryClassifier";
import type { IndustryClassificationResult } from "../../inference/industryClassifier";
import { archetypeRegistry } from "@shared/personality";

const AI_TIMEOUT_MS = 6000;
const REACTION_TIMEOUT_MS = 4000;
const TOTAL_ROUTE_BUDGET_MS = 12000;

// Simple in-memory rate limiter: 10 requests per minute per user
const professionRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const PROFESSION_RATE_LIMIT_MAX = 10;
const PROFESSION_RATE_LIMIT_WINDOW_MS = 60_000;

function checkProfessionRateLimit(userId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  // Periodic cleanup: prune expired entries every ~100 calls to prevent unbounded growth
  if (professionRateLimitMap.size > 200 && Math.random() < 0.1) {
    for (const [key, entry] of professionRateLimitMap) {
      if (now >= entry.resetAt) professionRateLimitMap.delete(key);
    }
  }
  const entry = professionRateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    professionRateLimitMap.set(userId, { count: 1, resetAt: now + PROFESSION_RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  if (entry.count >= PROFESSION_RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { allowed: true };
}

function requireAuth(req: Request, res: any, next: any) {
  if (!getAuthenticatedUserId(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

const understandProfessionSchema = z.object({
  description: z.string().min(1, "Description is required").max(100),
});

interface UnderstandProfessionResponse {
  reaction: string;
  reactionHint: string;
  displayTags: string[];
  classification: {
    category: { id: string; label: string } | null;
    segment: { id: string; label: string } | null;
    niche: { id: string; label: string } | null;
    standardizedOccupationId: string | null;
  };
  source: "seed" | "ontology" | "ai" | "fallback" | "fuzzy";
  confidence: number;
  archetypeContext?: {
    primaryArchetype: string | null;
    traits: string[];
  };
}

function buildReactionHint(
  rawText: string,
  classification: IndustryClassificationResult
): string {
  const label = classification.niche?.label
    || classification.segment?.label
    || classification.category?.label
    || "";
  const labelPart = label ? `${label}方向` : "你的行业";
  return `${rawText}！${labelPart}？`;
}

const REACTION_PROMPT_VERSION = "profession-reaction-v1";

interface ArchetypeTraitContext {
  primaryArchetype: string | null;
  traits: string[];
}

async function getArchetypeContext(userId: string): Promise<ArchetypeTraitContext> {
  try {
    const [userRow] = await db
      .select({ primaryArchetype: users.primaryArchetype, secondaryArchetype: users.secondaryArchetype })
      .from(users)
      .where(eq(users.id, userId));

    if (!userRow?.primaryArchetype) {
      return { primaryArchetype: null, traits: [] };
    }

    const traits = archetypeRegistry[userRow.primaryArchetype]?.narrative?.traits ?? [];
    return {
      primaryArchetype: userRow.primaryArchetype,
      traits,
    };
  } catch {
    return { primaryArchetype: null, traits: [] };
  }
}

async function generateAIReaction(
  rawText: string,
  classification: IndustryClassificationResult,
  archetype: ArchetypeTraitContext,
  signal?: AbortSignal
): Promise<{ reaction: string; displayTags: string[] }> {
  const traitContext = archetype.traits.length > 0
    ? `用户的社交人格特质包含：${archetype.traits.join("、")}。请在回复中自然地融入这些特质，但不要直接说出人格类型的名称。`
    : "";

  const classificationContext = classification.niche
    ? `行业细分：${classification.niche.label}（${classification.segment.label} → ${classification.category.label}）`
    : classification.segment
      ? `行业细分：${classification.segment.label}（${classification.category.label}）`
      : `行业大致领域：${classification.category.label}`;

  const prompt = `你是一个温暖、有趣的社交App助手角色，叫做"悦仔"。你正在和一位新用户聊天，用户刚刚告诉你TA的职业是"${rawText}"。

系统分析后认为：${classificationContext}
${traitContext}

请做两件事：

1. 写一段50-100字的回复。要求：
   - 先肯定用户的职业（1句话）
   - 结合TA的特质，预判TA在社交局里的表现（1-2句话）
   - 用鼓励的语气结尾，表示已把信息放入匹配画像（1句话）
   - 语言自然、温暖、有趣，不要出现emoji，用文字的趣味性替代
   - 不要说出人格类型的具体名称（如"冒险家型""探索者型"等）

2. 生成3-5个"印象标签"（中文，2-6个字），类似小红书上的标签风格。这些标签应反映该职业的核心特质，例如：户外运动、教育培训、冒险精神、逻辑派、好奇心。

请以JSON格式返回：
{
  "reaction": "你的回复",
  "displayTags": ["标签1", "标签2", "标签3"]
}`;

  try {
    const client = getDeepseekClient();
    const model = getDeepseekModel("flash");

    const response = await client.chat.completions.create(
      {
        model,
        messages: [
          {
            role: "system",
            content: "你是一个温暖有趣的社交App助手。请严格以JSON格式回复，不要添加额外的解释。",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: "json_object" },
      },
      signal ? { signal } : undefined
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty AI response");
    }

    const parsed = JSON.parse(content);
    return {
      reaction: typeof parsed.reaction === "string" ? parsed.reaction : buildFallbackReaction(rawText, classification, archetype.traits),
      displayTags: Array.isArray(parsed.displayTags) ? parsed.displayTags.slice(0, 5) : buildFallbackTags(classification),
    };
  } catch (error) {
    logger.warn("AI reaction generation failed, using fallback", {
      error: error instanceof Error ? error.message : String(error),
      promptVersion: REACTION_PROMPT_VERSION,
    });
      return {
        reaction: buildFallbackReaction(rawText, classification, archetype.traits),
        displayTags: buildFallbackTags(classification, archetype.traits),
      };
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  context: string,
  abortController?: AbortController
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      abortController?.abort();
      reject(new Error(`${context} timeout after ${ms}ms`));
    }, ms);
  });
  return Promise.race([
    promise.finally(() => { if (timer) clearTimeout(timer); }),
    timeoutPromise,
  ]);
}

function buildFallbackReaction(
  rawText: string,
  classification: IndustryClassificationResult,
  archetypeTraits?: string[]
): string {
  const label = classification.niche?.label
    || classification.segment?.label
    || classification.category?.label
    || "你的领域";

  const traitBridge = archetypeTraits && archetypeTraits.length > 0
    ? `你身上${archetypeTraits.slice(0, 2).join("、")}的特质，在${label}圈子里其实很吃香。`
    : "";

  return `「${rawText.trim()}」收到！${traitBridge}悦仔已经把它收进你的匹配档案，帮你找最对味的人～`;
}

function buildFallbackTags(classification: IndustryClassificationResult, archetypeTraits?: string[]): string[] {
  const tags: string[] = [];
  if (archetypeTraits && archetypeTraits.length > 0) {
    tags.push(...archetypeTraits);
  }
  if (classification.niche?.label) tags.push(classification.niche.label);
  if (classification.segment?.label && !tags.includes(classification.segment.label)) tags.push(classification.segment.label);
  if (classification.category?.label && !tags.includes(classification.category.label)) tags.push(classification.category.label);
  return tags.slice(0, 5);
}

async function runCatalogClassification(description: string): Promise<{
  result: IndustryClassificationResult | null;
  source: "seed" | "ontology" | "fuzzy";
}> {
  const result = await classifyIndustryUnified({
    description,
    context: { source: "manual_input" },
  });

  if (result.source !== "ai") {
    return { result, source: result.source as "seed" | "ontology" | "fuzzy" };
  }

  return { result: null, source: "fuzzy" };
}

async function runAIClassification(
  description: string
): Promise<IndustryClassificationResult | null> {
  try {
    const result = await classifyIndustry(description);

    if (result.source === "ai") {
      return result;
    }
    return null;
  } catch (error) {
    logger.warn("AI classification failed in understand-profession", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

interface BestClassification {
  classification: IndustryClassificationResult;
  source: UnderstandProfessionResponse["source"];
}

function pickBestClassification(
  catalog: IndustryClassificationResult | null,
  aiResult: IndustryClassificationResult | null
): BestClassification {
  const catalogConf = catalog?.confidence ?? 0;
  const aiConf = aiResult?.confidence ?? 0;

  if (!catalog && !aiResult) {
    return {
      classification: {
        category: { id: "life_services", label: "生活服务" },
        segment: { id: "general", label: "通用" },
        confidence: 0.3,
        source: "fallback",
        processingTimeMs: 0,
        rawInput: "",
        normalizedInput: "",
        reasoning: "无法分类",
      },
      source: "fallback",
    };
  }

  if (catalog && aiResult) {
    if (catalogConf >= aiConf + 0.05) {
      return { classification: catalog, source: catalog.source };
    }
    if (aiConf >= catalogConf + 0.05) {
      return { classification: aiResult, source: "ai" };
    }
    return { classification: catalog, source: catalog.source };
  }

  if (catalog) {
    return { classification: catalog, source: catalog.source };
  }

  return { classification: aiResult!, source: "ai" };
}

export function registerProfessionUnderstandingRoutes(app: Express): void {
  app.post("/api/inference/understand-profession", requireAuth, async (req: Request, res) => {
    const startTime = Date.now();

    try {
      const parseResult = understandProfessionSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Invalid request",
          details: parseResult.error.flatten(),
        });
      }

      const { description } = parseResult.data;
      const userId = getAuthenticatedUserId(req)!;

      const rateLimit = checkProfessionRateLimit(userId);
      if (!rateLimit.allowed) {
        logger.warn("[understand-profession] Rate limit exceeded", { userId });
        return res.status(429).json({
          error: "Too many requests",
          retryAfterMs: rateLimit.retryAfterMs,
        });
      }

      const archetypeContext = await getArchetypeContext(userId);

      let classificationTimer: NodeJS.Timeout | null = null;
      const classificationTimeout = new Promise<null>((resolve) => {
        classificationTimer = setTimeout(() => resolve(null), AI_TIMEOUT_MS);
      });

      const classificationPromise = (async () => {
        const [cat, ai] = await Promise.all([
          runCatalogClassification(description).catch(
            () => ({ result: null, source: "fuzzy" as const })
          ),
          runAIClassification(description).catch(() => null),
        ]);
        return { catalogResult: cat, aiResult: ai };
      })();

      const result = await Promise.race([classificationPromise, classificationTimeout]);
      if (classificationTimer) clearTimeout(classificationTimer);
      const classificationTimedOut = result === null;

      const catalogResult = result?.catalogResult ?? { result: null, source: "fuzzy" as const };
      const aiResult = result?.aiResult ?? null;

      const { classification, source } = pickBestClassification(
        catalogResult.result,
        aiResult
      );

      // Budget-aware reaction generation:
      // - If classification already timed out, skip AI and use deterministic fallback
      //   so the client receives a fast response instead of cascading delays.
      // - Otherwise cap reaction LLM latency with REACTION_TIMEOUT_MS to stay inside
      //   the overall route budget.
      const elapsedMs = Date.now() - startTime;
      const reactionBudgetMs = Math.max(
        2000,
        Math.min(REACTION_TIMEOUT_MS, TOTAL_ROUTE_BUDGET_MS - elapsedMs - 500)
      );

      let reaction: string;
      let displayTags: string[];
      if (classificationTimedOut || reactionBudgetMs <= 2000) {
        logger.info("[understand-profession] Skipping AI reaction due to budget", {
          classificationTimedOut,
          elapsedMs,
          reactionBudgetMs,
        });
        reaction = buildFallbackReaction(description, classification, archetypeContext.traits);
        displayTags = buildFallbackTags(classification, archetypeContext.traits);
      } else {
        const reactionAbort = new AbortController();
        try {
          const aiReaction = await withTimeout(
            generateAIReaction(description, classification, archetypeContext, reactionAbort.signal),
            reactionBudgetMs,
            "AI reaction",
            reactionAbort
          );
          reaction = aiReaction.reaction;
          displayTags = aiReaction.displayTags;
        } catch (timeoutError) {
          logger.warn("[understand-profession] Reaction generation timed out, using fallback", {
            elapsedMs,
            reactionBudgetMs,
            error: timeoutError instanceof Error ? timeoutError.message : String(timeoutError),
          });
          reaction = buildFallbackReaction(description, classification, archetypeContext.traits);
          displayTags = buildFallbackTags(classification, archetypeContext.traits);
        }
      }

      const reactionHint = buildReactionHint(description, classification);

      const response: UnderstandProfessionResponse = {
        reaction,
        reactionHint,
        displayTags,
        classification: {
          category: classification.category
            ? { id: classification.category.id, label: classification.category.label }
            : null,
          segment: classification.segment
            ? { id: classification.segment.id, label: classification.segment.label }
            : null,
          niche: classification.niche
            ? { id: classification.niche.id, label: classification.niche.label }
            : null,
          standardizedOccupationId: classification.niche?.id ?? null,
        },
        source,
        confidence: classification.confidence,
      };

      logger.info("[understand-profession] Classification complete", {
        rawInput: description.substring(0, 10) + "...",
        source,
        confidence: classification.confidence,
        processingTimeMs: Date.now() - startTime,
        hasArchetype: archetypeContext.primaryArchetype !== null,
      });

      res.json(response);
    } catch (error) {
      logger.error("Failed to understand profession", {
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      });
      res.status(500).json({ error: "Failed to process profession input" });
    }
  });
}
