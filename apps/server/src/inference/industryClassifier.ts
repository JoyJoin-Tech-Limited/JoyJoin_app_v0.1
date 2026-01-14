/**
 * 混合智能行业分类引擎 (Hybrid Industry Classification Engine)
 * 
 * 三层架构:
 * - Tier 1: Seed库精确匹配 (0-5ms) - 最快，最准确
 * - Tier 2: Ontology模糊匹配 (5-50ms) - 基于规则和同义词
 * - Tier 3: AI深度分析 (200-800ms) - DeepSeek推理
 */

import { matchSeed, type SeedMatch } from "./industrySeedMap";
import { matchIndustryFromText } from "./industryOntology";
import { INDUSTRY_TAXONOMY, findCategoryById, findSegmentById, findNicheById } from "@shared/industryTaxonomy";

export interface IndustryClassificationResult {
  category: {
    id: string;
    label: string;
  };
  segment: {
    id: string;
    label: string;
  };
  niche?: {
    id: string;
    label: string;
  };
  confidence: number;
  reasoning?: string;
  source: "seed" | "ontology" | "ai" | "fallback";
  processingTimeMs: number;
  rawInput: string;           // original user input
  normalizedInput: string;    // AI-cleaned version
}

/**
 * Tier 1: Seed库精确匹配
 */
function matchViaSeed(userInput: string): IndustryClassificationResult | null {
  const startTime = Date.now();
  const seedMatch = matchSeed(userInput);
  
  if (!seedMatch) return null;
  
  const category = findCategoryById(seedMatch.category);
  const segment = findSegmentById(seedMatch.category, seedMatch.segment);
  
  if (!category || !segment) return null;
  
  let niche = undefined;
  if (seedMatch.niche) {
    const nicheFound = findNicheById(seedMatch.category, seedMatch.segment, seedMatch.niche);
    if (nicheFound) {
      niche = { id: seedMatch.niche, label: nicheFound.label };
    }
  }
  
  return {
    category: { id: category.id, label: category.label },
    segment: { id: segment.id, label: segment.label },
    niche,
    confidence: seedMatch.confidence,
    source: "seed",
    processingTimeMs: Date.now() - startTime,
    rawInput: userInput,
    normalizedInput: userInput,
  };
}

/**
 * Tier 2: Ontology模糊匹配
 */
function matchViaOntology(userInput: string): IndustryClassificationResult | null {
  const startTime = Date.now();
  
  try {
    const match = matchIndustryFromText(userInput);
    
    if (!match || !match.industry) return null;
    
    const mappedResult = mapOldIndustryToThreeTier(match.industry, match.confidence || 0.7);
    
    if (!mappedResult) return null;
    
    return {
      ...mappedResult,
      source: "ontology",
      processingTimeMs: Date.now() - startTime,
      rawInput: userInput,
      normalizedInput: userInput,
    };
  } catch (error) {
    console.error("Ontology matching error:", error);
    return null;
  }
}

/**
 * 将旧行业分类映射到新的三层体系
 */
function mapOldIndustryToThreeTier(oldIndustry: string, confidence: number): Omit<IndustryClassificationResult, "source" | "processingTimeMs" | "rawInput" | "normalizedInput"> | null {
  const mappings: Record<string, { category: string; segment: string; niche?: string }> = {
    "金融": { category: "finance", segment: "commercial_banking" },
    "科技": { category: "tech", segment: "software_dev" },
    "互联网": { category: "tech", segment: "software_dev" },
    "医疗": { category: "healthcare", segment: "medical_services" },
    "教育": { category: "education", segment: "k12" },
    "制造": { category: "manufacturing", segment: "consumer_electronics" },
    "零售": { category: "consumer_retail", segment: "retail" },
    "房地产": { category: "real_estate", segment: "real_estate_sales" },
  };
  
  const mapping = mappings[oldIndustry];
  if (!mapping) return null;
  
  const category = findCategoryById(mapping.category);
  const segment = findSegmentById(mapping.category, mapping.segment);
  
  if (!category || !segment) return null;
  
  return {
    category: { id: category.id, label: category.label },
    segment: { id: segment.id, label: segment.label },
    niche: undefined,
    confidence: confidence * 0.8,
    reasoning: `基于关键词"${oldIndustry}"的模糊匹配`,
  };
}

/**
 * Tier 3: AI深度分析
 */
async function matchViaAI(userInput: string): Promise<IndustryClassificationResult | null> {
  const startTime = Date.now();
  
  try {
    const { default: OpenAI } = await import("openai");
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("OPENAI_API_KEY not configured");
      return null;
    }
    
    const openai = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
    
    const categoryList = INDUSTRY_TAXONOMY.map(cat => `${cat.id} (${cat.label})`).join(", ");
    
    const prompt = `你是行业分类专家。将用户职业描述映射到三层分类体系。

可选大类（15个）：
${categoryList}

用户输入："${userInput}"

分析用户输入，返回最匹配的行业分类。必须返回JSON格式：
{
  "category": "大类ID",
  "categoryLabel": "大类中文名称",
  "segment": "细分ID",
  "segmentLabel": "细分中文名称",
  "niche": "赛道ID（可选）",
  "nicheLabel": "赛道中文名称（可选）",
  "confidence": 0.0-1.0,
  "reasoning": "分类理由"
}

注意：所有label必须使用简体中文，confidence反映确定性。`;
    
    const response = await (openai.chat.completions.create as any)({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const aiResult = JSON.parse(content);
    
    const category = findCategoryById(aiResult.category);
    const segment = category ? findSegmentById(aiResult.category, aiResult.segment) : null;
    
    if (!category || !segment) return null;
    
    let niche = undefined;
    if (aiResult.niche) {
      const nicheFound = findNicheById(aiResult.category, aiResult.segment, aiResult.niche);
      if (nicheFound) {
        niche = { id: aiResult.niche, label: aiResult.nicheLabel || nicheFound.label };
      }
    }
    
    return {
      category: { id: category.id, label: aiResult.categoryLabel || category.label },
      segment: { id: segment.id, label: aiResult.segmentLabel || segment.label },
      niche,
      confidence: Math.min(1.0, Math.max(0.0, aiResult.confidence || 0.7)),
      reasoning: aiResult.reasoning,
      source: "ai",
      processingTimeMs: Date.now() - startTime,
      rawInput: userInput,
      normalizedInput: userInput,
    };
  } catch (error) {
    console.error("AI classification error:", error);
    return null;
  }
}

/**
 * Normalize user input using AI
 */
async function normalizeUserInput(rawText: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    const { default: OpenAI } = await import("openai");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return rawText;
    
    const openai = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
    });
    
    const prompt = `将用户输入的职业描述清理并标准化为专业表述（最多20个字）。只返回结果。
输入: "${rawText}"
输出: `;
    
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 50,
    });
    
    const normalized = response.choices[0]?.message?.content?.trim();
    return normalized || rawText;
  } catch (error) {
    return rawText;
  }
}

/**
 * 主分类函数
 */
export async function classifyIndustry(
  userInput: string
): Promise<IndustryClassificationResult> {
  const startTime = Date.now();
  const cleanInput = userInput.trim();
  
  if (!cleanInput) {
    return {
      category: { id: "tech", label: "科技互联网" },
      segment: { id: "software_dev", label: "软件开发" },
      confidence: 0.3,
      reasoning: "输入为空",
      source: "fallback",
      processingTimeMs: Date.now() - startTime,
      rawInput: cleanInput,
      normalizedInput: cleanInput,
    };
  }
  
  const seedResult = matchViaSeed(cleanInput);
  if (seedResult && seedResult.confidence >= 0.9) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...seedResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  const ontologyResult = matchViaOntology(cleanInput);
  if (ontologyResult && ontologyResult.confidence >= 0.8) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...ontologyResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  try {
    const aiResult = await matchViaAI(cleanInput);
    if (aiResult) {
      const normalizedInput = await normalizeUserInput(cleanInput);
      return { ...aiResult, normalizedInput };
    }
  } catch (error) {}
  
  const normalizedInput = await normalizeUserInput(cleanInput);
  const base = ontologyResult || seedResult || {
    category: { id: "tech", label: "科技互联网" },
    segment: { id: "software_dev", label: "软件开发" },
    confidence: 0.3,
    reasoning: "无法准确分类",
  };

  return {
    ...base,
    source: (base as any).source || "fallback",
    processingTimeMs: Date.now() - startTime,
    rawInput: cleanInput,
    normalizedInput,
  };
}
