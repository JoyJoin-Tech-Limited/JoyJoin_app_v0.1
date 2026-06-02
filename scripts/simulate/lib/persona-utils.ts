/**
 * Shared utilities for personality test simulation
 * Reusable across all simulation runners
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  getFinalResult,
  EngineState,
} from '../../../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../../../packages/shared/src/personality/questionsV4';
import { findBestMatchingArchetypesV2 } from '../../../packages/shared/src/personality/matcherV2';
import { archetypeRegistry } from '../../../packages/shared/src/personality/archetypeRegistry';
import { TraitKey, DEFAULT_ASSESSMENT_CONFIG } from '../../../packages/shared/src/personality/types';

export type NoiseMode = 'clean' | 'moderate' | 'high';

export interface Persona {
  id: string;
  label: string;
  traitProfile: Record<TraitKey, number>;
  expectedArchetype: string;
  category: 'centroid' | 'boundary';
  metadata?: Record<string, unknown>;
}

export interface SimulationRunResult {
  personaId: string;
  personaLabel: string;
  expectedArchetype: string;
  assignedArchetype: string | null;
  secondaryArchetype: string | null;
  confidence: number;
  confidenceGap: number;
  isExactMatch: boolean;
  isSimilarMatch: boolean;
  questionsAsked: number;
  l3DisambiguationTriggered: boolean;
  closingQuestionsAsked: number;
  traitScores: Record<TraitKey, number>;
  questionSequence: string[];
  top3Matches: Array<{ archetype: string; score: number }>;
}

export interface MatcherIsolationResult {
  personaId: string;
  personaLabel: string;
  expectedArchetype: string;
  assignedArchetype: string;
  confidence: number;
  confidenceGap: number;
  isExactMatch: boolean;
  top3Matches: Array<{ archetype: string; score: number }>;
}

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

// ── Noise configuration ──────────────────────────────────────────────

const NOISE_CONFIG: Record<NoiseMode, { suboptimalRate: number; contrarianRate: number; jitterScale: number }> = {
  clean: { suboptimalRate: 0, contrarianRate: 0, jitterScale: 0 },
  moderate: { suboptimalRate: 0.15, contrarianRate: 0, jitterScale: 1 },
  high: { suboptimalRate: 0.25, contrarianRate: 0.05, jitterScale: 2 },
};

// ── Answer Deriver ───────────────────────────────────────────────────

function scoreOptionForTraits(
  option: { value: string; traitScores: Partial<Record<TraitKey, number>> },
  targetTraits: Record<TraitKey, number>
): number {
  let score = 0;
  for (const trait of ALL_TRAITS) {
    const optionValue = option.traitScores[trait] || 0;
    const targetValue = targetTraits[trait];
    const traitAlignment = (targetValue - 50) / 50;
    score += optionValue * traitAlignment;
  }
  return score;
}

export function selectAnswerByTraits(
  question: typeof questionsV4[0],
  targetTraits: Record<TraitKey, number>,
  noiseMode: NoiseMode = 'clean',
  seedRandom: () => number = Math.random
): string {
  const config = NOISE_CONFIG[noiseMode];

  // Score all options
  const scored = question.options.map((opt) => ({
    value: opt.value,
    score: scoreOptionForTraits(opt, targetTraits),
  }));

  // Add jitter based on noise mode
  if (config.jitterScale > 0) {
    for (const s of scored) {
      s.score += (seedRandom() - 0.5) * 3 * config.jitterScale;
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const roll = seedRandom();

  // Contrarian: pick from the bottom
  if (config.contrarianRate > 0 && roll < config.contrarianRate) {
    const bottomIndex = Math.floor(seedRandom() * Math.min(2, scored.length - 1)) + scored.length - 2;
    return scored[Math.max(0, bottomIndex)].value;
  }

  // Suboptimal: pick 2nd or 3rd best
  if (config.suboptimalRate > 0 && roll < config.contrarianRate + config.suboptimalRate) {
    const suboptimalIndex = Math.floor(seedRandom() * Math.min(2, scored.length - 1)) + 1;
    return scored[Math.min(suboptimalIndex, scored.length - 1)].value;
  }

  // Optimal: pick best
  return scored[0].value;
}

// ── Trait Noise Generator ────────────────────────────────────────────

export function addTraitNoise(
  baseTraits: Record<TraitKey, number>,
  magnitude: number = 10,
  seedRandom: () => number = Math.random
): Record<TraitKey, number> {
  const result = { ...baseTraits } as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    const noise = (seedRandom() - 0.5) * magnitude * 2;
    result[trait] = Math.max(15, Math.min(95, result[trait] + noise));
  }
  return result;
}

// ── End-to-End Simulation ────────────────────────────────────────────

export function runAssessmentSimulation(
  persona: Persona,
  noiseMode: NoiseMode = 'clean',
  retestSeed?: number
): SimulationRunResult {
  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
  let state = initializeEngineState(config);
  const questionSequence: string[] = [];
  let l3DisambiguationTriggered = false;

  // Deterministic random for retest consistency
  let seed = retestSeed ?? 0;
  const seededRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;

    questionSequence.push(question.id);
    if (question.level === 3) l3DisambiguationTriggered = true;

    const answer = selectAnswerByTraits(question, persona.traitProfile, noiseMode, seededRandom);
    state = processAnswer(state, question, answer);

    if (questionSequence.length >= 25) break; // Safety limit
  }

  const topMatch = state.currentMatches[0];
  const secondMatch = state.currentMatches[1];

  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = state.traitConfidences[trait]?.score ?? 50;
  }

  const expectedProto = archetypeRegistry[persona.expectedArchetype as keyof typeof archetypeRegistry];
  const isSimilar = expectedProto?.profile.confusableWith?.includes(topMatch?.archetype ?? '') ?? false;

  return {
    personaId: persona.id,
    personaLabel: persona.label,
    expectedArchetype: persona.expectedArchetype,
    assignedArchetype: topMatch?.archetype ?? null,
    secondaryArchetype: secondMatch?.archetype ?? null,
    confidence: topMatch?.confidence ?? 0,
    confidenceGap: (topMatch?.confidence ?? 0) - (secondMatch?.confidence ?? 0),
    isExactMatch: topMatch?.archetype === persona.expectedArchetype,
    isSimilarMatch: topMatch?.archetype === persona.expectedArchetype || isSimilar,
    questionsAsked: questionSequence.length,
    l3DisambiguationTriggered,
    closingQuestionsAsked: questionSequence.filter((id) => id.startsWith('Q_PLAYFUL')).length,
    traitScores: normalizedTraits,
    questionSequence,
    top3Matches: state.currentMatches.slice(0, 3).map((m) => ({ archetype: m.archetype, score: m.score })),
  };
}

// ── Matcher Isolation ────────────────────────────────────────────────

export function runMatcherIsolation(persona: Persona): MatcherIsolationResult {
  const matches = findBestMatchingArchetypesV2(persona.traitProfile);
  const top = matches[0];
  const second = matches[1];

  const expectedProto = archetypeRegistry[persona.expectedArchetype as keyof typeof archetypeRegistry];
  const isSimilar = expectedProto?.profile.confusableWith?.includes(top?.archetype ?? '') ?? false;

  return {
    personaId: persona.id,
    personaLabel: persona.label,
    expectedArchetype: persona.expectedArchetype,
    assignedArchetype: top?.archetype ?? '',
    confidence: top?.confidence ?? 0,
    confidenceGap: (top?.confidence ?? 0) - (second?.confidence ?? 0),
    isExactMatch: top?.archetype === persona.expectedArchetype,
    top3Matches: matches.slice(0, 3).map((m) => ({ archetype: m.archetype, score: m.score })),
  };
}

// ── Report Formatting ────────────────────────────────────────────────

export function formatConsoleReport(
  results: SimulationRunResult[],
  title: string
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═'.repeat(80));
  lines.push(`  ${title}`);
  lines.push('═'.repeat(80));
  lines.push('');

  const exactMatches = results.filter((r) => r.isExactMatch).length;
  const similarMatches = results.filter((r) => r.isSimilarMatch).length;
  const avgQuestions = results.reduce((s, r) => s + r.questionsAsked, 0) / results.length;
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;
  const avgGap = results.reduce((s, r) => s + r.confidenceGap, 0) / results.length;
  const l3Rate = results.filter((r) => r.l3DisambiguationTriggered).length / results.length;

  lines.push(`📊 Summary:`);
  lines.push(`   Total personas: ${results.length}`);
  lines.push(`   Exact matches:  ${exactMatches} (${((exactMatches / results.length) * 100).toFixed(1)}%)`);
  lines.push(`   Similar+Exact:  ${similarMatches} (${((similarMatches / results.length) * 100).toFixed(1)}%)`);
  lines.push(`   Avg questions:  ${avgQuestions.toFixed(1)}`);
  lines.push(`   Avg confidence: ${avgConfidence.toFixed(3)}`);
  lines.push(`   Avg gap:        ${avgGap.toFixed(3)}`);
  lines.push(`   L3 triggered:   ${(l3Rate * 100).toFixed(1)}%`);
  lines.push('');

  // Per-persona table
  lines.push('─'.repeat(80));
  lines.push(
    `${'Persona'.padEnd(24)} ${'Expected'.padEnd(12)} ${'Assigned'.padEnd(12)} ${'Q#'.padEnd(4)} ${'Conf'.padEnd(6)} ${'Gap'.padEnd(6)} ${'Status'.padEnd(8)}`
  );
  lines.push('─'.repeat(80));

  for (const r of results) {
    const status = r.isExactMatch ? '✅ exact' : r.isSimilarMatch ? '🟡 similar' : '❌ miss';
    lines.push(
      `${r.personaLabel.slice(0, 23).padEnd(24)} ${r.expectedArchetype.padEnd(12)} ${(r.assignedArchetype ?? '—').padEnd(12)} ${String(r.questionsAsked).padEnd(4)} ${r.confidence.toFixed(2).padEnd(6)} ${r.confidenceGap.toFixed(2).padEnd(6)} ${status}`
    );
  }

  lines.push('─'.repeat(80));
  lines.push('');

  return lines.join('\n');
}

export function formatMatcherIsolationReport(
  results: MatcherIsolationResult[],
  title: string
): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═'.repeat(80));
  lines.push(`  ${title}`);
  lines.push('═'.repeat(80));
  lines.push('');

  const exactMatches = results.filter((r) => r.isExactMatch).length;
  const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length;
  const avgGap = results.reduce((s, r) => s + r.confidenceGap, 0) / results.length;

  lines.push(`📊 Summary:`);
  lines.push(`   Total personas: ${results.length}`);
  lines.push(`   Exact matches:  ${exactMatches} (${((exactMatches / results.length) * 100).toFixed(1)}%)`);
  lines.push(`   Avg confidence: ${avgConfidence.toFixed(3)}`);
  lines.push(`   Avg gap:        ${avgGap.toFixed(3)}`);
  lines.push('');

  lines.push('─'.repeat(80));
  lines.push(
    `${'Persona'.padEnd(24)} ${'Expected'.padEnd(12)} ${'Assigned'.padEnd(12)} ${'Conf'.padEnd(6)} ${'Gap'.padEnd(6)} ${'Status'.padEnd(8)}`
  );
  lines.push('─'.repeat(80));

  for (const r of results) {
    const status = r.isExactMatch ? '✅ exact' : '❌ miss';
    lines.push(
      `${r.personaLabel.slice(0, 23).padEnd(24)} ${r.expectedArchetype.padEnd(12)} ${r.assignedArchetype.padEnd(12)} ${r.confidence.toFixed(2).padEnd(6)} ${r.confidenceGap.toFixed(2).padEnd(6)} ${status}`
    );
  }

  lines.push('─'.repeat(80));
  lines.push('');

  return lines.join('\n');
}
