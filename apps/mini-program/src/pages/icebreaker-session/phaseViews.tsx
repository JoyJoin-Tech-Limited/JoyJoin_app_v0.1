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

// Phase views (PhaseHeroCard visual system, PR2/PR3 2026-07-17)
export { WarmupPhaseView } from './phases/WarmupPhaseView'
export { MicroChallengeHeroView } from './phases/MicroChallengeHeroView'
export { LieDetectiveHeroView } from './phases/LieDetectiveHeroView'
export { PersonalityDiceHeroView } from './phases/PersonalityDiceHeroView'
export { SpeedFriendingHeroView } from './phases/SpeedFriendingHeroView'
export { QuipBattleHeroView } from './phases/QuipBattleHeroView'
export { UndercoverWordHeroView } from './phases/UndercoverWordHeroView'
export { GroupMirrorHeroView } from './phases/GroupMirrorHeroView'
export { AuctionHeroView } from './phases/AuctionHeroView'
export { MiniScriptHeroView } from './phases/MiniScriptHeroView'
export { FallbackPhaseView } from './phases/FallbackPhaseView'
export { RecapPhaseView } from './phases/RecapPhaseView'
