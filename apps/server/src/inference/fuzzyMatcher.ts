/**
 * Tier 0: Fuzzy Matching with Levenshtein Distance
 * Response time target: 10-30ms
 * Handles typos, variations, and partial matches
 */

import { OCCUPATIONS } from '@shared/occupations';
import { findCategoryById, findSegmentById, findNicheById } from '@shared/industryTaxonomy';
import type { IndustryClassificationResult } from './industryClassifier';
import { levenshteinDistance } from '../utils/stringUtils';

interface OccupationMatch {
  occupation: typeof OCCUPATIONS[0];
  score: number;
  matchType: 'exact' | 'levenshtein' | 'keyword' | 'synonym';
}

/**
 * Fuzzy match user input to occupations
 */
export function fuzzyMatch(userInput: string): IndustryClassificationResult | null {
  const startTime = Date.now();
  const input = userInput.toLowerCase().trim();
  
  if (!input || input.length < 2) return null;
  
  const candidates: OccupationMatch[] = [];
  
  for (const occ of OCCUPATIONS) {
    // Skip occupations without seed mappings
    if (!occ.seedMappings) continue;
    
    let score = 0;
    let matchType: OccupationMatch['matchType'] = 'keyword';
    
    const displayName = occ.displayName.toLowerCase();
    
    // Exact match (highest priority)
    if (displayName === input) {
      return createResult(occ, 1.0, 'fuzzy', '精确匹配', userInput, startTime);
    }
    
    // Levenshtein distance for typos (very high priority)
    const distance = levenshteinDistance(input, displayName);
    const maxDistance = Math.min(2, Math.floor(displayName.length * 0.25)); // Allow up to 25% errors
    
    if (distance <= maxDistance) {
      score += (maxDistance + 1 - distance) * 35;
      matchType = 'levenshtein';
    }
    
    // Substring match in display name
    if (displayName.includes(input) || input.includes(displayName)) {
      score += 30;
      if (matchType === 'keyword') matchType = 'exact';
    }
    
    // Synonym matching
    for (const syn of occ.synonyms) {
      const synLower = syn.toLowerCase();
      
      if (synLower === input) {
        return createResult(occ, 0.98, 'fuzzy', `精确匹配同义词"${syn}"`, userInput, startTime);
      }
      
      if (synLower.includes(input) || input.includes(synLower)) {
        score += 25;
        matchType = 'synonym';
      }
      
      // Levenshtein for synonyms
      const synDistance = levenshteinDistance(input, synLower);
      if (synDistance <= 2) {
        score += (3 - synDistance) * 20;
        matchType = 'synonym';
      }
    }
    
    // Keyword partial match
    for (const keyword of occ.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (input.includes(keywordLower) || keywordLower.includes(input)) {
        score += 15;
      }
    }
    
    if (score > 20) {
      candidates.push({ occupation: occ, score, matchType });
    }
  }
  
  if (candidates.length === 0) return null;
  
  // Sort by score (descending)
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  
  // Calculate confidence based on score and match type
  let confidence = Math.min(0.95, best.score / 100);
  
  // Boost confidence for high-quality matches
  if (best.matchType === 'levenshtein' && best.score > 80) {
    confidence = Math.min(0.92, confidence + 0.1);
  }
  
  const matchTypeLabel = {
    exact: '精确匹配',
    levenshtein: '模糊匹配',
    keyword: '关键词匹配',
    synonym: '同义词匹配',
  }[best.matchType];
  
  return createResult(
    best.occupation,
    confidence,
    'fuzzy',
    `${matchTypeLabel} "${best.occupation.displayName}"`,
    userInput,
    startTime
  );
}

/**
 * Create classification result from occupation match
 */
function createResult(
  occ: typeof OCCUPATIONS[0],
  confidence: number,
  source: IndustryClassificationResult['source'],
  reasoning: string,
  userInput: string,
  startTime: number
): IndustryClassificationResult | null {
  if (!occ.seedMappings) return null;
  
  const category = findCategoryById(occ.seedMappings.category);
  const segment = category ? findSegmentById(occ.seedMappings.category, occ.seedMappings.segment) : null;
  
  if (!category || !segment) return null;
  
  let niche = undefined;
  if (occ.seedMappings.niche) {
    const nicheFound = findNicheById(
      occ.seedMappings.category,
      occ.seedMappings.segment,
      occ.seedMappings.niche
    );
    if (nicheFound) {
      niche = { id: occ.seedMappings.niche, label: nicheFound.label };
    }
  }
  
  return {
    category: { id: category.id, label: category.label },
    segment: { id: segment.id, label: segment.label },
    niche,
    confidence,
    reasoning,
    source,
    processingTimeMs: Date.now() - startTime,
    rawInput: userInput,
    normalizedInput: occ.displayName,
  };
}
