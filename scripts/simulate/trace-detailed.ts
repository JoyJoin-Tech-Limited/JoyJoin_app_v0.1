import fs from 'node:fs';
import { selectAnswerByTraits } from './lib/persona-utils';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import { initializeEngineState, selectNextQuestion, processAnswer } from '../../packages/shared/src/personality/adaptiveEngine';
import { DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const all = JSON.parse(fs.readFileSync('./scripts/simulate/data/all-personas.json', 'utf8'));

function tracePersona(labelSubstring: string) {
  const p = all.find((p: any) => p.label.includes(labelSubstring));
  if (!p) {
    console.log('Not found:', labelSubstring);
    return;
  }

  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
  let state = initializeEngineState(config);

  console.log(`\n=== ${p.label} ===`);
  console.log('Input traits:', JSON.stringify(p.traitProfile));

  for (let i = 0; i < 20; i++) {
    const q = selectNextQuestion(state);
    if (!q) break;
    const answer = selectAnswerByTraits(q, p.traitProfile, 'clean');
    const option = q.options.find((o: any) => o.value === answer);
    const scores = option?.traitScores || {};
    console.log(`${q.id}: ${option?.text?.slice(0, 35).padEnd(35)} | A=${scores.A ?? 0} C=${scores.C ?? 0} E=${scores.E ?? 0} O=${scores.O ?? 0} X=${scores.X ?? 0} P=${scores.P ?? 0}`);
    state = processAnswer(state, q, answer);
  }

  const traits: Record<string, number> = {};
  for (const [trait, info] of Object.entries(state.traitConfidences)) {
    traits[trait] = (info as any).score;
  }
  console.log('Final traits:', JSON.stringify(traits));
  console.log('Top match:', state.currentMatches[0]?.archetype, 'score=', state.currentMatches[0]?.score);
  console.log('2nd match:', state.currentMatches[1]?.archetype, 'score=', state.currentMatches[1]?.score);
}

// Trace key failing cases
tracePersona('脑洞章鱼 (centroid)');
tracePersona('慢热龟↔靠谱大象 (50/50)');
tracePersona('机灵海豚↔树洞考拉 (60/40)');
tracePersona('夸夸仓鼠↔小太阳鸡 (60/40)');
tracePersona('好奇猫头鹰↔脑洞章鱼 (50/50)');
