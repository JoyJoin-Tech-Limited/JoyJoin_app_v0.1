/**
 * Table simulation types — a dev/QA harness that lets six LLM personas
 * (one per seat) talk to each other, then flags the awkwardness.
 *
 * This is NOT a runtime product surface. It never runs inside a live
 * session and it never writes to the database.
 */

export type SeatLabel = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export const SEAT_LABELS: readonly SeatLabel[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export const MAX_SIMULATION_SEATS = SEAT_LABELS.length;

/**
 * The only fields a seat persona may be built from.
 * Everything else on the user row is deliberately excluded.
 */
export interface SimulationSeatInput {
  archetype?: string | null;
  primaryArchetype?: string | null;
  interests?: string[] | null;
  tableVibePreference?: string | null;
}

export type SeatEnergy = 'low' | 'mid' | 'high' | 'unknown';

export interface SeatPersona {
  seat: SeatLabel;
  /** 12-archetype display name, e.g. 社牛柯基. Falls back to 未知. */
  archetypeLabel: string;
  energy: SeatEnergy;
  /** At most 3 normalized interest labels. */
  interests: string[];
  /** One of 轻松聊天 / 深度交流 / 游戏互动 / 不限. */
  vibe: string;
}

export interface SimulationTurn {
  /** 1-based round number. */
  round: number;
  /** 1-based global speaking-order index. */
  index: number;
  seat: SeatLabel;
  speak: boolean;
  /** Spoken line. `null` when the seat stayed quiet. */
  text: string | null;
  /** Private reasoning. Never fed back to other seats. */
  innerThought: string | null;
}

export const AWKWARDNESS_CODES = [
  'silent_seat',
  'monologue',
  'two_person_table',
  'dead_air',
  'unanswered_question',
  'interview_loop',
  'unsafe_topic',
  'energy_mismatch',
  /** Judge-only: someone wanted depth and the table stayed on snacks/gear. */
  'depth_mismatch',
] as const;

export type AwkwardnessCode = (typeof AWKWARDNESS_CODES)[number];

export type AwkwardnessSeverity = 'low' | 'medium' | 'high';

export type AwkwardnessSource = 'heuristic' | 'judge' | 'heuristic+judge';

export interface AwkwardnessFlag {
  code: AwkwardnessCode;
  severity: AwkwardnessSeverity;
  seats: SeatLabel[];
  evidence: string;
  source: AwkwardnessSource;
}

export interface JudgeFlag {
  code: AwkwardnessCode;
  severity: AwkwardnessSeverity;
  seats: SeatLabel[];
  evidence: string;
}

export interface TableSimulationJudgeResult {
  overallRead: string;
  riskiestMoment: string | null;
  flags: JudgeFlag[];
}

/** One recorded line for transcript replay. Order in the array is speaking order. */
export interface ReplayTurnInput {
  seat: SeatLabel;
  text?: string | null;
  round?: number;
  innerThought?: string | null;
}

export interface TableSimulationMeta {
  seatPromptVersion: string;
  judgePromptVersion: string;
  seatCalls: number;
  seatFailures: number;
  judgeCalls: number;
  providers: string[];
  models: string[];
  latencyMs: number;
  traceIds: string[];
}

export interface TableSimulationReport {
  generatedAt: string;
  mode: 'llm' | 'heuristic-only' | 'replay';
  fixture?: string;
  sessionId?: string;
  seed: number;
  rounds: number;
  seatCount: number;
  personas: SeatPersona[];
  transcript: SimulationTurn[];
  flags: AwkwardnessFlag[];
  /** 0-100, higher means more likely the table dies. Derived from flags only. */
  awkwardnessScore: number;
  judge: TableSimulationJudgeResult | null;
  meta: TableSimulationMeta;
  notes: string[];
}
