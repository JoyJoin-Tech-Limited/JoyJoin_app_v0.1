export {
  matchingThresholds,
  poolMatchingLogs,
  matchHistory,
  archetypePairFeedbackStats,
  matchingConfig,
  insertMatchingConfigSchema,
  matchingResults,
  insertMatchingResultSchema,
} from './_definitions.js';

export {
  matchingShadowExperiments,
  insertMatchingShadowExperimentSchema,
  matchingWeightsConfig,
  matchingWeightsHistory,
  insertMatchingWeightsConfigSchema,
  insertMatchingWeightsHistorySchema,
} from './_definitions_extended.js';

export type {
  MatchingConfig,
  InsertMatchingConfig,
  MatchingResult,
} from './_definitions.js';

export type {
  InsertMatchingResult,
} from './_definitions_extended.js';

export type {
  MatchingShadowExperiment,
  InsertMatchingShadowExperiment,
  MatchingShadowComparison,
  MatchingShadowSummary,
  MatchingWeightsConfig,
  InsertMatchingWeightsConfig,
  MatchingWeightsHistory,
  InsertMatchingWeightsHistory,
} from './_definitions_extended.js';
