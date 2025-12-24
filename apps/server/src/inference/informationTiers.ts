/**
 * 三层信息漏斗系统 (3-Tier Information Funnel)
 * 
 * 基于10位社交达人建议设计：
 * - L1: 显式必要信息 (Explicit Fundamentals) - 小悦直接问
 * - L2: 自然丰富信息 (Natural Enrichment) - 对话中巧妙引出
 * - L3: 隐藏推断洞察 (Hidden Insights) - AI静默推断
 * 
 * 匹配算法权重映射：
 * - L1 → 硬约束过滤
 * - L2 → 兼容度计算 (40%)
 * - L3 → 化学反应微调 (15%)
 */

// ============ 信息层级定义 ============

export type InformationTier = 'L1' | 'L2' | 'L3';

export interface TierFieldConfig {
  field: string;
  tier: InformationTier;
  label: string;
  required: boolean;
  collectionMethod: 'explicit' | 'natural' | 'inferred';
  matchingRole: 'hard_filter' | 'compatibility' | 'chemistry';
  weight?: number;
}

// ============ L1: 显式必要信息 ============

export interface Level1Fundamentals {
  displayName: string;
  phoneNumber: string;
  gender: 'male' | 'female' | 'other';
  ageRange: '18-24' | '25-29' | '30-34' | '35-39' | '40-49' | '50+';
  currentCity: string;
  hometownProvince: string;
  languagePreference: ('cantonese' | 'mandarin' | 'english')[];
}

// L1 字段配置
export const L1_FIELDS: TierFieldConfig[] = [
  { field: 'displayName', tier: 'L1', label: '昵称', required: true, collectionMethod: 'explicit', matchingRole: 'hard_filter' },
  { field: 'phoneNumber', tier: 'L1', label: '手机号', required: true, collectionMethod: 'explicit', matchingRole: 'hard_filter' },
  { field: 'gender', tier: 'L1', label: '性别', required: true, collectionMethod: 'explicit', matchingRole: 'hard_filter' },
  { field: 'ageRange', tier: 'L1', label: '年龄段', required: true, collectionMethod: 'explicit', matchingRole: 'hard_filter' },
  { field: 'currentCity', tier: 'L1', label: '当前城市', required: true, collectionMethod: 'explicit', matchingRole: 'hard_filter' },
  { field: 'hometownProvince', tier: 'L1', label: '家乡省份', required: true, collectionMethod: 'explicit', matchingRole: 'compatibility', weight: 15 },
  { field: 'languagePreference', tier: 'L1', label: '语言偏好', required: true, collectionMethod: 'explicit', matchingRole: 'compatibility', weight: 10 },
];

// ============ L2: 自然丰富信息 ============

export interface Level2Enrichment {
  topInterests: string[];
  primaryInterests: string[];
  occupationHint: string;
  industryHint: string;
  intent: string[];
  activityTimePreference: string[];
  relationshipStatus: string;
  socialStyle: 'introvert' | 'extrovert' | 'ambivert';
  groupSizeComfort: 'small' | 'medium' | 'large' | 'flexible';
  educationLevel: string;
  seniority: string;
}

// L2 字段配置
export const L2_FIELDS: TierFieldConfig[] = [
  { field: 'topInterests', tier: 'L2', label: '兴趣爱好', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 24 },
  { field: 'primaryInterests', tier: 'L2', label: '核心兴趣', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 10 },
  { field: 'occupationHint', tier: 'L2', label: '职业方向', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 8 },
  { field: 'industryHint', tier: 'L2', label: '行业', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 5 },
  { field: 'intent', tier: 'L2', label: '社交意向', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 13 },
  { field: 'activityTimePreference', tier: 'L2', label: '活动时间偏好', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 5 },
  { field: 'relationshipStatus', tier: 'L2', label: '感情状态', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 5 },
  { field: 'socialStyle', tier: 'L2', label: '社交风格', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 8 },
  { field: 'groupSizeComfort', tier: 'L2', label: '群体规模舒适度', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 5 },
  { field: 'educationLevel', tier: 'L2', label: '学历', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 3 },
  { field: 'seniority', tier: 'L2', label: '资历', required: false, collectionMethod: 'natural', matchingRole: 'compatibility', weight: 5 },
];

// ============ L3: 隐藏推断洞察 ============

export interface DialectProfile {
  cantonese: number;
  mandarin: number;
  hunan: number;
  teochew: number;
  hakka: number;
  sichuanese: number;
  northeastern: number;
  hokkien: number;
  shanghainese: number;
  primaryDialect: string | null;
  confidence: number;
}

export interface CommunicationStyle {
  formalityLevel: 'formal' | 'casual' | 'adaptive';
  humorType: 'witty' | 'silly' | 'dry' | 'none';
  expressionDepth: 'surface' | 'moderate' | 'deep';
  emojiFrequency: 'frequent' | 'occasional' | 'rare';
  messageLengthTendency: 'concise' | 'moderate' | 'elaborate';
}

export interface ConversationPattern {
  responseSpeed: 'fast' | 'moderate' | 'slow';
  topicEngagement: 'shallow' | 'moderate' | 'deep';
  questionTendency: 'questioner' | 'answerer' | 'balanced';
  initiativeLevel: 'proactive' | 'reactive' | 'balanced';
}

export interface EmotionalSignature {
  expressiveness: 'expressive' | 'reserved' | 'selective';
  stabilityIndicator: 'stable' | 'sensitive' | 'balanced';
  positivityTendency: 'optimistic' | 'neutral' | 'cautious';
  warmthLevel: 'warm' | 'neutral' | 'reserved';
}

export interface PersonalitySignals {
  extraversionHint: number;
  opennessHint: number;
  conscientiousnessHint: number;
  agreeablenessHint: number;
  emotionalStabilityHint: number;
  archetypeValidation: {
    suggestedArchetype: string | null;
    matchConfidence: number;
    divergenceFromTest: number;
  };
}

export interface Level3HiddenInsights {
  dialectProfile: DialectProfile;
  communicationStyle: CommunicationStyle;
  conversationPattern: ConversationPattern;
  emotionalSignature: EmotionalSignature;
  personalitySignals: PersonalitySignals;
  
  extractedAt: string;
  messageCount: number;
  overallConfidence: number;
}

// L3 字段配置
export const L3_FIELDS: TierFieldConfig[] = [
  { field: 'dialectProfile', tier: 'L3', label: '方言画像', required: false, collectionMethod: 'inferred', matchingRole: 'chemistry', weight: 5 },
  { field: 'communicationStyle', tier: 'L3', label: '沟通风格', required: false, collectionMethod: 'inferred', matchingRole: 'chemistry', weight: 4 },
  { field: 'conversationPattern', tier: 'L3', label: '对话模式', required: false, collectionMethod: 'inferred', matchingRole: 'chemistry', weight: 3 },
  { field: 'emotionalSignature', tier: 'L3', label: '情绪特征', required: false, collectionMethod: 'inferred', matchingRole: 'chemistry', weight: 2 },
  { field: 'personalitySignals', tier: 'L3', label: '性格信号', required: false, collectionMethod: 'inferred', matchingRole: 'chemistry', weight: 1 },
];

// ============ 完整用户信息画像 ============

export interface UserInformationProfile {
  userId: string;
  
  level1: Partial<Level1Fundamentals>;
  level2: Partial<Level2Enrichment>;
  level3: Partial<Level3HiddenInsights>;
  
  completeness: {
    l1Percentage: number;
    l2Percentage: number;
    l3Confidence: number;
    overallScore: number;
  };
  
  lastUpdated: string;
}

// ============ 收集进度追踪 ============

export interface CollectionProgress {
  currentTier: InformationTier;
  
  l1Collected: string[];
  l1Missing: string[];
  l1Complete: boolean;
  
  l2Collected: string[];
  l2Potential: string[];
  
  l3Signals: number;
  l3Confidence: number;
}

// ============ 匹配权重配置 ============

export interface TierMatchingWeights {
  l1HardFilters: {
    cityMatch: boolean;
    ageRangeOverlap: boolean;
    genderPreference: boolean;
    languageCompatible: boolean;
  };
  
  l2CompatibilityScore: number;
  l2MaxWeight: 40;
  
  l3ChemistryScore: number;
  l3MaxWeight: 15;
}

// ============ 工具函数 ============

export function calculateL1Completeness(data: Partial<Level1Fundamentals>): number {
  const requiredFields = L1_FIELDS.filter(f => f.required).map(f => f.field);
  const filledCount = requiredFields.filter(field => {
    const value = data[field as keyof Level1Fundamentals];
    return value !== undefined && value !== null && value !== '';
  }).length;
  return Math.round((filledCount / requiredFields.length) * 100);
}

export function calculateL2Completeness(data: Partial<Level2Enrichment>): number {
  const fields = L2_FIELDS.map(f => f.field);
  const filledCount = fields.filter(field => {
    const value = data[field as keyof Level2Enrichment];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }).length;
  return Math.round((filledCount / fields.length) * 100);
}

export function getCollectionProgress(profile: UserInformationProfile): CollectionProgress {
  const l1Collected = L1_FIELDS.filter(f => {
    const value = profile.level1[f.field as keyof Level1Fundamentals];
    return value !== undefined && value !== null;
  }).map(f => f.field);
  
  const l1Missing = L1_FIELDS.filter(f => f.required && !l1Collected.includes(f.field)).map(f => f.field);
  
  const l2Collected = L2_FIELDS.filter(f => {
    const value = profile.level2[f.field as keyof Level2Enrichment];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null;
  }).map(f => f.field);
  
  const l2Potential = L2_FIELDS.filter(f => !l2Collected.includes(f.field)).map(f => f.field);
  
  return {
    currentTier: l1Missing.length > 0 ? 'L1' : (l2Collected.length < 3 ? 'L2' : 'L3'),
    l1Collected,
    l1Missing,
    l1Complete: l1Missing.length === 0,
    l2Collected,
    l2Potential,
    l3Signals: profile.level3.dialectProfile ? 1 : 0,
    l3Confidence: profile.level3.dialectProfile?.confidence || 0,
  };
}

export function initializeEmptyProfile(userId: string): UserInformationProfile {
  return {
    userId,
    level1: {},
    level2: {},
    level3: {},
    completeness: {
      l1Percentage: 0,
      l2Percentage: 0,
      l3Confidence: 0,
      overallScore: 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function initializeDialectProfile(): DialectProfile {
  return {
    cantonese: 0,
    mandarin: 0,
    hunan: 0,
    teochew: 0,
    hakka: 0,
    sichuanese: 0,
    northeastern: 0,
    hokkien: 0,
    shanghainese: 0,
    primaryDialect: null,
    confidence: 0,
  };
}
