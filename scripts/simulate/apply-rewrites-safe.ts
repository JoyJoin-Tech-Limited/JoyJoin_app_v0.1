// Safe rewrite: uses exact string replacement to preserve formatting
import { readFileSync, writeFileSync } from 'fs';

interface Rewrite {
  file: string;
  oldText: string;
  newText: string;
}

const rewrites: Rewrite[] = [];

// ==================== questionsV4Attractor.ts ====================

// Q107
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "去热闹的场合感受氛围，被人群的能量感染",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 4, P: 1 }
      },
      {
        value: "B",
        text: "和亲近的朋友深度聊天，互相鼓励打气",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "C",
        text: "做点让自己开心的事，比如吃顿好的、看个喜剧",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "好好睡一觉，安静地休息恢复",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "去热闹的地方，被人群的能量感染",
        traitScores: { A: -1, C: -1, E: 0, O: 0, X: 4, P: 1 }
      },
      {
        value: "B",
        text: "和亲近的朋友深度聊天，互相打气",
        traitScores: { A: 2, C: 0, E: 0, O: -1, X: 1, P: 2 }
      },
      {
        value: "C",
        text: "独自做喜欢的事，比如看剧、打游戏",
        traitScores: { A: -1, C: 0, E: 1, O: 0, X: -2, P: 1 }
      },
      {
        value: "D",
        text: "好好睡一觉，什么都不想",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }`
});

// Q108
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "成为焦点、带动全场气氛high起来",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 4, P: 1 }
      },
      {
        value: "B",
        text: "和每个人都聊得开心、让大家都舒服",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 3, P: 3 }
      },
      {
        value: "C",
        text: "找到几个特别聊得来的人深入交流",
        traitScores: { A: 1, C: 1, E: 0, O: 1, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "观察大家的互动，感受社交的有趣之处",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: -1, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "成为焦点，带动全场气氛",
        traitScores: { A: -2, C: -1, E: 1, O: -1, X: 4, P: 2 }
      },
      {
        value: "B",
        text: "和每个人都聊得开心，没人觉得拘束",
        traitScores: { A: 2, C: 0, E: 0, O: -1, X: 2, P: 1 }
      },
      {
        value: "C",
        text: "找到几个聊得来的人，聊点深入的",
        traitScores: { A: 1, C: 1, E: -1, O: 2, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "在一边观察大家的互动，感觉也挺有意思",
        traitScores: { A: -1, C: 1, E: 0, O: 3, X: -3, P: -1 }
      }`
});

// Q110
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "每个人的情绪状态，谁需要被关注和肯定",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: -2, P: 4 }
      },
      {
        value: "B",
        text: "怎么让气氛更活跃、让大家玩得更开心",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }
      },
      {
        value: "C",
        text: "谁比较有趣、值得深入认识",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 2, P: 0 }
      },
      {
        value: "D",
        text: "整体的群体动态和人际关系结构",
        traitScores: { A: 1, C: 2, E: 0, O: 2, X: 0, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "谁看起来不太自在，需要被关注和肯定",
        traitScores: { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 }
      },
      {
        value: "B",
        text: "怎么让气氛活跃起来，让大家更放松",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 4, P: -1 }
      },
      {
        value: "C",
        text: "谁比较有趣，值得深入认识一下",
        traitScores: { A: -1, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "整体的人际关系结构和群体动态",
        traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: -1 }
      }`
});

// Q112
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "认真倾听，给予真诚的鼓励和肯定",
        traitScores: { A: 3, C: 1, E: 1, O: 0, X: -2, P: 4 }
      },
      {
        value: "B",
        text: "带ta去做些好玩的事，用快乐转移注意力",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }
      },
      {
        value: "C",
        text: "帮ta分析问题，一起想解决方案",
        traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "默默陪伴，让ta知道我一直在",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: -2, P: 2 }
      }`,
  newText: `      {
        value: "A",
        text: "认真倾听，给予真诚的鼓励和肯定",
        traitScores: { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 }
      },
      {
        value: "B",
        text: "带ta去做些好玩的事，用快乐转移注意力",
        traitScores: { A: -1, C: -1, E: -1, O: 0, X: 3, P: -1 }
      },
      {
        value: "C",
        text: "帮ta分析问题，一起想解决方案",
        traitScores: { A: -1, C: 2, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "默默陪伴，让ta知道我一直在",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: -2, P: 1 }
      }`
});

// Q114
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "用幽默和乐观的态度帮ta振作起来",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 4, P: 0 }
      },
      {
        value: "B",
        text: "认真倾听，给予温暖的理解和支持",
        traitScores: { A: 4, C: 0, E: 0, O: 0, X: -2, P: 4 }
      },
      {
        value: "C",
        text: "分享自己的经验，提供实用的建议",
        traitScores: { A: 1, C: 2, E: 0, O: 1, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "陪ta做点开心的事，转移注意力",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 3, P: 1 }
      }`,
  newText: `      {
        value: "A",
        text: "先逗ta笑，把气氛从低落里拉出来",
        traitScores: { A: -2, C: -2, E: 1, O: -1, X: 4, P: 2 }
      },
      {
        value: "B",
        text: "安静听完，让ta知道你在认真听",
        traitScores: { A: 4, C: -1, E: 2, O: -1, X: -3, P: 1 }
      },
      {
        value: "C",
        text: "分享自己的类似经历，让ta知道不孤单",
        traitScores: { A: 1, C: -1, E: -1, O: 2, X: -1, P: -2 }
      },
      {
        value: "D",
        text: "陪ta做点开心的事，转移一下注意力",
        traitScores: { A: -1, C: -2, E: -2, O: 2, X: 2, P: 1 }
      }`
});

// Q124
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "确保每个人都被照顾到，没有人被冷落",
        traitScores: { A: 6, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "让整体氛围轻松愉快，大家都玩得开心",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: 2, P: 1 }
      },
      {
        value: "C",
        text: "活动流程顺畅，时间安排合理",
        traitScores: { A: 0, C: 4, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "惊喜环节够特别，让寿星印象深刻",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: 1, P: 1 }
      }`,
  newText: `      {
        value: "A",
        text: "确保没人被冷落，落单的人有人陪",
        traitScores: { A: 4, C: -1, E: -1, O: -1, X: -2, P: 1 }
      },
      {
        value: "B",
        text: "整体氛围轻松，大家玩得尽兴",
        traitScores: { A: 0, C: 0, E: 1, O: -1, X: 2, P: 0 }
      },
      {
        value: "C",
        text: "流程顺畅，突发状况有人兜底",
        traitScores: { A: -2, C: 3, E: 1, O: 0, X: 0, P: -2 }
      },
      {
        value: "D",
        text: "惊喜环节够特别，留下难忘记忆",
        traitScores: { A: -1, C: -1, E: 0, O: 4, X: 1, P: 1 }
      }`
});

// Q125
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "主动打气！\\"别灰心，我们一定能搞定！\\"带动大家的情绪",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 5, P: 6 }
      },
      {
        value: "B",
        text: "保持冷静，说\\"慢慢来，一步一步解决\\"",
        traitScores: { A: 0, C: 1, E: 4, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "默默多承担一些任务，用行动支持团队",
        traitScores: { A: 2, C: 2, E: 1, O: 0, X: -2, P: 1 }
      },
      {
        value: "D",
        text: "分析问题出在哪里，提出调整方案",
        traitScores: { A: 0, C: 3, E: 0, O: 2, X: 0, P: -1 }
      }`,
  newText: `      {
        value: "A",
        text: "主动打气：\\"别灰心，我们一定能搞定！\\"",
        traitScores: { A: -2, C: -1, E: -1, O: 0, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "保持冷静：\\"慢慢来，一步一步解决\\"",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "默默多承担一些任务，用行动支持",
        traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 }
      },
      {
        value: "D",
        text: "分析问题出在哪，提出调整方案",
        traitScores: { A: -1, C: 3, E: 0, O: 2, X: 0, P: -2 }
      }`
});

// Q128
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "派对本身就很好玩呀！人多热闹，肯定开心",
        traitScores: { A: 1, C: -1, E: 0, O: 1, X: 5, P: 4 }
      },
      {
        value: "B",
        text: "可能认识一些有趣的新朋友，扩展社交圈",
        traitScores: { A: 0, C: 0, E: 1, O: 3, X: 2, P: 1 }
      },
      {
        value: "C",
        text: "想观察不同类型的人，觉得挺有意思的",
        traitScores: { A: -1, C: 0, E: 2, O: 4, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "不太想去，除非有认识的人陪同",
        traitScores: { A: 2, C: 1, E: 2, O: 0, X: -3, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "派对本身就好玩，人多热闹肯定开心",
        traitScores: { A: 0, C: -1, E: -1, O: 0, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "可能认识有趣的新朋友，扩展圈子",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "想观察不同类型的人，觉得挺有意思",
        traitScores: { A: -1, C: 0, E: 1, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "不太想去，除非有认识的人陪同",
        traitScores: { A: 1, C: 0, E: 1, O: -1, X: -3, P: -1 }
      }`
});

// Q130
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "「没事！这都是小事，明天肯定会更好的！」积极鼓励",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 2, P: 6 }
      },
      {
        value: "B",
        text: "静静听完，给一个拥抱或者陪着TA",
        traitScores: { A: 5, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "帮TA分析问题，提出解决方案",
        traitScores: { A: 1, C: 2, E: 1, O: 2, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "说几句安慰的话，然后岔开话题聊点开心的",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 1, P: 3 }
      }`,
  newText: `      {
        value: "A",
        text: "走！带你去吃好吃的，把不开心吃掉",
        traitScores: { A: -1, C: -1, E: -2, O: -1, X: 3, P: 3 }
      },
      {
        value: "B",
        text: "我在，慢慢说，我听着",
        traitScores: { A: 4, C: -1, E: 2, O: -1, X: -2, P: 1 }
      },
      {
        value: "C",
        text: "先别急，我们一起看看问题出在哪",
        traitScores: { A: -2, C: 3, E: 1, O: 2, X: -2, P: -2 }
      },
      {
        value: "D",
        text: "这也太气人了吧！陪你吐槽完就让它过去",
        traitScores: { A: -1, C: -1, E: -2, O: 1, X: 2, P: -2 }
      }`
});

// Q131
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "立刻活跃气氛，\\"我们可以的！一起加油！\\"，带动大家打起精神",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 5, P: 6 }
      },
      {
        value: "B",
        text: "保持冷静，分析问题，给出实际可行的建议",
        traitScores: { A: 2, C: 2, E: 4, O: 1, X: 1, P: -1 }
      },
      {
        value: "C",
        text: "默默做好自己的部分，用行动支持团队",
        traitScores: { A: 1, C: 4, E: 2, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "倾听每个人的想法，找到大家都认可的方向",
        traitScores: { A: 5, C: 1, E: 2, O: 0, X: 0, P: 1 }
      }`,
  newText: `      {
        value: "A",
        text: "站起来说\\"我们可以的！\\"，先把士气拉起来",
        traitScores: { A: -2, C: -1, E: -1, O: 0, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "安静分析问题，拿出几套可行的方案",
        traitScores: { A: -1, C: 3, E: 2, O: 1, X: -1, P: -2 }
      },
      {
        value: "C",
        text: "默默把最棘手的部分接过来，用行动扛住",
        traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 }
      },
      {
        value: "D",
        text: "一个个私聊，了解每个人真正的顾虑",
        traitScores: { A: 3, C: -1, E: 0, O: 0, X: -2, P: 1 }
      }`
});

// Q132
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "想一些新奇的主题，比如角色扮演、密室逃脱之类的有创意的形式",
        traitScores: { A: 0, C: -2, E: 1, O: 5, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "参考以前成功的聚会形式，做个靠谱的经典聚餐或K歌",
        traitScores: { A: 1, C: 4, E: 2, O: -2, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "随便聊聊天就行，大家开心最重要，不用太复杂",
        traitScores: { A: 2, C: -1, E: 2, O: 0, X: 3, P: 3 }
      },
      {
        value: "D",
        text: "先问问大家想做什么，收集意见再决定",
        traitScores: { A: 4, C: 1, E: 1, O: 0, X: 1, P: 1 }
      }`,
  newText: `      {
        value: "A",
        text: "想个新奇主题，比如桌游 tournament 或城市探索",
        traitScores: { A: -1, C: -2, E: 0, O: 4, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "参考以前成功的形式，经典聚餐或 K 歌",
        traitScores: { A: 0, C: 3, E: 1, O: -2, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "随便聚聚，聊聊天就行，不用太复杂",
        traitScores: { A: 1, C: -2, E: 1, O: -1, X: 2, P: 2 }
      },
      {
        value: "D",
        text: "先问大家想做什么，按多数人的意愿来",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: -1, P: -1 }
      }`
});

// Q134
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "详细规划每天行程、交通、预算，做好备选方案",
        traitScores: { A: 0, C: 5, E: 2, O: -1, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "定好大方向和关键节点，其他随机应变",
        traitScores: { A: 1, C: 2, E: 4, O: 1, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "问问大家想去哪，根据大家意见来",
        traitScores: { A: 4, C: 0, E: 2, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "随缘吧，走到哪算哪，轻松就好",
        traitScores: { A: 0, C: -3, E: 2, O: 1, X: 1, P: 2 }
      }`,
  newText: `      {
        value: "A",
        text: "详细规划行程、交通、预算，备好 Plan B",
        traitScores: { A: -1, C: 4, E: 1, O: -1, X: -1, P: -1 }
      },
      {
        value: "B",
        text: "定好大方向和关键节点，其他随机应变",
        traitScores: { A: 0, C: 1, E: 2, O: 1, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "问大家想去哪，按多数人的意愿来",
        traitScores: { A: 3, C: -1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "随缘，走到哪算哪，轻松就好",
        traitScores: { A: -1, C: -3, E: 1, O: 2, X: 1, P: 2 }
      }`
});

// Q135
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Attractor.ts',
  oldText: `      {
        value: "A",
        text: "\\"哇！太棒了！你真的超厉害！\\"，各种夸赞和感叹",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 4, P: 6 }
      },
      {
        value: "B",
        text: "给一个温暖的拥抱，真诚地说\\"我为你感到开心\\"",
        traitScores: { A: 5, C: 0, E: 3, O: 0, X: 1, P: 2 }
      },
      {
        value: "C",
        text: "微笑点头，说\\"恭喜\\"，保持礼貌距离",
        traitScores: { A: 1, C: 1, E: 3, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "\\"意料之中，你一直都很优秀\\"，冷静肯定",
        traitScores: { A: 2, C: 1, E: 4, O: 1, X: 0, P: -1 }
      }`,
  newText: `      {
        value: "A",
        text: "\\"这也太厉害了吧！\\"真心替ta高兴，情绪拉满",
        traitScores: { A: 1, C: -1, E: -1, O: 0, X: 3, P: 3 }
      },
      {
        value: "B",
        text: "认真听完，说一句\\"我为你感到骄傲\\"",
        traitScores: { A: 3, C: 0, E: 1, O: -1, X: -2, P: 1 }
      },
      {
        value: "C",
        text: "微笑点头，简单说句\\"恭喜\\"",
        traitScores: { A: -1, C: 1, E: 2, O: 0, X: -2, P: -2 }
      },
      {
        value: "D",
        text: "\\"意料之中，你一直都很稳\\"，冷静肯定",
        traitScores: { A: 1, C: 1, E: 2, O: 1, X: 0, P: -2 }
      }`
});

// ==================== questionsV4Advanced.ts ====================

// Q93
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Advanced.ts',
  oldText: `      {
        value: "A",
        text: "第一时间放下手头的事去帮忙，朋友有难义不容辞",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "先了解清楚情况，制定合理的帮助计划再行动",
        traitScores: { A: 1, C: 3, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "帮忙的同时也会协调其他资源，让帮助更有效率",
        traitScores: { A: 2, C: 2, E: 1, O: 1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "想帮但不太确定怎么帮最好，先观察再说",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: -1, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "放下手头的事先陪ta，情绪上先接住",
        traitScores: { A: 3, C: -1, E: -1, O: 0, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "先了解情况，制定帮助计划再行动",
        traitScores: { A: -1, C: 3, E: 1, O: 0, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "帮ta协调资源，找更多人一起解决",
        traitScores: { A: 1, C: 2, E: 0, O: 1, X: 1, P: -1 }
      },
      {
        value: "D",
        text: "想帮但怕添乱，先观察再决定",
        traitScores: { A: -1, C: 0, E: 1, O: 0, X: -2, P: -1 }
      }`
});

// ==================== questionsV4Extended.ts ====================

// Q54
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Extended.ts',
  oldText: `      {
        value: "A",
        text: "做真实的自己更重要。我不需要为了迎合他人而改变",
        traitScores: { A: -1, C: 0, E: 1, O: 1, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "让周围的人感到舒服更重要。和谐的关系需要适当的调整",
        traitScores: { A: 3, C: 1, E: 0, O: -1, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "看情况。在亲密朋友面前真实，在陌生环境里随和",
        traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "两者不冲突。我真实的自己就是能让别人舒服的",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 2 }
      }`,
  newText: `      {
        value: "A",
        text: "做真实的自己更重要，不需要为了迎合他人而改变",
        traitScores: { A: -2, C: 0, E: 1, O: 1, X: 2, P: -1 }
      },
      {
        value: "B",
        text: "让周围的人感到舒服更重要，和谐需要适当的调整",
        traitScores: { A: 3, C: 1, E: -1, O: -1, X: -1, P: 1 }
      },
      {
        value: "C",
        text: "看情况。在亲密朋友面前真实，在陌生环境里随和",
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "两者不冲突，真实的自己就是能让别人舒服的",
        traitScores: { A: 1, C: -1, E: 1, O: 0, X: 1, P: 1 }
      }`
});

// Q55
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Extended.ts',
  oldText: `      {
        value: "A",
        text: "我经常是活动的发起者或核心组织者",
        traitScores: { A: 1, C: 2, E: -1, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "我更多是活动的积极参与者和支持者",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "C",
        text: "我倾向于参与小型、深度的交流",
        traitScores: { A: 2, C: 0, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我经常以观察者或偶尔参与者的身份加入",
        traitScores: { A: 0, C: 1, E: 3, O: 1, X: -1, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "我经常是活动的发起者或核心组织者",
        traitScores: { A: 0, C: 1, E: -1, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "我更多是积极参与者，配合让活动更圆满",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "我倾向于小型、深度的交流，不求人多",
        traitScores: { A: 1, C: 0, E: 1, O: 1, X: -1, P: -1 }
      },
      {
        value: "D",
        text: "我经常是观察者，偶尔参与，不刻意融入",
        traitScores: { A: -1, C: 0, E: 2, O: 1, X: -2, P: -1 }
      }`
});

// Q73
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4Extended.ts',
  oldText: `      {
        value: "A",
        text: "超开心！继续抖包袱",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 3, P: 3 }
      },
      {
        value: "B",
        text: "有点小得意，自然流露就好",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "C",
        text: "有点意外，无心插柳",
        traitScores: { A: 0, C: 0, E: 2, O: 1, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "笑完就过了，不太在意",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "超开心，顺势再抖个包袱",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 3, P: 3 }
      },
      {
        value: "B",
        text: "有点小得意，但自然流露就好",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "有点意外，无心插柳",
        traitScores: { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "笑完就过了，不太在意",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: -2 }
      }`
});

// ==================== questionsV4L2.ts ====================

// Q49
rewrites.push({
  file: 'packages/shared/src/personality/questionsV4L2.ts',
  oldText: `      {
        value: "A",
        text: "每个摊位都看看，尝各种小吃，看热闹的表演",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "先绕场一周了解全貌，再有选择地重点逛",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "和朋友一边逛一边聊天，逛什么是次要的",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "人多的地方就不去了，找些人少的角落看看",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }`,
  newText: `      {
        value: "A",
        text: "每个摊位都看看，尝各种小吃，看热闹的表演",
        traitScores: { A: 0, C: -1, E: -1, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "先绕场一周了解全貌，再有选择地重点逛",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "和朋友一边逛一边聊天，逛什么是次要的",
        traitScores: { A: 2, C: -1, E: 1, O: -1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "人多的地方就不去了，找些人少的角落看看",
        traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }`
});

// ===== Apply =====
const files = new Map<string, string[]>();
for (const rw of rewrites) {
  if (!files.has(rw.file)) files.set(rw.file, []);
  files.get(rw.file)!.push(rw.oldText.slice(0, 30));
}

for (const [file, _] of files) {
  let content = readFileSync(file, 'utf-8');
  let count = 0;
  for (const rw of rewrites) {
    if (rw.file !== file) continue;
    if (!content.includes(rw.oldText)) {
      console.log(`⚠️  Not found in ${file}: ${rw.oldText.slice(0, 40)}...`);
      continue;
    }
    content = content.replace(rw.oldText, rw.newText);
    count++;
  }
  writeFileSync(file, content);
  console.log(`✅ ${file}: ${count} replacements`);
}
