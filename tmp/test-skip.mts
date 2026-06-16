import { skipQuestion, initializeEngineState, selectNextQuestion, processAnswer } from '../packages/shared/src/personality/adaptiveEngine.js';
import { questionsV4 } from '../packages/shared/src/personality/questionsV4.js';

// 1. Basic skip should exclude the skipped ID
const s = initializeEngineState();
const r = skipQuestion(s, 'Q1');
console.log('skip Q1 newQuestion:', r?.newQuestion?.id);
console.log('Q1 in skipped?', r?.newState.skippedQuestionIds.has('Q1'));

// 2. Variant exclusion: answer Q21, then Q21_v1 should not be selected
let state2 = initializeEngineState();
const q21 = questionsV4.find((q) => q.id === 'Q21')!;
const q21v1 = questionsV4.find((q) => q.id === 'Q21_v1')!;
state2 = processAnswer(state2, q21, 'A');
const nextAfterQ21 = selectNextQuestion(state2);
console.log('next after answering Q21:', nextAfterQ21?.id, '(should not be Q21_v1)');

// 3. Skip Q21_v1 should also exclude Q21 (already answered here, but test filter)
let state3 = initializeEngineState();
state3 = processAnswer(state3, q21v1, 'A');
const nextAfterVariant = selectNextQuestion(state3);
console.log('next after answering Q21_v1:', nextAfterVariant?.id, '(should not be Q21)');
