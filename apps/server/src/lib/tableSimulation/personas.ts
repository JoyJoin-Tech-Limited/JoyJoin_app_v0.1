import {
  ARCHETYPE_BY_ID,
  resolveRosterArchetype,
} from '@shared/personality/archetypeNames';
import { archetypeRegistry } from '@shared/personality/archetypeRegistry';
import type {
  SeatEnergy,
  SeatLabel,
  SeatPersona,
  SimulationSeatInput,
} from './types';
import { MAX_SIMULATION_SEATS, SEAT_LABELS } from './types';

/**
 * Fields that must never reach a simulation prompt or report.
 * Kept as an explicit list so the privacy test can assert on it.
 */
export const SEAT_PERSONA_FORBIDDEN_FIELDS = [
  'displayName',
  'userId',
  'gender',
  'birthdate',
  'age',
  'currentCity',
  'district',
  'industryNicheLabel',
  'bio',
  'educationLevel',
  'vibeVector',
  'traitScores',
  'matchingScore',
] as const;

const MAX_INTERESTS = 3;

/**
 * Labels that carry no signal for a simulated dinner table.
 * Kept short on purpose — the goal is to avoid a persona built entirely
 * from generic words, not to curate the taxonomy here.
 */
const GENERIC_INTEREST_LABELS = new Set([
  '社交',
  '交友',
  '聊天',
  '生活',
  '娱乐',
  '其他',
  '美食',
  '旅行',
]);

const KNOWN_VIBES = new Set(['轻松聊天', '深度交流', '游戏互动', '不限']);

/** Accepts both the Chinese column values and the legacy machine values. */
const VIBE_ALIASES: Record<string, string> = {
  light_fun: '轻松聊天',
  natural_chat: '不限',
  deep_talk: '深度交流',
};

const ENERGY_LOW_MAX = 50;
const ENERGY_HIGH_MIN = 75;

function normalizeInterests(interests: string[] | null | undefined): string[] {
  if (!interests?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of interests) {
    if (typeof raw !== 'string') continue;
    const label = raw.trim();
    if (!label || label.length > 20) continue;
    if (GENERIC_INTEREST_LABELS.has(label)) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    result.push(label);
    if (result.length >= MAX_INTERESTS) break;
  }
  return result;
}

function normalizeVibe(value: string | null | undefined): string {
  const vibe = typeof value === 'string' ? value.trim() : '';
  if (KNOWN_VIBES.has(vibe)) return vibe;
  return VIBE_ALIASES[vibe] ?? '不限';
}

function energyBand(energyLevel: number | undefined): SeatEnergy {
  if (typeof energyLevel !== 'number' || Number.isNaN(energyLevel)) return 'unknown';
  if (energyLevel < ENERGY_LOW_MAX) return 'low';
  if (energyLevel >= ENERGY_HIGH_MIN) return 'high';
  return 'mid';
}

/**
 * Builds anonymized seat personas from roster rows.
 * Names, ids, gender, age, city, industry, bio and trait scores are dropped here
 * and can never reappear downstream.
 */
export function buildSeatPersonas(roster: SimulationSeatInput[]): SeatPersona[] {
  return roster.slice(0, MAX_SIMULATION_SEATS).map((member, index) => {
    const archetypeId =
      resolveRosterArchetype(member.primaryArchetype ?? null, member.archetype ?? null) ?? null;
    const definition = archetypeId ? ARCHETYPE_BY_ID[archetypeId] : undefined;
    const registryEntry = archetypeId ? archetypeRegistry[archetypeId as keyof typeof archetypeRegistry] : undefined;

    return {
      seat: SEAT_LABELS[index] as SeatLabel,
      archetypeLabel: definition?.nameCn ?? '未知',
      energy: energyBand(registryEntry?.profile?.energyLevel),
      interests: normalizeInterests(member.interests),
      vibe: normalizeVibe(member.tableVibePreference),
    } satisfies SeatPersona;
  });
}

const ENERGY_COPY: Record<SeatEnergy, string> = {
  low: '偏低（慢热，需要被带）',
  mid: '中等（看气氛）',
  high: '偏高（主动开口）',
  unknown: '未知',
};

/** Renders one persona as the prompt block. Contains no identifying data. */
export function describeSeatForPrompt(persona: SeatPersona): string {
  const interests = persona.interests.length ? persona.interests.join('、') : '未提供';
  return [
    `- 座位：${persona.seat}`,
    `- 性格原型：${persona.archetypeLabel}`,
    `- 能量：${ENERGY_COPY[persona.energy]}`,
    `- 兴趣标签：${interests}`,
    `- 期望氛围：${persona.vibe}`,
  ].join('\n');
}
