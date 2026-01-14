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
}

/**
 * Tier 1: Seed库精确匹配
 * 目标响应时间: <10ms
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
  };
}

/**
 * Tier 2: Ontology模糊匹配
 * 目标响应时间: <100ms
 * 使用现有的 industryOntology.ts 进行模糊匹配
 */
function matchViaOntology(userInput: string): IndustryClassificationResult | null {
  const startTime = Date.now();
  
  try {
    const match = matchIndustryFromText(userInput);
    
    if (!match || !match.industry) return null;
    
    // 尝试从匹配结果映射到三层分类
    // industryOntology返回的是旧的行业名称，需要映射到新的三层体系
    const mappedResult = mapOldIndustryToThreeTier(match.industry, match.confidence || 0.7);
    
    if (!mappedResult) return null;
    
    return {
      ...mappedResult,
      source: "ontology",
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Ontology matching error:", error);
    return null;
  }
}

/**
 * 将旧行业分类映射到新的三层体系
 * 这是一个临时解决方案，直到我们完全迁移到新系统
 */
function mapOldIndustryToThreeTier(oldIndustry: string, confidence: number): IndustryClassificationResult | null {
  // 简单映射规则 - 可以根据需要扩展
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
    confidence: confidence * 0.8, // 降低置信度因为是映射结果
    reasoning: `基于关键词"${oldIndustry}"的模糊匹配`,
    source: "ontology",
    processingTimeMs: 0,
  };
}

/**
 * Tier 3: AI深度分析
 * 目标响应时间: <1000ms
 * 使用DeepSeek进行智能推理
 */
async function matchViaAI(userInput: string): Promise<IndustryClassificationResult | null> {
  const startTime = Date.now();
  
  try {
    // 动态导入以避免循环依赖
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
    
    // 构建可选分类列表
    const categoryList = INDUSTRY_TAXONOMY.map(cat => `${cat.id} (${cat.label})`).join(", ");
    
    const prompt = `你是行业分类专家。将用户职业描述映射到三层分类体系。

可选大类（15个）：
${categoryList}

用户输入："${userInput}"

分析用户输入，返回最匹配的行业分类。必须返回JSON格式：
{
  "category": "大类ID（例如：tech, finance）",
  "categoryLabel": "大类中文名称",
  "segment": "细分ID（例如：ai_ml, commercial_banking）",
  "segmentLabel": "细分中文名称",
  "niche": "具体赛道ID（可选）",
  "nicheLabel": "赛道中文名称（可选）",
  "confidence": 0.0-1.0,
  "reasoning": "分类理由（一句话，简体中文）"
}

注意：
1. 所有label必须使用简体中文
2. confidence应该反映匹配的确定性
3. 如果输入模糊，confidence应该较低
4. reasoning要简洁明了`;
    
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
      timeout: 5000,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    
    const aiResult = JSON.parse(content);
    
    // 验证AI返回的分类是否存在于taxonomy中
    const category = findCategoryById(aiResult.category);
    const segment = category ? findSegmentById(aiResult.category, aiResult.segment) : null;
    
    if (!category || !segment) {
      console.error("AI returned invalid category/segment:", aiResult);
      return null;
    }
    
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
    };
  } catch (error) {
    console.error("AI classification error:", error);
    return null;
  }
}

/**
 * 主分类函数：混合三层推断
 * 
 * 流程:
 * 1. Tier 1: Seed精确匹配 (最快)
 * 2. Tier 2: Ontology模糊匹配 (中速)
 * 3. Tier 3: AI深度分析 (最慢但最智能)
 */
export async function classifyIndustry(
  userInput: string
): Promise<IndustryClassificationResult> {
  const startTime = Date.now();
  
  // 清理输入
  const cleanInput = userInput.trim();
  
  if (!cleanInput) {
    return {
      category: { id: "tech", label: "科技互联网" },
      segment: { id: "software_dev", label: "软件开发" },
      confidence: 0.3,
      reasoning: "输入为空，使用默认分类",
      source: "fallback",
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // Tier 1: Seed精确匹配
  const seedResult = matchViaSeed(cleanInput);
  if (seedResult && seedResult.confidence >= 0.9) {
    return seedResult;
  }
  
  // Tier 2: Ontology模糊匹配
  const ontologyResult = matchViaOntology(cleanInput);
  if (ontologyResult && ontologyResult.confidence >= 0.8) {
    return ontologyResult;
  }
  
  // Tier 3: AI深度分析
  try {
    const aiResult = await matchViaAI(cleanInput);
    if (aiResult) {
      return aiResult;
    }
  } catch (error) {
    console.error("AI matching failed, falling back:", error);
  }
  
  // 降级策略：返回低置信度的结果或默认值
  if (ontologyResult) {
    return ontologyResult;
  }
  
  if (seedResult) {
    return seedResult;
  }
  
  // 最终降级：返回默认分类
  return {
    category: { id: "tech", label: "科技互联网" },
    segment: { id: "software_dev", label: "软件开发" },
    confidence: 0.3,
    reasoning: "无法准确分类，建议手动选择",
    source: "fallback",
    processingTimeMs: Date.now() - startTime,
  };
}
