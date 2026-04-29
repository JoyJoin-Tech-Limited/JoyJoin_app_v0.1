// Phase Registry — Client-safe catalog of all shipped phase modules

import type { PhaseModule, IcebreakerRunPlan } from './phaseModule';
import type { SocialIcebreakerPhase } from './socialIcebreaker';

export const PHASE_REGISTRY: Record<SocialIcebreakerPhase, PhaseModule> = {
  warmup: {
    id: 'warmup',
    name: '热身',
    nameEn: 'Warmup',
    emoji: '🌅',
    durationMinutes: 8,
    minPlayers: 2,
    category: 'conversation',
    energyArc: 'warmup',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'pass_ok',
    tone: 'gentle',
    gradient: 'from-amber-400 to-orange-400',
    bgGradient: 'from-amber-50 via-rose-50 to-purple-50',
    darkBgGradient: 'from-zinc-900 via-amber-950 to-zinc-900',
    pillColor: 'bg-amber-100/80 text-amber-700',
  },
  micro_challenge: {
    id: 'micro_challenge',
    name: '挑战',
    nameEn: 'Challenge',
    emoji: '⚡',
    durationMinutes: 8,
    minPlayers: 2,
    category: 'game',
    energyArc: 'rising',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'full',
    tone: 'playful',
    gradient: 'from-cyan-400 to-blue-500',
    bgGradient: 'from-cyan-50 via-blue-50 to-indigo-50',
    darkBgGradient: 'from-cyan-950 via-blue-950 to-zinc-900',
    pillColor: 'bg-cyan-100/80 text-cyan-700',
  },
  lie_detective: {
    id: 'lie_detective',
    name: '谎言侦探',
    nameEn: 'Lie Detective',
    emoji: '',
    durationMinutes: 15,
    minPlayers: 3,
    category: 'deduction',
    energyArc: 'peak',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: false,
    participation: 'full',
    tone: 'playful',
    gradient: 'from-purple-500 to-violet-600',
    bgGradient: 'from-slate-900 via-purple-950 to-slate-900',
    darkBgGradient: 'from-slate-900 via-purple-950 to-slate-900',
    pillColor: 'bg-purple-900/80 text-purple-300 border border-purple-700',
  },
  auction: {
    id: 'auction',
    name: '拍卖',
    nameEn: 'Auction',
    emoji: '🎪',
    durationMinutes: 20,
    minPlayers: 3,
    category: 'competition',
    energyArc: 'peak',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'full',
    tone: 'competitive',
    gradient: 'from-amber-500 to-orange-600',
    bgGradient: 'from-yellow-50 via-orange-50 to-rose-50',
    darkBgGradient: 'from-yellow-950 via-orange-950 to-zinc-900',
    pillColor: 'bg-yellow-400 text-yellow-900 font-black',
  },
  personality_dice: {
    id: 'personality_dice',
    name: '人格骰子',
    nameEn: 'Personality Dice',
    emoji: '🎲',
    durationMinutes: 12,
    minPlayers: 2,
    category: 'creative',
    energyArc: 'rising',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'pass_ok',
    tone: 'playful',
    gradient: 'from-pink-500 to-fuchsia-600',
    bgGradient: 'from-pink-50 via-fuchsia-50 to-purple-50',
    darkBgGradient: 'from-pink-950 via-fuchsia-950 to-zinc-900',
    pillColor: 'bg-pink-100/80 text-pink-700',
  },
  mini_script: {
    id: 'mini_script',
    name: '迷你剧本杀',
    nameEn: 'Mini Script',
    emoji: '🎭',
    durationMinutes: 25,
    minPlayers: 4,
    maxPlayers: 6,
    category: 'narrative',
    energyArc: 'peak',
    requiresGeneration: true,
    generationLeadTimeMinutes: 1440, // 24h — complex JSON generation
    canBeSkipped: false,
    participation: 'full',
    tone: 'dramatic',
    gradient: 'from-indigo-500 to-slate-700',
    bgGradient: 'from-indigo-50 via-slate-50 to-violet-50',
    darkBgGradient: 'from-slate-950 via-indigo-950 to-zinc-900',
    pillColor: 'bg-indigo-100/80 text-indigo-700 border border-indigo-300',
  },
  quip_battle: {
    id: 'quip_battle',
    name: '机智对决',
    nameEn: 'Quip Battle',
    emoji: '',
    durationMinutes: 12,
    minPlayers: 2,
    category: 'creative',
    energyArc: 'rising',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'full',
    tone: 'playful',
    gradient: 'from-yellow-400 to-orange-500',
    bgGradient: 'from-yellow-50 via-orange-50 to-amber-50',
    darkBgGradient: 'from-yellow-950 via-orange-950 to-zinc-900',
    pillColor: 'bg-yellow-100/80 text-yellow-700',
  },
  undercover_word: {
    id: 'undercover_word',
    name: '谁是卧底',
    nameEn: 'Undercover Word',
    emoji: '🕵️',
    durationMinutes: 12,
    minPlayers: 3,
    category: 'deduction',
    energyArc: 'peak',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'full',
    tone: 'playful',
    gradient: 'from-red-500 to-rose-600',
    bgGradient: 'from-red-50 via-rose-50 to-pink-50',
    darkBgGradient: 'from-red-950 via-rose-950 to-zinc-900',
    pillColor: 'bg-red-100/80 text-red-700',
  },
  group_mirror: {
    id: 'group_mirror',
    name: '群像镜像',
    nameEn: 'Group Mirror',
    emoji: '',
    durationMinutes: 10,
    minPlayers: 2,
    category: 'creative',
    energyArc: 'warmup',
    requiresGeneration: true,
    generationLeadTimeMinutes: 60,
    canBeSkipped: true,
    participation: 'full',
    tone: 'gentle',
    gradient: 'from-teal-400 to-cyan-500',
    bgGradient: 'from-teal-50 via-cyan-50 to-sky-50',
    darkBgGradient: 'from-teal-950 via-cyan-950 to-zinc-900',
    pillColor: 'bg-teal-100/80 text-teal-700',
  },
  recap: {
    id: 'recap',
    name: '回顾',
    nameEn: 'Recap',
    emoji: '✨',
    durationMinutes: 5,
    minPlayers: 1,
    category: 'conversation',
    energyArc: 'falling',
    requiresGeneration: true,
    generationLeadTimeMinutes: 0, // generated at end of session
    canBeSkipped: false,
    participation: 'observe_ok',
    tone: 'gentle',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
    darkBgGradient: 'from-violet-950 via-purple-950 to-zinc-900',
    pillColor: 'bg-violet-100/80 text-violet-700',
  },
} as const;

export function getPhaseModule(phase: SocialIcebreakerPhase): PhaseModule {
  return PHASE_REGISTRY[phase];
}

export function getAllPhaseModules(): PhaseModule[] {
  return Object.values(PHASE_REGISTRY);
}

export function getPhasesByCategory(category: PhaseModule['category']): PhaseModule[] {
  return getAllPhaseModules().filter((m) => m.category === category);
}

export function getPhasesByEnergyArc(arc: PhaseModule['energyArc']): PhaseModule[] {
  return getAllPhaseModules().filter((m) => m.energyArc === arc);
}

export function getDefaultStandardFlow(): SocialIcebreakerPhase[] {
  return ['warmup', 'micro_challenge', 'lie_detective', 'personality_dice', 'mini_script', 'recap'];
}

export function getDefaultBarFlow(): SocialIcebreakerPhase[] {
  return ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'recap'];
}

/** Default 80-minute Standard Run Plan compiled from PHASE_REGISTRY modules. */
export const DEFAULT_STANDARD_RUN_PLAN: IcebreakerRunPlan = {
  version: 2,
  segments: [
    { phase: 'warmup', allocatedMinutes: 8, energyWeight: 1, participation: 'full', tone: 'gentle' },
    { phase: 'micro_challenge', allocatedMinutes: 8, energyWeight: 2, participation: 'full', tone: 'playful' },
    { phase: 'lie_detective', allocatedMinutes: 15, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'personality_dice', allocatedMinutes: 12, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'mini_script', allocatedMinutes: 25, energyWeight: 3, participation: 'full', tone: 'playful' },
    { phase: 'recap', allocatedMinutes: 5, energyWeight: 1, participation: 'observe_ok', tone: 'gentle' },
  ],
  totalMinutes: 73, // 73 allocated + 7 buffer = 80
  compilerId: 'default-standard-v1',
  compiledAt: new Date().toISOString(),
};

export function validateRunPlanSegments(segments: { phase: SocialIcebreakerPhase }[]): boolean {
  // Every segment must reference a known phase
  return segments.every((s) => s.phase in PHASE_REGISTRY);
}
