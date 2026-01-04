import { questionsV4 } from '../packages/shared/src/personality/questionsV4';
import { initializeEngineState, selectNextQuestion, processAnswer } from '../packages/shared/src/personality/adaptiveEngine';
import { DEFAULT_ASSESSMENT_CONFIG } from '../packages/shared/src/personality/types';

const NUM_SIMULATIONS = 1000;

const questionUsage: Map<string, number> = new Map();
const levelStats: Record<1|2|3, { total: number, used: Set<string> }> = { 
  1: { total: 0, used: new Set<string>() }, 
  2: { total: 0, used: new Set<string>() }, 
  3: { total: 0, used: new Set<string>() } 
};

questionsV4.forEach(q => {
  levelStats[q.level as 1|2|3].total++;
});

function simulateUser(): string[] {
  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
  let state = initializeEngineState(config);
  const askedQuestions: string[] = [];
  
  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;
    
    askedQuestions.push(question.id);
    const randomOption = question.options[Math.floor(Math.random() * question.options.length)];
    state = processAnswer(state, question, randomOption.value);
    
    if (askedQuestions.length >= 20) break;
  }
  
  return askedQuestions;
}

console.log("Running " + NUM_SIMULATIONS + " simulations...");

let totalQuestionsAsked = 0;
for (let i = 0; i < NUM_SIMULATIONS; i++) {
  const questions = simulateUser();
  totalQuestionsAsked += questions.length;
  questions.forEach(qId => {
    questionUsage.set(qId, (questionUsage.get(qId) || 0) + 1);
    const q = questionsV4.find(x => x.id === qId);
    if (q) levelStats[q.level as 1|2|3].used.add(qId);
  });
}

console.log("\n=== Question Coverage Analysis (1000 Users) ===\n");
console.log("Average questions per session: " + (totalQuestionsAsked / NUM_SIMULATIONS).toFixed(1));
console.log("Total unique questions in bank: " + questionsV4.length + "\n");

for (const level of [1, 2, 3] as const) {
  const stats = levelStats[level];
  const coverage = (stats.used.size / stats.total * 100).toFixed(1);
  console.log("Level " + level + ": " + stats.used.size + "/" + stats.total + " questions used (" + coverage + "% coverage)");
}

console.log("\n=== Usage Frequency by Level ===");
for (const level of [1, 2, 3] as const) {
  const levelQuestions = questionsV4.filter(q => q.level === level);
  let totalUsage = 0;
  levelQuestions.forEach(q => {
    totalUsage += questionUsage.get(q.id) || 0;
  });
  const avgUsage = totalUsage / levelQuestions.length;
  console.log("Level " + level + ": avg " + avgUsage.toFixed(1) + " uses per question");
}

console.log("\n=== Top 10 Most Used Questions ===");
const sorted = [...questionUsage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
sorted.forEach(([qId, count]) => {
  const q = questionsV4.find(x => x.id === qId);
  console.log("  " + qId + " (L" + q?.level + "): " + count + " times (" + (count/NUM_SIMULATIONS*100).toFixed(1) + "% of sessions)");
});

console.log("\n=== Least Used Questions (>0 usage) ===");
const usedQuestions = [...questionUsage.entries()].filter(([_, c]) => c > 0).sort((a, b) => a[1] - b[1]).slice(0, 10);
usedQuestions.forEach(([qId, count]) => {
  const q = questionsV4.find(x => x.id === qId);
  console.log("  " + qId + " (L" + q?.level + "): " + count + " times (" + (count/NUM_SIMULATIONS*100).toFixed(1) + "% of sessions)");
});

const neverUsed = questionsV4.filter(q => !questionUsage.has(q.id));
console.log("\n=== Never Used Questions: " + neverUsed.length + " ===");
if (neverUsed.length > 0 && neverUsed.length <= 30) {
  neverUsed.forEach(q => console.log("  " + q.id + " (L" + q.level + "): " + q.category));
}

console.log("\n=== New Differentiation Questions (Q119-Q126) ===");
for (let i = 119; i <= 126; i++) {
  const qId = "Q" + i;
  const count = questionUsage.get(qId) || 0;
  const q = questionsV4.find(x => x.id === qId);
  console.log("  " + qId + ": " + count + " times (" + (count/NUM_SIMULATIONS*100).toFixed(1) + "%) - " + (q?.category || "NOT FOUND"));
}

console.log("\n=== Questions with targetPairs (Confusion Pair Targeting) ===");
const targetPairQuestions = questionsV4.filter(q => q.targetPairs && q.targetPairs.length > 0);
console.log("Total targetPair questions: " + targetPairQuestions.length);
let usedTargetPair = 0;
targetPairQuestions.forEach(q => {
  if (questionUsage.has(q.id)) usedTargetPair++;
});
console.log("Used in simulations: " + usedTargetPair + "/" + targetPairQuestions.length + " (" + (usedTargetPair/targetPairQuestions.length*100).toFixed(1) + "%)");
