/**
 * Canonical essential-data step ids — the single source the voice-matrix
 * key mapping (`essential-${id}`) and STEP_CONFIG both derive from.
 * Parity with the onboarding voice matrix is locked by
 * essentialDataVoiceMap.test.ts.
 */
export const ESSENTIAL_DATA_STEP_IDS = [
  'displayName',
  'intent',
  'aboutYou',
  'professionalProfile',
  'location',
] as const

export type EssentialDataStepId = (typeof ESSENTIAL_DATA_STEP_IDS)[number]
