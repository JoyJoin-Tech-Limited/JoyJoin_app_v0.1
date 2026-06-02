import { readFileSync, writeFileSync } from 'fs';

// Second pass: fix questions still with inflation > 10

const FIXES: Record<string, { file: string; question: any }> = {};

// === Q124: fix inflation 14 → target < 8 ===
FIXES['Q124'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q124",
    level: 3,
    category: "原型区分-暖心熊vs淡定海豚-聚会角色",
    scenarioText: "你在组织一个朋友的生日聚会。",
    questionText: "你最上心的是什么？",
    primaryTraits: ["A", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "淡定海豚"],
    cohortTag: 'steady_harmonizer',
    discriminationIndex: 0.65,
    options: [
      { value: "A", text: "确保没人被冷落，落单的人有人陪", traitScores: { A: 4, C: -1, E: -1, O: -1, X: -2, P: 1 } },
      { value: "B", text: "整体氛围轻松，大家玩得尽兴", traitScores: { A: 0, C: 0, E: 1, O: -1, X: 2, P: 0 } },
      { value: "C", text: "流程顺畅，突发状况有人兜底", traitScores: { A: -2, C: 3, E: 1, O: 0, X: 0, P: -2 } },
      { value: "D", text: "惊喜环节够特别，留下难忘记忆", traitScores: { A: -1, C: -1, E: 0, O: 4, X: 1, P: 1 } },
    ]
  }
};

// === Q131: fix inflation 12 → target < 8 ===
FIXES['Q131'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q131",
    level: 3,
    category: "能量表达方式",
    scenarioText: "团队项目遇到困难，大家情绪有点低落。",
    questionText: "你会怎么做？",
    primaryTraits: ["P", "X", "A"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.85,
    options: [
      { value: "A", text: "站起来说\"我们可以的！\"，先把士气拉起来", traitScores: { A: -2, C: -1, E: -1, O: 0, X: 4, P: 3 } },
      { value: "B", text: "安静分析问题，拿出几套可行的方案", traitScores: { A: -1, C: 3, E: 2, O: 1, X: -1, P: -2 } },
      { value: "C", text: "默默把最棘手的部分接过来，用行动扛住", traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 } },
      { value: "D", text: "一个个私聊，了解每个人真正的顾虑", traitScores: { A: 3, C: -1, E: 0, O: 0, X: -2, P: 1 } },
    ]
  }
};

// === Q135: fix inflation 13 → target < 8 ===
FIXES['Q135'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q135",
    level: 3,
    category: "情感表达深度",
    scenarioText: "好朋友分享了一个好消息。",
    questionText: "你的第一反应是？",
    primaryTraits: ["P", "A", "X"],
    isForcedChoice: true,
    targetPairs: ["夸夸豚", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.80,
    options: [
      { value: "A", text: "\"这也太厉害了吧！\"真心替ta高兴，情绪拉满", traitScores: { A: 1, C: -1, E: -1, O: 0, X: 3, P: 3 } },
      { value: "B", text: "认真听完，说一句\"我为你感到骄傲\"", traitScores: { A: 3, C: 0, E: 1, O: -1, X: -2, P: 1 } },
      { value: "C", text: "微笑点头，简单说句\"恭喜\"", traitScores: { A: -1, C: 1, E: 2, O: 0, X: -2, P: -2 } },
      { value: "D", text: "\"意料之中，你一直都很稳\"，冷静肯定", traitScores: { A: 1, C: 1, E: 2, O: 1, X: 0, P: -2 } },
    ]
  }
};

// === Q114: fix inflation 15 → target < 6 ===
FIXES['Q114'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q114",
    level: 3,
    category: "原型区分-太阳鸡vs暖心熊-给予方式",
    scenarioText: "朋友向你倾诉最近的烦恼。",
    questionText: "你通常会怎么回应？",
    primaryTraits: ["A", "P", "E", "X"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.58,
    options: [
      { value: "A", text: "先逗ta笑，把气氛从低落里拉出来", traitScores: { A: -2, C: -2, E: 1, O: -1, X: 4, P: 2 } },
      { value: "B", text: "安静听完，让ta知道你在认真听", traitScores: { A: 4, C: -1, E: 2, O: -1, X: -3, P: 1 } },
      { value: "C", text: "分享自己的类似经历，让ta知道不孤单", traitScores: { A: 1, C: -1, E: -1, O: 2, X: -1, P: -2 } },
      { value: "D", text: "陪ta做点开心的事，转移一下注意力", traitScores: { A: -1, C: -2, E: -2, O: 2, X: 2, P: 1 } },
    ]
  }
};

// === Q108: fix inflation 12 → target < 8 ===
FIXES['Q108'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q108",
    level: 3,
    category: "原型区分-太阳鸡vs开心柯基-社交目标",
    scenarioText: "参加一个人比较多的聚会活动。",
    questionText: "你最期待的是什么？",
    primaryTraits: ["X", "E", "A"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "开心柯基"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.48,
    options: [
      { value: "A", text: "成为焦点，带动全场气氛", traitScores: { A: -2, C: -1, E: 1, O: -1, X: 4, P: 2 } },
      { value: "B", text: "和每个人都聊得开心，没人觉得拘束", traitScores: { A: 2, C: 0, E: 0, O: -1, X: 2, P: 1 } },
      { value: "C", text: "找到几个聊得来的人，聊点深入的", traitScores: { A: 1, C: 1, E: -1, O: 2, X: 0, P: -1 } },
      { value: "D", text: "在一边观察大家的互动，感觉也挺有意思", traitScores: { A: -1, C: 1, E: 0, O: 3, X: -3, P: -1 } },
    ]
  }
};

// === Q132: fix inflation 13 → target < 8 ===
FIXES['Q132'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q132",
    level: 3,
    category: "思维方式偏好",
    scenarioText: "策划一个周末小型聚会，还没有具体方案。",
    questionText: "你更倾向于？",
    primaryTraits: ["O", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["沉思猫头鹰", "稳如龟"],
    cohortTag: 'quiet_anchor',
    discriminationIndex: 0.82,
    options: [
      { value: "A", text: "想个新奇主题，比如桌游 tournament 或城市探索", traitScores: { A: -1, C: -2, E: 0, O: 4, X: 2, P: 1 } },
      { value: "B", text: "参考以前成功的形式，经典聚餐或 K 歌", traitScores: { A: 0, C: 3, E: 1, O: -2, X: -1, P: -1 } },
      { value: "C", text: "随便聚聚，聊聊天就行，不用太复杂", traitScores: { A: 1, C: -2, E: 1, O: -1, X: 2, P: 2 } },
      { value: "D", text: "先问大家想做什么，按多数人的意愿来", traitScores: { A: 3, C: 1, E: 0, O: 0, X: -1, P: -1 } },
    ]
  }
};

// === Q93: fix inflation 11 → target < 8 ===
FIXES['Q93'] = {
  file: 'packages/shared/src/personality/questionsV4Advanced.ts',
  question: {
    id: "Q93",
    level: 2,
    category: "原型区分-暖心熊vs定心大象vs织网蛛",
    scenarioText: "朋友遇到困难需要帮忙，你通常会？",
    questionText: "你更倾向于？",
    primaryTraits: ["A", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "定心大象", "织网蛛"],
    cohortTag: 'steady_harmonizer',
    options: [
      { value: "A", text: "放下手头的事先陪ta，情绪上先接住", traitScores: { A: 3, C: -1, E: -1, O: 0, X: 1, P: 1 } },
      { value: "B", text: "先了解情况，制定帮助计划再行动", traitScores: { A: -1, C: 3, E: 1, O: 0, X: 0, P: -1 } },
      { value: "C", text: "帮ta协调资源，找更多人一起解决", traitScores: { A: 1, C: 2, E: 0, O: 1, X: 1, P: -1 } },
      { value: "D", text: "想帮但怕添乱，先观察再决定", traitScores: { A: -1, C: 0, E: 1, O: 0, X: -2, P: -1 } },
    ]
  }
};

// === Q125: fix inflation 12 → target < 8 ===
FIXES['Q125'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q125",
    level: 3,
    category: "原型区分-太阳鸡vs淡定海豚-能量输出",
    scenarioText: "团队项目遇到困难，大家有点泄气。",
    questionText: "你会怎么做？",
    primaryTraits: ["P", "X"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.70,
    options: [
      { value: "A", text: "主动打气：\"别灰心，我们一定能搞定！\"", traitScores: { A: -2, C: -1, E: -1, O: 0, X: 4, P: 3 } },
      { value: "B", text: "保持冷静：\"慢慢来，一步一步解决\"", traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: -1 } },
      { value: "C", text: "默默多承担一些任务，用行动支持", traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 } },
      { value: "D", text: "分析问题出在哪，提出调整方案", traitScores: { A: -1, C: 3, E: 0, O: 2, X: 0, P: -2 } },
    ]
  }
};

// === Q134: fix inflation 16 → target < 8 (WORST REMAINING) ===
FIXES['Q134'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q134",
    level: 3,
    category: "计划细节程度",
    scenarioText: "组织一次3天小团队旅行。",
    questionText: "你会怎么规划？",
    primaryTraits: ["C", "E", "A"],
    isForcedChoice: true,
    targetPairs: ["织网蛛", "定心大象"],
    cohortTag: 'steady_harmonizer',
    discriminationIndex: 0.76,
    options: [
      { value: "A", text: "详细规划行程、交通、预算，备好 Plan B", traitScores: { A: -1, C: 4, E: 1, O: -1, X: -1, P: -1 } },
      { value: "B", text: "定好大方向和关键节点，其他随机应变", traitScores: { A: 0, C: 1, E: 2, O: 1, X: 1, P: 1 } },
      { value: "C", text: "问大家想去哪，按多数人的意愿来", traitScores: { A: 3, C: -1, E: 0, O: 0, X: 1, P: 0 } },
      { value: "D", text: "随缘，走到哪算哪，轻松就好", traitScores: { A: -1, C: -3, E: 1, O: 2, X: 1, P: 2 } },
    ]
  }
};

// === Q54: fix inflation 13 → target < 8 ===
FIXES['Q54'] = {
  file: 'packages/shared/src/personality/questionsV4Extended.ts',
  question: {
    id: "Q54",
    level: 3,
    category: "价值观权衡",
    scenarioText: "对你而言，在社交中，做真实的自己和让周围的人感到舒服",
    questionText: "哪个更重要？",
    primaryTraits: ["X", "A", "E"],
    options: [
      { value: "A", text: "做真实的自己更重要，不需要为了迎合他人而改变", traitScores: { A: -2, C: 0, E: 1, O: 1, X: 2, P: -1 } },
      { value: "B", text: "让周围的人感到舒服更重要，和谐需要适当的调整", traitScores: { A: 3, C: 1, E: -1, O: -1, X: -1, P: 1 } },
      { value: "C", text: "看情况。在亲密朋友面前真实，在陌生环境里随和", traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 } },
      { value: "D", text: "两者不冲突，真实的自己就是能让别人舒服的", traitScores: { A: 1, C: -1, E: 1, O: 0, X: 1, P: 1 } },
    ]
  }
};

// === Q73: fix inflation 11 → target < 8 ===
FIXES['Q73'] = {
  file: 'packages/shared/src/personality/questionsV4Extended.ts',
  question: {
    id: "Q73",
    level: 2,
    category: "幽默风格",
    scenarioText: "你说了句话把朋友们逗笑了。",
    questionText: "你的感觉是？",
    primaryTraits: ["P", "X", "A"],
    discriminationIndex: 0.44,
    options: [
      { value: "A", text: "超开心，顺势再抖个包袱", traitScores: { A: -1, C: 0, E: -1, O: 0, X: 3, P: 3 } },
      { value: "B", text: "有点小得意，但自然流露就好", traitScores: { A: 0, C: 1, E: 1, O: 0, X: 1, P: 1 } },
      { value: "C", text: "有点意外，无心插柳", traitScores: { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 } },
      { value: "D", text: "笑完就过了，不太在意", traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: -2 } },
    ]
  }
};

// Validate
function validate(id: string, q: any) {
  const traits = ['A', 'C', 'E', 'O', 'X', 'P'];
  const net: Record<string, number> = { A:0, C:0, E:0, O:0, X:0, P:0 };
  for (const opt of q.options) {
    for (const t of traits) net[t] += opt.traitScores[t] || 0;
  }
  const inflation = traits.reduce((s, t) => s + Math.max(0, net[t]), 0);
  return { id, net, inflation, optionSums: q.options.map((o: any) => {
    let s = 0; for (const t of traits) s += o.traitScores[t] || 0; return s;
  })};
}

console.log("=== PASS 2 VALIDATION ===\n");
for (const id of Object.keys(FIXES)) {
  const r = validate(id, FIXES[id].question);
  const netStr = `A:${r.net.A} C:${r.net.C} E:${r.net.E} O:${r.net.O} X:${r.net.X} P:${r.net.P}`;
  console.log(`${id}: inflation=${r.inflation.toFixed(1).padStart(4)}  ${netStr}  optSums=[${r.optionSums.join(',')}]`);
}

// Apply
console.log("\n=== APPLYING FIXES ===\n");
const files = new Map<string, string[]>();
for (const [id, data] of Object.entries(FIXES)) {
  if (!files.has(data.file)) files.set(data.file, []);
  files.get(data.file)!.push(id);
}

for (const [file, ids] of files) {
  let content = readFileSync(file, 'utf-8');
  for (const id of ids) {
    const q = FIXES[id].question;
    const regex = new RegExp(`\\{\\s*id: "${id}"[\\s\\S]*?\\n  \\}`, 'm');
    const replacement = JSON.stringify(q, null, 2).replace(/"([^"]+)":/g, '$1:').replace(/"/g, '"');
    if (!regex.test(content)) {
      console.log(`⚠️  Could not find ${id}`);
      continue;
    }
    content = content.replace(regex, replacement);
    console.log(`✅ ${id}`);
  }
  writeFileSync(file, content);
  console.log(`📝 ${file}\n`);
}
