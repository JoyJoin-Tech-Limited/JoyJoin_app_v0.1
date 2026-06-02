#!/usr/bin/env node
/**
 * Personality Engine Accuracy Simulation
 * Runs 10 archetype-typical profiles through the V2 matcher and full engine.
 */

import {
  archetypePrototypes,
  findBestMatchingArchetypes,
  normalizeTraitScore,
} from '../packages/shared/src/personality/prototypes';
import {
  prototypeMatcher,
  UserSecondaryData,
} from '../packages/shared/src/personality/matcherV2';
import {
  initializeEngineState,
  processAnswer,
  getFinalResult,
  isAssessmentComplete,
} from '../packages/shared/src/personality/adaptiveEngine';
import { DEFAULT_ASSESSMENT_CONFIG } from '../packages/shared/src/personality/types';
import { questionsV4 } from '../packages/shared/src/personality/questionsV4';
import { TraitKey } from '../packages/shared/src/personality/types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

interface SimulationCase {
  name: string;
  expectedArchetype: string;
  traitProfile: Record<TraitKey, number>;
  description: string;
}

// Build 12 pure-archetype simulation cases from prototypes
const simulationCases: SimulationCase[] = Object.entries(archetypePrototypes).map(
  ([id, prototype]) => ({
    name: prototype.name,
    expectedArchetype: id,
    traitProfile: { ...prototype.traitProfile },
    description: `Pure ${id} prototype profile`,
  })
);

// Add 8 edge-case / hybrid profiles
const edgeCases: SimulationCase[] = [
  {
    name: 'High-O-Low-C (Octopus-like)',
    expectedArchetype: 'octopus',
    traitProfile: { A: 55, C: 35, E: 50, O: 92, X: 60, P: 65 },
    description: 'Very high openness, low conscientiousness',
  },
  {
    name: 'High-X-High-P (Corgi-like)',
    expectedArchetype: 'corgi',
    traitProfile: { A: 60, C: 45, E: 55, O: 55, X: 92, P: 88 },
    description: 'Very high extraversion and positivity',
  },
  {
    name: 'High-A-Low-X (Koala-like)',
    expectedArchetype: 'koala',
    traitProfile: { A: 88, C: 50, E: 60, O: 50, X: 35, P: 55 },
    description: 'High affinity, very low extraversion',
  },
  {
    name: 'High-E-High-C-Low-X (Turtle-like)',
    expectedArchetype: 'turtle',
    traitProfile: { A: 50, C: 82, E: 85, O: 45, X: 28, P: 50 },
    description: 'High stability and conscientiousness, very low extraversion',
  },
  {
    name: 'Balanced-Mid (Dolphin-like)',
    expectedArchetype: 'dolphin_calm',
    traitProfile: { A: 65, C: 55, E: 70, O: 60, X: 50, P: 55 },
    description: 'Balanced mid-range, slightly high stability',
  },
  {
    name: 'High-C-High-A (Spider-like)',
    expectedArchetype: 'spider',
    traitProfile: { A: 78, C: 82, E: 55, O: 50, X: 55, P: 50 },
    description: 'High conscientiousness and affinity',
  },
  {
    name: 'Low-Everything (Cat-like)',
    expectedArchetype: 'cat',
    traitProfile: { A: 35, C: 45, E: 40, O: 40, X: 22, P: 30 },
    description: 'Very low across all dimensions',
  },
  {
    name: 'High-O-High-C (Owl-like)',
    expectedArchetype: 'owl',
    traitProfile: { A: 45, C: 78, E: 60, O: 82, X: 35, P: 45 },
    description: 'High openness and conscientiousness, low extraversion',
  },
];

simulationCases.push(...edgeCases);

function runMatcherV2Direct(
  traits: Record<TraitKey, number>,
  userSecondaryData?: UserSecondaryData
) {
  const matches = prototypeMatcher.findBestMatches(traits, userSecondaryData, 3);
  const decisiveCheck = prototypeMatcher.isDecisiveMatch(matches);
  return {
    primary: matches[0]?.archetype ?? 'unknown',
    secondary: matches[1]?.archetype ?? null,
    score: matches[0]?.score ?? 0,
    gap: matches[0] && matches[1] ? matches[0].score - matches[1].score : 0,
    isDecisive: decisiveCheck.decisive,
    decisiveReason: decisiveCheck.reason,
    top3: matches,
  };
}

function runLegacyMatcher(traits: Record<TraitKey, number>) {
  const matches = findBestMatchingArchetypes(traits, 3);
  return {
    primary: matches[0]?.archetype ?? 'unknown',
    secondary: matches[1]?.archetype ?? null,
    score: matches[0]?.score ?? 0,
    gap: matches[0] && matches[1] ? matches[0].score - matches[1].score : 0,
    top3: matches,
  };
}

/**
 * Simulate answering questions by always picking the option that moves trait scores
 * closest to the target profile.
 */
function runFullEngineSimulation(
  targetProfile: Record<TraitKey, number>,
  maxQuestions: number = 20
) {
  let state = initializeEngineState(DEFAULT_ASSESSMENT_CONFIG);
  const shuffledQuestions = [...questionsV4].sort(() => Math.random() - 0.5);

  for (const question of shuffledQuestions.slice(0, maxQuestions)) {
    // Pick option that minimizes Euclidean distance to target profile
    let bestOption = question.options[0];
    let bestDistance = Infinity;

    for (const option of question.options) {
      // Estimate where this option would move the trait scores
      const currentTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
      for (const trait of ALL_TRAITS) {
        currentTraits[trait] = state.traitConfidences[trait].score;
      }

      // Simulate the trait update (simplified: add normalized option scores)
      const simulatedTraits: Record<TraitKey, number> = { ...currentTraits };
      for (const trait of ALL_TRAITS) {
        const optionDelta = option.traitScores[trait] ?? 0;
        const currentSample = state.traitConfidences[trait].sampleCount;
        const currentScore = currentTraits[trait];
        // Weighted average approximation
        const newSample = currentSample + 1;
        simulatedTraits[trait] = (currentScore * currentSample + normalizeTraitScore(optionDelta)) / newSample;
      }

      const distance = ALL_TRAITS.reduce(
        (sum, t) => sum + Math.pow(simulatedTraits[t] - targetProfile[t], 2),
        0
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestOption = option;
      }
    }

    state = processAnswer(state, question, bestOption.value);

    if (isAssessmentComplete(state)) {
      break;
    }
  }

  const result = getFinalResult(state);
  return {
    primaryArchetype: result.primaryArchetype,
    secondaryArchetype: result.secondaryArchetype,
    traitScores: result.traitScores,
    isDecisive: (result as any).isDecisive,
    algorithmVersion: result.algorithmVersion,
    answeredCount: state.answeredQuestionIds.size,
  };
}

function printHeader(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

function printSubHeader(title: string) {
  console.log(`\n${'-'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'-'.repeat(50)}`);
}

// ─── Run Simulations ─────────────────────────────────────────────────────────

printHeader('PERSONALITY ENGINE ACCURACY SIMULATION');
console.log(`Total cases: ${simulationCases.length}`);
console.log(`Engine: V2 Matcher (default)`);
console.log(`Config: min=${DEFAULT_ASSESSMENT_CONFIG.minQuestions}, softMax=${DEFAULT_ASSESSMENT_CONFIG.softMaxQuestions}, hardMax=${DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions}`);

// ─── Direct Matcher Tests ────────────────────────────────────────────────────
printSubHeader('TEST 1: Direct V2 Matcher (Ideal Profiles)');

let directCorrect = 0;
let directTotal = 0;

for (const testCase of simulationCases) {
  const result = runMatcherV2Direct(testCase.traitProfile);
  const isCorrect = result.primary === testCase.expectedArchetype;
  if (isCorrect) directCorrect++;
  directTotal++;

  const status = isCorrect ? '✅ PASS' : '❌ FAIL';
  console.log(
    `${status} | ${testCase.name.padEnd(28)} | expected: ${testCase.expectedArchetype.padEnd(14)} | got: ${result.primary.padEnd(14)} | score: ${result.score.toFixed(1)} | gap: ${result.gap.toFixed(2)} | decisive: ${result.isDecisive ? 'Y' : 'N'}`
  );

  if (!isCorrect) {
    console.log(`       top3: ${result.top3.map((m: any) => `${m.archetype}(${m.score.toFixed(1)})`).join(', ')}`);
  }
}

console.log(`\nDirect V2 Matcher Accuracy: ${directCorrect}/${directTotal} = ${((directCorrect/directTotal)*100).toFixed(1)}%`);

// ─── Legacy Matcher Comparison ───────────────────────────────────────────────
printSubHeader('TEST 2: Legacy V1 Matcher (Same Profiles)');

let legacyCorrect = 0;
for (const testCase of simulationCases) {
  const result = runLegacyMatcher(testCase.traitProfile);
  const isCorrect = result.primary === testCase.expectedArchetype;
  if (isCorrect) legacyCorrect++;

  const status = isCorrect ? '✅ PASS' : '❌ FAIL';
  console.log(
    `${status} | ${testCase.name.padEnd(28)} | expected: ${testCase.expectedArchetype.padEnd(14)} | got: ${result.primary.padEnd(14)} | score: ${result.score.toFixed(1)} | gap: ${result.gap.toFixed(2)}`
  );
}

console.log(`\nLegacy V1 Matcher Accuracy: ${legacyCorrect}/${directTotal} = ${((legacyCorrect/directTotal)*100).toFixed(1)}%`);

// ─── Full Engine Simulation ──────────────────────────────────────────────────
printSubHeader('TEST 3: Full Adaptive Engine Simulation (10 runs)');

// Run full engine on the 10 most important cases
const fullEngineCases = simulationCases.slice(0, 12); // All 12 pure archetypes

let engineCorrect = 0;
let engineTotal = 0;

for (const testCase of fullEngineCases) {
  // Run 3 times with different question order to check stability
  const results: string[] = [];
  const details: any[] = [];

  for (let run = 0; run < 3; run++) {
    const result = runFullEngineSimulation(testCase.traitProfile);
    results.push(result.primaryArchetype);
    details.push(result);
  }

  const allSame = results.every((r) => r === results[0]);
  const isCorrect = results[0] === testCase.expectedArchetype;
  if (isCorrect) engineCorrect++;
  engineTotal++;

  const stability = allSame ? 'stable' : 'UNSTABLE';
  const status = isCorrect ? '✅ PASS' : '❌ FAIL';

  console.log(
    `${status} | ${testCase.name.padEnd(28)} | expected: ${testCase.expectedArchetype.padEnd(14)} | got: ${results[0].padEnd(14)} | stability: ${stability} | answered: ${details[0].answeredCount}`
  );

  if (!allSame) {
    console.log(`       runs: ${results.join(' → ')}`);
  }
}

console.log(`\nFull Engine Accuracy: ${engineCorrect}/${engineTotal} = ${((engineCorrect/engineTotal)*100).toFixed(1)}%`);

// ─── Summary ─────────────────────────────────────────────────────────────────
printHeader('SIMULATION SUMMARY');
console.log(`Direct V2 Matcher:    ${((directCorrect/directTotal)*100).toFixed(1)}% (${directCorrect}/${directTotal})`);
console.log(`Legacy V1 Matcher:    ${((legacyCorrect/directTotal)*100).toFixed(1)}% (${legacyCorrect}/${directTotal})`);
console.log(`Full Engine (12 pure): ${((engineCorrect/engineTotal)*100).toFixed(1)}% (${engineCorrect}/${engineTotal})`);

const overallCorrect = directCorrect + engineCorrect;
const overallTotal = directTotal + engineTotal;
console.log(`\nOverall Accuracy:     ${((overallCorrect/overallTotal)*100).toFixed(1)}% (${overallCorrect}/${overallTotal})`);

// Check for archetypes that are frequently misclassified
printSubHeader('Misclassification Pattern Analysis');
const misclassifications: Record<string, { expected: string; got: string; count: number }> = {};

for (const testCase of simulationCases) {
  const result = runMatcherV2Direct(testCase.traitProfile);
  if (result.primary !== testCase.expectedArchetype) {
    const key = `${testCase.expectedArchetype}→${result.primary}`;
    misclassifications[key] = {
      expected: testCase.expectedArchetype,
      got: result.primary,
      count: (misclassifications[key]?.count ?? 0) + 1,
    };
  }
}

const misclassList = Object.values(misclassifications).sort((a, b) => b.count - a.count);
if (misclassList.length === 0) {
  console.log('No misclassifications detected in simulation set.');
} else {
  for (const m of misclassList) {
    console.log(`  ${m.expected} misclassified as ${m.got}: ${m.count} case(s)`);
  }
}

console.log('\n');
