export * from './schema';
export * from './constants';
export * from './utils';
export * from './gamification';
// DEPRECATED — legacy static game catalog for IcebreakerToolkit only.
// See docs/icebreaker-system.md §2 and packages/shared/src/icebreakerGames.ts
// for full deprecation notice. Do not use for new Social Icebreaker phases.
export * from './icebreakerGames';
export * from './microChallengeTemplates';
export * from './icebreakerRunPlan';
export * from './topicCards';
export * from './wsEvents';
export * from './interests';
export * from './matchingWeights';
export { 
  type Industry,
  type Occupation,
  type WorkModeOption,
  WORK_MODES,
  INDUSTRIES,
  OCCUPATIONS,
  PINYIN_MAP,
  OCCUPATION_ID_TO_NAME,
  INDUSTRY_ID_TO_LABEL,
  OCCUPATION_STATS,
  WORK_MODE_TO_LABEL,
  OCCUPATION_TO_FIELD_SUGGESTIONS,
  getOccupationById,
  getIndustryById,
  getOccupationsByIndustry,
  getHotOccupations,
  searchOccupations,
  getOccupationGuidance,
  getOccupationDisplayLabel,
  getIndustryDisplayLabel,
  getSuggestedFieldsOfStudy,
  getDefaultFieldOfStudy,
  getIndustryLabel,
  getIndustryId
} from './occupations';
export * from './atmospherePrediction';
export * from './districts';
export * from './personality';
export * from './types/industry';
export * from './types/groupAnalysis';
export * from './eventDetail';
export * from './groupAnalysis';
export * from './api';
export * from './iconSystem';
export * from './onboarding';
export * from './archetypeColors';
export * from './archetypeColorTokens';
export * from './achievements';
export * from './hongKongTime';
export * from './centerTabRouting';
export * from './legal/joyjoinTermsZh';

export * from './miniscriptCatalog';
export * from './miniscriptStoryFramework';
export * from './miniscriptGameModes';
export * from './schemaAnalytics';
export * from './aiModels';
