/**
 * Personality Test Question Bank Bias Audit
 * Phase 1: Statistical audit to identify the most positively-biased questions
 */

import { questionsV4L1 } from '../../packages/shared/src/personality/questionsV4L1.js';
import { questionsV4L2 } from '../../packages/shared/src/personality/questionsV4L2.js';
import { questionsV4Extended } from '../../packages/shared/src/personality/questionsV4Extended.js';
import { questionsV4Advanced } from '../../packages/shared/src/personality/questionsV4Advanced.js';
import { questionsV4Attractor } from '../../packages/shared/src/personality/questionsV4Attractor.js';
import type { AdaptiveQuestion, TraitKey, TraitScores } from '../../packages/shared/src/personality/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

function getScore(scores: TraitScores, trait: TraitKey): number {
  return scores[trait] ?? 0;
}

interface QuestionMetrics {
  id: string;
  text: string;
  level: number;
  category: string;
  netTraitSums: Record<TraitKey, number>;
  totalNetBias: number;
  polarityCounts: Record<TraitKey, { positive: number; negative: number; zero: number }>;
  inflationScore: number;
  positiveOptionTotal: number; // total options with positive score (across all traits)
  negativeOptionTotal: number; // total options with negative score (across all traits)
  zeroOptionTotal: number;     // total options with zero score (across all traits)
  expectedTraitDrift: Record<TraitKey, number>; // mean per trait
  primaryTraits: TraitKey[];
}

function computeQuestionMetrics(q: AdaptiveQuestion): QuestionMetrics {
  const netTraitSums: Record<TraitKey, number> = {
    A: 0, C: 0, E: 0, O: 0, X: 0, P: 0,
  };
  const polarityCounts: Record<TraitKey, { positive: number; negative: number; zero: number }> = {
    A: { positive: 0, negative: 0, zero: 0 },
    C: { positive: 0, negative: 0, zero: 0 },
    E: { positive: 0, negative: 0, zero: 0 },
    O: { positive: 0, negative: 0, zero: 0 },
    X: { positive: 0, negative: 0, zero: 0 },
    P: { positive: 0, negative: 0, zero: 0 },
  };

  let positiveOptionTotal = 0;
  let negativeOptionTotal = 0;
  let zeroOptionTotal = 0;

  for (const option of q.options) {
    for (const trait of ALL_TRAITS) {
      const score = getScore(option.traitScores, trait);
      netTraitSums[trait] += score;

      if (score > 0) {
        polarityCounts[trait].positive++;
        positiveOptionTotal++;
      } else if (score < 0) {
        polarityCounts[trait].negative++;
        negativeOptionTotal++;
      } else {
        polarityCounts[trait].zero++;
        zeroOptionTotal++;
      }
    }
  }

  const totalNetBias = ALL_TRAITS.reduce((sum, trait) => sum + Math.abs(netTraitSums[trait]), 0);

  // Expected trait drift = mean score per trait for a random answerer
  const expectedTraitDrift: Record<TraitKey, number> = {
    A: 0, C: 0, E: 0, O: 0, X: 0, P: 0,
  };
  const numOptions = q.options.length;
  for (const trait of ALL_TRAITS) {
    expectedTraitDrift[trait] = netTraitSums[trait] / numOptions;
  }

  // Inflation Score Formula:
  // 1. Sum of all positive expected drift (how much a random answerer gains)
  // 2. Multiply by imbalance ratio (positive options / total nonzero options)
  // 3. Add a penalty for traits that have zero negative-loading options
  const positiveDriftSum = ALL_TRAITS.reduce((sum, trait) => sum + Math.max(0, expectedTraitDrift[trait]), 0);
  const nonzeroOptions = positiveOptionTotal + negativeOptionTotal;
  const imbalanceRatio = nonzeroOptions > 0 ? positiveOptionTotal / nonzeroOptions : 0.5;

  // Count traits with no negative options at all (severe bias)
  let traitsWithoutNegative = 0;
  for (const trait of ALL_TRAITS) {
    if (polarityCounts[trait].negative === 0 && polarityCounts[trait].positive > 0) {
      traitsWithoutNegative++;
    }
  }

  // Inflation score = positive drift * imbalance ratio * (1 + severity penalty)
  const severityPenalty = traitsWithoutNegative * 0.5;
  const inflationScore = positiveDriftSum * imbalanceRatio * (1 + severityPenalty);

  return {
    id: q.id,
    text: q.scenarioText + (q.questionText ? ` — ${q.questionText}` : ''),
    level: q.level,
    category: q.category,
    netTraitSums,
    totalNetBias,
    polarityCounts,
    inflationScore,
    positiveOptionTotal,
    negativeOptionTotal,
    zeroOptionTotal,
    expectedTraitDrift,
    primaryTraits: q.primaryTraits as TraitKey[] ?? [],
  };
}

function generateRecommendedAction(metrics: QuestionMetrics): string {
  const imbalancedTraits: TraitKey[] = [];
  const severelyBiasedTraits: TraitKey[] = [];

  for (const trait of ALL_TRAITS) {
    const net = metrics.netTraitSums[trait];
    const pos = metrics.polarityCounts[trait].positive;
    const neg = metrics.polarityCounts[trait].negative;

    if (net > 2 && pos > neg) {
      imbalancedTraits.push(trait);
    }
    if (neg === 0 && pos > 0) {
      severelyBiasedTraits.push(trait);
    }
  }

  if (severelyBiasedTraits.length > 0) {
    if (severelyBiasedTraits.length === 1) {
      return `Add negative-${severelyBiasedTraits[0]} option`;
    }
    if (severelyBiasedTraits.length <= 3) {
      return `Rebalance ${severelyBiasedTraits.join('/')}`;
    }
    return `Add reversed options across ${severelyBiasedTraits.length} traits`;
  }

  if (imbalancedTraits.length > 0) {
    if (imbalancedTraits.length === 1) {
      return `Add negative-${imbalancedTraits[0]} option`;
    }
    return `Rebalance ${imbalancedTraits.slice(0, 3).join('/')}`;
  }

  // Check overall positive bias
  const totalNet = Object.values(metrics.netTraitSums).reduce((s, v) => s + v, 0);
  if (totalNet > 3) {
    return 'Add more negative-loading options';
  }

  return 'Minor rebalancing needed';
}

function main() {
  const allQuestions: AdaptiveQuestion[] = [
    ...questionsV4L1,
    ...questionsV4L2,
    ...questionsV4Extended,
    ...questionsV4Advanced,
    ...questionsV4Attractor,
  ];

  // Compute metrics for each question
  const metrics = allQuestions.map(computeQuestionMetrics);

  // Summary stats
  const totalQuestions = metrics.length;
  let questionsWithNetPositiveBias = 0;
  let questionsWithNetNegativeBias = 0;
  let questionsBalanced = 0;

  for (const m of metrics) {
    const totalNet = Object.values(m.netTraitSums).reduce((s, v) => s + v, 0);
    if (totalNet > 0.5) questionsWithNetPositiveBias++;
    else if (totalNet < -0.5) questionsWithNetNegativeBias++;
    else questionsBalanced++;
  }

  const avgNetBiasPerTrait: Record<string, number> = {};
  for (const trait of ALL_TRAITS) {
    const sum = metrics.reduce((s, m) => s + m.netTraitSums[trait], 0);
    avgNetBiasPerTrait[trait] = Number((sum / totalQuestions).toFixed(3));
  }

  // Rank by inflation score (descending)
  const ranked = [...metrics].sort((a, b) => b.inflationScore - a.inflationScore);
  const top18 = ranked.slice(0, 18);

  // Per-trait analysis
  const perTraitAnalysis: Record<string, {
    mostBiasedQuestions: string[];
    avgOptionScore: number;
    positiveOptionCount: number;
    negativeOptionCount: number;
  }> = {};

  for (const trait of ALL_TRAITS) {
    // Sort by net trait sum descending for this trait
    const byTrait = [...metrics].sort((a, b) => b.netTraitSums[trait] - a.netTraitSums[trait]);
    const mostBiased = byTrait.slice(0, 5).map(m => m.id);

    let totalScore = 0;
    let posCount = 0;
    let negCount = 0;
    let optionCount = 0;

    for (const m of metrics) {
      for (const q of allQuestions) {
        if (q.id === m.id) {
          for (const opt of q.options) {
            const score = getScore(opt.traitScores, trait);
            totalScore += score;
            optionCount++;
            if (score > 0) posCount++;
            else if (score < 0) negCount++;
          }
          break;
        }
      }
    }

    perTraitAnalysis[trait] = {
      mostBiasedQuestions: mostBiased,
      avgOptionScore: Number((totalScore / optionCount).toFixed(4)),
      positiveOptionCount: posCount,
      negativeOptionCount: negCount,
    };
  }

  // Build report
  const report = {
    summary: {
      totalQuestions,
      questionsWithNetPositiveBias,
      questionsWithNetNegativeBias,
      questionsBalanced,
      avgNetBiasPerTrait,
    },
    topCandidates: top18.map(m => ({
      id: m.id,
      text: m.text,
      level: m.level,
      inflationScore: Number(m.inflationScore.toFixed(4)),
      netTraitSums: Object.fromEntries(
        ALL_TRAITS.map(t => [t, Number(m.netTraitSums[t].toFixed(2))])
      ) as Record<string, number>,
      polarityCounts: Object.fromEntries(
        ALL_TRAITS.map(t => [t, m.polarityCounts[t]])
      ) as Record<string, { positive: number; negative: number; zero: number }>,
      recommendedAction: generateRecommendedAction(m),
    })),
    perTraitAnalysis,
  };

  // Write JSON report
  const outputPath = path.join(__dirname, 'data', 'question-bias-audit.json');
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  // Console summary
  console.log('='.repeat(70));
  console.log('PERSONALITY TEST QUESTION BANK BIAS AUDIT');
  console.log('Phase 1: Statistical Audit Report');
  console.log('='.repeat(70));
  console.log();

  console.log('📊 SUMMARY');
  console.log(`   Total questions audited:        ${totalQuestions}`);
  console.log(`   Questions with net positive bias: ${questionsWithNetPositiveBias} (${((questionsWithNetPositiveBias / totalQuestions) * 100).toFixed(1)}%)`);
  console.log(`   Questions with net negative bias: ${questionsWithNetNegativeBias} (${((questionsWithNetNegativeBias / totalQuestions) * 100).toFixed(1)}%)`);
  console.log(`   Questions balanced:               ${questionsBalanced} (${((questionsBalanced / totalQuestions) * 100).toFixed(1)}%)`);
  console.log();

  console.log('📈 AVERAGE NET BIAS PER TRAIT');
  for (const trait of ALL_TRAITS) {
    const avg = avgNetBiasPerTrait[trait];
    const bar = avg >= 0 ? '+'.repeat(Math.min(Math.round(avg * 5), 20)) : '-'.repeat(Math.min(Math.round(-avg * 5), 20));
    console.log(`   ${trait}: ${avg >= 0 ? ' ' : ''}${avg.toFixed(3).padStart(6)} ${bar}`);
  }
  console.log();

  console.log('🔴 TOP 18 MOST BIASED QUESTIONS (Ranked by Inflation Score)');
  console.log('-'.repeat(70));
  top18.forEach((m, i) => {
    const netSumsStr = ALL_TRAITS
      .map(t => `${t}:${m.netTraitSums[t] >= 0 ? '+' : ''}${m.netTraitSums[t].toFixed(1)}`)
      .join(' ');
    console.log(`${(i + 1).toString().padStart(2)}. ${m.id.padEnd(16)} score=${m.inflationScore.toFixed(3)}  L${m.level}  ${m.category}`);
    console.log(`    Text: ${m.text.slice(0, 80)}${m.text.length > 80 ? '...' : ''}`);
    console.log(`    Net:  ${netSumsStr}`);
    console.log(`    Act:  ${generateRecommendedAction(m)}`);
    console.log();
  });

  console.log('📋 PER-TRAIT MOST BIASED QUESTIONS');
  console.log('-'.repeat(70));
  for (const trait of ALL_TRAITS) {
    const analysis = perTraitAnalysis[trait];
    console.log(`${trait}: avg=${analysis.avgOptionScore >= 0 ? '+' : ''}${analysis.avgOptionScore}  pos=${analysis.positiveOptionCount} neg=${analysis.negativeOptionCount}`);
    console.log(`   Top 5: ${analysis.mostBiasedQuestions.join(', ')}`);
  }
  console.log();

  console.log(`✅ Full JSON report written to: ${outputPath}`);
  console.log('='.repeat(70));
}

main();
