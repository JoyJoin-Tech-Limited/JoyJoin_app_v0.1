// Social Icebreaker System - Shared Types

import { z } from 'zod';
import type { AIResponseMeta } from './types/aiMeta';
import type { ArchetypeHSL } from './archetypeColors';
import type { MiniScriptSolution, MiniScriptStoryFramework, MiniScriptStoryFrameworkPublic, MiniScriptVoteInput, MiniScriptVoteProgress } from './miniscriptStoryFramework';
export type { MiniScriptStoryFrameworkPublic } from './miniscriptStoryFramework';
import type { IcebreakerRunPlan } from './phaseModule';
import type { TierMachineId } from './socialIcebreakerTierManifest.js';

export type SocialIcebreakerPhase =
  | 'warmup'
  | 'micro_challenge'
  | 'lie_detective'
  | 'auction'
  | 'personality_dice'
  | 'quip_battle'
  | 'undercover_word'
  | 'group_mirror'
  | 'speed_friending'
  | 'mini_script'
  | 'recap'
  | 'phase_selection';

export type AtmosphereMood = 'relaxed' | 'funny' | 'life' | 'emotional';

export type SocialTopicDepthLevel = 1 | 2 | 3;
export type SocialTopicPromptStyle = 'binary' | 'experiential' | 'reflective';
export type SocialTopicSafety = 'gentle' | 'open' | 'reflective';

export interface SocialTopicPromptTiers {
  opener: string;
  followUp: string;
  reflection: string;
}

export interface SocialTopic {
  id: string;
  question: string;
  mood: AtmosphereMood;
  emoji: string;
  category?: string;
  depthLevel?: SocialTopicDepthLevel;
  promptStyle?: SocialTopicPromptStyle;
  safety?: SocialTopicSafety;
  /** 3-tier prompts for 深聊 vibe (opener → follow-up → reflection). */
  promptTiers?: SocialTopicPromptTiers;
  /** 悦仔说 permission whisper, server-selected from register-matched pool at generation. */
  permissionLine?: string | null;
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
  /** V2: true if this statement was AI-generated (server secret). */
  is_ai?: boolean;
  /** V2: the original user tag that this statement was expanded from (server secret). */
  source_tag?: string | null;
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
  /** Archetype accent color for ParticleBurst / UI theming */
  archetypeColor?: ArchetypeHSL;
  dominantTrait: 'A' | 'C' | 'E' | 'O' | 'X' | 'P';
  challengeTitle: string;
  challengeBody: string;
  challengeEmoji: string;
  difficulty: 'easy' | 'medium' | 'hard';
  /** Graceful opt-out text */
  passLine?: string;
  /** Funny consequence for passing */
  passConsequence?: string;
}

/** Choose-Your-Prompt variant: groups 3 difficulty-tiered dares per player.
 *  Behind PERSONALITY_DICE_CHOOSE_MODE_ENABLED. */
export interface PersonalityDiceChallengeGroup {
  userId: string;
  displayName: string;
  archetype?: string;
  /** Archetype accent color for ParticleBurst / UI theming */
  archetypeColor?: ArchetypeHSL;
  dominantTrait: 'A' | 'C' | 'E' | 'O' | 'X' | 'P';
  /** Exactly 3 options: difficulty easy, medium, hard */
  options: PersonalityDiceChallenge[];
}

/** Lightweight profile for AI prompt context. Server-only — stripped before client delivery. */
export interface SocialSessionParticipantProfile {
  /** 12-archetype ID (e.g. '社牛柯基') */
  archetype?: string | null;
  /** Industry niche label (e.g. '医疗AI', '社交产品') */
  industryLabel?: string | null;
  /** Approximate age derived from birthdate */
  age?: number | null;
  /** Current city (e.g. '深圳', '上海') */
  city?: string | null;
  /** Social energy label: 快热带动型, 慢热深聊型, etc. */
  stateLabel?: string | null;
  /** Gender: 女性, 男性, 不透露 */
  gender?: string | null;
  /** Education level (e.g. '本科', '硕士') */
  educationLevel?: string | null;
  /** Life stage (e.g. '职场新人', '创业中') */
  lifeStage?: string | null;
  /** Short bio / personal tagline (≤100 chars) — drives emotional depth */
  bio?: string | null;
  /** Preferred table atmosphere: 'light_fun' | 'natural_chat' | 'deep_talk' */
  tableVibePreference?: string | null;
}

export interface SocialSessionParticipantSummary {
  userId: string;
  displayName: string;
  /** Legacy Chinese display name (users.archetype), when present. */
  archetype?: string;
  /** Canonical 12-archetype ID (users.primary_archetype), e.g. 'corgi'. Preferred for icon/glyph lookup. */
  primaryArchetype?: string;
  /** Server-only: AI prompt context. Must be stripped before sending to clients. */
  profile?: SocialSessionParticipantProfile | null;
  joinedAt?: string;
  lastSeenAt?: string;
  isActive?: boolean;
}

export interface PulseCheckResult {
  userId: string;
  vibe: 1 | 2 | 3; // 1=cold, 2=warm, 3=fire
}

export interface LieDetectiveReveal {
  targetUserId: string;
  lieIndex: number;
  voteCount: number;
  correctVoteCount: number;
  revealedAt: number;
  /** V2: which statement was AI-generated (same as lieIndex in V2 mode). */
  aiStatementIndex?: number;
  /** V2: per-statement vote tallies. */
  voteCounts?: Record<number, number>;
}

/** Virtual-currency auction lots (no real-money semantics). */
export interface AuctionLot {
  id: string;
  title: string;
  teaser?: string;
  /** Optional emoji / category icon for visual presentation (D9) */
  emoji?: string;
}

export interface AuctionHighBid {
  userId: string;
  amount: number;
}

/** Persistent bid record for cross-session rejoin (D5) */
export interface AuctionBidRecord {
  userId: string;
  amount: number;
  at: number;
  lotIndex: number;
}

// ─── Undercover Word (谁是卧底) ────────────────────────────────────────────

export interface UndercoverWordPair {
  civilianWord: string;
  undercoverWord: string;
  category: string;
}

export interface UndercoverWordRound {
  roundNumber: number;
  descriptions: Array<{ userId: string; displayName: string; text: string }>;
}

export interface UndercoverWordVote {
  voterId: string;
  targetUserId: string;
}

export interface UndercoverWordResult {
  undercoverUserId: string;
  undercoverDisplayName: string;
  civilianWord: string;
  undercoverWord: string;
  voteCounts: Record<string, number>;
  caught: boolean;
}

// ─── Group Mirror (群像镜像) ───────────────────────────────────────────────

export interface GroupMirrorQuestion {
  id: string;
  questionText: string;
  category: 'perception' | 'memory' | 'prediction';
}

export interface GroupMirrorAnswer {
  userId: string;
  displayName: string;
  questionId: string;
  targetUserId: string; // who they think the question is about / best fits
  reasonText?: string;
}

export interface GroupMirrorResult {
  questionId: string;
  questionText: string;
  topTargetUserId: string;
  topTargetDisplayName: string;
  voteCount: number;
  totalVotes: number;
}

// ─── Speed Friending (快速配对) ─────────────────────────────────────────────

export interface SpeedFriendingPair {
  userIdA: string;
  userIdB: string;
  displayNameA: string;
  displayNameB: string;
  roundIndex: number;
}

export type SpeedFriendingRound = SpeedFriendingPair[];

/** Temporary in-session skill-role label assigned by Xiaoyue Session Pack. */
export interface XiaoyuePlayerSkillRole {
  userId: string;
  displayName: string;
  roleLabel: string;
  roleBlurb: string;
}

/** Per-phase coaching guidance from Xiaoyue Session Pack. */
export interface XiaoyuePhaseCoaching {
  toneLine: string;
  hostHint?: string;
  energyRescue?: string;
}

/** Xiaoyue-generated session starter kit (read-only, public-safe). */
export interface XiaoyueSessionPack {
  generatedAt: string;
  opener: string;
  phaseCoaching: Record<SocialIcebreakerPhase, XiaoyuePhaseCoaching>;
  backupPrompts: string[];
  recapFraming: {
    open: string;
    highlightTemplate: string;
    close: string;
  };
  playerSkillRoles: XiaoyuePlayerSkillRole[];
}

// ─── Xiaoyue Adaptive Facilitation ───────────────────────────────────────────

/** Bounded suggestion types from deterministic pulse analysis. */
export type XiaoyueAdaptiveSuggestionType =
  | 'advance_ready'   // most players done → host can advance
  | 'speed_up'        // phase dragging → tighten pace
  | 'slow_down'       // people need more time
  | 'go_deeper'       // high energy → suggest deeper content
  | 'keep_light'      // low/fragile energy → stay shallow
  | 'rescue_quiet'    // specific players not engaging
  | 'energy_boost'    // energy dipping → inject fun
  | 'keep_going';     // everything looks fine

/** Computed pulse signals extracted from live session state. */
export interface XiaoyuePulseSignals {
  /** Minutes elapsed in current phase. */
  phaseElapsedMinutes: number;
  /** Fraction of roster with recent heartbeat (0–1). */
  activeRate: number;
  /** Fraction of players who completed current phase action (0–1). */
  completionRate: number;
  /** Average vibe from pulse checks (1=cold, 2=warm, 3=fire). 0 if none. */
  avgVibe: number;
  /** Total roster size. */
  playerCount: number;
  /** Number of pulse-check responses received. */
  pulseCheckCount: number;
}

/** A single adaptive suggestion generated by Xiaoyue for the host. */
export interface XiaoyueAdaptiveSuggestion {
  /** Deterministic suggestion category. */
  type: XiaoyueAdaptiveSuggestionType;
  /** Human-readable suggestion text (≤80 chars). */
  message: string;
  /** Concrete action the host can take (≤60 chars). */
  actionableHint: string;
  /** Signals that drove this suggestion. */
  basedOnSignals: XiaoyuePulseSignals;
  /** ISO timestamp when generated. */
  generatedAt: string;
}

export type MomentHighlightAspect =
  | 'participation'
  | 'popularity'
  | 'collaboration'
  | 'memorable';

export interface MomentHighlightItem {
  aspect: MomentHighlightAspect;
  title: string;
  personDisplayName?: string;
  evidence: string;
  narrative: string;
}

export interface MomentHighlightsPanel {
  headline: string;
  overview: string;
  highlights: MomentHighlightItem[];
  closingLine: string;
}

/** Starting balance per player when auction lots are generated. */
export const AUCTION_STARTING_COINS = 100;

export const AUCTION_MIN_LOTS = 2;

export const AUCTION_MAX_LOTS = 5;

export const auctionLotSchema = z.object({
  id: z.string().min(1).max(48),
  title: z.string().min(1).max(100),
  teaser: z.string().max(200).optional(),
  emoji: z.string().max(8).optional(),
});

export const auctionLotsLlmPayloadSchema = z.object({
  lots: z.array(auctionLotSchema).min(AUCTION_MIN_LOTS).max(AUCTION_MAX_LOTS),
});

export type AuctionLotsLlmPayload = z.infer<typeof auctionLotsLlmPayloadSchema>;

export function parseAuctionLotsPayload(input: unknown): AuctionLotsLlmPayload {
  return auctionLotsLlmPayloadSchema.parse(input);
}

export const xiaoyueSessionPackSchema = z.object({
  generatedAt: z.string(),
  opener: z.string().min(1).max(200),
  phaseCoaching: z.record(
    z.enum(['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'speed_friending', 'mini_script', 'recap', 'quip_battle', 'undercover_word', 'group_mirror']),
    z.object({
      toneLine: z.string().min(1).max(120),
      hostHint: z.string().max(200).optional(),
      energyRescue: z.string().max(200).optional(),
    })
  ),
  backupPrompts: z.array(z.string().min(1).max(200)).min(2).max(5),
  recapFraming: z.object({
    open: z.string().min(1).max(200),
    highlightTemplate: z.string().min(1).max(200),
    close: z.string().min(1).max(200),
  }),
  playerSkillRoles: z.array(
    z.object({
      userId: z.string(),
      displayName: z.string(),
      roleLabel: z.string().min(1).max(20),
      roleBlurb: z.string().min(1).max(120),
    })
  ).max(12),
});

export type XiaoyueSessionPackPayload = z.infer<typeof xiaoyueSessionPackSchema>;

export function parseXiaoyueSessionPack(input: unknown): XiaoyueSessionPackPayload {
  return xiaoyueSessionPackSchema.parse(input);
}

// ─── Single-Test Mode Metadata ─────────────────────────────────────────────

export const singleTestBotSchema = z.object({
  botId: z.string().min(1),
  displayName: z.string().min(1),
  archetype: z.string().min(1),
});

export const singleTestBotPersonaSchema = z.object({
  botId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1),
  archetype: z.string().min(1),
});

export const singleTestStateSchema = z.object({
  version: z.literal(2),
  groupId: z.string().min(1),
  isTestModeSkip: z.boolean(),
  runBots: z.boolean().default(false),
  bots: z.array(singleTestBotSchema).max(12),
  botPersonas: z.array(singleTestBotPersonaSchema).max(12).default([]),
});

export type SingleTestBotPersona = z.infer<typeof singleTestBotPersonaSchema>;

export type SingleTestBot = z.infer<typeof singleTestBotSchema>;
export type SingleTestState = z.infer<typeof singleTestStateSchema>;

export function parseSingleTestState(input: unknown): SingleTestState {
  return singleTestStateSchema.parse(input);
}

export interface RecapSummary {
  headline: string;
  closingLine: string;
  moments: string[];
}

export interface Medal {
  emoji: string;
  title: string;
  recipientDisplayName: string;
  description: string;
}

export interface MiniScriptPlayerRuntimeView {
  slotIndex: number;
  roleLabel: string;
  sinHook: string;
  alibi: string;
  secretAgenda: string;
}

export interface MiniScriptVote {
  userId: string;
  /** 1-based index into the framework's characters — the structured tally key. */
  suspectRoleSlot?: number;
  /** Legacy free-text fields (pre-structured-vote clients). Accepted for one
   * release; ignored by the tally unless mappable to a role slot. */
  who?: string;
  what?: string;
  why?: string;
  votedAt: number;
}

/** Eligibility metadata for a selectable phase in custom mode. */
export interface SelectablePhaseInfo {
  phase: Exclude<SocialIcebreakerPhase, 'warmup' | 'recap' | 'phase_selection'>;
  name: string;
  nameEn: string;
  emoji: string;
  minPlayers: number;
  disabled: boolean;
  disabledReason?: string;
}

export interface SocialSessionState {
  socialSessionId: string;
  icebreakerSessionId: string;
  currentPhase: SocialIcebreakerPhase;
  hostUserId: string;
  hostDisplayName: string;
  /** Total number of users who have ever joined this session (roster count). */
  playerCount: number;
  /** Number of participants who have sent a heartbeat in the last 30 seconds. */
  activePlayerCount?: number;
  /** Joined roster with presence metadata for client-side participant rendering. */
  joinedParticipants?: SocialSessionParticipantSummary[];
  phaseStartedAt: number; // timestamp of current phase start
  sessionStartedAt: number; // timestamp of session creation
  /** ISO timestamp when the session expires; undefined for in-memory legacy sessions. */
  expiresAt?: string;
  completedPhases: SocialIcebreakerPhase[];
  eventType?: string;
  eventTier?: TierMachineId;
  vibe?: 'chat' | 'balanced' | 'game';
  enabledPhases?: SocialIcebreakerPhase[];
  /** Compiled run plan from Game Design Agent; if present, session follows this instead of hardcoded PHASE_ORDER.
   *  Undefined for custom-mode sessions where the host picks phases manually. */
  runPlan?: IcebreakerRunPlan;
  /** Server-generated nonce for the current custom-mode picker round.
   *  Refreshed every time the session enters `phase_selection`. */
  phaseSelectionId?: string;
  /** Eligibility list sent to all clients when in custom mode. */
  selectablePhases?: SelectablePhaseInfo[];
  /** When true, Xiaoyue auto-hosts: any participant can trigger actions, and phases auto-advance based on adaptive signals. */
  autoAdvanceEnabled?: boolean;
  /** Timestamp (ms) when auto-advance should trigger. Set when adaptive engine signals advance_ready. */
  autoAdvanceScheduledAt?: number;
  /** Legacy scheduling marker retained only so the server can scrub older sessions. */
  advanceFuseKind?: 'all_ready' | 'stall_recovery';
  /** Timestamp (ms) when the host was nudged about a stalled phase. */
  stallNudgeAt?: number;
  /** Phase whose stall automation the host dismissed; suppressed until the next phase. */
  stallSuppressedForPhase?: SocialIcebreakerPhase;
  /** Trigger that caused the most recent phase transition (analytics attribution). */
  lastAdvanceTrigger?: 'host_tap' | 'auto_all_ready' | 'stall_recovery' | 'early_end_jump' | 'custom_select' | 'custom_end';
  /** ISO timestamp written when the host deliberately interrupts the run and jumps to recap. */
  endedEarlyAt?: string;
  /** Playable phase that was interrupted; recap uses this for honest framing. */
  interruptedAtPhase?: SocialIcebreakerPhase;
  // Per-phase data
  warmupTopics?: SocialTopic[];
  warmupTopicsMeta?: AIResponseMeta;
  /** Server-owned warmup generation lifecycle. 'generating' is written BEFORE
   *  the LLM call so recovery logic can distinguish waiting from a failed request while the
   *  host is waiting on the system rather than on people (2026-07-26). */
  warmupTopicsStatus?: 'idle' | 'generating' | 'ready' | 'failed';
  /** Timestamp (ms) when topic generation started. Stall suppression only
   *  applies within a bounded window from this moment, so a wedged
   *  'generating' state (e.g. server restart mid-request) self-heals. */
  warmupTopicsGeneratingAt?: number;
  currentTopicIndex?: number;
  warmupReadyUserIds?: string[];
  /** Current warmup speaker. Used for turn-based card reveal and timeout flow. */
  warmupTurnUserId?: string;
  /** Timestamp (ms) when the current warmup turn started. */
  warmupTurnStartedAt?: number;
  /** Whether the current warmup topic card has been revealed to the table. */
  warmupTopicRevealed?: boolean;
  /** Per-turn warmup timeout in seconds. Defaults to 30. */
  warmupTurnDurationSeconds?: number;
  selectedMood?: AtmosphereMood;
  commonGroundCount?: number;
  currentChallenge?: MicroChallenge;
  currentChallengeMeta?: AIResponseMeta;
  challengeCompletedBy?: string[];
  lieDetectivePlayers?: LieDetectivePlayer[];
  lieDetectiveStatementsMeta?: AIResponseMeta;
  currentLieDetectivePlayerIndex?: number;
  lieDetectiveCompletedUserIds?: string[];
  currentLieDetectiveReveal?: LieDetectiveReveal;
  votes?: LieDetectiveVote[];
  pulseChecks?: PulseCheckResult[];
  // PersonalityDice phase data
  personalityDiceChallenges?: PersonalityDiceChallenge[];
  personalityDiceChallengesMeta?: AIResponseMeta;
  currentDicePlayerIndex?: number;
  diceCompletedBy?: string[];
  dicePassedBy?: string[];
  // Choose-Your-Prompt variant (PERSONALITY_DICE_CHOOSE_MODE_ENABLED)
  personalityDiceChallengeGroups?: PersonalityDiceChallengeGroup[];
  /** userId → chosen optionIndex (0|1|2) */
  diceSelectedOption?: Record<string, number>;
  /** Stable server-generated userId order used once every player is ready. */
  diceRevealOrder?: string[];
  /** Epoch milliseconds when the synchronized three-second reveal countdown ends. */
  diceRevealCountdownEndsAt?: number;
  /** Players ready to leave the reveal and continue to the next game. */
  diceRevealReadyBy?: string[];
  // Auction phase (virtual coins; see payment-entitlement-authority if real value ever touches this)
  auctionLots?: AuctionLot[];
  auctionLotsMeta?: AIResponseMeta;
  /** userId -> remaining coins while in auction phase */
  auctionBalances?: Record<string, number>;
  /** Index into `auctionLots` for the active lot */
  auctionCurrentLotIndex?: number;
  auctionHighBid?: AuctionHighBid | null;
  /** Set when host has closed the final lot; required before advancing out of `auction`. */
  auctionAllLotsClosed?: boolean;
  /** Server-written one-liners for recap LLM (bounded strings). */
  auctionRecapLines?: string[];
  /** Persistent bid history across the whole auction phase (D5) */
  auctionBidHistory?: AuctionBidRecord[];
  // Quip Battle phase data
  quipBattlePrompts?: Array<{ id: string; promptText: string; category: string }>;
  quipBattlePromptsMeta?: AIResponseMeta;
  quipBattleAnswers?: Array<{ userId: string; displayName: string; promptId: string; answerText: string }>;
  quipBattleVotes?: Array<{ voterId: string; answerId: string; promptId: string }>;
  quipBattleSubmittedUserIds?: string[];
  quipBattleVotedUserIds?: string[];
  quipBattleRevealed?: boolean;
  quipBattleResults?: Array<{
    promptId: string;
    promptText: string;
    answers: Array<{ userId: string; displayName: string; promptId: string; answerText: string }>;
    winnerUserId: string;
    winnerDisplayName: string;
    voteCount: number;
  }>;
  // Undercover Word phase data
  undercoverWordPair?: UndercoverWordPair;
  undercoverWordPairMeta?: AIResponseMeta;
  undercoverUserId?: string;
  undercoverWordRounds?: UndercoverWordRound[];
  undercoverWordCurrentRound?: number;
  undercoverWordVotes?: UndercoverWordVote[];
  undercoverWordVotedUserIds?: string[];
  undercoverWordRevealed?: boolean;
  undercoverWordResults?: UndercoverWordResult;
  // Group Mirror phase data
  groupMirrorQuestions?: GroupMirrorQuestion[];
  groupMirrorQuestionsMeta?: AIResponseMeta;
  groupMirrorAnswers?: GroupMirrorAnswer[];
  groupMirrorVotes?: GroupMirrorAnswer[]; // re-use answer shape for votes
  groupMirrorSubmittedUserIds?: string[];
  groupMirrorRevealed?: boolean;
  groupMirrorResults?: GroupMirrorResult[];
  // Speed Friending phase data
  speedFriendingPairs?: SpeedFriendingPair[];
  speedFriendingCurrentRound?: number;
  speedFriendingTotalRounds?: number;
  speedFriendingRoundStartedAt?: number;
  speedFriendingAllRoundsComplete?: boolean;
  // Recap data
  recapData?: {
    topicsDiscussed: string[];
    challengesCompleted: number;
    lieDetectiveWinner?: string;
    funMoments: string[];
    /** V2 lie-detective recap metrics (populated after phase completes). */
    lieDetective?: {
      aiWinRate: number;
      hardestRound: number;
      fooledEveryone: number;
    };
  };
  /** Cached AI-generated recap summary and medals when session enters recap phase. */
  recapSnapshot?: {
    recapSummary?: RecapSummary;
    medals?: Medal[];
    meta?: AIResponseMeta;
    interrupted?: {
      interrupted: true;
      phase: SocialIcebreakerPhase;
    };
    /** V2 lie-detective recap metrics (populated when reveal history exists). */
    lieDetectiveV2Stats?: {
      aiWinRate: number;
      hardestRound: number;
      fooledEveryone: number;
    };
    /** Personality dice completion highlights. */
    personalityDiceHighlights?: {
      completedCount: number;
      passedCount: number;
      completionRate: number;
    };
    /** Undercover word game result. */
    undercoverWordResult?: {
      caught: boolean;
      undercoverDisplayName: string;
    };
    /** Micro challenge completion highlights. */
    microChallengeHighlights?: {
      completedCount: number;
      totalCount: number;
      completionRate: number;
    };
    /** Group mirror top-voted player highlight. */
    groupMirrorHighlights?: {
      topVotedDisplayName: string;
      questionText: string;
      voteCount: number;
    };
  };
  /** 迷你剧本杀 — generated story framework (JSON), host-only mutation via POST /api/miniscript/generate */
  miniScriptFramework?: MiniScriptStoryFrameworkPublic;
  miniScriptFrameworkGeneratedAt?: number;
  miniScriptFrameworkGeneratedByUserId?: string;
  miniScriptFrameworkMeta?: AIResponseMeta;
  /** Host-preview candidate; not active for gameplay until POST /api/miniscript/select. */
  miniScriptCandidateFramework?: MiniScriptStoryFrameworkPublic;
  miniScriptCandidateGeneratedAt?: number;
  miniScriptCandidateGeneratedByUserId?: string;
  miniScriptCandidateFrameworkMeta?: AIResponseMeta;
  // MiniScript gameplay state
  miniScriptRoleAssignments?: Record<string, number>; // userId -> slotIndex
  miniScriptPlayerRuntimeViews?: Record<string, MiniScriptPlayerRuntimeView>;
  miniScriptCurrentAct?: number; // 0 = not started, 1 = act 1, etc.
  miniScriptRevealedClueIds?: string[];
  miniScriptRevealedClues?: Array<{ clueId: string; text: string }>;
  miniScriptVotes?: MiniScriptVote[];
  /** Epoch ms when the vote phase opened (final act revealed). Drives the 90s
   * quorum escape hatch. */
  miniScriptVoteOpenedAt?: number;
  /** Derived in `sanitizeStateForClient` on every poll — never persisted. */
  miniScriptVoteProgress?: MiniScriptVoteProgress;
  miniScriptSolutionRevealed?: boolean;
  /** Public only after the host reveals the solution. Absent before reveal. */
  miniScriptRevealedSolution?: MiniScriptSolution;
  /** Real resolutionSummary restored after reveal (the persisted framework keeps
   * a placeholder until then). Derived from secrets at reveal time. */
  miniScriptRevealedResolutionSummary?: string;
  miniScriptPlayerReady?: Record<string, boolean>; // userId -> ready status
  miniScriptDeductionHints?: Array<{ stepNumber: number; conclusion: string }>;
  // Bonus gate — post-core-phase mini_script offer
  bonusGateOffered?: boolean;
  bonusGateAccepted?: boolean;
  bonusGateDeclined?: boolean;
  bonusGatePlayerSentiment?: Record<string, 'want' | 'pass'>;
  bonusGateOwnSentiment?: 'want' | 'pass';
  bonusGateSentimentSummary?: { wantCount: number; passCount: number; responseCount: number };
  bonusGateFrameworkPreloading?: boolean;
  /** Xiaoyue Session Pack — generated once at session start, read-only content kit */
  xiaoyueSessionPack?: XiaoyueSessionPack;
  xiaoyueSessionPackMeta?: AIResponseMeta;
  /** Xiaoyue Adaptive Suggestion — latest pulse-check-driven host nudge */
  xiaoyueAdaptiveSuggestion?: XiaoyueAdaptiveSuggestion;
  xiaoyueAdaptiveSuggestionMeta?: AIResponseMeta;
  /** Lie detective mode: v1 = AI generates all 3 statements; v2 = players submit 2 tags, AI expands + inserts 1 fake. */
  lieDetectiveMode?: 'v1' | 'v2';
  /** Server-owned Personality Dice renderer/generation contract. */
  personalityDiceChooseModeEnabled?: boolean;
  /** V2: tag submissions per userId — each player submits exactly 2 tags. */
  lieDetectiveV2Tags?: Record<string, [string, string]>;
  /** V2: history of reveal correct-rates for dynamic difficulty calibration. */
  lieDetectiveRevealHistory?: Array<{ round: number; correctRate: number }>;
  /** V2: current dynamic difficulty (easy / medium / hard). Defaults to medium. */
  lieDetectiveDynamicDifficulty?: 'easy' | 'medium' | 'hard';
  /** Pre-formatted archetype mix text for the current roster (e.g. "社牛柯基×2、小太阳鸡×1").
   *  Computed server-side so the client does not need to rebuild it. */
  archetypeMixText?: string;
  /** Single-test debug metadata: versioned, Zod-validated, and only populated
   *  when the session was created from /api/test/single-test/start. */
  singleTest?: SingleTestState;
  /** Client-only: when true, the host sees a test-mode disclosure (warmup→recap skip). */
  isTestModeSkip?: boolean;
  /** Client-only: read-only bot roster for single-test visual realism. */
  testModeBots?: SingleTestBot[];
  /** Client-only: when true, bots will participate in the multi-player phases. */
  runBots?: boolean;
}

// Phase config
export const PHASE_CONFIG = {
  warmup: {
    emoji: '',
    name: '话题卡',
    nameEn: 'Topic Cards',
    gradient: 'from-amber-400 to-orange-400',
    bgGradient: 'from-amber-50 via-rose-50 to-purple-50',
    darkBgGradient: 'from-zinc-900 via-amber-950 to-zinc-900',
    pillColor: 'bg-amber-100/80 text-amber-700',
    timeoutMinutes: 20,
    minPlayersRequired: 2,
  },
  micro_challenge: {
    emoji: '',
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
    emoji: '',
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
    emoji: '',
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
    emoji: '',
    name: '骰子',
    nameEn: 'Personality Dice',
    gradient: 'from-pink-500 to-fuchsia-600',
    bgGradient: 'from-pink-50 via-fuchsia-50 to-purple-50',
    darkBgGradient: 'from-pink-950 via-fuchsia-950 to-zinc-900',
    pillColor: 'bg-pink-100/80 text-pink-700',
    timeoutMinutes: 15,
    minPlayersRequired: 2,
  },
  mini_script: {
    emoji: '',
    name: '迷你剧本杀',
    nameEn: 'Mini Script',
    gradient: 'from-indigo-500 to-slate-700',
    bgGradient: 'from-indigo-50 via-slate-50 to-violet-50',
    darkBgGradient: 'from-slate-950 via-indigo-950 to-zinc-900',
    pillColor: 'bg-indigo-100/80 text-indigo-700 border border-indigo-300',
    timeoutMinutes: 45,
    minPlayersRequired: 4,
  },
  quip_battle: {
    emoji: '',
    name: '机智对决',
    nameEn: 'Quip Battle',
    gradient: 'from-yellow-400 to-orange-500',
    bgGradient: 'from-yellow-50 via-orange-50 to-amber-50',
    darkBgGradient: 'from-yellow-950 via-orange-950 to-zinc-900',
    pillColor: 'bg-yellow-100/80 text-yellow-700',
    timeoutMinutes: 15,
    minPlayersRequired: 2,
  },
  undercover_word: {
    emoji: '',
    name: '谁是卧底',
    nameEn: 'Undercover Word',
    gradient: 'from-red-500 to-rose-600',
    bgGradient: 'from-red-50 via-rose-50 to-pink-50',
    darkBgGradient: 'from-red-950 via-rose-950 to-zinc-900',
    pillColor: 'bg-red-100/80 text-red-700',
    timeoutMinutes: 20,
    minPlayersRequired: 3,
  },
  group_mirror: {
    emoji: '',
    name: '群像镜像',
    nameEn: 'Group Mirror',
    gradient: 'from-teal-400 to-cyan-500',
    bgGradient: 'from-teal-50 via-cyan-50 to-sky-50',
    darkBgGradient: 'from-teal-950 via-cyan-950 to-zinc-900',
    pillColor: 'bg-teal-100/80 text-teal-700',
    timeoutMinutes: 12,
    minPlayersRequired: 2,
  },
  speed_friending: {
    emoji: '',
    name: '轮桌畅聊',
    nameEn: 'Speed Friending',
    gradient: 'from-green-400 to-emerald-500',
    bgGradient: 'from-green-50 via-emerald-50 to-teal-50',
    darkBgGradient: 'from-green-950 via-emerald-950 to-zinc-900',
    pillColor: 'bg-green-100/80 text-green-700',
    timeoutMinutes: 30,
    minPlayersRequired: 2,
  },
  recap: {
    emoji: '',
    name: '回顾',
    nameEn: 'Recap',
    gradient: 'from-violet-500 to-purple-600',
    bgGradient: 'from-violet-50 via-purple-50 to-fuchsia-50',
    darkBgGradient: 'from-violet-950 via-purple-950 to-zinc-900',
    pillColor: 'bg-violet-100/80 text-violet-700',
    timeoutMinutes: 5,
    minPlayersRequired: 1,
  },
  phase_selection: {
    emoji: '🔀',
    name: '环节选择',
    nameEn: 'Phase Selection',
    gradient: 'from-slate-400 to-zinc-500',
    bgGradient: 'from-slate-50 via-zinc-50 to-neutral-50',
    darkBgGradient: 'from-slate-950 via-zinc-950 to-neutral-950',
    pillColor: 'bg-slate-100/80 text-slate-700',
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
  'speed_friending',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'mini_script',
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
): SocialIcebreakerPhase {
  const idx = enabledPhases.indexOf(current);
  if (idx === -1 || idx === enabledPhases.length - 1) return 'recap';
  return enabledPhases[idx + 1];
}

/**
 * Get the next eligible phase, skipping phases that don't meet min player requirements.
 *
 * Backward-compatible overload: accepts either (current, enabledPhases, playerCount)
 * or (current, state) where state may contain a runPlan.
 */
export function getNextEligiblePhase(
  current: SocialIcebreakerPhase,
  enabledPhases: SocialIcebreakerPhase[],
  playerCount: number
): SocialIcebreakerPhase;
export function getNextEligiblePhase(
  current: SocialIcebreakerPhase,
  state: SocialSessionState
): SocialIcebreakerPhase;
export function getNextEligiblePhase(
  current: SocialIcebreakerPhase,
  second: SocialIcebreakerPhase[] | SocialSessionState,
  third?: number
): SocialIcebreakerPhase {
  // Determine which overload was used
  const isLegacyCall = Array.isArray(second);
  const enabledPhases: SocialIcebreakerPhase[] = isLegacyCall
    ? second
    : (second.enabledPhases || DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES);
  const playerCount: number = isLegacyCall && typeof third === 'number'
    ? third
    : (!isLegacyCall ? second.playerCount : 0);

  // If state was passed and has a run plan, use the plan's segment order
  if (!isLegacyCall && second.runPlan?.segments?.length) {
    const planPhases = second.runPlan.segments.map((s) => s.phase);
    let candidate = getNextPhase(current, planPhases);
    const visited = new Set<SocialIcebreakerPhase>();

    while (candidate !== 'recap' && !visited.has(candidate)) {
      visited.add(candidate);
      if (playerCount >= PHASE_CONFIG[candidate].minPlayersRequired) {
        return candidate;
      }
      candidate = getNextPhase(candidate, planPhases);
    }
    return 'recap';
  }

  // Legacy custom sessions without a preselected run plan keep the host-driven
  // picker between games.
  if (!isLegacyCall && second.eventTier === 'custom') {
    if (current === 'phase_selection') return 'recap';
    return 'phase_selection';
  }

  // Legacy logic
  let candidate = getNextPhase(current, enabledPhases);

  while (candidate !== 'recap') {
    if (playerCount >= PHASE_CONFIG[candidate].minPlayersRequired) {
      return candidate;
    }
    candidate = getNextPhase(candidate, enabledPhases);
  }

  return 'recap';
}

const LEGACY_MINI_SCRIPT_PHASE = 'mini_script_beta' as const;

/**
 * Normalizes DB-backed session JSON that still uses the deprecated phase id
 * `mini_script_beta` (renamed to `mini_script`).
 */
export function migrateLegacySocialIcebreakerPhases(state: SocialSessionState): void {
  if ((state.currentPhase as string) === LEGACY_MINI_SCRIPT_PHASE) {
    state.currentPhase = 'mini_script';
  }
  if (Array.isArray(state.enabledPhases)) {
    state.enabledPhases = state.enabledPhases.map((phase) =>
      (phase as string) === LEGACY_MINI_SCRIPT_PHASE ? 'mini_script' : phase,
    );
  }
  if (Array.isArray(state.completedPhases)) {
    state.completedPhases = state.completedPhases.map((phase) =>
      (phase as string) === LEGACY_MINI_SCRIPT_PHASE ? 'mini_script' : phase,
    );
  }
}
