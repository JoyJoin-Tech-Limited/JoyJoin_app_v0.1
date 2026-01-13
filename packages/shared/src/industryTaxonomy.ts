/**
 * JoyJoin Industry Taxonomy System
 * 
 * Three-tier classification: Category → Segment → Niche
 * 
 * Design Principles:
 * - Comprehensive coverage of Hong Kong-Shenzhen Bay Area occupations
 * - Chinese labels with synonyms for intelligent matching
 * - Priority-ordered for user selection UI
 * - Each category has visual icon for quick recognition
 * 
 * Data Structure:
 * - 15 main industry categories
 * - 82 industry segments  
 * - 234 industry niches (granular job functions)
 */

// ============ Type Definitions ============

export interface IndustryNiche {
  id: string;
  label: string;           // Chinese display name
  synonyms: string[];      // Alternative names, abbreviations
  keywords: string[];      // Search keywords
}

export interface IndustrySegment {
  id: string;
  label: string;
  niches: IndustryNiche[];
}

export interface IndustryCategory {
  id: string;
  label: string;
  icon: string;
  priority: number;
  segments: IndustrySegment[];
}

