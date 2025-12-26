/**
 * 推断引擎模块入口
 * 导出所有公共接口
 */

// 类型
export type {
  AttributeState,
  UserAttributeMap,
  InferredAttribute,
  ConflictInfo,
  InferenceResult,
  InferenceRule,
  SynonymGroup,
  SimulatedScenario,
  SimulatedUserProfile,
  EvaluationMetrics,
  InferenceEngineConfig
} from './types';

export { DEFAULT_CONFIG } from './types';

// 核心引擎
export { 
  InferenceEngine, 
  inferenceEngine,
  quickInfer,
  fullInfer,
  generateXiaoyueContext,
  type InferenceEngineResult,
  type InferenceLog,
  type ProcessOptions
} from './engine';

// 异步推断队列
export {
  AsyncInferenceQueue,
  asyncInferenceQueue,
  type AsyncInferenceStatus
} from './asyncInferenceQueue';

// 语义匹配器
export { SemanticMatcher, semanticMatcher } from './semanticMatcher';

// LLM推理器
export { LLMReasoner, llmReasoner, type LLMReasonerResult } from './llmReasoner';

// 状态管理器
export { StateManager, stateManager } from './stateManager';

// 知识图谱
export { 
  findCompanyInfo, 
  findSchoolInfo, 
  findCityInfo,
  extractEntities,
  chainInference,
  COMPANY_KNOWLEDGE,
  SCHOOL_KNOWLEDGE,
  CITY_KNOWLEDGE
} from './knowledgeGraph';

// 同义词
export {
  LIFE_STAGE_SYNONYMS,
  INDUSTRY_SYNONYMS,
  RETURNEE_SYNONYMS,
  RELATIONSHIP_SYNONYMS,
  QUICK_INFERENCE_RULES,
  containsNegation,
  getTemporalContext,
  findCanonicalForm
} from './synonyms';

// 测试场景
export { 
  generateScenarios, 
  generateRealisticScenario,
  TEST_SCENARIOS 
} from './scenarios';

// 评估器
export { 
  InferenceEvaluator, 
  evaluator,
  runEvaluation 
} from './evaluator';
