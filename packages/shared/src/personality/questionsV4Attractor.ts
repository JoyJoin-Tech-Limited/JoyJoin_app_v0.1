/**
 * V4 Adaptive Assessment - Attractor + High Confusion + Playful Questions
 */

import { AdaptiveQuestion } from './types';

export const questionsV4Attractor: AdaptiveQuestion[] = [
  // 针对 灵感章鱼/机智狐/太阳鸡/夸夸豚 → 开心柯基 的主要混淆
  {
    id: "Q103",
    level: 3,
    category: "原型区分-灵感章鱼vs开心柯基-创意深度",
    scenarioText: "朋友分享了一个有趣的新想法，邀请你一起参与。",
    questionText: "你更看重的是？",
    primaryTraits: ["O", "X", "P"],
    isForcedChoice: true,
    targetPairs: ["灵感章鱼", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.55,
    options: [
      {
        value: "A",
        text: "这个想法有多独特、能延伸出多少可能性",
        traitScores: { A: 0, C: 0, E: 0, O: 4, X: -2, P: -1 }
      },
      {
        value: "B",
        text: "做这件事的过程会不会开心、氛围好不好",
        traitScores: { A: 0, C: 0, E: 0, O: -1, X: 4, P: 3 }
      },
      {
        value: "C",
        text: "能不能认识新朋友、扩大社交圈",
        traitScores: { A: 1, C: 0, E: 0, O: -1, X: 4, P: 2 }
      },
      {
        value: "D",
        text: "这件事是否值得我投入时间和精力",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q104",
    level: 3,
    category: "原型区分-机智狐vs开心柯基-思考vs氛围",
    scenarioText: "参加一个话题讨论活动，气氛开始变得热闹。",
    questionText: "你内心更期待的是？",
    primaryTraits: ["O", "X", "P"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.55,
    options: [
      {
        value: "A",
        text: "听到让我眼前一亮的观点或角度",
        traitScores: { A: 0, C: 0, E: 0, O: 4, X: -2, P: -1 }
      },
      {
        value: "B",
        text: "大家笑成一团、气氛嗨到极点",
        traitScores: { A: 0, C: 0, E: 0, O: -1, X: 4, P: 3 }
      },
      {
        value: "C",
        text: "巧妙地化解分歧，让讨论更有建设性",
        traitScores: { A: 1, C: 1, E: 1, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "交到几个聊得来的新朋友",
        traitScores: { A: 2, C: 0, E: 0, O: -1, X: 3, P: 2 }
      }
    ]
  },
  {
    id: "Q105",
    level: 3,
    category: "原型区分-灵感章鱼vs开心柯基-独处创造",
    scenarioText: "一个安静的周末晚上，你有一整晚自由时间。",
    questionText: "你最想做的是？",
    primaryTraits: ["O", "X", "C"],
    isForcedChoice: true,
    targetPairs: ["灵感章鱼", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.58,
    options: [
      {
        value: "A",
        text: "沉浸在某个创意项目或探索新领域",
        traitScores: { A: 0, C: 0, E: 0, O: 4, X: -3, P: -1 }
      },
      {
        value: "B",
        text: "约几个好友出来聚聚、聊聊天",
        traitScores: { A: 1, C: 0, E: 0, O: -1, X: 4, P: 2 }
      },
      {
        value: "C",
        text: "在社交媒体上互动、看看朋友们在干嘛",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "看部好电影或读本好书，享受独处",
        traitScores: { A: 0, C: 1, E: 1, O: 3, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q106",
    level: 3,
    category: "原型区分-机智狐vs开心柯基-问题解决",
    scenarioText: "遇到一个棘手的问题需要解决。",
    questionText: "你的第一反应是？",
    primaryTraits: ["O", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.52,
    options: [
      {
        value: "A",
        text: "从不同角度分析，找出创新的解法",
        traitScores: { A: 0, C: 1, E: 0, O: 4, X: -2, P: -1 }
      },
      {
        value: "B",
        text: "找大家一起头脑风暴，集思广益",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 4, P: 2 }
      },
      {
        value: "C",
        text: "按部就班，用已验证的方法一步步解决",
        traitScores: { A: 0, C: 3, E: 1, O: -1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "先放一放，也许灵感会在不经意间出现",
        traitScores: { A: 0, C: -1, E: 2, O: 2, X: -1, P: 0 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "去热闹的场合感受氛围，被人群的能量感染",
        traitScores: { A: -1, C: -1, E: -1, O: -1, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "和亲近的朋友深度聊天，互相鼓励打气",
        traitScores: { A: 3, C: -1, E: 2, O: -1, X: -2, P: 1 }
      },
      {
        value: "C",
        text: "做点让自己开心的事，比如吃顿好的、看个喜剧",
        traitScores: { A: -1, C: -1, E: -1, O: 0, X: -2, P: 1 }
      },
      {
        value: "D",
        text: "好好睡一觉，安静地休息恢复",
        traitScores: { A: -1, C: -1, E: -1, O: 0, X: -3, P: -1 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "成为焦点、带动全场气氛high起来",
        traitScores: { A: 1, C: 1, E: 4, O: -1, X: -2, P: 2 }
      },
      {
        value: "B",
        text: "和每个人都聊得开心、让大家都舒服",
        traitScores: { A: 2, C: 0, E: 0, O: -1, X: 2, P: 1 }
      },
      {
        value: "C",
        text: "找到几个特别聊得来的人深入交流",
        traitScores: { A: 1, C: 1, E: -1, O: 2, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "观察大家的互动，感受社交的有趣之处",
        traitScores: { A: -1, C: 1, E: 0, O: 3, X: -3, P: -1 }
      }
    ]
  },
  {
    id: "Q109",
    level: 3,
    category: "原型区分-夸夸豚vs开心柯基-表达方式",
    scenarioText: "朋友完成了一件很棒的事情。",
    questionText: "你会怎么表达你的欣赏？",
    primaryTraits: ["P", "A", "X"],
    isForcedChoice: true,
    targetPairs: ["夸夸豚", "开心柯基"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.55,
    options: [
      {
        value: "A",
        text: "真诚地赞美ta的努力和成果，具体说出优点",
        traitScores: { A: 2, C: 1, E: 0, O: 0, X: -2, P: 4 }
      },
      {
        value: "B",
        text: "热情地庆祝，提议一起出去high一下！",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 4, P: -1 }
      },
      {
        value: "C",
        text: "分享到朋友圈帮ta宣传，让更多人知道",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "默默记在心里，下次有机会帮ta一把",
        traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "每个人的情绪状态，谁需要被关注和肯定",
        traitScores: { A: 3, C: 0, E: 0, O: -1, X: -2, P: 3 }
      },
      {
        value: "B",
        text: "怎么让气氛更活跃、让大家玩得更开心",
        traitScores: { A: -2, C: -1, E: -1, O: 0, X: 4, P: 2 }
      },
      {
        value: "C",
        text: "谁比较有趣、值得深入认识",
        traitScores: { A: -1, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "整体的群体动态和人际关系结构",
        traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: -1 }
      }
    ]
  },
  // Q111-Q112: 价值取舍题 - 区分赞美驱动(夸夸豚) vs 玩乐驱动(开心柯基)
  {
    id: "Q111",
    level: 3,
    category: "价值取舍-夸夸豚vs开心柯基-社交满足感",
    scenarioText: "回顾一次让你特别满足的社交经历。",
    questionText: "是什么让你觉得这次经历特别好？",
    primaryTraits: ["P", "X", "A"],
    isForcedChoice: true,
    targetPairs: ["夸夸豚", "开心柯基"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.58,
    options: [
      {
        value: "A",
        text: "我让在场的人感受到了被认可和支持",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: -2, P: 4 }
      },
      {
        value: "B",
        text: "整个过程充满欢笑，大家都玩得很嗨",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }
      },
      {
        value: "C",
        text: "交到了新朋友，扩展了社交圈子",
        traitScores: { A: 1, C: 0, E: 0, O: 1, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "进行了有深度的对话，收获了新的想法",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: -1, P: 0 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "认真倾听，给予真诚的鼓励和肯定",
        traitScores: { A: 4, C: 0, E: 0, O: -1, X: -2, P: 3 }
      },
      {
        value: "B",
        text: "带ta去做些好玩的事，用快乐转移注意力",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }
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
      }
    ]
  },
  // Q113-Q114: 太阳鸡 vs 暖心熊 专项区分题 (E+X vs A+P)
  {
    id: "Q113",
    level: 3,
    category: "原型区分-太阳鸡vs暖心熊-社交能量",
    scenarioText: "聚会上气氛开始变得热烈起来。",
    questionText: "你更倾向于怎么做？",
    primaryTraits: ["E", "X", "A", "P"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.60,
    options: [
      {
        value: "A",
        text: "自然地成为焦点，用热情感染全场",
        traitScores: { A: 0, C: 0, E: 4, O: 0, X: 4, P: -1 }
      },
      {
        value: "B",
        text: "关注每个人的状态，确保没人被冷落",
        traitScores: { A: 4, C: 0, E: -1, O: 0, X: -1, P: 3 }
      },
      {
        value: "C",
        text: "和身边的人深入聊天，享受高质量对话",
        traitScores: { A: 2, C: 1, E: 0, O: 1, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "安静享受热闹的氛围，不太参与中心互动",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q114",
    level: 3,
    category: "原型区分-太阳鸡vs暖心熊-给予方式",
    scenarioText: "朋友向你倾诉最近的烦恼。",
    questionText: "你一般会怎么回应？",
    primaryTraits: ["A", "P", "E", "X"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.58,
    options: [
      {
        value: "A",
        text: "用幽默和乐观的态度帮ta振作起来",
        traitScores: { A: -2, C: -2, E: 2, O: -1, X: 4, P: 2 }
      },
      {
        value: "B",
        text: "认真倾听，给予温暖的理解和支持",
        traitScores: { A: 4, C: -1, E: 1, O: -1, X: -3, P: 1 }
      },
      {
        value: "C",
        text: "分享自己的经验，提供实用的建议",
        traitScores: { A: -1, C: 2, E: 0, O: 1, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "陪ta做点开心的事，转移注意力",
        traitScores: { A: 0, C: -1, E: -1, O: 0, X: 2, P: 1 }
      }
    ]
  },
  // Q115-Q116: 沉思猫头鹰 vs 稳如龟 专项区分题 (O+reflection vs E+steadiness)
  // Key diff: 猫头鹰 O:85/E:75, 稳如龟 O:70/E:85 - need O vs E tradeoff
  {
    id: "Q115",
    level: 3,
    category: "原型区分-沉思猫头鹰vs稳如龟-充电方式",
    scenarioText: "一场热闹的社交活动结束后。",
    questionText: "你最可能怎么恢复能量？",
    primaryTraits: ["O", "E"],
    isForcedChoice: true,
    targetPairs: ["沉思猫头鹰", "稳如龟"],
    cohortTag: 'reflective_stabilizer',
    discriminationIndex: 0.62,
    options: [
      {
        value: "A",
        text: "安静地回顾和分析今天遇到的人和对话",
        traitScores: { A: 0, C: 0, E: -2, O: 4, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "做些熟悉的放松活动，让自己回到舒适状态",
        traitScores: { A: 0, C: 0, E: 4, O: -2, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "和亲近的朋友聊聊今天的感受",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "早点休息，充足睡眠最重要",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q116",
    level: 3,
    category: "原型区分-沉思猫头鹰vs稳如龟-处事风格",
    scenarioText: "团队在讨论一个重要决定。",
    questionText: "你更倾向于怎么参与？",
    primaryTraits: ["O", "E"],
    isForcedChoice: true,
    targetPairs: ["沉思猫头鹰", "稳如龟"],
    cohortTag: 'reflective_stabilizer',
    discriminationIndex: 0.60,
    options: [
      {
        value: "A",
        text: "仔细观察各方观点，提出深度分析和见解",
        traitScores: { A: 0, C: 1, E: -1, O: 4, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "保持稳定态度，帮助团队专注于核心问题",
        traitScores: { A: 0, C: 1, E: 4, O: -1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "积极推动讨论，确保每个人的意见被听到",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 3, P: 1 }
      },
      {
        value: "D",
        text: "安静倾听，需要时再补充想法",
        traitScores: { A: 0, C: 0, E: 1, O: 1, X: -2, P: 0 }
      }
    ]
  },
  // Q117-Q118: 机智狐 vs 灵感章鱼 专项区分题 (X+advocacy vs O+incubation)
  // Key diff: 机智狐 O:92/X:72, 灵感章鱼 O:95/X:60 - need X tradeoff
  {
    id: "Q117",
    level: 3,
    category: "原型区分-机智狐vs灵感章鱼-创意分享",
    scenarioText: "你想到了一个很棒的新点子。",
    questionText: "你更倾向于怎么处理这个点子？",
    primaryTraits: ["O", "X"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "灵感章鱼"],
    discriminationIndex: 0.65,
    options: [
      {
        value: "A",
        text: "迫不及待地和大家分享，听听反馈",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 4, P: 0 }
      },
      {
        value: "B",
        text: "先自己深入思考完善，再选择性地分享",
        traitScores: { A: 0, C: 0, E: 0, O: 4, X: -3, P: 0 }
      },
      {
        value: "C",
        text: "找一两个信任的人讨论，一起打磨",
        traitScores: { A: 1, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "记录下来，等合适的时机再说",
        traitScores: { A: 0, C: 1, E: 0, O: 1, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q118",
    level: 3,
    category: "原型区分-机智狐vs灵感章鱼-社交能量",
    scenarioText: "一个创意活动正在进行。",
    questionText: "你更可能怎么参与？",
    primaryTraits: ["O", "X"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "灵感章鱼"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.58,
    options: [
      {
        value: "A",
        text: "主动提出新奇想法，引导讨论方向",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 4, P: 0 }
      },
      {
        value: "B",
        text: "安静吸收灵感，在脑海中构建自己的想法",
        traitScores: { A: 0, C: 0, E: 0, O: 4, X: -3, P: 0 }
      },
      {
        value: "C",
        text: "和身边的人讨论，碰撞出新火花",
        traitScores: { A: 1, C: 0, E: 0, O: 2, X: 2, P: 0 }
      },
      {
        value: "D",
        text: "观察别人的创意，学习不同的思路",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: -1, P: 0 }
      }
    ]
  },
  // Q119-Q120: 太阳鸡 vs 淡定海豚 专项区分题 (P+X tradeoff)
  // Key diff: 太阳鸡 P:92/X:85, 淡定海豚 P:68/X:55 - need P and X differentiation
  {
    id: "Q119",
    level: 3,
    category: "原型区分-太阳鸡vs淡定海豚-社交节奏",
    scenarioText: "朋友邀请你参加一个派对。",
    questionText: "你对这次聚会的期待是？",
    primaryTraits: ["P", "X"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.65,
    options: [
      {
        value: "A",
        text: "超级兴奋！准备认识很多新朋友，把气氛搞起来",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 5, P: 3 }
      },
      {
        value: "B",
        text: "期待去开心一下，和熟悉的朋友待在一起就好",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "随缘参加，不会刻意社交，享受氛围就行",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -2, P: -2 }
      },
      {
        value: "D",
        text: "可能待一会儿就走，社交太久会累",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -4, P: 0 }
      }
    ]
  },
  {
    id: "Q120",
    level: 3,
    category: "原型区分-太阳鸡vs淡定海豚-耐心程度",
    scenarioText: "等待的事情比预期延迟了很久。",
    questionText: "你一般会怎么应对？",
    primaryTraits: ["P", "E"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.62,
    options: [
      {
        value: "A",
        text: "没关系！找周围的人聊天，时间很快过去",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 4, P: 4 }
      },
      {
        value: "B",
        text: "做点自己的事打发时间，比如看手机或看书",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "心平气和地等着，反正急也没用",
        traitScores: { A: 0, C: 0, E: 4, O: 0, X: -2, P: -2 }
      },
      {
        value: "D",
        text: "主动问一下进度，看看能不能加快",
        traitScores: { A: 0, C: 2, E: 0, O: 0, X: 1, P: -1 }
      }
    ]
  },
  // Q121-Q122: 暖心熊 vs 淡定海豚 专项区分题 (A tradeoff)
  // Key diff: 暖心熊 A:88, 淡定海豚 A:70 - need A differentiation
  {
    id: "Q121",
    level: 3,
    category: "原型区分-暖心熊vs淡定海豚-关怀方式",
    scenarioText: "一个不太熟的同事看起来心情很低落。",
    questionText: "你会怎么做？",
    primaryTraits: ["A", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.60,
    options: [
      {
        value: "A",
        text: "主动过去关心一下，看看能不能帮到ta",
        traitScores: { A: 5, C: 0, E: 0, O: 0, X: 2, P: 2 }
      },
      {
        value: "B",
        text: "悄悄买杯咖啡放ta桌上，不打扰但表达关心",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: -1, P: 2 }
      },
      {
        value: "C",
        text: "如果ta主动找我聊，我会认真倾听",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "不太会特别注意，ta可能想要私人空间",
        traitScores: { A: -2, C: 0, E: 2, O: 0, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q122",
    level: 3,
    category: "原型区分-暖心熊vs淡定海豚-情感投入",
    scenarioText: "朋友分享了一个好消息。",
    questionText: "你的反应更接近哪个？",
    primaryTraits: ["A", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.58,
    options: [
      {
        value: "A",
        text: "超级开心！立刻送上热情的祝贺和拥抱",
        traitScores: { A: 5, C: 0, E: 1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "真心为ta高兴，表达诚挚的祝福",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "替ta开心，问问接下来的计划",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "说声恭喜，内心替ta感到高兴",
        traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  // Q123-Q124: 暖心熊 vs 淡定海豚 加强区分题 (主动关怀 vs 稳定陪伴)
  {
    id: "Q123",
    level: 3,
    category: "原型区分-暖心熊vs淡定海豚-安慰方式",
    scenarioText: "好朋友刚经历了一次挫折，向你倾诉。",
    questionText: "你会怎么回应？",
    primaryTraits: ["A", "P"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "淡定海豚"],
    cohortTag: 'steady_harmonizer',
    discriminationIndex: 0.68,
    options: [
      {
        value: "A",
        text: "立刻放下手头的事，给ta一个大大的拥抱，陪ta聊到舒服为止",
        traitScores: { A: 6, C: -1, E: 0, O: 0, X: 1, P: 3 }
      },
      {
        value: "B",
        text: "认真倾听，偶尔点头，让ta知道你在，不急着给建议",
        traitScores: { A: 2, C: 1, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "帮ta分析问题，提供一些实际的解决思路",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "给ta空间消化情绪，告诉ta需要的时候可以找你",
        traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q124",
    level: 3,
    category: "原型区分-暖心熊vs淡定海豚-聚会角色",
    scenarioText: "你在组织一个朋友的生日聚会。",
    questionText: "你最关心的是什么？",
    primaryTraits: ["A", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "淡定海豚"],
    cohortTag: 'steady_harmonizer',
    discriminationIndex: 0.65,
    options: [
      {
        value: "A",
        text: "确保每个人都被照顾到，没有人被冷落",
        traitScores: { A: 4, C: -1, E: 1, O: -1, X: -2, P: 1 }
      },
      {
        value: "B",
        text: "让整体氛围轻松愉快，大家都玩得开心",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 2, P: 0 }
      },
      {
        value: "C",
        text: "活动流程顺畅，时间安排合理",
        traitScores: { A: -2, C: 3, E: 1, O: 0, X: 0, P: -2 }
      },
      {
        value: "D",
        text: "惊喜环节够特别，让寿星印象深刻",
        traitScores: { A: -1, C: -1, E: -1, O: 4, X: 1, P: 1 }
      }
    ]
  },
  // Q125-Q126: 太阳鸡 vs 淡定海豚 加强区分题 (高能量鼓励 vs 稳定陪伴)
  {
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
      {
        value: "A",
        text: "主动打气！\"别灰心，我们一定能搞定！\"带动大家的情绪",
        traitScores: { A: -1, C: -1, E: 1, O: -1, X: 4, P: 4 }
      },
      {
        value: "B",
        text: "保持冷静，说\"慢慢来，一步一步解决\"",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "默默多承担一些任务，用行动支持团队",
        traitScores: { A: 2, C: 2, E: 1, O: 0, X: -2, P: 1 }
      },
      {
        value: "D",
        text: "分析问题出在哪里，提出调整方案",
        traitScores: { A: -1, C: 2, E: 0, O: 2, X: 0, P: -2 }
      }
    ]
  },
  {
    id: "Q126",
    level: 3,
    category: "原型区分-太阳鸡vs淡定海豚-日常状态",
    scenarioText: "普通的一天，没什么特别的事。",
    questionText: "你的状态更接近哪个？",
    primaryTraits: ["P", "E"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "淡定海豚"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.72,
    options: [
      {
        value: "A",
        text: "心情自然就很好，看到什么都觉得挺开心的",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 2, P: 6 }
      },
      {
        value: "B",
        text: "心态平稳，不太有大起大落，该做什么做什么",
        traitScores: { A: 0, C: 1, E: 4, O: 0, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "需要找点有意思的事做，不然会有点无聊",
        traitScores: { A: 0, C: -1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "享受安静的时光，自己待着也挺舒服",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -3, P: 0 }
      }
    ]
  },
  
  // ==================== Q127-Q130: 高混淆对区分题 (V2.2新增) ====================
  // 针对模拟数据发现的主要混淆对：开心柯基↔机智狐、隐身猫↔淡定海豚、太阳鸡↔暖心熊
  
  {
    id: "Q127",
    level: 3,
    category: "社交风格区分",
    scenarioText: "朋友圈里有人发了一条很有争议的观点，评论区热闹得很。",
    questionText: "你更可能怎么做？",
    primaryTraits: ["X", "O", "A"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.78,
    options: [
      {
        value: "A",
        text: "立刻加入讨论，抛出自己独特的观点，享受思想碰撞",
        traitScores: { A: -1, C: -1, E: 0, O: 4, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "吃瓜看评论，觉得很有意思，偶尔点个赞互动",
        traitScores: { A: 1, C: 0, E: 2, O: 2, X: 5, P: 3 }
      },
      {
        value: "C",
        text: "私下找熟人讨论这个话题，分享各自看法",
        traitScores: { A: 2, C: 1, E: 2, O: 1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "有些厌烦这种争论，默默划走",
        traitScores: { A: 0, C: 1, E: 2, O: -1, X: -3, P: -1 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "派对本身就很好玩呀！人多热闹，肯定开心",
        traitScores: { A: -1, C: -1, E: -1, O: 0, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "可能认识一些有趣的新朋友，扩展社交圈",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "想观察不同类型的人，觉得挺有意思的",
        traitScores: { A: -1, C: 0, E: 1, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "不太想去，除非有认识的人陪同",
        traitScores: { A: 1, C: 0, E: 1, O: -1, X: -3, P: -1 }
      }
    ]
  },
  {
    id: "Q129",
    level: 3,
    category: "独处风格区分",
    scenarioText: "周末晚上独自在家，有一整个晚上的时间。",
    questionText: "你的状态更接近哪个？",
    primaryTraits: ["X", "E", "A"],
    isForcedChoice: true,
    targetPairs: ["隐身猫", "淡定海豚"],
    cohortTag: 'quiet_anchor',
    discriminationIndex: 0.80,
    options: [
      {
        value: "A",
        text: "很享受这种独处，做自己喜欢的事，不想被打扰",
        traitScores: { A: -1, C: 1, E: 2, O: 0, X: -4, P: 0 }
      },
      {
        value: "B",
        text: "会想找朋友线上聊聊天，分享一下今天的事",
        traitScores: { A: 3, C: 0, E: 2, O: 0, X: 2, P: 1 }
      },
      {
        value: "C",
        text: "独处很舒服，但如果朋友需要我，我随时愿意陪伴",
        traitScores: { A: 4, C: 0, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "会开始计划明天的事情，让时间有意义",
        traitScores: { A: 0, C: 3, E: 2, O: 0, X: 0, P: 1 }
      }
    ]
  },
  {
    id: "Q130",
    level: 3,
    category: "关怀方式区分",
    scenarioText: "朋友跟你吐槽工作上的烦恼。",
    questionText: "你更自然的反应是？",
    primaryTraits: ["A", "P", "E"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.82,
    options: [
      {
        value: "A",
        text: "「没事！这都是小事，明天肯定会更好的！」积极鼓励",
        traitScores: { A: -2, C: -2, E: 2, O: -2, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "静静听完，给一个拥抱或者陪着ta",
        traitScores: { A: 4, C: -1, E: 1, O: -1, X: -3, P: 1 }
      },
      {
        value: "C",
        text: "帮ta分析问题，提出解决方案",
        traitScores: { A: -2, C: 3, E: 1, O: 2, X: -2, P: -2 }
      },
      {
        value: "D",
        text: "说几句安慰的话，然后岔开话题聊点开心的",
        traitScores: { A: -1, C: -1, E: -2, O: 1, X: 2, P: -2 }
      }
    ]
  },

  // ==================== Q131-Q135: 新增高混淆对区分题 ====================
  // 针对持续混淆对：太阳鸡↔淡定海豚、沉思猫头鹰↔稳如龟、机智狐↔灵感章鱼、织网蛛↔定心大象、夸夸豚↔暖心熊
  
  {
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
      {
        value: "A",
        text: "立刻活跃气氛，\"我们可以的！一起加油！\"，带动大家打起精神",
        traitScores: { A: -1, C: -1, E: 1, O: -1, X: 4, P: 4 }
      },
      {
        value: "B",
        text: "保持冷静，分析问题，给出实际可行的建议",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: -1, P: -2 }
      },
      {
        value: "C",
        text: "默默做好自己的部分，用行动支持团队",
        traitScores: { A: 1, C: 2, E: 0, O: 0, X: -2, P: -1 }
      },
      {
        value: "D",
        text: "倾听每个人的想法，找到大家都认可的方向",
        traitScores: { A: 3, C: -1, E: 0, O: 0, X: -2, P: 1 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "想一些新奇的主题，比如角色扮演、密室逃脱之类的有创意的形式",
        traitScores: { A: -1, C: -1, E: 0, O: 4, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "参考以前成功的聚会形式，做个靠谱的经典聚餐或K歌",
        traitScores: { A: 0, C: 3, E: 1, O: -2, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "随便聊聊天就行，大家开心最重要，不用太复杂",
        traitScores: { A: 1, C: -2, E: 1, O: -1, X: 2, P: 2 }
      },
      {
        value: "D",
        text: "先问问大家想做什么，收集意见再决定",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q133",
    level: 3,
    category: "创意产生方式",
    scenarioText: "需要想一个创意方案，没有时间限制。",
    questionText: "你更喜欢？",
    primaryTraits: ["X", "O", "A"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "灵感章鱼"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.78,
    options: [
      {
        value: "A",
        text: "和朋友们头脑风暴，在讨论中激发灵感",
        traitScores: { A: 2, C: 0, E: 1, O: 4, X: 5, P: 2 }
      },
      {
        value: "B",
        text: "独自思考，沉浸在自己的想象世界里",
        traitScores: { A: -1, C: 1, E: 2, O: 5, X: -3, P: 0 }
      },
      {
        value: "C",
        text: "参考已有的成功案例，在此基础上优化",
        traitScores: { A: 0, C: 3, E: 2, O: -1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "边做边想，在实践中调整",
        traitScores: { A: 0, C: -1, E: 1, O: 2, X: 2, P: 2 }
      }
    ]
  },
  {
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
      {
        value: "A",
        text: "详细规划每天行程、交通、预算，做好备选方案",
        traitScores: { A: 1, C: 4, E: 2, O: -1, X: -2, P: -2 }
      },
      {
        value: "B",
        text: "定好大方向和关键节点，其他随机应变",
        traitScores: { A: 0, C: 2, E: 2, O: 1, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "问问大家想去哪，根据大家意见来",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "随缘吧，走到哪算哪，轻松就好",
        traitScores: { A: -1, C: -3, E: 1, O: 2, X: 1, P: 2 }
      }
    ]
  },
  {
    id: "Q135",
    level: 3,
    category: "情感表达深度",
    scenarioText: "好朋友分享了一个好消息。",
    questionText: "你的反应？",
    primaryTraits: ["P", "A", "X"],
    isForcedChoice: true,
    targetPairs: ["夸夸豚", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.80,
    options: [
      {
        value: "A",
        text: "\"哇！太棒了！你真的超厉害！\"，各种夸赞和感叹",
        traitScores: { A: 2, C: -2, E: -1, O: -2, X: 4, P: 4 }
      },
      {
        value: "B",
        text: "给一个温暖的拥抱，真诚地说\"我为你感到开心\"",
        traitScores: { A: 4, C: 0, E: 1, O: -1, X: -2, P: 1 }
      },
      {
        value: "C",
        text: "微笑点头，说\"恭喜\"，保持礼貌距离",
        traitScores: { A: -1, C: 1, E: 2, O: 0, X: -2, P: -2 }
      },
      {
        value: "D",
        text: "\"意料之中，你一直都很优秀\"，冷静肯定",
        traitScores: { A: 1, C: 1, E: 2, O: 1, X: 0, P: -2 }
      }
    ]
  },

  // ==================== Q_PLAYFUL: 互动式收尾题 (填补题库空白) ====================

  // Q_PLAYFUL_SLIDER — Energy Dial
  // 目标: 连续测量 X 强度 + 通过 P 信号解开 太阳鸡/淡定海豚 混淆对
  // 设计依据: MCQ 选项强迫用户二选一，滑条让用户表达真实强度，绕过社会期望偏差
  {
    id: "Q_PLAYFUL_SLIDER",
    level: 3,
    category: "能量感知",
    scenarioText: "周五下班，终于自由了——",
    questionText: "拖动滑条，找到你现在最接近的感觉",
    primaryTraits: ["X", "P"],
    questionType: "slider",
    isAnchor: false,
    discriminationIndex: 0.55,
    sliderConfig: {
      leftLabel: "想一个人待着",
      rightLabel: "快叫上朋友！",
      traitMappings: [
        { traitKey: "X", scoreAtZero: -4, scoreAt100: 4 },
        { traitKey: "P", scoreAtZero: -3, scoreAt100: 3 },
      ],
    },
    // 5 discrete buckets let the V4 engine validate selectedOption normally.
    // The frontend maps the continuous 0–100 slider position to the nearest bucket,
    // so scoring remains server-authoritative while the UX is still continuous.
    options: [
      {
        value: "slider_0",
        text: "完全想一个人待着",
        traitScores: { X: -4, P: -3 },
      },
      {
        value: "slider_25",
        text: "更偏向自己充电",
        traitScores: { X: -2, P: -1 },
      },
      {
        value: "slider_50",
        text: "看心情，居中就好",
        traitScores: { X: 0, P: 0 },
      },
      {
        value: "slider_75",
        text: "有点想约人出去",
        traitScores: { X: 2, P: 1 },
      },
      {
        value: "slider_100",
        text: "超想热闹一下，快叫上朋友！",
        traitScores: { X: 4, P: 3 },
      },
    ],
  },

  // Q_PLAYFUL_EMOJI — Conflict Instinct Tap
  // 目标: 捕捉 conflictPosture（prototypes.ts secondaryDifferentiators 中完全未被探测的维度）+ A 特质
  // 设计依据: 5选1快速直觉选择激活系统一反应，比文字 MCQ 更能测出真实行为倾向
  {
    id: "Q_PLAYFUL_EMOJI",
    level: 3,
    category: "社交直觉",
    scenarioText: "你看到两个朋友在微信群里因为一件小事杠起来了……",
    questionText: "你的第一反应？（别想，直接按）",
    primaryTraits: ["A", "X", "E"],
    questionType: "emoji_tap",
    isAnchor: false,
    isForcedChoice: true,
    discriminationIndex: 0.58,
    options: [
      {
        value: "popcorn",
        text: "吃瓜围观",
        traitScores: { O: 2, A: -2 },
        iconAssetKey: "popcorn",
      },
      {
        value: "dm",
        text: "私聊关心",
        traitScores: { A: 4, X: -1 },
        iconAssetKey: "dm",
      },
      {
        value: "leave",
        text: "暂退群聊",
        traitScores: { E: 2, X: -3 },
        iconAssetKey: "leave",
      },
      {
        value: "dove",
        text: "转移话题",
        traitScores: { A: 2, P: 2, C: 1 },
        iconAssetKey: "dove",
      },
      {
        value: "direct",
        text: "直接调解",
        traitScores: { X: 2, C: 2, A: 1 },
        iconAssetKey: "direct",
      },
    ],
  },
];
