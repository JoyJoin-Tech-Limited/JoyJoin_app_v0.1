// Manual rewrites with semantic alignment + validation
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

const TRAITS = ['A', 'C', 'E', 'O', 'X', 'P'];

function score(scores: Record<string, number>, archetypeId: string): number {
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

function validate(id: string, options: Record<string, number>[], targets: string[][]): { inflation: number; margins: number[]; ok: boolean } {
  const inf = inflation(options);
  const margins: number[] = [];
  let ok = true;
  
  for (let i = 0; i < targets.length; i++) {
    for (const aid of targets[i]) {
      const myScore = score(options[i], aid);
      let bestOther = -Infinity;
      for (let j = 0; j < options.length; j++) {
        if (j === i) continue;
        const otherScore = score(options[j], aid);
        if (otherScore > bestOther) bestOther = otherScore;
      }
      const margin = myScore - bestOther;
      margins.push(margin);
      if (margin <= 0) ok = false;
    }
  }
  
  return { inflation: inf, margins, ok };
}

function print(id: string, options: Record<string, number>[], targets: string[][]) {
  const v = validate(id, options, targets);
  console.log(`\n${id}: inflation=${v.inflation.toFixed(1)} ok=${v.ok} margins=[${v.margins.map(m => m.toFixed(2)).join(', ')}]`);
  for (let i = 0; i < options.length; i++) {
    const net = TRAITS.reduce((s, t) => s + (options[i][t] || 0), 0);
    console.log(`  ${String.fromCharCode(65+i)}: ${JSON.stringify(options[i]).replace(/"/g,'')} sum=${net}`);
  }
}

// ==================== DESIGNS ====================

// Q130: 太阳鸡 vs 暖心熊
// Rooster: high E,P,X; Koala: high A,E
const q130 = [
  { A: -2, C: -2, E: 2, O: -2, X: 4, P: 3 },   // A: rooster (cheer up)
  { A: 4, C: -1, E: 1, O: -1, X: -3, P: 1 },    // B: koala (listen)
  { A: -2, C: 3, E: 1, O: 2, X: -2, P: -2 },    // C: owl (analyze)
  { A: -1, C: -1, E: -2, O: 1, X: 2, P: -2 },   // D: fox (distract)
];
print('Q130', q130, [['rooster'], ['koala']]);

// Q124: 暖心熊 vs 淡定海豚
// Koala: high A,E; Dolphin: high E, balanced
const q124 = [
  { A: 4, C: -1, E: 1, O: -1, X: -2, P: 1 },    // A: koala (inclusive)
  { A: 0, C: 0, E: 2, O: 0, X: 2, P: 0 },        // B: dolphin (vibe)
  { A: -2, C: 3, E: 1, O: 0, X: 0, P: -2 },      // C: spider (logistics)
  { A: -1, C: -1, E: -1, O: 4, X: 1, P: 1 },     // D: fox (surprise)
];
print('Q124', q124, [['koala'], ['dolphin_calm']]);

// Q131: 太阳鸡 vs 淡定海豚
// Rooster: high E,P,X; Dolphin: high E, balanced
const q131 = [
  { A: -1, C: -1, E: 1, O: -1, X: 4, P: 3 },    // A: rooster (energize)
  { A: 0, C: 2, E: 2, O: 0, X: -1, P: -2 },      // B: dolphin (calm analyze)
  { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 },      // C: elephant (action)
  { A: 3, C: -1, E: 0, O: 0, X: -2, P: 1 },      // D: koala (connect)
];
print('Q131', q131, [['rooster'], ['dolphin_calm']]);

// Q135: 夸夸豚 vs 暖心熊
// Hamster: high A,X,P; Koala: high A,E
const q135 = [
  { A: 1, C: -1, E: 0, O: 0, X: 3, P: 3 },       // A: hamster (enthusiastic)
  { A: 3, C: 0, E: 1, O: -1, X: -2, P: 1 },      // B: koala (sincere)
  { A: -1, C: 1, E: 2, O: 0, X: -2, P: -2 },     // C: turtle (reserved)
  { A: 1, C: 1, E: 2, O: 1, X: 0, P: -2 },       // D: elephant (steady)
];
print('Q135', q135, [['hamster_praise'], ['koala']]);

// Q114: 太阳鸡 vs 暖心熊
const q114 = [
  { A: -2, C: -2, E: 2, O: -1, X: 4, P: 2 },     // A: rooster (humor)
  { A: 4, C: -1, E: 1, O: -1, X: -3, P: 1 },     // B: koala (listen)
  { A: -1, C: 2, E: 0, O: 1, X: 0, P: -1 },      // C: spider (advice)
  { A: 0, C: -1, E: -1, O: 0, X: 2, P: 1 },      // D: corgi (distract)
];
print('Q114', q114, [['rooster'], ['koala']]);

// Q108: 太阳鸡 vs 开心柯基
// Rooster: high E,P,X; Corgi: very high X,P
const q108 = [
  { A: -1, C: -1, E: 2, O: -1, X: 3, P: 2 },     // A: rooster (center)
  { A: 2, C: 0, E: 0, O: -1, X: 2, P: 1 },       // B: corgi (socialize)
  { A: 1, C: 1, E: -1, O: 2, X: 0, P: -1 },      // C: owl (deep)
  { A: -1, C: 1, E: 0, O: 3, X: -3, P: -1 },     // D: cat (observe)
];
print('Q108', q108, [['rooster'], ['corgi']]);

// Q132: 沉思猫头鹰 vs 稳如龟
// Owl: high O,C,E; Turtle: high C,E, very low X
const q132 = [
  { A: -1, C: -1, E: 0, O: 4, X: 2, P: 1 },      // A: fox (creative)
  { A: 0, C: 3, E: 1, O: -2, X: -1, P: -1 },     // B: turtle (classic)
  { A: 1, C: -2, E: 1, O: -1, X: 2, P: 2 },      // C: corgi (casual)
  { A: 3, C: 1, E: 0, O: 0, X: -1, P: -1 },      // D: koala (consensus)
];
print('Q132', q132, [['owl'], ['turtle']]);

// Q93: 暖心熊 vs 定心大象 vs 织网蛛
// Koala: high A,E; Elephant: high C,E; Spider: high C,A
const q93 = [
  { A: 3, C: -1, E: 1, O: -1, X: 1, P: 1 },      // A: koala (emotional)
  { A: -1, C: 3, E: 1, O: 0, X: 0, P: -1 },      // B: elephant (plan)
  { A: 1, C: 2, E: 0, O: 1, X: 1, P: -1 },       // C: spider (network)
  { A: -1, C: 0, E: 1, O: 0, X: -2, P: -1 },     // D: cat (hesitate)
];
print('Q93', q93, [['koala'], ['elephant'], ['spider']]);

// Q125: 太阳鸡 vs 淡定海豚
const q125 = [
  { A: -1, C: -1, E: 1, O: -1, X: 4, P: 3 },     // A: rooster (cheer)
  { A: 0, C: 1, E: 2, O: 0, X: -1, P: -1 },      // B: dolphin (steady)
  { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 },      // C: elephant (action)
  { A: -1, C: 2, E: 0, O: 2, X: 0, P: -2 },      // D: owl (analyze)
];
print('Q125', q125, [['rooster'], ['dolphin_calm']]);

// Q134: 织网蛛 vs 定心大象
// Spider: high C,A; Elephant: high C,E
const q134 = [
  { A: -1, C: 4, E: 1, O: -1, X: -1, P: -1 },    // A: elephant (detailed)
  { A: 0, C: 1, E: 2, O: 1, X: 1, P: 1 },        // B: dolphin (flexible)
  { A: 3, C: -1, E: 0, O: 0, X: 1, P: 0 },       // C: koala (consensus)
  { A: -1, C: -3, E: 1, O: 2, X: 1, P: 2 },      // D: fox (go with flow)
];
print('Q134', q134, [['spider'], ['elephant']]);

// Q55: no target pairs, general
const q55 = [
  { A: 0, C: 1, E: -1, O: 0, X: 3, P: 1 },       // A: organizer
  { A: 1, C: 1, E: 1, O: 0, X: 1, P: 1 },        // B: supporter
  { A: 1, C: 0, E: 1, O: 1, X: -1, P: -1 },      // C: deep talker
  { A: -1, C: 0, E: 2, O: 1, X: -2, P: -1 },     // D: observer
];
print('Q55', q55, []);

// Q107: 太阳鸡 vs 开心柯基
const q107 = [
  { A: -1, C: -1, E: 1, O: -1, X: 4, P: 1 },     // A: corgi (crowd)
  { A: 2, C: 0, E: 0, O: -1, X: 1, P: 2 },       // B: hamster (friend)
  { A: -1, C: 0, E: 1, O: 0, X: -2, P: 1 },      // C: cat (solo)
  { A: 0, C: 0, E: 2, O: 0, X: -2, P: -1 },      // D: turtle (sleep)
];
print('Q107', q107, [['rooster'], ['corgi']]);

// Q128: 开心柯基 vs 机智狐
// Corgi: high X,P; Fox: high O,X
const q128 = [
  { A: 0, C: -1, E: -1, O: 0, X: 4, P: 3 },      // A: corgi (party)
  { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 },        // B: fox (network)
  { A: -1, C: 0, E: 1, O: 3, X: -1, P: 0 },      // C: owl (observe)
  { A: 1, C: 0, E: 1, O: -1, X: -3, P: -1 },     // D: turtle (avoid)
];
print('Q128', q128, [['corgi'], ['fox']]);

// Q110: 夸夸豚 vs 开心柯基
// Hamster: high A,X,P; Corgi: high X,P
const q110 = [
  { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 },      // A: hamster (affirm)
  { A: -1, C: 0, E: -1, O: 0, X: 4, P: -1 },     // B: corgi (activate)
  { A: -1, C: 0, E: 0, O: 2, X: 1, P: 0 },       // C: fox (interesting)
  { A: 0, C: 2, E: 0, O: 2, X: 0, P: -1 },       // D: spider (dynamics)
];
print('Q110', q110, [['hamster_praise'], ['corgi']]);

// Q49: general
const q49 = [
  { A: 0, C: -1, E: -1, O: 2, X: 3, P: 1 },      // A: explorer
  { A: 0, C: 3, E: 1, O: 0, X: 0, P: -1 },       // B: planner
  { A: 2, C: -1, E: 1, O: -1, X: 1, P: 0 },      // C: socializer
  { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 },     // D: avoider
];
print('Q49', q49, []);

// Q54: general
const q54 = [
  { A: -2, C: 0, E: 1, O: 1, X: 2, P: -1 },      // A: authentic
  { A: 3, C: 1, E: -1, O: -1, X: -1, P: 1 },     // B: harmonious
  { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 },        // C: adaptive
  { A: 1, C: -1, E: 1, O: 0, X: 1, P: 1 },       // D: integrated
];
print('Q54', q54, []);

// Q73: general
const q73 = [
  { A: -1, C: 0, E: -1, O: 0, X: 3, P: 3 },      // A: performer
  { A: 0, C: 1, E: 1, O: 0, X: 1, P: 1 },        // B: pleased
  { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 },       // C: surprised
  { A: 0, C: 1, E: 2, O: 0, X: -2, P: -2 },      // D: indifferent
];
print('Q73', q73, []);

// Q112: 夸夸豚 vs 开心柯基
const q112 = [
  { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 },      // A: hamster (encourage)
  { A: -1, C: -1, E: -1, O: 0, X: 3, P: -1 },    // B: corgi (fun)
  { A: -1, C: 2, E: 0, O: 2, X: 0, P: 0 },       // C: owl (solve)
  { A: 2, C: 0, E: 2, O: 0, X: -2, P: 1 },       // D: koala (accompany)
];
print('Q112', q112, [['hamster_praise'], ['corgi']]);
