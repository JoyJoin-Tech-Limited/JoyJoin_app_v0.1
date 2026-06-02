import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const REWRITES: Record<string, {
  file: string;
  question: object;
}> = {};

// === Q130: 关怀方式区分 (was inflation 33) ===
REWRITES['Q130'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q130",
    level: 3,
    category: "关怀方式区分",
    scenarioText: "朋友刚被领导批评了，心情很糟，给你发消息吐槽。",
    questionText: "你更可能先做什么？",
    primaryTraits: ["A", "P", "E"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.82,
    options: [
      { value: "A", text: "走！带你去吃好吃的，把不开心吃掉", traitScores: { A: -1, C: -1, E: -2, O: -1, X: 3, P: 3 } },
      { value: "B", text: "我在，慢慢说，我听着", traitScores: { A: 4, C: -1, E: 2, O: -1, X: -2, P: 1 } },
      { value: "C", text: "先别急，我们一起看看问题出在哪", traitScores: { A: -2, C: 3, E: 1, O: 2, X: -2, P: -2 } },
      { value: "D", text: "这也太气人了吧！陪你吐槽完就让它过去", traitScores: { A: -1, C: -1, E: -2, O: 1, X: 2, P: -2 } },
    ]
  }
};

// === Q124: 原型区分-暖心熊vs淡定海豚-聚会角色 (was inflation 25) ===
REWRITES['Q124'] = {
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
      { value: "A", text: "确保没人被冷落，落单的人有人陪", traitScores: { A: 4, C: -1, E: 0, O: -1, X: -2, P: 2 } },
      { value: "B", text: "整体氛围轻松，大家玩得尽兴", traitScores: { A: 1, C: 0, E: 2, O: 0, X: 2, P: 1 } },
      { value: "C", text: "流程顺畅，突发状况有人兜底", traitScores: { A: -1, C: 3, E: 2, O: 0, X: 0, P: -1 } },
      { value: "D", text: "惊喜环节够特别，留下难忘记忆", traitScores: { A: -2, C: -1, E: -1, O: 4, X: 1, P: 2 } },
    ]
  }
};

// === Q131: 能量表达方式 (was inflation 24.7) ===
REWRITES['Q131'] = {
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
      { value: "A", text: "站起来说\"我们可以的！\"，先把士气拉起来", traitScores: { A: -1, C: -1, E: -1, O: 0, X: 4, P: 4 } },
      { value: "B", text: "安静分析问题，拿出几套可行的方案", traitScores: { A: -1, C: 3, E: 3, O: 1, X: -1, P: -2 } },
      { value: "C", text: "默默把最棘手的部分接过来，用行动扛住", traitScores: { A: 1, C: 2, E: 1, O: 0, X: -2, P: -1 } },
      { value: "D", text: "一个个私聊，了解每个人真正的顾虑", traitScores: { A: 3, C: 0, E: 0, O: 0, X: -2, P: 1 } },
    ]
  }
};

// === Q135: 情感表达深度 (was inflation 23.2) ===
REWRITES['Q135'] = {
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
      { value: "A", text: "\"这也太厉害了吧！\"真心替ta高兴，情绪拉满", traitScores: { A: 1, C: -1, E: 0, O: 0, X: 3, P: 4 } },
      { value: "B", text: "认真听完，说一句\"我为你感到骄傲\"", traitScores: { A: 3, C: 0, E: 1, O: -1, X: -2, P: 2 } },
      { value: "C", text: "微笑点头，简单说句\"恭喜\"", traitScores: { A: -1, C: 1, E: 2, O: 0, X: -2, P: -2 } },
      { value: "D", text: "\"意料之中，你一直都很稳\"，冷静肯定", traitScores: { A: 1, C: 1, E: 3, O: 1, X: 0, P: -2 } },
    ]
  }
};

// === Q114: 原型区分-太阳鸡vs暖心熊-给予方式 (was inflation 20.3) ===
REWRITES['Q114'] = {
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
      { value: "A", text: "先逗ta笑，把气氛从低落里拉出来", traitScores: { A: -1, C: -1, E: 2, O: 1, X: 3, P: 2 } },
      { value: "B", text: "安静听完，让ta知道你在认真听", traitScores: { A: 3, C: 0, E: 2, O: -1, X: -2, P: 1 } },
      { value: "C", text: "分享自己的类似经历，让ta知道不孤单", traitScores: { A: 1, C: -1, E: -1, O: 1, X: 0, P: 1 } },
      { value: "D", text: "陪ta做点开心的事，转移一下注意力", traitScores: { A: 0, C: -1, E: -1, O: 0, X: 2, P: 2 } },
    ]
  }
};

// === Q108: 原型区分-太阳鸡vs开心柯基-社交目标 (was inflation 18.7) ===
REWRITES['Q108'] = {
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
      { value: "A", text: "成为焦点，带动全场气氛", traitScores: { A: -2, C: -1, E: 2, O: 0, X: 4, P: 2 } },
      { value: "B", text: "和每个人都聊得开心，没人觉得拘束", traitScores: { A: 2, C: 0, E: 0, O: -1, X: 2, P: 2 } },
      { value: "C", text: "找到几个聊得来的人，聊点深入的", traitScores: { A: 1, C: 1, E: -1, O: 2, X: 0, P: 0 } },
      { value: "D", text: "在一边观察大家的互动，感觉也挺有意思", traitScores: { A: -1, C: 1, E: 0, O: 3, X: -3, P: -1 } },
    ]
  }
};

// === Q132: 思维方式偏好 (was inflation 18.3) ===
REWRITES['Q132'] = {
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
      { value: "A", text: "想个新奇主题，比如桌游 tournament 或城市探索", traitScores: { A: 0, C: -2, E: 0, O: 4, X: 2, P: 1 } },
      { value: "B", text: "参考以前成功的形式，经典聚餐或 K 歌", traitScores: { A: 0, C: 3, E: 1, O: -2, X: -1, P: 0 } },
      { value: "C", text: "随便聚聚，聊聊天就行，不用太复杂", traitScores: { A: 1, C: -2, E: 1, O: -1, X: 2, P: 2 } },
      { value: "D", text: "先问大家想做什么，按多数人的意愿来", traitScores: { A: 3, C: 1, E: 0, O: 0, X: 0, P: 0 } },
    ]
  }
};

// === Q93: 原型区分-暖心熊vs定心大象vs织网蛛 (was inflation 16.3) ===
REWRITES['Q93'] = {
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
      { value: "A", text: "放下手头的事先陪ta，情绪上先接住", traitScores: { A: 3, C: -1, E: 0, O: 0, X: 1, P: 1 } },
      { value: "B", text: "先了解情况，制定帮助计划再行动", traitScores: { A: -1, C: 3, E: 2, O: 0, X: 0, P: -1 } },
      { value: "C", text: "帮ta协调资源，找更多人一起解决", traitScores: { A: 1, C: 2, E: 0, O: 1, X: 1, P: 0 } },
      { value: "D", text: "想帮但怕添乱，先观察再决定", traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: -1 } },
    ]
  }
};

// === Q125: 原型区分-太阳鸡vs淡定海豚-能量输出 (was inflation 15) ===
REWRITES['Q125'] = {
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
      { value: "A", text: "主动打气：\"别灰心，我们一定能搞定！\"", traitScores: { A: -1, C: -1, E: -1, O: 0, X: 4, P: 4 } },
      { value: "B", text: "保持冷静：\"慢慢来，一步一步解决\"", traitScores: { A: 0, C: 1, E: 3, O: 0, X: -1, P: -1 } },
      { value: "C", text: "默默多承担一些任务，用行动支持", traitScores: { A: 1, C: 2, E: 1, O: 0, X: -2, P: 0 } },
      { value: "D", text: "分析问题出在哪，提出调整方案", traitScores: { A: -1, C: 3, E: 0, O: 2, X: 0, P: -2 } },
    ]
  }
};

// === Q134: 计划细节程度 (was inflation 14.2) ===
REWRITES['Q134'] = {
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
      { value: "A", text: "详细规划行程、交通、预算，备好 Plan B", traitScores: { A: -1, C: 4, E: 2, O: -1, X: -1, P: -1 } },
      { value: "B", text: "定好大方向和关键节点，其他随机应变", traitScores: { A: 0, C: 1, E: 3, O: 1, X: 1, P: 1 } },
      { value: "C", text: "问大家想去哪，按多数人的意愿来", traitScores: { A: 3, C: -1, E: 1, O: 0, X: 1, P: 1 } },
      { value: "D", text: "随缘，走到哪算哪，轻松就好", traitScores: { A: -1, C: -3, E: 1, O: 2, X: 1, P: 2 } },
    ]
  }
};

// === Q55: 历史模式 (was inflation 13.9) ===
REWRITES['Q55'] = {
  file: 'packages/shared/src/personality/questionsV4Extended.ts',
  question: {
    id: "Q55",
    level: 3,
    category: "历史模式",
    scenarioText: "回顾你过往的社交经历，哪种模式更常发生？",
    questionText: "",
    primaryTraits: ["X", "A", "E"],
    options: [
      { value: "A", text: "我经常是活动的发起者或核心组织者", traitScores: { A: 0, C: 1, E: -1, O: 0, X: 3, P: 1 } },
      { value: "B", text: "我更多是积极参与者，配合让活动更圆满", traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 1 } },
      { value: "C", text: "我倾向于小型、深度的交流，不求人多", traitScores: { A: 1, C: 0, E: 1, O: 1, X: -1, P: -1 } },
      { value: "D", text: "我经常是观察者，偶尔参与，不刻意融入", traitScores: { A: -1, C: 0, E: 2, O: 1, X: -2, P: -1 } },
    ]
  }
};

// === Q107: 原型区分-太阳鸡vs开心柯基-能量来源 (was inflation 13.1) ===
REWRITES['Q107'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q107",
    level: 3,
    category: "原型区分-太阳鸡vs开心柯基-能量来源",
    scenarioText: "连续工作一周后，你感觉能量有点低。",
    questionText: "什么能最快让你恢复活力？",
    primaryTraits: ["X", "E", "P"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "开心柯基"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.50,
    options: [
      { value: "A", text: "去热闹的地方，被人群的能量感染", traitScores: { A: -1, C: -1, E: 0, O: 0, X: 4, P: 1 } },
      { value: "B", text: "和亲近的朋友深度聊天，互相打气", traitScores: { A: 2, C: 0, E: 0, O: -1, X: 1, P: 2 } },
      { value: "C", text: "独自做喜欢的事，比如看剧、打游戏", traitScores: { A: -1, C: 0, E: 1, O: 0, X: -2, P: 1 } },
      { value: "D", text: "好好睡一觉，什么都不想", traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: -1 } },
    ]
  }
};

// === Q128: 社交动机区分 (was inflation 12.9) ===
REWRITES['Q128'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q128",
    level: 3,
    category: "社交动机区分",
    scenarioText: "你被邀请去一个大部分人都不认识的派对。",
    questionText: "你最可能因为什么原因而去？",
    primaryTraits: ["X", "P", "O"],
    isForcedChoice: true,
    targetPairs: ["开心柯基", "机智狐"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.75,
    options: [
      { value: "A", text: "派对本身就好玩，人多热闹肯定开心", traitScores: { A: 0, C: -1, E: -1, O: 0, X: 4, P: 3 } },
      { value: "B", text: "可能认识有趣的新朋友，扩展圈子", traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 } },
      { value: "C", text: "想观察不同类型的人，觉得挺有意思", traitScores: { A: -1, C: 0, E: 1, O: 3, X: -1, P: 0 } },
      { value: "D", text: "不太想去，除非有认识的人陪同", traitScores: { A: 1, C: 0, E: 1, O: -1, X: -3, P: -1 } },
    ]
  }
};

// === Q110: 原型区分-夸夸豚vs开心柯基-关注焦点 (was inflation 11.9) ===
REWRITES['Q110'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q110",
    level: 3,
    category: "原型区分-夸夸豚vs开心柯基-关注焦点",
    scenarioText: "在一个新认识的小群体里。",
    questionText: "你自然而然会注意什么？",
    primaryTraits: ["A", "P", "X"],
    isForcedChoice: true,
    targetPairs: ["夸夸豚", "开心柯基"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.55,
    options: [
      { value: "A", text: "谁看起来不太自在，需要被关注和肯定", traitScores: { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 } },
      { value: "B", text: "怎么让气氛活跃起来，让大家更放松", traitScores: { A: -1, C: 0, E: -1, O: 0, X: 4, P: -1 } },
      { value: "C", text: "谁比较有趣，值得深入认识一下", traitScores: { A: -1, C: 0, E: 0, O: 2, X: 1, P: 0 } },
      { value: "D", text: "整体的人际关系结构和群体动态", traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: -1 } },
    ]
  }
};

// === Q49: 探索行为 (was inflation 11.8) ===
REWRITES['Q49'] = {
  file: 'packages/shared/src/personality/questionsV4L2.ts',
  question: {
    id: "Q49",
    level: 2,
    category: "探索行为",
    scenarioText: "一个大型节日市集，有各种小吃、手作和表演。",
    questionText: "你怎么逛？",
    primaryTraits: ["X", "C", "E", "O"],
    options: [
      { value: "A", text: "每个摊位都看看，尝各种小吃，看热闹的表演", traitScores: { A: 0, C: -1, E: -1, O: 2, X: 3, P: 1 } },
      { value: "B", text: "先绕场一周了解全貌，再有选择地重点逛", traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: -1 } },
      { value: "C", text: "和朋友一边逛一边聊天，逛什么是次要的", traitScores: { A: 2, C: -1, E: 1, O: -1, X: 1, P: 0 } },
      { value: "D", text: "人多的地方就不去了，找些人少的角落看看", traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 } },
    ]
  }
};

// === Q54: 价值观权衡 (was inflation 11.7) ===
REWRITES['Q54'] = {
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
      { value: "B", text: "让周围的人感到舒服更重要，和谐需要适当的调整", traitScores: { A: 3, C: 1, E: 0, O: -1, X: -1, P: 1 } },
      { value: "C", text: "看情况。在亲密朋友面前真实，在陌生环境里随和", traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 } },
      { value: "D", text: "两者不冲突，真实的自己就是能让别人舒服的", traitScores: { A: 1, C: -1, E: 1, O: 0, X: 1, P: 2 } },
    ]
  }
};

// === Q73: 幽默风格 (was inflation 11.7) ===
REWRITES['Q73'] = {
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
      { value: "A", text: "超开心，顺势再抖个包袱", traitScores: { A: -1, C: 0, E: 0, O: 0, X: 3, P: 3 } },
      { value: "B", text: "有点小得意，但自然流露就好", traitScores: { A: 0, C: 1, E: 1, O: 0, X: 1, P: 1 } },
      { value: "C", text: "有点意外，无心插柳", traitScores: { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 } },
      { value: "D", text: "笑完就过了，不太在意", traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: -2 } },
    ]
  }
};

// === Q112: 价值取舍-夸夸豚vs开心柯基-给予方式 (was inflation 11.2) ===
REWRITES['Q112'] = {
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  question: {
    id: "Q112",
    level: 3,
    category: "价值取舍-夸夸豚vs开心柯基-给予方式",
    scenarioText: "朋友正在经历低谷期，需要你的支持。",
    questionText: "你最可能怎么帮助ta？",
    primaryTraits: ["P", "A", "X"],
    isForcedChoice: true,
    targetPairs: ["夸夸豚", "开心柯基"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.58,
    options: [
      { value: "A", text: "认真倾听，给予真诚的鼓励和肯定", traitScores: { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 } },
      { value: "B", text: "带ta去做些好玩的事，用快乐转移注意力", traitScores: { A: -1, C: -1, E: -1, O: 0, X: 3, P: -1 } },
      { value: "C", text: "帮ta分析问题，一起想解决方案", traitScores: { A: -1, C: 2, E: 0, O: 2, X: 0, P: 0 } },
      { value: "D", text: "默默陪伴，让ta知道我一直在", traitScores: { A: 2, C: 0, E: 2, O: 0, X: -2, P: 1 } },
    ]
  }
};

// ===== VALIDATION =====

function validateRewrite(id: string, q: any) {
  const traits = ['A', 'C', 'E', 'O', 'X', 'P'];
  const net: Record<string, number> = { A:0, C:0, E:0, O:0, X:0, P:0 };
  let totalPositive = 0;
  let totalNegative = 0;

  for (const opt of q.options) {
    for (const t of traits) {
      const v = opt.traitScores[t] || 0;
      net[t] += v;
      if (v > 0) totalPositive += v;
      if (v < 0) totalNegative += Math.abs(v);
    }
  }

  const inflationScore = traits.reduce((sum, t) => sum + Math.max(0, net[t]), 0);
  
  return {
    id,
    netTraitSums: net,
    totalPositive,
    totalNegative,
    inflationScore,
    optionSums: q.options.map((o: any) => {
      let s = 0;
      for (const t of traits) s += o.traitScores[t] || 0;
      return s;
    })
  };
}

console.log("=== REWRITE VALIDATION ===\n");
let totalOldInflation = 0;
let totalNewInflation = 0;

// Old inflation scores (from audit)
const oldInflation: Record<string, number> = {
  Q130: 33, Q124: 25, Q131: 24.7, Q135: 23.2, Q114: 20.3,
  Q108: 18.7, Q132: 18.3, Q93: 16.3, Q125: 15, Q134: 14.2,
  Q55: 13.9, Q107: 13.1, Q128: 12.9, Q110: 11.9, Q49: 11.8,
  Q54: 11.7, Q73: 11.7, Q112: 11.2,
};

const results: any[] = [];
for (const id of Object.keys(REWRITES)) {
  const r = validateRewrite(id, REWRITES[id].question);
  results.push(r);
  totalOldInflation += oldInflation[id];
  totalNewInflation += r.inflationScore;
  console.log(`${id}: old=${oldInflation[id].toFixed(1).padStart(5)} new=${r.inflationScore.toFixed(1).padStart(5)}  net={A:${r.netTraitSums.A}, C:${r.netTraitSums.C}, E:${r.netTraitSums.E}, O:${r.netTraitSums.O}, X:${r.netTraitSums.X}, P:${r.netTraitSums.P}}  optSums=[${r.optionSums.join(',')}]`);
}

console.log(`\nTotal old inflation: ${totalOldInflation.toFixed(1)}`);
console.log(`Total new inflation: ${totalNewInflation.toFixed(1)}`);
console.log(`Reduction: ${((1 - totalNewInflation/totalOldInflation)*100).toFixed(1)}%`);

// Check for any questions with inflation > 10
const highInflation = results.filter(r => r.inflationScore > 10);
if (highInflation.length > 0) {
  console.log(`\n⚠️  WARNING: ${highInflation.length} questions still have inflation > 10:`);
  for (const r of highInflation) {
    console.log(`  ${r.id}: ${r.inflationScore.toFixed(1)}`);
  }
}

// Apply rewrites
console.log("\n=== APPLYING REWRITES ===\n");

const filesToUpdate = new Map<string, string[]>();
for (const [id, data] of Object.entries(REWRITES)) {
  if (!filesToUpdate.has(data.file)) filesToUpdate.set(data.file, []);
  filesToUpdate.get(data.file)!.push(id);
}

for (const [file, ids] of filesToUpdate) {
  let content = readFileSync(file, 'utf-8');
  for (const id of ids) {
    const q = REWRITES[id].question;
    // Find the question block and replace it
    const regex = new RegExp(`\\{\\s*id: "${id}"[\\s\\S]*?\\n  \\}`, 'm');
    const replacement = JSON.stringify(q, null, 2).replace(/"([^"]+)":/g, '$1:').replace(/"/g, '"');
    
    if (!regex.test(content)) {
      console.log(`⚠️  Could not find ${id} in ${file}`);
      continue;
    }
    content = content.replace(regex, replacement);
    console.log(`✅ ${id} in ${file}`);
  }
  writeFileSync(file, content);
  console.log(`📝 Wrote ${file}`);
}

console.log("\nDone.");
