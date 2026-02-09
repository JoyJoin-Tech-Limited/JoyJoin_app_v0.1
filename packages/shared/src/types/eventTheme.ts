/**
 * Event Theme Type Definitions
 * 事件主题类型定义
 * 
 * Mystery box (盲盒主题) experience design for matched groups
 */

/**
 * Event Theme Output Schema
 * 
 * Example:
 * {
 *   theme: "高能充电站：柯基×狐狸的周末探险",
 *   subtitle: "广州老乡的咖啡×人脉派对",
 *   vibe: "🔥 超高能 (88分)",
 *   emoji: "⚡"
 * }
 */
export interface EventTheme {
  /** Main theme (12-18 characters, mysterious, archetype-led) */
  theme: string;
  
  /** Subtitle (15-25 characters, grounding, concrete) */
  subtitle: string;
  
  /** Vibe indicator (energy emoji + level) */
  vibe: string;
  
  /** Single emoji */
  emoji: string;
  
  /** Full reasoning with data provenance */
  reasoning: string;
  
  /** Data sources used (for debugging) */
  dataSources: {
    archetype?: string;
    interests?: string;
    hometown?: string;
    industry?: string;
    intent?: string;
    age?: string;
  };
}

/**
 * Theme Component after scoring
 */
export interface ThemeComponent {
  dimension: 'archetype' | 'interests' | 'intent' | 'hometown' | 'industry' | 'age';
  usageType: 'theme-lead' | 'subtitle-ground' | 'bonus';
  mysteryValue: number;    // 0-100
  groundingValue: number;  // 0-100
  finalScore: number;      // weighted score
  data: any;               // actual data (archetype names, interests, etc.)
  dataSource: string;      // file path + line numbers
}

/**
 * Dimension Data after extraction
 */
export interface DimensionData {
  archetype?: {
    pattern: 'homogeneous' | 'complementary' | 'diverse';
    primaryArchetypes: string[];
    secondaryArchetypes: string[];
    avgEnergy: number;
    energyDistribution: { high: number; medium: number; low: number };
    dynamics: string; // "柯基×狐狸" or "柯基的快乐派对"
  };
  
  interests?: {
    commonInterests: Array<{
      name: string;
      count: number;
      avgHeat: number;
    }>;
    topInterest?: {
      name: string;
      count: number;
      avgHeat: number;
    };
  };
  
  intent?: {
    dominantIntent?: string;
    count: number;
    mixed: boolean;
  };
  
  hometown?: {
    commonCity?: string;
    count: number;
  };
  
  industry?: {
    commonIndustry?: string;
    count: number;
  };
  
  age?: {
    avgAge?: number;
    range?: string;
  };
}

/**
 * Raw member data for theme generation
 */
export interface MemberProfile {
  userId: string;
  
  // From users table
  archetype: string | null;
  secondaryArchetype: string | null;
  gender: string | null;
  birthYear: string | null;
  industryNicheLabel: string | null;
  hometownRegionCity: string | null;
  currentCity: string | null;
  intent: string[] | null;
  
  // From user_interests table
  interests?: Array<{
    topicId: string;
    label: string;
    heat: number;
    level: number;
  }>;
}

/**
 * LLM Prompt Input
 */
export interface ThemeLLMInput {
  // Theme elements (mysterious, for main theme)
  archetypeDynamics?: string;
  avgEnergy?: number;
  pattern?: string;
  additionalThemeElement?: string;
  
  // Grounding elements (concrete, for subtitle)
  hometown?: { city: string; count: number };
  intent?: { intent: string; count: number };
  interest?: { name: string; count: number; avgHeat: number };
  
  // Energy profile
  energyProfile: {
    avgEnergy: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    pattern: string;
  };
  
  // Context
  eventType: string;
  city: string;
  memberCount: number;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Theme generation analytics
 */
export interface ThemeGenerationMetrics {
  attempt: number;
  latency: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  passedValidation: boolean;
  validationErrors: string[];
  usedFallback: boolean;
  themeLength: number;
  subtitleLength: number;
  hasArchetype: boolean;
  energyAlignment: boolean;
  top1Dimension: string;
  top2Dimension: string;
  top3Dimension: string;
  avgEnergy: number;
  chemistryPattern: string;
  memberCount: number;
}
