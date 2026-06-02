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

function search(numOptions: number, targetMapping: Record<number, string[]>, minMargin = 0.3): { options: Record<string, number>[]; inflation: number; margin: number } | null {
  const combos = Array.from(scoreCombos());
  let best: { options: Record<string, number>[]; inflation: number; margin: number } | null = null;
  
  for (let iter = 0; iter < 800000; iter++) {
    const opts: Record<string, number>[] = [];
    for (let i = 0; i < numOptions; i++) {
      opts.push(combos[Math.floor(Math.random() * combos.length)]);
    }
    
    let valid = true;
    let minM = Infinity;
    for (const [optIdxStr, archetypeIds] of Object.entries(targetMapping)) {
      const optIdx = parseInt(optIdxStr);
      for (const aid of archetypeIds) {
        const myScore = scoreForArchetype(opts[optIdx], aid);
        for (let j = 0; j < numOptions; j++) {
          if (j === optIdx) continue;
          const otherScore = scoreForArchetype(opts[j], aid);
          const margin = myScore - otherScore;
          if (margin <= minMargin) { valid = false; break; }
          if (margin < minM) minM = margin;
        }
        if (!valid) break;
      }
      if (!valid) break;
    }
    if (!valid) continue;
    
    const inf = inflation(opts);
    if (!best || inf < best.inflation || (inf === best.inflation && minM > best.margin)) {
      best = { options: opts, inflation: inf, margin: minM };
      if (inf === 0) break; // perfect
    }
  }
  return best;
}

function formatScores(scores: Record<string, number>): string {
  return '{ ' + TRAITS.map(t => `${t}: ${scores[t] ?? 0}`).join(', ') + ' }';
}

function applyRewrite(file: string, id: string, newOptions: { value: string; text: string; scores: Record<string, number> }[]) {
  const content = readFileSync(file, 'utf-8');
  
  // Find the question block
  const startRegex = new RegExp(`(\\{\\s*id: "${id}"[\\s\\S]*?traitScores:) `, 'm');
  const match = content.match(startRegex);
  if (!match) {
    console.log(`❌ Could not find start of ${id}`);
    return;
  }
  
  const startIdx = content.indexOf(match[0]) + match[0].length;
  // Find the end of the options array
  const endRegex = /\n  \}\s*,?\s*(?:\n  \/\/|\n  \{|\n\})/;
  const endMatch = content.slice(startIdx).match(endRegex);
  if (!endMatch) {
    console.log(`❌ Could not find end of ${id}`);
    return;
  }
  const endIdx = startIdx + endMatch.index! + endMatch[0].indexOf('}') + 1;
  
  // Extract old options block
  const oldBlock = content.slice(startIdx, endIdx);
  
  // Build new options block
  let newBlock = '';
  for (let i = 0; i < newOptions.length; i++) {
    const opt = newOptions[i];
    newBlock += ` { ${opt.value}: "${opt.text}", traitScores: ${formatScores(opt.scores)} }${i < newOptions.length - 1 ? ',' : ''}`;
  }
  
  const newContent = content.slice(0, startIdx) + newBlock + content.slice(endIdx);
  writeFileSync(file, newContent);
  console.log(`✅ Applied ${id}`);
}

// For questions without targetPairs, we need to infer from the text and primaryTraits
// Q49 (explore behavior): X, C, E, O — no clear pair, keep general
// Q54 (values): X, A, E — no clear pair, keep general
// Q55 (history): X, A, E — no clear pair, keep general
// Q73 (humor): P, X, A — no clear pair, keep general

console.log("=== Searching for optimal scores ===\n");

const SOLUTIONS: Record<string, { file: string; options: { value: string; text: string; scores: Record<string, number> }[]; inflation: number; margin: number }> = {};

// Q130
let r = search(4, { 0: ['rooster'], 1: ['koala'] });
if (r) SOLUTIONS['Q130'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '「没事！这都是小事，明天肯定会更好的！」积极鼓励', scores: r.options[0] },
  { value: 'B', text: '静静听完，给一个拥抱或者陪着TA', scores: r.options[1] },
  { value: 'C', text: '帮TA分析问题，提出解决方案', scores: r.options[2] },
  { value: 'D', text: '说几句安慰的话，然后岔开话题聊点开心的', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q124
r = search(4, { 0: ['koala'], 1: ['dolphin_calm'] });
if (r) SOLUTIONS['Q124'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '确保每个人都被照顾到，没有人被冷落', scores: r.options[0] },
  { value: 'B', text: '让整体氛围轻松愉快，大家都玩得开心', scores: r.options[1] },
  { value: 'C', text: '活动流程顺畅，时间安排合理', scores: r.options[2] },
  { value: 'D', text: '惊喜环节够特别，让寿星印象深刻', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q131
r = search(4, { 0: ['rooster'], 1: ['dolphin_calm'] });
if (r) SOLUTIONS['Q131'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '立刻活跃气氛，"我们可以的！一起加油！"，带动大家打起精神', scores: r.options[0] },
  { value: 'B', text: '保持冷静，分析问题，给出实际可行的建议', scores: r.options[1] },
  { value: 'C', text: '默默做好自己的部分，用行动支持团队', scores: r.options[2] },
  { value: 'D', text: '倾听每个人的想法，找到大家都认可的方向', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q135
r = search(4, { 0: ['hamster_praise'], 1: ['koala'] });
if (r) SOLUTIONS['Q135'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '"哇！太棒了！你真的超厉害！"，各种夸赞和感叹', scores: r.options[0] },
  { value: 'B', text: '给一个温暖的拥抱，真诚地说"我为你感到开心"', scores: r.options[1] },
  { value: 'C', text: '微笑点头，说"恭喜"，保持礼貌距离', scores: r.options[2] },
  { value: 'D', text: '"意料之中，你一直都很优秀"，冷静肯定', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q114
r = search(4, { 0: ['rooster'], 1: ['koala'] });
if (r) SOLUTIONS['Q114'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '用幽默和乐观的态度帮ta振作起来', scores: r.options[0] },
  { value: 'B', text: '认真倾听，给予温暖的理解和支持', scores: r.options[1] },
  { value: 'C', text: '分享自己的经验，提供实用的建议', scores: r.options[2] },
  { value: 'D', text: '陪ta做点开心的事，转移注意力', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q108
r = search(4, { 0: ['rooster'], 1: ['corgi'] });
if (r) SOLUTIONS['Q108'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '成为焦点、带动全场气氛high起来', scores: r.options[0] },
  { value: 'B', text: '和每个人都聊得开心、让大家都舒服', scores: r.options[1] },
  { value: 'C', text: '找到几个特别聊得来的人深入交流', scores: r.options[2] },
  { value: 'D', text: '观察大家的互动，感受社交的有趣之处', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q132
r = search(4, { 0: ['owl'], 1: ['turtle'] });
if (r) SOLUTIONS['Q132'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '想一些新奇的主题，比如角色扮演、密室逃脱之类的有创意的形式', scores: r.options[0] },
  { value: 'B', text: '参考以前成功的聚会形式，做个靠谱的经典聚餐或K歌', scores: r.options[1] },
  { value: 'C', text: '随便聊聊天就行，大家开心最重要，不用太复杂', scores: r.options[2] },
  { value: 'D', text: '先问问大家想做什么，收集意见再决定', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q93
r = search(4, { 0: ['koala'], 1: ['elephant'], 2: ['spider'] });
if (r) SOLUTIONS['Q93'] = { file: 'packages/shared/src/personality/questionsV4Advanced.ts', options: [
  { value: 'A', text: '第一时间放下手头的事去帮忙，朋友有难义不容辞', scores: r.options[0] },
  { value: 'B', text: '先了解清楚情况，制定合理的帮助计划再行动', scores: r.options[1] },
  { value: 'C', text: '帮忙的同时也会协调其他资源，让帮助更有效率', scores: r.options[2] },
  { value: 'D', text: '想帮但不太确定怎么帮最好，先观察再说', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q125
r = search(4, { 0: ['rooster'], 1: ['dolphin_calm'] });
if (r) SOLUTIONS['Q125'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '主动打气！"别灰心，我们一定能搞定！"带动大家的情绪', scores: r.options[0] },
  { value: 'B', text: '保持冷静，说"慢慢来，一步一步解决"', scores: r.options[1] },
  { value: 'C', text: '默默多承担一些任务，用行动支持团队', scores: r.options[2] },
  { value: 'D', text: '分析问题出在哪里，提出调整方案', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q134
r = search(4, { 0: ['spider'], 1: ['elephant'] });
if (r) SOLUTIONS['Q134'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '详细规划每天行程、交通、预算，做好备选方案', scores: r.options[0] },
  { value: 'B', text: '定好大方向和关键节点，其他随机应变', scores: r.options[1] },
  { value: 'C', text: '问问大家想去哪，根据大家意见来', scores: r.options[2] },
  { value: 'D', text: '随缘吧，走到哪算哪，轻松就好', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q107
r = search(4, { 0: ['rooster'], 1: ['corgi'] });
if (r) SOLUTIONS['Q107'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '去热闹的场合感受氛围，被人群的能量感染', scores: r.options[0] },
  { value: 'B', text: '和亲近的朋友深度聊天，互相鼓励打气', scores: r.options[1] },
  { value: 'C', text: '做点让自己开心的事，比如吃顿好的、看个喜剧', scores: r.options[2] },
  { value: 'D', text: '好好睡一觉，安静地休息恢复', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q128
r = search(4, { 0: ['corgi'], 1: ['fox'] });
if (r) SOLUTIONS['Q128'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '派对本身就很好玩呀！人多热闹，肯定开心', scores: r.options[0] },
  { value: 'B', text: '可能认识一些有趣的新朋友，扩展社交圈', scores: r.options[1] },
  { value: 'C', text: '想观察不同类型的人，觉得挺有意思的', scores: r.options[2] },
  { value: 'D', text: '不太想去，除非有认识的人陪同', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q110
r = search(4, { 0: ['hamster_praise'], 1: ['corgi'] });
if (r) SOLUTIONS['Q110'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '每个人的情绪状态，谁需要被关注和肯定', scores: r.options[0] },
  { value: 'B', text: '怎么让气氛更活跃、让大家玩得更开心', scores: r.options[1] },
  { value: 'C', text: '谁比较有趣、值得深入认识', scores: r.options[2] },
  { value: 'D', text: '整体的群体动态和人际关系结构', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

// Q112
r = search(4, { 0: ['hamster_praise'], 1: ['corgi'] });
if (r) SOLUTIONS['Q112'] = { file: 'packages/shared/src/personality/questionsV4Attractor.ts', options: [
  { value: 'A', text: '认真倾听，给予真诚的鼓励和肯定', scores: r.options[0] },
  { value: 'B', text: '带ta去做些好玩的事，用快乐转移注意力', scores: r.options[1] },
  { value: 'C', text: '帮ta分析问题，一起想解决方案', scores: r.options[2] },
  { value: 'D', text: '默默陪伴，让ta知道我一直在', scores: r.options[3] },
], inflation: r.inflation, margin: r.margin };

console.log("\n=== Applying solutions ===\n");
for (const [id, data] of Object.entries(SOLUTIONS)) {
  console.log(`${id}: inflation=${data.inflation.toFixed(1)} margin=${data.margin.toFixed(2)}`);
  for (const opt of data.options) {
    console.log(`  ${opt.value}: ${formatScores(opt.scores)}`);
  }
}
