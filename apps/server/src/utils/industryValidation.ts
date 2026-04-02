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
  
  const validSources = ['seed', 'ontology', 'ai', 'fallback', 'fuzzy', 'exact'];
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
  let text = input.trim();

  // Patterns matching encoded variants of < and >
  const ltEnt = '(?:&lt;|&#60;|&#x3[Cc];)';
  const gtEnt = '(?:&gt;|&#62;|&#x3[Ee];)';

  // Remove encoded opening HTML tags entirely (e.g. &lt;script&gt; → '')
  text = text.replace(new RegExp(`${ltEnt}([a-zA-Z][a-zA-Z0-9]*)${gtEnt}`, 'gi'), '');

  // Convert encoded closing HTML tags to just /tagname (e.g. &lt;/script&gt; → /script)
  text = text.replace(new RegExp(`${ltEnt}/([a-zA-Z][a-zA-Z0-9]*)${gtEnt}`, 'gi'), '/$1');

  // Handle remaining HTML entities – decode safe ones, drop dangerous ones
  text = text.replace(/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/gi, (match) => {
    const decoded = decodeHTMLEntities(match);
    return /[<>{}[\]\\]/.test(decoded) ? '' : decoded;
  });

  return text
    .replace(/[<>{}[\]\\"'()]/g, '')  // Remove XSS and dangerous chars including quotes and parens
    .replace(/ {3,}/g, ' ')           // Normalize runs of 3+ spaces (preserve 1-2 spaces)
    .trim()
    .slice(0, 200);
}
