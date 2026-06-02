import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { initializeEngineState, processAnswer, selectNextQuestion } from '../../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import { selectAnswerByTraits } from './lib/persona-utils';
import { V2_ASSESSMENT_CONFIG, DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';
import { setMatcherDebug } from '../../packages/shared/src/personality/matcherV2';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, 'data/all-personas.json'), 'utf-8'));

const BASELINES = { A: 0.515, C: 0.531, E: 0.709, O: 0.429, X: 0.074, P: 0.327 };
Object.assign(DEFAULT_ASSESSMENT_CONFIG, {
  ...V2_ASSESSMENT_CONFIG,
  traitScoreBaselines: BASELINES,
  traitScoreMultiplier: 15,
  anchorQuestionCount: 10,
});

setMatcherDebug(false);

const targetId = process.argv[2] || 'boundary-22';
const anchorCount = parseInt(process.argv[3] || '9', 10);
Object.assign(DEFAULT_ASSESSMENT_CONFIG, { anchorQuestionCount: anchorCount });
const persona = data.find((p: any) => p.id === targetId);
if (!persona) {
  console.log('Persona not found:', targetId);
  process.exit(1);
}

console.log('=== Persona:', persona.id, persona.label, '→', persona.expectedArchetype, '===');
console.log('Traits:', JSON.stringify(persona.traitProfile));
console.log();

const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
let state = initializeEngineState(config);
let seed = 0;
const seededRandom = () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

while (true) {
  const question = selectNextQuestion(state);
  if (!question) break;
  const answer = selectAnswerByTraits(question, persona.traitProfile, 'clean', seededRandom);
  const option = question.options.find(o => o.value === answer)!;
  
  console.log(`${question.id} (${question.primaryTraits.join(',')}) → ${answer}: ${option.text.substring(0, 40)}...`);
  console.log(`  traits: ${JSON.stringify(option.traitScores)}`);
  
  state = processAnswer(state, question, answer);
  const traits = {} as Record<string, number>;
  for (const t of ['A','C','E','O','X','P']) {
    traits[t] = state.traitConfidences[t as any]?.score ?? 50;
  }
  console.log(`  cumul:  ${JSON.stringify(traits)}`);
  console.log(`  top2:   ${state.currentMatches.slice(0,2).map(m => `${m.archetype}(${m.score.toFixed(0)})`).join(', ')}`);
  console.log();
  
  if (state.questionHistory.length >= 25) break;
}

console.log('Final assigned:', state.currentMatches[0]?.archetype);
