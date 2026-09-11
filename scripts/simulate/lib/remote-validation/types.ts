/**
 * Remote-validation harness — shared types and the locked ACOEXP↔Big Five
 * convergent mapping.
 *
 * These types describe the PANEL DATA CONTRACT: what a real remote-validation
 * study must collect. Instrument-agnostic: the IPIP item wording is never
 * embedded here — only item IDs and a scoring key. See
 * `docs/strategy/scientific-foundation.md` §Pre-launch validation program.
 */

export const ACOEXP_TRAITS = ['A', 'C', 'E', 'O', 'X', 'P'] as const;
export type AcoexpTrait = (typeof ACOEXP_TRAITS)[number];

export const BIG_FIVE_DOMAINS = [
  'openness',
  'conscientiousness',
  'extraversion',
  'agreeableness',
  'emotional_stability',
] as const;
export type BigFiveDomain = (typeof BIG_FIVE_DOMAINS)[number];

export type TraitScores = Record<AcoexpTrait, number>;

export interface V4ResultRecord {
  traitScores: TraitScores;
  archetype: string;
  confidence: number;
  completedAt: string;
}

export interface IpIpRecord {
  /** itemId → raw response (1–5, where 1 = very inaccurate). */
  responses: Record<string, number>;
}

export interface RetestRecord {
  traitScores: TraitScores;
  completedAt: string;
}

export interface PanelRespondent {
  participantId: string;
  v4: V4ResultRecord;
  ipip?: IpIpRecord;
  retest?: RetestRecord;
  narrativeArm?: string;
  /** Perceived-accuracy rating for the assigned narrative variant (1–7). */
  narrativeRating?: number;
}

export interface VibeSession {
  sessionId: string;
  completedAt: string;
  memberIds: string[];
  /** Post-session 同频 (same-frequency) rating, higher = more resonant. */
  sameFrequency: number;
  /** Would meet again (1–5). Optional secondary outcome. */
  wouldMeetAgain?: number;
}

export interface PanelDataset {
  meta: {
    panelId: string;
    collectedAt: string;
    /** Name of the benchmark instrument (e.g. "IPIP Big-Five Factor Markers"). */
    instrument: string;
    notes?: string;
  };
  respondents: PanelRespondent[];
  vibeSessions?: VibeSession[];
  narrative?: {
    arms: string[];
    metric: string;
    /** The arm hypothesized to score higher (answer-citing vs generic). */
    hypothesizedBetterArm?: string;
  };
}

/** Scoring key for a public-domain IPIP Big Five instrument. */
export interface IpIpKeying {
  instrument: string;
  /** Free-text provenance/disclaimer for the keying file. */
  note?: string;
  /** True when item IDs are a structural placeholder, not the official key. */
  placeholder?: boolean;
  /** Authoritative source of the item set + key (e.g. "Goldberg, 1992"). */
  source?: string;
  /** Canonical retrieval URL for audit/reproducibility. */
  sourceUrl?: string;
  /** ISO date the item set + key were retrieved from sourceUrl. */
  retrievedAt?: string;
  /** License posture of the item set (IPIP is public domain). */
  license?: string;
  responseMin: number;
  responseMax: number;
  items: Array<{
    id: string;
    domain: BigFiveDomain;
    /** true = reverse-scored (IPIP "− keyed" item). */
    reversed: boolean;
    /** Official item wording, included for auditability. */
    text?: string;
  }>;
}

export type AnalysisStatus = 'PASS' | 'FAIL' | 'INSUFFICIENT' | 'NOT-RUN';

export interface AnalysisResult {
  id: string;
  label: string;
  status: AnalysisStatus;
  measured: string;
  threshold: string;
  detail: Record<string, unknown>;
}
