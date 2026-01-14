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

/**
 * Decode HTML entities to prevent bypass attacks
 * Handles common entities like &lt; &#60; &amp; etc.
 */
function decodeHTMLEntities(text: string): string {
  // Decode named entities
  const namedEntities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  
  let decoded = text;
  
  // Replace named entities
  Object.entries(namedEntities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  });
  
  // Decode numeric entities (&#60; &#x3C; etc.)
  decoded = decoded.replace(/&#(\d+);/g, (_, code) => 
    String.fromCharCode(parseInt(code, 10))
  );
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, code) => 
    String.fromCharCode(parseInt(code, 16))
  );
  
  return decoded;
}

/**
 * Sanitize user input to prevent XSS attacks
 * Decodes HTML entities first to prevent bypass, then removes dangerous characters
 */
export function sanitizeIndustryInput(input: string): string {
  return input
    .trim()
    // First decode any HTML entities to prevent bypass attacks
    .replace(/&[a-z]+;|&#\d+;|&#x[0-9a-f]+;/gi, (match) => {
      const decoded = decodeHTMLEntities(match);
      // If decoded contains dangerous chars, remove the entire entity
      return /[<>{}[\]\\]/.test(decoded) ? '' : decoded;
    })
    .replace(/[<>{}[\]\\]/g, '')  // Remove potential XSS characters
    .replace(/\s+/g, ' ')          // Normalize whitespace
    .slice(0, 200);                // Max length
}
