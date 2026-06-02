#!/usr/bin/env node
/**
 * Test-Retest Reliability Harness
 * Runs end-to-end adaptive assessment multiple times per persona with different seeds
 * to measure consistency of assignment.
 *
 * Usage:
 *   tsx scripts/simulate/run-test-retest.ts --n=5 [--personas=boundaries|centroids|all]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectAnswerByTraits } from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import types only; actual modules loaded dynamically below for ESM compatibility
interface PersonaRecord {
  id: string;
  pair?: string;
  blendRatio?: number;
  traitProfile: Record<string, number>;
  expectedArchetype: string;
  category: 'boundary' | 'centroid';
  label: string;
}

interface RetestResult {
  personaId: string;
  personaLabel: string;
  category: 'boundary' | 'centroid';
  expectedArchetype: string;
  runs: Array<{
    seed: number;
    assignedArchetype: string | null;
    secondaryArchetype: string | null;
    confidence: number;
    confidenceGap: number;
    questionsAsked: number;
    l3DisambiguationTriggered: boolean;
    isExactMatch: boolean;
    isSimilarMatch: boolean;
  }>;
}

function loadPersonas(filter: 'boundaries' | 'centroids' | 'all'): PersonaRecord[] {
  const allPath = path.join(__dirname, 'data', 'all-personas.json');
  if (!fs.existsSync(allPath)) {
    throw new Error(`all-personas.json not found. Run generate-boundary-personas.ts first.`);
  }
  const all = JSON.parse(fs.readFileSync(allPath, 'utf8'));
  let records: PersonaRecord[] = Array.isArray(all) ? all : all.personas;
  if (filter !== 'all') {
    records = records.filter((p: PersonaRecord) => p.category === filter);
  }
  return records;
}

function createAnswerDeriver(targetProfile: Record<string, number>, noiseMode: string, seed: number) {
  // Simple LCG PRNG for reproducibility
  let state = seed || 1;
  const seededRandom = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  // Import questionsV4 for proper typing
  // We use dynamic require here to avoid top-level import issues
  return (question: any) => {
    return selectAnswerByTraits(question, targetProfile, noiseMode as any, seededRandom);
  };
}

async function main() {
  const args = process.argv.slice(2);
  const nRuns = parseInt(args.find((a) => a.startsWith('--n='))?.slice(4) || '5', 10);
  const personaFilter = (args.find((a) => a.startsWith('--personas='))?.slice(11) as 'boundaries' | 'centroids' | 'all') || 'all';
  const noiseMode = (args.find((a) => a.startsWith('--noise='))?.slice(8) as string) || 'clean';

  console.log(`🔬 Test-Retest Reliability Harness`);
  console.log(`   Runs per persona: ${nRuns}`);
  console.log(`   Noise mode: ${noiseMode}`);
  console.log(`   Persona filter: ${personaFilter}\n`);

  // Normalize filter: 'centroids' → 'centroid', 'boundaries' → 'boundary'
  const normalizedFilter = personaFilter === 'centroids' ? 'centroid' : personaFilter === 'boundaries' ? 'boundary' : personaFilter;
  const personas = loadPersonas(normalizedFilter as any);
  console.log(`Loaded ${personas.length} personas`);

  // Dynamic import of adaptive engine
  const adaptiveMod = await import('../../packages/shared/src/personality/adaptiveEngine');
  const registryMod = await import('../../packages/shared/src/personality/archetypeRegistry');
  const typesMod = await import('../../packages/shared/src/personality/types');
  const archetypeRegistry = registryMod.archetypeRegistry;
  const DEFAULT_ASSESSMENT_CONFIG = typesMod.DEFAULT_ASSESSMENT_CONFIG;

  const {
    initializeEngineState,
    processAnswer,
    selectNextQuestion,
    getFinalResult,
  } = adaptiveMod;

  const results: RetestResult[] = [];

  for (let i = 0; i < personas.length; i++) {
    const persona = personas[i];
    process.stdout.write(`\r[${i + 1}/${personas.length}] ${persona.label.padEnd(40)}`);

    const runs: RetestResult['runs'] = [];
    for (let seed = 1; seed <= nRuns; seed++) {
      const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
      let state = initializeEngineState(config);
      const answerDeriver = createAnswerDeriver(persona.traitProfile, noiseMode, seed + i * 1000);
      const questionSequence: string[] = [];
      let l3DisambiguationTriggered = false;

      while (true) {
        const question = selectNextQuestion(state);
        if (!question) break;
        questionSequence.push(question.id);
        if (question.level === 3) l3DisambiguationTriggered = true;

        const answer = answerDeriver(question);
        state = processAnswer(state, question, answer);
        if (questionSequence.length >= 25) break;
      }

      const topMatch = state.currentMatches[0];
      const secondMatch = state.currentMatches[1];
      const assigned = topMatch?.archetype ?? null;
      const secondary = secondMatch?.archetype ?? null;
      const confidence = topMatch?.confidence ?? 0;
      const confidenceGap = (topMatch?.confidence ?? 0) - (secondMatch?.confidence ?? 0);

      const expectedProto = archetypeRegistry[persona.expectedArchetype as keyof typeof archetypeRegistry];
      const isSimilar = expectedProto?.profile.confusableWith?.includes(assigned ?? '') ?? false;

      runs.push({
        seed,
        assignedArchetype: assigned,
        secondaryArchetype: secondary,
        confidence,
        confidenceGap,
        questionsAsked: questionSequence.length,
        l3DisambiguationTriggered,
        isExactMatch: assigned === persona.expectedArchetype,
        isSimilarMatch: assigned === persona.expectedArchetype || isSimilar,
      });
    }

    results.push({
      personaId: persona.id,
      personaLabel: persona.label,
      category: persona.category,
      expectedArchetype: persona.expectedArchetype,
      runs,
    });
  }

  console.log('\n');

  // ── Summary ──
  const exactRates = results.map((r) => {
    const exact = r.runs.filter((run) => run.isExactMatch).length;
    return exact / r.runs.length;
  });
  const similarRates = results.map((r) => {
    const similar = r.runs.filter((run) => run.isExactMatch || run.isSimilarMatch).length;
    return similar / r.runs.length;
  });
  const consistency = results.map((r) => {
    const first = r.runs[0].assignedArchetype;
    return r.runs.every((run) => run.assignedArchetype === first) ? 1 : 0;
  });

  const avgExact = exactRates.reduce((s, v) => s + v, 0) / exactRates.length;
  const avgSimilar = similarRates.reduce((s, v) => s + v, 0) / similarRates.length;
  const avgConsistency = consistency.reduce((s, v) => s + v, 0) / consistency.length;

  console.log('═'.repeat(70));
  console.log('📊 Test-Retest Summary');
  console.log('═'.repeat(70));
  console.log(`Total personas tested: ${results.length}`);
  console.log(`Runs per persona: ${nRuns}`);
  console.log(`Avg exact match rate: ${(avgExact * 100).toFixed(1)}%`);
  console.log(`Avg similar+exact rate: ${(avgSimilar * 100).toFixed(1)}%`);
  console.log(`Avg assignment consistency: ${(avgConsistency * 100).toFixed(1)}%`);
  console.log('═'.repeat(70));

  // Per-persona table
  console.log(`\n📋 Per-Persona Results:`);
  console.log(
    `${'Persona'.padEnd(30)} ${'Cat'.padEnd(10)} ${'Exact'.padEnd(8)} ${'Sim+Ex'.padEnd(8)} ${'Consist'.padEnd(8)} ${'AvgConf'.padEnd(8)} ${'AvgQ'.padEnd(6)}`
  );
  console.log('─'.repeat(80));

  for (const r of results) {
    const exact = r.runs.filter((run) => run.isExactMatch).length;
    const similar = r.runs.filter((run) => run.isExactMatch || run.isSimilarMatch).length;
    const consist = r.runs.every((run) => run.assignedArchetype === r.runs[0].assignedArchetype);
    const avgConf = r.runs.reduce((s, run) => s + run.confidence, 0) / r.runs.length;
    const avgQ = r.runs.reduce((s, run) => s + run.questionsAsked, 0) / r.runs.length;
    console.log(
      `${r.personaLabel.slice(0, 28).padEnd(30)} ${r.category.padEnd(10)} ` +
      `${(exact / r.runs.length * 100).toFixed(0).padStart(3)}%      ` +
      `${(similar / r.runs.length * 100).toFixed(0).padStart(3)}%      ` +
      `${consist ? '✅' : '❌'}      ` +
      `${avgConf.toFixed(3).padEnd(8)} ` +
      `${avgQ.toFixed(1).padEnd(6)}`
    );
  }

  // Identify inconsistent personas
  const inconsistent = results.filter((r) => !r.runs.every((run) => run.assignedArchetype === r.runs[0].assignedArchetype));
  if (inconsistent.length > 0) {
    console.log(`\n⚠️  Inconsistent Assignments (${inconsistent.length} personas):`);
    for (const r of inconsistent) {
      const assignments = r.runs.map((run) => `${run.assignedArchetype}(seed=${run.seed})`).join(', ');
      console.log(`  ${r.personaLabel}: ${assignments}`);
    }
  }

  // Write JSON artifact
  const artifact = {
    meta: {
      timestamp: new Date().toISOString(),
      nRuns,
      noise: noiseMode,
      personaFilter,
      personaCount: personas.length,
    },
    summary: {
      avgExactMatchRate: avgExact,
      avgSimilarOrExactRate: avgSimilar,
      avgAssignmentConsistency: avgConsistency,
    },
    results,
  };

  const artifactPath = path.join(__dirname, 'data', `test-retest-${noiseMode}-${nRuns}runs-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\n✅ Artifact written: ${artifactPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
