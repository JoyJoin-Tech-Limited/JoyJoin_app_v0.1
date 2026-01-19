/**
 * 混合智能行业分类引擎 (Hybrid Industry Classification Engine)
 * 
 * 四层架构:
 * - Tier 0: Fuzzy匹配 (10-30ms) - 处理拼写错误和变体
 * - Tier 1: Seed库精确匹配 (0-5ms) - 最快，最准确
 * - Tier 2: Taxonomy直接匹配 (5-20ms) - 基于INDUSTRY_TAXONOMY的keywords/synonyms
 * - Tier 3: AI深度分析 (200-800ms) - DeepSeek推理
 */

import { matchSeed, type SeedMatch } from "./industrySeedMap";
import { fuzzyMatch } from "./fuzzyMatcher";
import { INDUSTRY_TAXONOMY, findCategoryById, findSegmentById, findNicheById } from "@shared/industryTaxonomy";
import { OCCUPATIONS } from "@shared/occupations";
import { ensureReasoning } from "./reasoningGenerator";
import { inferNicheFromContext } from "./nicheInferenceEngine";
import { applySemanticFallback } from "@shared/semanticFallback";

// Confidence thresholds for classification tiers
const CONFIDENCE_THRESHOLDS = {
  FUZZY_HIGH: 0.85,      // High confidence fuzzy match (use immediately)
  FUZZY_DECENT: 0.70,    // Decent fuzzy match (use if seed fails)
  SEED_MIN: 0.90,        // Minimum seed match confidence
  TAXONOMY_MIN: 0.80,    // Minimum taxonomy match confidence
  NICHE_INFERENCE_SEED: 0.85,    // Niche inference for seed/taxonomy
  NICHE_INFERENCE_AI: 0.80,      // Niche inference for AI results
};

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
  source: "seed" | "ontology" | "ai" | "fallback" | "fuzzy";
  processingTimeMs: number;
  rawInput: string;           // original user input
  normalizedInput: string;    // AI-cleaned version
  
  // 🆕 Candidate list (returned when confidence < 0.7)
  candidates?: Array<{
    category: { id: string; label: string };
    segment: { id: string; label: string };
    niche?: { id: string; label: string };
    confidence: number;
    reasoning: string;
    occupationId?: string;
    occupationName?: string;
  }>;
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
  
  const result: IndustryClassificationResult = {
    category: { id: category.id, label: category.label },
    segment: { id: segment.id, label: segment.label },
    niche,
    confidence: seedMatch.confidence,
    source: "seed",
    processingTimeMs: Date.now() - startTime,
    rawInput: userInput,
    normalizedInput: userInput,
  };
  
  // Apply niche inference if no niche found
  if (!result.niche) {
    const inferredNiche = inferNicheFromContext(userInput, category.id, segment.id);
    if (inferredNiche && inferredNiche.confidence >= CONFIDENCE_THRESHOLDS.NICHE_INFERENCE_SEED) {
      result.niche = { id: inferredNiche.id, label: inferredNiche.label };
    }
  }
  
  // Ensure reasoning is always present
  return ensureReasoning(result, userInput);
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
  
  const result: IndustryClassificationResult = {
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
  
  // Apply niche inference if no niche found
  if (!result.niche) {
    const inferredNiche = inferNicheFromContext(userInput, match.categoryId, match.segmentId);
    if (inferredNiche && inferredNiche.confidence >= CONFIDENCE_THRESHOLDS.NICHE_INFERENCE_SEED) {
      result.niche = { id: inferredNiche.id, label: inferredNiche.label };
    }
  }
  
  // Ensure reasoning is always present
  return ensureReasoning(result, userInput);
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
    
    // Apply niche inference if no niche found
    if (!niche) {
      const inferredNiche = inferNicheFromContext(userInput, category.id, segment.id);
      if (inferredNiche && inferredNiche.confidence >= CONFIDENCE_THRESHOLDS.NICHE_INFERENCE_AI) {
        niche = { id: inferredNiche.id, label: inferredNiche.label };
      }
    }
    
    const result: IndustryClassificationResult = {
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
    
    // Ensure reasoning is always present
    return ensureReasoning(result, userInput);
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
 * 🆕 Generate candidate list for user confirmation
 */
function generateCandidates(
  userInput: string,
  primaryResult?: IndustryClassificationResult
): Array<{
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  confidence: number;
  reasoning: string;
  occupationId?: string;
  occupationName?: string;
}> {
  const input = userInput.toLowerCase().trim();
  const candidates: Array<any> = [];
  
  // Search through all occupations for keyword/synonym matches
  for (const occ of OCCUPATIONS) {
    if (!occ.seedMappings) continue;
    
    let score = 0;
    let matchedTerms: string[] = [];
    
    // Check displayName
    if (occ.displayName.toLowerCase().includes(input) || 
        input.includes(occ.displayName.toLowerCase())) {
      score += 50;
      matchedTerms.push(occ.displayName);
    }
    
    // Check synonyms
    for (const syn of occ.synonyms) {
      if (syn.toLowerCase().includes(input) || 
          input.includes(syn.toLowerCase())) {
        score += 40;
        matchedTerms.push(syn);
        break; // Only count first match
      }
    }
    
    // Check keywords
    for (const keyword of occ.keywords) {
      if (input.includes(keyword.toLowerCase()) || 
          keyword.toLowerCase().includes(input)) {
        score += 30;
        matchedTerms.push(keyword);
        break;
      }
    }
    
    if (score > 20) {
      const category = findCategoryById(occ.seedMappings.category);
      const segment = category ? findSegmentById(occ.seedMappings.category, occ.seedMappings.segment) : null;
      
      if (category && segment) {
        let niche = undefined;
        if (occ.seedMappings.niche) {
          const nicheFound = findNicheById(occ.seedMappings.category, occ.seedMappings.segment, occ.seedMappings.niche);
          if (nicheFound) {
            niche = { id: occ.seedMappings.niche, label: nicheFound.label };
          }
        }
        
        candidates.push({
          category: { id: category.id, label: category.label },
          segment: { id: segment.id, label: segment.label },
          niche,
          confidence: Math.min(0.85, score / 100),
          reasoning: `匹配到：${matchedTerms.slice(0, 3).join('、')}`,
          occupationId: occ.id,
          occupationName: occ.displayName,
        });
      }
    }
  }
  
  // Deduplicate by category-segment-niche combo
  const uniqueCandidates = Array.from(
    new Map(candidates.map(c => [
      `${c.category.id}-${c.segment.id}-${c.niche?.id || 'none'}`, 
      c
    ])).values()
  );
  
  uniqueCandidates.sort((a, b) => b.confidence - a.confidence);
  
  // Return top 5, excluding primary result
  return uniqueCandidates
    .filter(c => {
      if (!primaryResult) return true;
      return !(
        c.category.id === primaryResult.category.id &&
        c.segment.id === primaryResult.segment.id &&
        c.niche?.id === primaryResult.niche?.id
      );
    })
    .slice(0, 5);
}

/**
 * 🆕 Generate AI semantic description (lightweight)
 */
async function generateSemanticDescription(userInput: string): Promise<string> {
  const { default: OpenAI } = await import("openai");
  
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }
  
  const openai = new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
  
  const prompt = `用一句话描述这个职业或身份的核心特征（不超过20字）：

用户输入："${userInput}"

要求：
- 如果能识别出职业，简述其工作内容
- 如果是身份描述（如"富二代"），描述其社会角色
- 如果完全无法理解，输出"未知职业类型"
- 不要分类，只描述

示例：
输入："投资" → 输出："从事投资相关工作"
输入："做AI的" → 输出："人工智能相关从业者"
输入："富二代" → 输出："家族企业继承人或财富二代"

输出（仅一句话）：`;
  
  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 50,
  });
  
  const description = response.choices[0]?.message?.content?.trim() || userInput;
  return description;
}

/**
 * Intelligent fallback - no hardcoding to software_dev
 * Returns "other" category with low confidence and suggestions
 */
async function intelligentFallback(userInput: string, startTime: number): Promise<IndustryClassificationResult> {
  // Try semantic fallback first for edge cases (farmer, student, 富二代, etc.)
  const semanticMatch = applySemanticFallback(userInput);
  if (semanticMatch) {
    const category = findCategoryById(semanticMatch.category);
    const segment = category ? findSegmentById(semanticMatch.category, semanticMatch.segment) : null;
    
    if (category && segment) {
      const result: IndustryClassificationResult = {
        category: { id: category.id, label: category.label },
        segment: { id: segment.id, label: segment.label },
        niche: semanticMatch.niche ? findNicheById(semanticMatch.category, semanticMatch.segment, semanticMatch.niche) 
          ? { id: semanticMatch.niche, label: findNicheById(semanticMatch.category, semanticMatch.segment, semanticMatch.niche)!.label }
          : undefined : undefined,
        confidence: semanticMatch.confidence,
        source: "fallback",
        reasoning: semanticMatch.reasoning,
        processingTimeMs: Date.now() - startTime,
        rawInput: userInput,
        normalizedInput: userInput,
      };
      
      return ensureReasoning(result, userInput);
    }
  }
  
  // Original fallback logic for occupation keyword matching
  const input = userInput.toLowerCase();
  const candidates: { occ: typeof OCCUPATIONS[0]; score: number }[] = [];
  
  // Try to find ANY partial match based on keywords
  for (const occ of OCCUPATIONS) {
    let score = 0;
    for (const keyword of occ.keywords) {
      if (input.includes(keyword.toLowerCase())) score += 10;
    }
    if (score > 0) candidates.push({ occ, score });
  }
  
  candidates.sort((a, b) => b.score - a.score);
  
  // If we found some keyword matches, suggest the top 3
  if (candidates.length > 0) {
    const top3 = candidates.slice(0, 3);
    const best = top3[0].occ;
    
    // Try to use the best match's category if it has seed mappings
    if (best.seedMappings) {
      const category = findCategoryById(best.seedMappings.category);
      const segment = category ? findSegmentById(best.seedMappings.category, best.seedMappings.segment) : null;
      
      if (category && segment) {
        const result: IndustryClassificationResult = {
          category: { id: category.id, label: category.label },
          segment: { id: segment.id, label: segment.label },
          confidence: Math.min(0.5, top3[0].score / 50),
          source: "fallback",
          reasoning: `推测可能是"${best.displayName}"相关领域，建议确认`,
          processingTimeMs: Date.now() - startTime,
          rawInput: userInput,
          normalizedInput: userInput,
        };
        
        // Ensure reasoning is always present
        return ensureReasoning(result, userInput);
      }
    }
  }
  
  // 🆕 Don't guess randomly - generate AI semantic description
  console.log(`[Fallback] Unable to classify "${userInput}", generating AI semantic description...`);
  
  try {
    const aiDescription = await generateSemanticDescription(userInput);
    
    // Return "unclassified" state with AI description
    const unknownCategory = INDUSTRY_TAXONOMY.find(c => c.id === "other") || INDUSTRY_TAXONOMY[0];
    const unknownSegment = unknownCategory.segments[0];
    
    return {
      category: { id: unknownCategory.id, label: unknownCategory.label },
      segment: { id: unknownSegment.id, label: unknownSegment.label },
      confidence: 0.3,  // Low confidence = uncertain
      source: "fallback",
      reasoning: `无法精确分类。AI理解：${aiDescription}`,
      processingTimeMs: Date.now() - startTime,
      rawInput: userInput,
      normalizedInput: aiDescription,  // 🆕 AI semantic description
    };
  } catch (error) {
    console.error('[Fallback] AI description generation failed:', error);
    
    // AI failed too, return basic unclassified state
    const unknownCategory = INDUSTRY_TAXONOMY.find(c => c.id === "other") || INDUSTRY_TAXONOMY[0];
    const unknownSegment = unknownCategory.segments[0];
    
    return {
      category: { id: unknownCategory.id, label: unknownCategory.label },
      segment: { id: unknownSegment.id, label: unknownSegment.label },
      confidence: 0.1,
      source: "fallback",
      reasoning: `无法识别职业类型，已保存原始输入"${userInput}"`,
      processingTimeMs: Date.now() - startTime,
      rawInput: userInput,
      normalizedInput: userInput,
    };
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
    return await intelligentFallback(cleanInput, startTime);
  }
  
  // Tier 0: Fuzzy matching for typos and variations
  const fuzzyResult = fuzzyMatch(cleanInput);
  if (fuzzyResult && fuzzyResult.confidence >= CONFIDENCE_THRESHOLDS.FUZZY_HIGH) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...fuzzyResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  // Tier 1: Seed库精确匹配
  const seedResult = matchViaSeed(cleanInput);
  if (seedResult && seedResult.confidence >= CONFIDENCE_THRESHOLDS.SEED_MIN) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...seedResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  // If fuzzy match has decent confidence, use it
  if (fuzzyResult && fuzzyResult.confidence >= CONFIDENCE_THRESHOLDS.FUZZY_DECENT) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...fuzzyResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  // Tier 2: Taxonomy直接匹配
  const taxonomyResult = matchViaTaxonomy(cleanInput);
  if (taxonomyResult && taxonomyResult.confidence >= CONFIDENCE_THRESHOLDS.TAXONOMY_MIN) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return { ...taxonomyResult, normalizedInput, processingTimeMs: Date.now() - startTime };
  }
  
  // Tier 3: AI深度分析
  let aiResult: IndustryClassificationResult | null = null;
  try {
    aiResult = await matchViaAI(cleanInput);
  } catch (error) {
    console.error("AI classification error:", error);
  }
  
  // 🆕 Decision point: Should we ask user to confirm?
  const bestResult = aiResult || taxonomyResult || fuzzyResult || seedResult;
  
  if (bestResult && bestResult.confidence < 0.7) {
    // Low confidence, generate candidate list
    const candidates = generateCandidates(cleanInput, bestResult);
    const normalizedInput = await normalizeUserInput(cleanInput);
    
    return {
      ...bestResult,
      normalizedInput,
      processingTimeMs: Date.now() - startTime,
      candidates, // 🆕 Return candidates for user selection
    };
  }
  
  if (bestResult) {
    const normalizedInput = await normalizeUserInput(cleanInput);
    return {
      ...bestResult,
      normalizedInput,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  // Final fallback
  const fallbackResult = await intelligentFallback(cleanInput, startTime);
  const candidates = generateCandidates(cleanInput);
  
  return {
    ...fallbackResult,
    candidates, // Even in fallback, provide candidates
  };
}
