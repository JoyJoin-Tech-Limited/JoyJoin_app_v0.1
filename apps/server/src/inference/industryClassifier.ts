/**
 * 混合智能行业分类引擎 (Hybrid Industry Classification Engine)
 * 
 * 三层架构:
 * - Tier 1: Seed库精确匹配 (0-5ms) - 最快，最准确
 * - Tier 2: Taxonomy直接匹配 (5-20ms) - 基于INDUSTRY_TAXONOMY的keywords/synonyms
 * - Tier 3: AI深度分析 (200-800ms) - DeepSeek推理
 */

import { matchSeed, type SeedMatch } from "./industrySeedMap";
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
 * Tier 2: Taxonomy直接匹配 - 直接扫描INDUSTRY_TAXONOMY的keywords/synonyms
 * 优先级: 完全匹配label > 部分keyword匹配
 * 匹配类型优先级: exact_segment_label (0.95) > niche_label (0.93) > niche_synonym (0.90) > segment_label_partial (0.85) > niche_keyword (0.80)
 */
function matchViaTaxonomy(userInput: string): IndustryClassificationResult | null {
  const startTime = Date.now();
  const lowerInput = userInput.toLowerCase();
  
  interface TaxonomyMatch {
    categoryId: string;
    categoryLabel: string;
    segmentId: string;
    segmentLabel: string;
    nicheId?: string;
    nicheLabel?: string;
    confidence: number;
    matchType: "niche" | "segment" | "category";
    matchedTerm: string;
    matchPriority: number; // Higher = better match
  }
  
  const allMatches: TaxonomyMatch[] = [];
  
  for (const category of INDUSTRY_TAXONOMY) {
    for (const segment of category.segments) {
      // HIGHEST PRIORITY: Exact segment label match (e.g., "投资银行" matches segment "投资银行")
      if (lowerInput === segment.label.toLowerCase() || 
          lowerInput.includes(segment.label.toLowerCase())) {
        const isExact = lowerInput === segment.label.toLowerCase();
        allMatches.push({
          categoryId: category.id,
          categoryLabel: category.label,
          segmentId: segment.id,
          segmentLabel: segment.label,
          confidence: isExact ? 0.98 : 0.95,
          matchType: "segment",
          matchedTerm: segment.label,
          matchPriority: isExact ? 100 : 90, // Exact segment match is highest priority
        });
      }
      
      // Check niche level
      for (const niche of segment.niches) {
        // Niche exact label match
        if (lowerInput === niche.label.toLowerCase() || 
            lowerInput.includes(niche.label.toLowerCase())) {
          const isExact = lowerInput === niche.label.toLowerCase();
          allMatches.push({
            categoryId: category.id,
            categoryLabel: category.label,
            segmentId: segment.id,
            segmentLabel: segment.label,
            nicheId: niche.id,
            nicheLabel: niche.label,
            confidence: isExact ? 0.98 : 0.93,
            matchType: "niche",
            matchedTerm: niche.label,
            matchPriority: isExact ? 95 : 85, // Niche label match
          });
        }
        
        // Check synonyms (medium-high priority)
        for (const synonym of niche.synonyms) {
          if (lowerInput === synonym.toLowerCase() || 
              lowerInput.includes(synonym.toLowerCase())) {
            const isExact = lowerInput === synonym.toLowerCase();
            allMatches.push({
              categoryId: category.id,
              categoryLabel: category.label,
              segmentId: segment.id,
              segmentLabel: segment.label,
              nicheId: niche.id,
              nicheLabel: niche.label,
              confidence: isExact ? 0.95 : 0.90,
              matchType: "niche",
              matchedTerm: synonym,
              matchPriority: isExact ? 88 : 75, // Synonym match
            });
          }
        }
        
        // Check keywords (lower priority - only partial match)
        for (const keyword of niche.keywords) {
          if (lowerInput.includes(keyword.toLowerCase())) {
            allMatches.push({
              categoryId: category.id,
              categoryLabel: category.label,
              segmentId: segment.id,
              segmentLabel: segment.label,
              nicheId: niche.id,
              nicheLabel: niche.label,
              confidence: 0.80,
              matchType: "niche",
              matchedTerm: keyword,
              matchPriority: 50, // Keyword match is lower priority
            });
          }
        }
      }
    }
    
    // Check category level (lowest priority)
    if (lowerInput.includes(category.label.toLowerCase())) {
      const firstSegment = category.segments[0];
      if (firstSegment) {
        allMatches.push({
          categoryId: category.id,
          categoryLabel: category.label,
          segmentId: firstSegment.id,
          segmentLabel: firstSegment.label,
          confidence: 0.65,
          matchType: "category",
          matchedTerm: category.label,
          matchPriority: 30, // Category match is lowest priority
        });
      }
    }
  }
  
  if (allMatches.length === 0) return null;
  
  // Sort by priority (highest first) and pick the best match
  allMatches.sort((a, b) => b.matchPriority - a.matchPriority);
  const match = allMatches[0];
  
  return {
    category: { id: match.categoryId, label: match.categoryLabel },
    segment: { id: match.segmentId, label: match.segmentLabel },
    niche: match.nicheId ? { id: match.nicheId, label: match.nicheLabel! } : undefined,
    confidence: match.confidence,
    reasoning: `基于"${match.matchedTerm}"的${match.matchType === "niche" ? "精准赛道" : match.matchType === "segment" ? "细分领域" : "大类"}匹配`,
    source: "ontology",
    processingTimeMs: Date.now() - startTime,
    rawInput: userInput,
    normalizedInput: userInput,
  };
}

/**
 * Tier 3: AI深度分析 (DeepSeek)
 */
async function matchViaAI(userInput: string): Promise<IndustryClassificationResult | null> {
  const startTime = Date.now();
  
  try {
    const { default: OpenAI } = await import("openai");
    
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      console.error("DEEPSEEK_API_KEY not configured");
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
    const apiKey = process.env.DEEPSEEK_API_KEY;
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
  
  // Tier 1: Seed库精确匹配
  const seedResult = matchViaSeed(cleanInput);
  if (seedResult && seedResult.confidence >= 0.9) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...seedResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  // Tier 2: Taxonomy直接匹配 (replaces old ontology matching)
  const taxonomyResult = matchViaTaxonomy(cleanInput);
  if (taxonomyResult && taxonomyResult.confidence >= 0.8) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...taxonomyResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  // Tier 3: AI深度分析 (DeepSeek fallback)
  try {
    const aiResult = await matchViaAI(cleanInput);
    if (aiResult) {
      const normalizedInput = await normalizeUserInput(cleanInput);
      return { ...aiResult, normalizedInput };
    }
  } catch (error) {
    console.error("AI classification fallback error:", error);
  }
  
  // Fallback: return best available result or default
  const normalizedInput = await normalizeUserInput(cleanInput);
  const base = taxonomyResult || seedResult || {
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
