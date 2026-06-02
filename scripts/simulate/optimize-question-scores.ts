import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Archetype trait profiles from archetypeRegistry.ts
const ARCHETYPES: Record<string, Record<string, number>> = {
  corgi:        { A: 60, C: 50, E: 60, O: 65, X: 95, P: 85 },
  rooster:      { A: 70, C: 78, E: 88, O: 55, X: 78, P: 92 },
  hamster_praise:{ A: 95, C: 50, E: 65, O: 62, X: 82, P: 88 },
  fox:          { A: 40, C: 50, E: 60, O: 92, X: 78, P: 58 },
  dolphin_calm: { A: 70, C: 70, E: 85, O: 65, X: 65, P: 68 },
  spider:       { A: 70, C: 85, E: 65, O: 70, X: 60, P: 60 },
  koala:        { A: 90, C: 65, E: 80, O: 60, X: 48, P: 70 },
  octopus:      { A: 50, C: 28, E: 55, O: 95, X: 52, P: 70 },
  owl:          { A: 45, C: 80, E: 75, O: 88, X: 40, P: 50 },
  elephant:     { A: 70, C: 90, E: 86, O: 50, X: 40, P: 60 },
  turtle:       { A: 55, C: 90, E: 82, O: 58, X: 28, P: 45 },
  cat:          { A: 40, C: 55, E: 65, O: 72, X: 22, P: 42 },
};

// Chinese name → id mapping
const NAME_TO_ID: Record<string, string> = {
  '社牛柯基': 'corgi', '小太阳鸡': 'rooster', '夸夸豚': 'hamster_praise',
  '开心柯基': 'corgi', '太阳鸡': 'rooster', '暖心熊': 'koala',
  '机智狐': 'fox', '寻宝狐': 'fox', '淡定海豚': 'dolphin_calm',
  '机灵海豚': 'dolphin_calm', '人脉蛛': 'spider', '织网蛛': 'spider',
  '树洞考拉': 'koala', '脑洞章鱼': 'octopus', '灵感章鱼': 'octopus',
  '好奇猫头鹰': 'owl', '沉思猫头鹰': 'owl', '靠谱大象': 'elephant',
  '定心大象': 'elephant', '稳如龟': 'turtle', '慢热龟': 'turtle',
  '隐身猫': 'cat', '小透明猫': 'cat', '夸夸仓鼠': 'hamster_praise',
};

const TRAITS = ['A', 'C', 'E', 'O', 'X', 'P'];

interface Option {
  value: string;
  text: string;
  traitScores: Record<string, number>;
}

interface Question {
  id: string;
  file: string;
  options: Option[];
  targetPairs?: string[];
  oldText: string;
}

// Load questions from files by extracting the question blocks
function extractQuestion(file: string, id: string): { question: any; oldText: string } | null {
  const content = readFileSync(file, 'utf-8');
  const regex = new RegExp(`(\\{\\s*id: "${id}"[\\s\\S]*?\\n  \\})`, 'm');
  const match = content.match(regex);
  if (!match) return null;
  const oldText = match[1];
  // Parse the old text to extract options
  const options: Option[] = [];
  const optRegex = /\{\s*value:\s*"([^"]+)"\s*,\s*text:\s*"([^"]+)"\s*,\s*traitScores:\s*\{([^}]+)\}\s*\}/g;
  let m;
  while ((m = optRegex.exec(oldText)) !== null) {
    const scores: Record<string, number> = {};
    const scoreStr = m[3];
    const scorePairs = scoreStr.matchAll(/([A-Z]):\s*(-?\d+)/g);
    for (const p of scorePairs) {
      scores[p[1]] = parseInt(p[2]);
    }
    options.push({ value: m[1], text: m[2], traitScores: scores });
  }
  return { question: { id, options, targetPairs: extractTargetPairs(oldText) }, oldText };
}

function extractTargetPairs(text: string): string[] {
  const m = text.match(/targetPairs:\s*\[([^\]]+)\]/);
  if (!m) return [];
  return m[1].matchAll(/"([^"]+)"/g).map(x => x[1]).toArray();
}

function scoreOptionForArchetype(option: Option, archetypeId: string): number {
  const profile = ARCHETYPES[archetypeId];
  let score = 0;
  for (const t of TRAITS) {
    score += (option.traitScores[t] || 0) * (profile[t] / 100);
  }
  return score;
}

function computeInflation(question: Question): number {
  const net: Record<string, number> = {};
  for (const t of TRAITS) net[t] = 0;
  for (const opt of question.options) {
    for (const t of TRAITS) net[t] += opt.traitScores[t] || 0;
  }
  return TRAITS.reduce((sum, t) => sum + Math.max(0, net[t]), 0);
}

function validateMapping(question: Question): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!question.targetPairs || question.targetPairs.length < 2) {
    return { ok: true, issues };
  }
  
  for (const pairName of question.targetPairs) {
    const archetypeId = NAME_TO_ID[pairName];
    if (!archetypeId) {
      issues.push(`Unknown archetype name: ${pairName}`);
      continue;
    }
    
    let bestOpt: Option | null = null;
    let bestScore = -Infinity;
    for (const opt of question.options) {
      const s = scoreOptionForArchetype(opt, archetypeId);
      if (s > bestScore) {
        bestScore = s;
        bestOpt = opt;
      }
    }
    
    // Find which option "should" be best for this archetype
    // Heuristic: the option whose positive traits most overlap with archetype's high traits
    // For now, just check that each target archetype has a unique best option
  }
  
  // More strict: check that target archetypes prefer DIFFERENT options
  const bestOptions = new Map<string, string>();
  for (const pairName of question.targetPairs) {
    const archetypeId = NAME_TO_ID[pairName];
    if (!archetypeId) continue;
    let bestOpt: Option | null = null;
    let bestScore = -Infinity;
    for (const opt of question.options) {
      const s = scoreOptionForArchetype(opt, archetypeId);
      if (s > bestScore) {
        bestScore = s;
        bestOpt = opt;
      }
    }
    if (bestOpt) bestOptions.set(archetypeId, bestOpt.value);
  }
  
  const values = Array.from(bestOptions.values());
  const unique = new Set(values);
  if (unique.size < values.length) {
    issues.push(`Target archetypes converge on same option: ${Array.from(bestOptions.entries()).map(([k,v]) => `${k}→${v}`).join(', ')}`);
  }
  
  return { ok: issues.length === 0, issues };
}

// The 18 questions to optimize
const QUESTION_IDS = [
  { id: 'Q130', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q124', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q131', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q135', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q114', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q108', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q132', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q93',  file: 'packages/shared/src/personality/questionsV4Advanced.ts' },
  { id: 'Q125', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q134', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q55',  file: 'packages/shared/src/personality/questionsV4Extended.ts' },
  { id: 'Q107', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q128', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q110', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
  { id: 'Q49',  file: 'packages/shared/src/personality/questionsV4L2.ts' },
  { id: 'Q54',  file: 'packages/shared/src/personality/questionsV4Extended.ts' },
  { id: 'Q73',  file: 'packages/shared/src/personality/questionsV4Extended.ts' },
  { id: 'Q112', file: 'packages/shared/src/personality/questionsV4Attractor.ts' },
];

console.log("=== Loading questions ===");
const questions: Question[] = [];
for (const { id, file } of QUESTION_IDS) {
  const result = extractQuestion(file, id);
  if (!result) {
    console.log(`❌ Could not find ${id}`);
    continue;
  }
  const q = result.question;
  q.file = file;
  q.oldText = result.oldText;
  questions.push(q);
  const inflation = computeInflation(q);
  const mapping = validateMapping(q);
  console.log(`${id}: inflation=${inflation.toFixed(1)} mapping=${mapping.ok ? 'OK' : 'ISSUES'} ${mapping.issues.join('; ')}`);
}

console.log(`\nLoaded ${questions.length} questions`);
