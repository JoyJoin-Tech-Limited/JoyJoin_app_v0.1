import type {
  AwkwardnessCode,
  AwkwardnessFlag,
  AwkwardnessSeverity,
  SeatLabel,
  SeatPersona,
  SimulationTurn,
} from './types';
import { AWKWARDNESS_CODES } from './types';

export const SEVERITY_RANK: Record<AwkwardnessSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Turns shorter than this are treated as a one-liner, not a monologue. */
export const MONOLOGUE_TURN_CHARS = 120;
export const MONOLOGUE_HARD_CHARS = 200;
/** A seat holding this share of all characters is dominating. */
export const DOMINANCE_CHAR_SHARE = 0.45;
/** Two seats holding this share of all spoken turns is a two-person table. */
export const TWO_PERSON_TURN_SHARE = 0.7;

const HIGH_RISK_PATTERN = /收入|工资|薪资|月薪|年薪|存款|资产|政治|前任|离婚|彩礼/;
const MEDIUM_RISK_PATTERN = /房价|买房|租房|结婚|生孩子|生育|体重|减肥|年龄|几岁|学历|户口/;

const QUESTION_PATTERN = /[？?]/;

/**
 * Questions that probe a person rather than open a topic.
 * Three of these in a row is 查户口; three ordinary icebreaker questions is not.
 */
const PERSONAL_PROBE_PATTERN =
  /你(们)?(多大|几岁|住|做|工作|上班|收入|工资|哪里人|哪儿人|老家|单身|结婚|对象|学历|学校|专业|买房|租房)/;

function spoken(turns: SimulationTurn[]): SimulationTurn[] {
  return turns.filter((turn) => turn.speak && typeof turn.text === 'string' && turn.text.trim().length > 0);
}

function truncate(value: string, max = 40): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/** First consecutive run of `length` turns matching the predicate, else null. */
function firstRun(
  turns: SimulationTurn[],
  predicate: (turn: SimulationTurn) => boolean,
  length: number,
): SimulationTurn[] | null {
  for (let index = 0; index + length <= turns.length; index += 1) {
    const window = turns.slice(index, index + length);
    if (window.every(predicate)) return window;
  }
  return null;
}

function bySeverityDesc(left: AwkwardnessFlag, right: AwkwardnessFlag): number {
  return SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity] || left.code.localeCompare(right.code);
}

function flag(
  code: AwkwardnessCode,
  severity: AwkwardnessSeverity,
  seats: SeatLabel[],
  evidence: string,
): AwkwardnessFlag {
  return { code, severity, seats: [...new Set(seats)].sort(), evidence, source: 'heuristic' };
}

/**
 * Deterministic awkwardness detectors. These are the ground truth of the
 * harness: the judge may add nuance, but it can never clear a heuristic flag.
 */
export function detectAwkwardness(
  personas: SeatPersona[],
  turns: SimulationTurn[],
): AwkwardnessFlag[] {
  const said = spoken(turns);
  const seats = personas.map((persona) => persona.seat);
  const rounds = turns.length ? Math.max(...turns.map((turn) => turn.round)) : 0;
  const flags: AwkwardnessFlag[] = [];

  if (said.length === 0) {
    return [flag('dead_air', 'high', seats, '整场没有任何人开口。')];
  }

  const spokenBySeat = new Map<SeatLabel, SimulationTurn[]>();
  for (const turn of said) {
    const list = spokenBySeat.get(turn.seat) ?? [];
    list.push(turn);
    spokenBySeat.set(turn.seat, list);
  }

  const totalChars = said.reduce((sum, turn) => sum + (turn.text?.length ?? 0), 0);

  // silent_seat — never spoke (medium) or spoke in under a quarter of rounds (low).
  for (const seat of seats) {
    const turnsBySeat = spokenBySeat.get(seat) ?? [];
    if (turnsBySeat.length === 0) {
      if (rounds >= 2) {
        flags.push(flag('silent_seat', 'medium', [seat], `座位 ${seat} 全程没有说过话。`));
      }
      continue;
    }
    if (rounds >= 4 && turnsBySeat.length / rounds < 0.25) {
      flags.push(
        flag('silent_seat', 'low', [seat], `座位 ${seat} 只在 ${turnsBySeat.length}/${rounds} 轮开口。`),
      );
    }
  }

  // monologue — one very long turn, or one seat holding too much of the table.
  for (const turn of said) {
    const length = turn.text?.length ?? 0;
    if (length >= MONOLOGUE_HARD_CHARS) {
      flags.push(flag('monologue', 'high', [turn.seat], `座位 ${turn.seat} 单次说了 ${length} 字。`));
    } else if (length >= MONOLOGUE_TURN_CHARS) {
      flags.push(
        flag('monologue', 'medium', [turn.seat], `座位 ${turn.seat} 单次说了 ${length} 字：${truncate(turn.text ?? '')}`),
      );
    }
  }
  for (const [seat, seatTurns] of spokenBySeat) {
    if (seatTurns.length < 3 || totalChars === 0) continue;
    const chars = seatTurns.reduce((sum, turn) => sum + (turn.text?.length ?? 0), 0);
    const share = chars / totalChars;
    if (share >= DOMINANCE_CHAR_SHARE) {
      flags.push(
        flag('monologue', 'medium', [seat], `座位 ${seat} 占了全场 ${Math.round(share * 100)}% 的发言字数。`),
      );
    }
  }

  // two_person_table — two seats carry almost the whole conversation.
  if (said.length >= 6) {
    const ranked = [...spokenBySeat.entries()]
      .map(([seat, list]) => ({ seat, count: list.length }))
      .sort((left, right) => right.count - left.count);
    const topTwo = ranked.slice(0, 2);
    const share = topTwo.reduce((sum, entry) => sum + entry.count, 0) / said.length;
    if (topTwo.length === 2 && share >= TWO_PERSON_TURN_SHARE) {
      flags.push(
        flag(
          'two_person_table',
          'medium',
          topTwo.map((entry) => entry.seat),
          `座位 ${topTwo[0].seat} 和 ${topTwo[1].seat} 承担了 ${Math.round(share * 100)}% 的发言。`,
        ),
      );
    }
  }

  // dead_air — a whole round with nobody speaking.
  for (let round = 1; round <= rounds; round += 1) {
    const roundTurns = said.filter((turn) => turn.round === round);
    if (roundTurns.length === 0) {
      flags.push(flag('dead_air', 'medium', seats, `第 ${round} 轮全场沉默。`));
    }
  }

  // unanswered_question — a question nobody picks up within two speaking turns.
  said.forEach((turn, index) => {
    if (!QUESTION_PATTERN.test(turn.text ?? '')) return;
    const nextTwo = said.slice(index + 1, index + 3);
    const answered = nextTwo.some((candidate) => candidate.seat !== turn.seat);
    if (!answered && nextTwo.length > 0) {
      flags.push(
        flag(
          'unanswered_question',
          'medium',
          [turn.seat, ...nextTwo.map((candidate) => candidate.seat)],
          `座位 ${turn.seat} 的问题没人接：${truncate(turn.text ?? '')}`,
        ),
      );
    }
  });

  // interview_loop — three personal probes in a row, or four short questions
  // of any kind. Three ordinary opening questions is normal icebreaking, not
  // 查户口 (calibrated against a real simulated run, 2026-11-09).
  const isShortQuestion = (turn: SimulationTurn) =>
    QUESTION_PATTERN.test(turn.text ?? '') && (turn.text?.length ?? 0) <= 40;
  const isProbingQuestion = (turn: SimulationTurn) =>
    isShortQuestion(turn) && PERSONAL_PROBE_PATTERN.test(turn.text ?? '');
  const probingRun = firstRun(said, isProbingQuestion, 3);
  const questionRun = probingRun ?? firstRun(said, isShortQuestion, 4);
  if (questionRun) {
    flags.push(
      flag(
        'interview_loop',
        'medium',
        questionRun.map((turn) => turn.seat),
        `连续 ${questionRun.length} 轮都是短问句，像在查户口：${truncate(questionRun[0].text ?? '')}`,
      ),
    );
  }

  // unsafe_topic — money, housing, marriage, politics, exes, weight.
  for (const turn of said) {
    const text = turn.text ?? '';
    const high = text.match(HIGH_RISK_PATTERN);
    const medium = text.match(MEDIUM_RISK_PATTERN);
    if (high) {
      flags.push(
        flag('unsafe_topic', 'high', [turn.seat], `座位 ${turn.seat} 提到「${high[0]}」：${truncate(text)}`),
      );
    } else if (medium) {
      flags.push(
        flag('unsafe_topic', 'medium', [turn.seat], `座位 ${turn.seat} 提到「${medium[0]}」：${truncate(text)}`),
      );
    }
  }

  // energy_mismatch — derived: mixed energy roster where the loud seat dominates
  // and a quiet seat goes silent. Only fires when both signals already exist.
  const hasHigh = personas.some((persona) => persona.energy === 'high');
  const hasLow = personas.some((persona) => persona.energy === 'low');
  if (hasHigh && hasLow) {
    const silentSeats = new Set(
      flags.filter((entry) => entry.code === 'silent_seat').flatMap((entry) => entry.seats),
    );
    const dominantSeats = new Set(
      flags.filter((entry) => entry.code === 'monologue').flatMap((entry) => entry.seats),
    );
    const quietSeat = personas.find((persona) => persona.energy === 'low' && silentSeats.has(persona.seat));
    const loudSeat = personas.find((persona) => persona.energy === 'high' && dominantSeats.has(persona.seat));
    if (quietSeat && loudSeat) {
      flags.push(
        flag(
          'energy_mismatch',
          'medium',
          [loudSeat.seat, quietSeat.seat],
          `高能量座位 ${loudSeat.seat} 主导，低能量座位 ${quietSeat.seat} 沉默。`,
        ),
      );
    }
  }

  return mergeFlagsByCode(flags);
}

/** Merges flags sharing a code: highest severity wins, seats union. */
export function mergeFlagsByCode(flags: AwkwardnessFlag[]): AwkwardnessFlag[] {
  const byCode = new Map<AwkwardnessCode, AwkwardnessFlag>();
  for (const entry of flags) {
    const existing = byCode.get(entry.code);
    if (!existing) {
      byCode.set(entry.code, { ...entry, seats: [...entry.seats].sort() });
      continue;
    }
    const severity =
      SEVERITY_RANK[entry.severity] > SEVERITY_RANK[existing.severity] ? entry.severity : existing.severity;
    byCode.set(entry.code, {
      code: entry.code,
      severity,
      seats: [...new Set([...existing.seats, ...entry.seats])].sort(),
      evidence:
        SEVERITY_RANK[entry.severity] > SEVERITY_RANK[existing.severity] ? entry.evidence : existing.evidence,
      source: existing.source,
    });
  }
  return [...byCode.values()].sort(bySeverityDesc);
}

export function isAwkwardnessCode(value: string): value is AwkwardnessCode {
  return (AWKWARDNESS_CODES as readonly string[]).includes(value);
}

/**
 * Merges judge-produced flags into the heuristic set.
 * A heuristic flag is never cleared; the judge can only raise its severity
 * or widen the seat set. Judge-only codes survive as `source: 'judge'`.
 */
export function mergeJudgeFlags(
  heuristicFlags: AwkwardnessFlag[],
  judgeFlags: Array<{ code: AwkwardnessCode; severity: AwkwardnessSeverity; seats: SeatLabel[]; evidence: string }>,
): AwkwardnessFlag[] {
  const merged = new Map<AwkwardnessCode, AwkwardnessFlag>(
    heuristicFlags.map((entry) => [entry.code, entry]),
  );

  for (const judge of judgeFlags) {
    const existing = merged.get(judge.code);
    if (!existing) {
      merged.set(judge.code, {
        code: judge.code,
        severity: judge.severity,
        seats: [...new Set(judge.seats)].sort(),
        evidence: judge.evidence,
        source: 'judge',
      });
      continue;
    }
    const severity =
      SEVERITY_RANK[judge.severity] > SEVERITY_RANK[existing.severity] ? judge.severity : existing.severity;
    merged.set(judge.code, {
      code: judge.code,
      severity,
      seats: [...new Set([...existing.seats, ...judge.seats])].sort(),
      evidence:
        SEVERITY_RANK[judge.severity] > SEVERITY_RANK[existing.severity] ? judge.evidence : existing.evidence,
      source: 'heuristic+judge',
    });
  }

  return [...merged.values()].sort(bySeverityDesc);
}
