/**
 * Universal Reasoning Generator for Industry Classification
 * 
 * Ensures all classification results have meaningful reasoning,
 * regardless of the matching tier (Seed, Fuzzy, Ontology, AI, Fallback)
 */

import type { IndustryClassificationResult } from './industryClassifier';

/**
 * Generate human-readable reasoning for classification result
 */
export function generateReasoning(
  result: IndustryClassificationResult,
  userInput: string
): string {
  const { source, category, segment, niche, normalizedInput, reasoning } = result;
  
  // If AI already provided reasoning, use it
  if (source === 'ai' && reasoning && reasoning.trim() !== '') {
    return reasoning;
  }
  
  // Generate reasoning based on source
  switch (source) {
    case 'seed':
      return generateSeedReasoning(normalizedInput, category.label, segment.label, niche?.label);
      
    case 'fuzzy':
      return generateFuzzyReasoning(userInput, normalizedInput, category.label, segment.label, niche?.label);
      
    case 'ontology':
      return generateOntologyReasoning(userInput, category.label, segment.label, niche?.label);
      
    case 'ai':
      // Fallback if AI didn't provide reasoning
      return `AI分析后判定为${segment.label}${niche ? `的${niche.label}` : ''}领域`;
      
    case 'fallback':
      return generateFallbackReasoning(category.label, segment.label);
      
    default:
      return `识别为${category.label}相关职业`;
  }
}

/**
 * Generate reasoning for Seed (exact match) tier
 */
function generateSeedReasoning(
  normalizedInput: string,
  categoryLabel: string,
  segmentLabel: string,
  nicheLabel?: string
): string {
  const nichePart = nicheLabel ? `，专注于${nicheLabel}领域` : '';
  return `精确匹配职业库中的"${normalizedInput}"，归属于${categoryLabel} > ${segmentLabel}${nichePart}`;
}

/**
 * Generate reasoning for Fuzzy matching tier
 */
function generateFuzzyReasoning(
  userInput: string,
  normalizedInput: string,
  categoryLabel: string,
  segmentLabel: string,
  nicheLabel?: string
): string {
  const nichePart = nicheLabel ? `，专注于${nicheLabel}领域` : '';
  
  if (userInput.toLowerCase() === normalizedInput.toLowerCase()) {
    return `通过模糊匹配识别为"${normalizedInput}"${nichePart}`;
  }
  
  return `通过模糊匹配将"${userInput}"识别为"${normalizedInput}"${nichePart}`;
}

/**
 * Generate reasoning for Ontology (knowledge graph) tier
 */
function generateOntologyReasoning(
  userInput: string,
  categoryLabel: string,
  segmentLabel: string,
  nicheLabel?: string
): string {
  const nichePart = nicheLabel ? ` > ${nicheLabel}` : '';
  return `根据行业知识库，将"${userInput}"归类为${categoryLabel} > ${segmentLabel}${nichePart}`;
}

/**
 * Generate reasoning for Fallback tier
 */
function generateFallbackReasoning(
  categoryLabel: string,
  segmentLabel: string
): string {
  return `未能精确识别，推测可能属于${categoryLabel} > ${segmentLabel}，建议手动确认`;
}

/**
 * Enrich existing result with reasoning if missing
 */
export function ensureReasoning(
  result: IndustryClassificationResult,
  userInput: string
): IndustryClassificationResult {
  if (!result.reasoning || result.reasoning.trim() === '') {
    return {
      ...result,
      reasoning: generateReasoning(result, userInput),
    };
  }
  return result;
}
