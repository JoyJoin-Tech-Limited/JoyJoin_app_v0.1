import type { UserIndustryData, IndustryLevel } from '@shared/types/industry';

export class IndustryValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'IndustryValidationError';
  }
}

export function validateIndustryLevel(
  level: any,
  levelName: string
): IndustryLevel {
  if (!level || typeof level !== 'object') {
    throw new IndustryValidationError(
      `${levelName} must be an object`,
      levelName
    );
  }
  
  if (typeof level.id !== 'string' || level.id.trim().length === 0) {
    throw new IndustryValidationError(
      `${levelName}.id must be a non-empty string`,
      `${levelName}.id`
    );
  }
  
  if (typeof level.label !== 'string' || level.label.trim().length === 0) {
    throw new IndustryValidationError(
      `${levelName}.label must be a non-empty string`,
      `${levelName}.label`
    );
  }
  
  return {
    id: level.id.trim(),
    label: level.label.trim(),
  };
}

export function validateUserIndustryData(data: any): UserIndustryData {
  if (!data || typeof data !== 'object') {
    throw new IndustryValidationError('Industry data must be an object', 'root');
  }
  
  // Validate required fields
  if (typeof data.raw !== 'string') {
    throw new IndustryValidationError('raw must be a string', 'raw');
  }
  
  if (typeof data.normalized !== 'string') {
    throw new IndustryValidationError('normalized must be a string', 'normalized');
  }
  
  // Validate L1 (required)
  const category = validateIndustryLevel(data.category, 'category');
  
  // Validate L2 (required)
  const segment = validateIndustryLevel(data.segment, 'segment');
  
  // Validate L3 (optional)
  let niche: IndustryLevel | null = null;
  if (data.niche) {
    niche = validateIndustryLevel(data.niche, 'niche');
  }
  
  // Validate metadata
  if (typeof data.confidence !== 'number' || data.confidence < 0 || data.confidence > 100) {
    throw new IndustryValidationError(
      'confidence must be a number between 0 and 100',
      'confidence'
    );
  }
  
  const validSources = ['seed', 'ontology', 'ai', 'fallback'];
  if (!validSources.includes(data.source)) {
    throw new IndustryValidationError(
      `source must be one of: ${validSources.join(', ')}`,
      'source'
    );
  }
  
  return {
    raw: data.raw.trim(),
    normalized: data.normalized.trim(),
    category,
    segment,
    niche,
    confidence: data.confidence,
    source: data.source,
    updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
  };
}

// Sanitize user input to prevent XSS
export function sanitizeIndustryInput(input: string): string {
  return input
    .trim()
    .replace(/[<>{}[\]\\]/g, '')  // Remove potential XSS characters
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .slice(0, 200);                // Max length
}
