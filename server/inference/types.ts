/**
 * 智能推断引擎 - 核心类型定义
 * 用于消除小悦对话中的重复问题
 */

// ============ 属性状态 ============

export interface AttributeState {
  value: string | number | boolean | string[];
  source: 'explicit' | 'inferred';  // 显式提供 vs 推断
  confidence: number;                // 0-1 置信度
  evidence: string;                  // 证据（哪句话推出来的）
  timestamp: Date;
}

export type UserAttributeMap = Record<string, AttributeState>;

// ============ 推断结果 ============

export interface InferredAttribute {
  field: string;
  value: string;
  confidence: number;
  evidence: string;
  reasoning?: string;  // 推理过程
}

export interface ConflictInfo {
  field: string;
  existingValue: string;
  newValue: string;
  resolution: 'keep_existing' | 'use_new' | 'needs_clarification';
  reason: string;
}

export interface InferenceResult {
  // 显式提取的信息
  extracted: Record<string, string>;
  
  // 推断的属性
  inferred: InferredAttribute[];
  
  // 检测到的冲突
  conflicts: ConflictInfo[];
  
  // 应该跳过的问题（高置信度已知）
  skipQuestions: string[];
  
  // 应该用确认式提问的字段（中等置信度）
  confirmQuestions: Array<{
    field: string;
    template: string;
    inferredValue: string;
  }>;
  
  // 调试信息
  debug?: {
    matcherHit: boolean;
    llmCalled: boolean;
    processingTimeMs: number;
  };
}

// ============ 推断规则 ============

export interface InferenceRule {
  id: string;
  name: string;
  
  // 触发条件
  trigger: {
    type: 'keyword' | 'pattern' | 'entity' | 'combination';
    keywords?: string[];
    pattern?: RegExp | string;
    requiredFields?: string[];  // 组合推断需要的前置字段
  };
  
  // 推断结果
  infers: {
    field: string;
    value: string | null;  // null = 需要从上下文判断
    confidence: number;
    decayRate?: number;    // 链式传播时的衰减率
  }[];
  
  // 排除条件（否定表达）
  excludePatterns?: string[];
  
  // 优先级（数字越大优先级越高）
  priority: number;
  
  // 是否忽略时态检查（用于海归、转折句式等需要绕过过去时态限制的规则）
  ignoreTemporal?: boolean;
}

// ============ 知识图谱节点 ============

export interface KnowledgeNode {
  id: string;
  type: 'company' | 'city' | 'industry' | 'occupation' | 'school' | 'country';
  name: string;
  aliases: string[];  // 别名
  properties: Record<string, any>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  relation: 'belongs_to' | 'located_in' | 'implies' | 'associated_with';
  weight: number;  // 关系强度 0-1
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: KnowledgeEdge[];
}

// ============ 同义词映射 ============

export interface SynonymGroup {
  canonical: string;  // 标准形式
  variants: string[]; // 变体
  field?: string;     // 对应的属性字段
  value?: string;     // 对应的属性值
}

// ============ 模拟用户场景 ============

export interface SimulatedUserProfile {
  id: string;
  persona: 'entrepreneur' | 'student' | 'corporate' | 'returnee' | 'freelancer' | 
           'homemaker' | 'jobSeeker' | 'healthcare' | 'creative' | 'retiree';
  
  // 真实属性（用于验证推断准确性）
  groundTruth: {
    lifeStage?: string;
    industry?: string;
    city?: string;
    occupation?: string;
    education?: string;
    age?: number;
    gender?: string;
    isReturnee?: boolean;
    languages?: string[];
    relationshipStatus?: string;
  };
  
  // 语言变体
  linguisticStyle: 'direct' | 'implicit' | 'negative' | 'dialect' | 'mixed' | 
                   'doubleNegative' | 'hypothetical' | 'thirdPerson' | 'contradiction';
}

export interface SimulatedDialogueTurn {
  role: 'user' | 'assistant';
  content: string;
  
  // 这轮对话中包含的可推断信息
  containsInferableInfo?: {
    field: string;
    value: string;
    expressionType: 'explicit' | 'implicit' | 'negation';
  }[];
}

export interface SimulatedScenario {
  id: string;
  profile: SimulatedUserProfile;
  dialogue: SimulatedDialogueTurn[];
  
  // 评估标记
  expectedInferences: InferredAttribute[];
  potentialDuplicateQuestions: string[];  // 如果系统问了这些就是重复
}

// ============ 评估指标 ============

export interface EvaluationMetrics {
  // 核心指标
  duplicateQuestionRate: number;      // 重复问题率
  inferenceAccuracy: number;          // 推断准确率
  inferenceCoverage: number;          // 推断覆盖率
  averageDialogueTurns: number;       // 平均对话轮数
  
  // 详细统计
  totalScenarios: number;
  totalInferences: number;
  correctInferences: number;
  incorrectInferences: number;
  missedInferences: number;
  duplicateQuestionsAsked: number;
  
  // 按用户类型分类
  byPersona: Record<string, {
    accuracy: number;
    duplicateRate: number;
  }>;
  
  // 按语言风格分类
  byLinguisticStyle: Record<string, {
    accuracy: number;
    duplicateRate: number;
  }>;
}

// ============ 推断引擎配置 ============

export interface InferenceEngineConfig {
  // 置信度阈值
  skipThreshold: number;      // 高于此值直接跳过问题 (默认 0.85)
  confirmThreshold: number;   // 高于此值用确认式提问 (默认 0.6)
  
  // 性能配置
  enableLLMFallback: boolean; // 是否启用LLM回退
  maxLLMLatencyMs: number;    // LLM最大延迟
  
  // 调试配置
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export const DEFAULT_CONFIG: InferenceEngineConfig = {
  skipThreshold: 0.85,
  confirmThreshold: 0.6,
  enableLLMFallback: true,
  maxLLMLatencyMs: 3000,
  enableLogging: true,
  logLevel: 'info',
};
