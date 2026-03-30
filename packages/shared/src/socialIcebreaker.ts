// Social Icebreaker System - Shared Types

export type SocialIcebreakerPhase =
  | 'warmup'
  | 'micro_challenge'
  | 'lie_detective'
  | 'auction'
  | 'personality_dice'
  | 'mini_script_beta'
  | 'recap';

export type AtmosphereMood = 'relaxed' | 'funny' | 'life' | 'emotional';

export interface SocialTopic {
  id: string;
  question: string;
  mood: AtmosphereMood;
  emoji: string;
}

export interface MicroChallenge {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  completionCTA: string;
  visualHint?: string;
}

export interface LieDetectiveStatement {
  index: number; // 1, 2, or 3
  text: string;
  isLie: boolean; // only known server-side / to owner
}

export interface LieDetectivePlayer {
  userId: string;
  displayName: string;
  statements: Array<{ index: number; text: string }>; // isLie hidden from others
}

export interface LieDetectiveVote {
  voterId: string;
  targetUserId: string;
  guessedStatementIndex: number;
}

export interface PersonalityDiceChallenge {
  userId: string;
  displayName: string;
  archetype?: string;
  dominantTrait: 'A' | 'C' | 'E' | 'O' | 'X' | 'P';
  challengeTitle: string;
  challengeBody: string;
  challengeEmoji: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface PulseCheckResult {
  userId: string;
  vibe: 1 | 2 | 3; // 1=cold, 2=warm, 3=fire
}

export interface SocialSessionState {
  socialSessionId: string;
  icebreakerSessionId: string;
  currentPhase: SocialIcebreakerPhase;
  hostUserId: string;
  hostDisplayName: string;
  playerCount: number;
  phaseStartedAt: number; // timestamp of current phase start
  sessionStartedAt: number; // timestamp of session creation
  completedPhases: SocialIcebreakerPhase[];
  eventType?: string;
  enabledPhases?: SocialIcebreakerPhase[];
  // Per-phase data
  warmupTopics?: SocialTopic[];
  currentTopicIndex?: number;
  selectedMood?: AtmosphereMood;
  currentChallenge?: MicroChallenge;
  challengeCompletedBy?: string[];
  lieDetectivePlayers?: LieDetectivePlayer[];
  currentLieDetectivePlayerIndex?: number;
  votes?: LieDetectiveVote[];
  pulseChecks?: PulseCheckResult[];
  // PersonalityDice phase data
  personalityDiceChallenges?: PersonalityDiceChallenge[];
  currentDicePlayerIndex?: number;
  diceCompletedBy?: string[];
  // Recap data
  recapData?: {
    topicsDiscussed: string[];
    challengesCompleted: number;
    lieDetectiveWinner?: string;
    funMoments: string[];
  };
}

// Phase config
export const PHASE_CONFIG = {
  warmup: {
    emoji: '🌅',
    name: '热身',
    nameEn: 'Warmup',
    gradient: 'from-amber-400 to-orange-400',
    bgGradient: 'from-amber-50 via-rose-50 to-purple-50',
    darkBgGradient: 'from-zinc-900 via-amber-950 to-zinc-900',
    pillColor: 'bg-amber-100/80 text-amber-700',
    timeoutMinutes: 20,
    minPlayersRequired: 2,
  },
  micro_challenge: {
    emoji: '⚡',
    name: '挑战',
    nameEn: 'Challenge',
    gradient: 'from-cyan-400 to-blue-500',
    bgGradient: 'from-cyan-50 via-blue-50 to-indigo-50',
    darkBgGradient: 'from-cyan-950 via-blue-950 to-zinc-900',
    pillColor: 'bg-cyan-100/80 text-cyan-700',
    timeoutMinutes: 15,
    minPlayersRequired: 2,
  },
  lie_detective: {
    emoji: '🕵️',
    name: '侦探',
    nameEn: 'Lie Detective',
    gradient: 'from-purple-500 to-violet-600',
    bgGradient: 'from-slate-900 via-purple-950 to-slate-900',
    darkBgGradient: 'from-slate-900 via-purple-950 to-slate-900',
    pillColor: 'bg-purple-900/80 text-purple-300 border border-purple-700',
    timeoutMinutes: 25,
    minPlayersRequired: 3,
  },
  auction: {
    emoji: '🎪',
    name: '拍卖',
    nameEn: 'Auction',
    gradient: 'from-amber-500 to-orange-600',
    bgGradient: 'from-yellow-50 via-orange-50 to-rose-50',
    darkBgGradient: 'from-yellow-950 via-orange-950 to-zinc-900',
    pillColor: 'bg-yellow-400 text-yellow-900 font-black',
    timeoutMinutes: 30,
    minPlayersRequired: 3,
  },
  personality_dice: {
    emoji: '🎲',
    name: '骰子',
    nameEn: 'Personality Dice',
    gradient: 'from-pink-500 to-fuchsia-600',
    bgGradient: 'from-pink-50 via-fuchsia-50 to-purple-50',
    darkBgGradient: 'from-pink-950 via-fuchsia-950 to-zinc-900',
    pillColor: 'bg-pink-100/80 text-pink-700',
    timeoutMinutes: 15,
    minPlayersRequired: 2,
  },
  mini_script_beta: {
    emoji: '🧪',
    name: '剧本杀β',
    nameEn: 'Mini Script Beta',
    gradient: 'from-indigo-500 to-slate-700',
    bgGradient: 'from-indigo-50 via-slate-50 to-violet-50',
    darkBgGradient: 'from-slate-950 via-indigo-950 to-zinc-900',
    pillColor: 'bg-indigo-100/80 text-indigo-700 border border-indigo-300',
    timeoutMinutes: 20,
    minPlayersRequired: 4,
  },
  recap: {
    emoji: '✨',
    name: '回顾',
    nameEn: 'Recap',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
    darkBgGradient: 'from-violet-950 via-purple-950 to-zinc-900',
    pillColor: 'bg-violet-100/80 text-violet-700',
    timeoutMinutes: 5,
    minPlayersRequired: 1,
  },
} as const;

export const PHASE_ORDER: SocialIcebreakerPhase[] = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'mini_script_beta',
  'recap',
];

export const MVP_PHASES: SocialIcebreakerPhase[] = ['warmup', 'micro_challenge', 'lie_detective'];

export const DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES: SocialIcebreakerPhase[] = [
  ...MVP_PHASES,
  'personality_dice',
];

export function getNextPhase(
  current: SocialIcebreakerPhase,
  enabledPhases: SocialIcebreakerPhase[]
): SocialIcebreakerPhase | 'recap' {
  const idx = enabledPhases.indexOf(current);
  if (idx === -1 || idx === enabledPhases.length - 1) return 'recap';
  return enabledPhases[idx + 1];
}

export function getNextEligiblePhase(
  current: SocialIcebreakerPhase,
  enabledPhases: SocialIcebreakerPhase[],
  playerCount: number
): SocialIcebreakerPhase | 'recap' {
  let candidate = getNextPhase(current, enabledPhases);

  while (candidate !== 'recap') {
    if (playerCount >= PHASE_CONFIG[candidate].minPlayersRequired) {
      return candidate;
    }
    candidate = getNextPhase(candidate, enabledPhases);
  }

  return 'recap';
}
