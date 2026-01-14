/**
 * Shared type definitions for industry classification system
 * Used across frontend and backend
 */

export interface IndustryLevel {
  id: string;
  label: string;
}

export interface UserIndustryData {
  raw: string;                      // Original user input
  normalized: string;               // AI-cleaned version
  category: IndustryLevel;          // L1 (e.g., { id: "tech", label: "科技互联网" })
  segment: IndustryLevel;           // L2 (e.g., { id: "ai_ml", label: "AI/机器学习" })
  niche?: IndustryLevel | null;     // L3 (optional, e.g., { id: "healthcare_ai", label: "医疗AI" })
  confidence: number;               // 0-100
  source: 'seed' | 'ontology' | 'ai' | 'fallback';
  updatedAt?: Date;
}

export interface IndustryClassificationRequest {
  description: string;              // User's text input
}

export interface IndustryClassificationResponse {
  category: IndustryLevel;
  segment: IndustryLevel;
  niche?: IndustryLevel;
  confidence: number;
  reasoning?: string;
  source: 'seed' | 'ontology' | 'ai' | 'fallback';
  processingTimeMs: number;
  rawInput: string;
  normalizedInput: string;
}

// Helper type guards
export function isValidIndustryLevel(obj: any): obj is IndustryLevel {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    obj.id.length > 0 &&
    typeof obj.label === 'string' &&
    obj.label.length > 0
  );
}

export function isValidUserIndustryData(obj: any): obj is UserIndustryData {
  if (!obj || typeof obj !== 'object') return false;
  
  return (
    typeof obj.raw === 'string' &&
    typeof obj.normalized === 'string' &&
    isValidIndustryLevel(obj.category) &&
    isValidIndustryLevel(obj.segment) &&
    (obj.niche === null || obj.niche === undefined || isValidIndustryLevel(obj.niche)) &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 100 &&
    ['seed', 'ontology', 'ai', 'fallback'].includes(obj.source)
  );
}
