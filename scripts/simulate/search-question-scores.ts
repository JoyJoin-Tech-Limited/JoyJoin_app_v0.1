// Constrained search for balanced trait scores that preserve archetype mapping
import { readFileSync, writeFileSync } from 'fs';

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

function scoreForArchetype(scores: Record<string, number>, archetypeId: string): number {
  const p = ARCHETYPES[archetypeId];
  let s = 0;
  for (const t of TRAITS) s += (scores[t] || 0) * (p[t] / 100);
  return s;
}

function inflation(options: Record<string, number>[]): number {
  const net: Record<string, number> = {};
  for (const t of TRAITS) net[t] = 0;
  for (const opt of options) for (const t of TRAITS) net[t] += opt[t] || 0;
  return TRAITS.reduce((sum, t) => sum + Math.max(0, net[t]), 0);
}

function* scoreCombos(): Generator<Record<string, number>> {
  // Generate combos with exactly 2-3 non-zero traits, values in {-3,-2,-1,1,2,3,4}
  const values = [-3, -2, -1, 1, 2, 3, 4];
  for (const t1 of TRAITS) {
    for (const v1 of values) {
      for (const t2 of TRAITS) {
        if (t2 <= t1) continue;
        for (const v2 of values) {
          yield { [t1]: v1, [t2]: v2 };
          for (const t3 of TRAITS) {
            if (t3 <= t2) continue;
            for (const v3 of values) {
              yield { [t1]: v1, [t2]: v2, [t3]: v3 };
            }
          }
        }
      }
    }
  }
}

interface SearchParams {
  numOptions: number;
  targetMapping: Record<number, string[]>; // option index (0-based) → archetype ids that should prefer it
  oldOptions: Record<string, number>[];
}

function search(params: SearchParams): { options: Record<string, number>[]; inflation: number; margin: number } | null {
  const { numOptions, targetMapping, oldOptions } = params;
  const combos = Array.from(scoreCombos());
  console.log(`  Search space: ${combos.length} combos per option, ${numOptions} options`);
  
  let best: { options: Record<string, number>[]; inflation: number; margin: number } | null = null;
  let checked = 0;
  
  // Random sampling instead of exhaustive search
  const ITERATIONS = 500000;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const opts: Record<string, number>[] = [];
    for (let i = 0; i < numOptions; i++) {
      opts.push(combos[Math.floor(Math.random() * combos.length)]);
    }
    
    // Check mapping constraints
    let valid = true;
    let minMargin = Infinity;
    for (const [optIdxStr, archetypeIds] of Object.entries(targetMapping)) {
      const optIdx = parseInt(optIdxStr);
      for (const aid of archetypeIds) {
        const myScore = scoreForArchetype(opts[optIdx], aid);
        for (let j = 0; j < numOptions; j++) {
          if (j === optIdx) continue;
          const otherScore = scoreForArchetype(opts[j], aid);
          const margin = myScore - otherScore;
          if (margin <= 0.001) { valid = false; break; }
          if (margin < minMargin) minMargin = margin;
        }
        if (!valid) break;
      }
      if (!valid) break;
    }
    if (!valid) continue;
    
    checked++;
    const inf = inflation(opts);
    if (!best || inf < best.inflation || (inf === best.inflation && minMargin > best.margin)) {
      best = { options: opts, inflation: inf, margin: minMargin };
    }
  }
  
  console.log(`  Checked ${checked} valid combos. Best inflation: ${best?.inflation ?? 'none'}, margin: ${best?.margin.toFixed(2) ?? 'none'}`);
  return best;
}

// ============ Q130: 太阳鸡 vs 暖心熊 ============
console.log("\n=== Q130: 太阳鸡 vs 暖心熊 ===");
const q130 = search({
  numOptions: 4,
  targetMapping: { 0: ['rooster'], 1: ['koala'] },
  oldOptions: []
});

// ============ Q124: 暖心熊 vs 淡定海豚 ============
console.log("\n=== Q124: 暖心熊 vs 淡定海豚 ===");
const q124 = search({
  numOptions: 4,
  targetMapping: { 0: ['koala'], 1: ['dolphin_calm'] },
  oldOptions: []
});

// ============ Q131: 太阳鸡 vs 淡定海豚 ============
console.log("\n=== Q131: 太阳鸡 vs 淡定海豚 ===");
const q131 = search({
  numOptions: 4,
  targetMapping: { 0: ['rooster'], 1: ['dolphin_calm'] },
  oldOptions: []
});

// ============ Q135: 夸夸豚 vs 暖心熊 ============
console.log("\n=== Q135: 夸夸豚 vs 暖心熊 ===");
const q135 = search({
  numOptions: 4,
  targetMapping: { 0: ['hamster_praise'], 1: ['koala'] },
  oldOptions: []
});

// ============ Q114: 太阳鸡 vs 暖心熊 ============
console.log("\n=== Q114: 太阳鸡 vs 暖心熊 ===");
const q114 = search({
  numOptions: 4,
  targetMapping: { 0: ['rooster'], 1: ['koala'] },
  oldOptions: []
});

// ============ Q108: 太阳鸡 vs 开心柯基 ============
console.log("\n=== Q108: 太阳鸡 vs 开心柯基 ===");
const q108 = search({
  numOptions: 4,
  targetMapping: { 0: ['rooster'], 1: ['corgi'] },
  oldOptions: []
});

// ============ Q132: 沉思猫头鹰 vs 稳如龟 ============
console.log("\n=== Q132: 沉思猫头鹰 vs 稳如龟 ===");
const q132 = search({
  numOptions: 4,
  targetMapping: { 0: ['owl'], 1: ['turtle'] },
  oldOptions: []
});

// ============ Q93: 暖心熊 vs 定心大象 vs 织网蛛 ============
console.log("\n=== Q93: 暖心熊 vs 定心大象 vs 织网蛛 ===");
const q93 = search({
  numOptions: 4,
  targetMapping: { 0: ['koala'], 1: ['elephant'], 2: ['spider'] },
  oldOptions: []
});

// ============ Q125: 太阳鸡 vs 淡定海豚 ============
console.log("\n=== Q125: 太阳鸡 vs 淡定海豚 ===");
const q125 = search({
  numOptions: 4,
  targetMapping: { 0: ['rooster'], 1: ['dolphin_calm'] },
  oldOptions: []
});

// ============ Q134: 织网蛛 vs 定心大象 ============
console.log("\n=== Q134: 织网蛛 vs 定心大象 ===");
const q134 = search({
  numOptions: 4,
  targetMapping: { 0: ['spider'], 1: ['elephant'] },
  oldOptions: []
});

// ============ Q107: 太阳鸡 vs 开心柯基 ============
console.log("\n=== Q107: 太阳鸡 vs 开心柯基 ===");
const q107 = search({
  numOptions: 4,
  targetMapping: { 0: ['rooster'], 1: ['corgi'] },
  oldOptions: []
});

// ============ Q128: 开心柯基 vs 机智狐 ============
console.log("\n=== Q128: 开心柯基 vs 机智狐 ===");
const q128 = search({
  numOptions: 4,
  targetMapping: { 0: ['corgi'], 1: ['fox'] },
  oldOptions: []
});

// ============ Q110: 夸夸豚 vs 开心柯基 ============
console.log("\n=== Q110: 夸夸豚 vs 开心柯基 ===");
const q110 = search({
  numOptions: 4,
  targetMapping: { 0: ['hamster_praise'], 1: ['corgi'] },
  oldOptions: []
});

// ============ Q112: 夸夸豚 vs 开心柯基 ============
console.log("\n=== Q112: 夸夸豚 vs 开心柯基 ===");
const q112 = search({
  numOptions: 4,
  targetMapping: { 0: ['hamster_praise'], 1: ['corgi'] },
  oldOptions: []
});

console.log("\n=== SUMMARY ===");
const results = { q130, q124, q131, q135, q114, q108, q132, q93, q125, q134, q107, q128, q110, q112 };
for (const [name, r] of Object.entries(results)) {
  if (r) {
    console.log(`${name}: inflation=${r.inflation.toFixed(1)}, margin=${r.margin.toFixed(2)}`);
  } else {
    console.log(`${name}: NO SOLUTION FOUND`);
  }
}
