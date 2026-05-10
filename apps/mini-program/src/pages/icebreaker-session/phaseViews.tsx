// Barrel file: re-exports all phase views and shared utilities
// One phase = one file. Do not add component implementations here.

// Shared utilities (also re-exported for backward compat)
export type { SessionPhase, SessionParticipant } from './phaseUtils'
export {
  MOOD_OPTIONS,
  getPhaseLabel,
  PhaseHeaderIcon,
  getMoodLabel,
} from './phaseUtils'

// Expansion phase views (pre-existing standalone files)
export { default as QuipBattlePhaseView } from './phases/QuipBattlePhaseView'
export { default as UndercoverWordPhaseView } from './phases/UndercoverWordPhaseView'
export { default as GroupMirrorPhaseView } from './phases/GroupMirrorPhaseView'

// Core phase views (extracted from former phaseViews.tsx)
export { WarmupPhaseView } from './phases/WarmupPhaseView'
export { MicroChallengePhaseView } from './phases/MicroChallengePhaseView'
export { LieDetectivePhaseView } from './phases/LieDetectivePhaseView'
export { PersonalityDicePhaseView } from './phases/PersonalityDicePhaseView'
export { AuctionPhaseView, type AuctionBidRecordLocal } from './phases/AuctionPhaseView'
export { FallbackPhaseView } from './phases/FallbackPhaseView'
export { RecapPhaseView } from './phases/RecapPhaseView'
