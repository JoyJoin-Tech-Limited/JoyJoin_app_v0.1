/**
 * V4 Adaptive Assessment - Advanced Questions (O dimension + forced choice + confusion pairs)
 */

import { AdaptiveQuestion } from './types';

export const questionsV4Advanced: AdaptiveQuestion[] = [
  {
    id: "Q75",
    level: 2,
    category: "新观点接纳",
    scenarioText: "朋友分享了一个你从未听过、甚至有点颠覆认知的观点或理论。",
    questionText: "你的第一反应是？",
    primaryTraits: ["O", "C", "E"],
    discriminationIndex: 0.46,
    options: [
      {
        value: "A",
        text: "哇，这个角度好新颖！",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "有意思，但我想先查证一下。",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "这个...我需要时间消化一下。",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "听起来不太靠谱吧？",
        traitScores: { A: 0, C: 1, E: 1, O: -2, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q76",
    level: 2,
    category: "艺术体验",
    scenarioText: "朋友带你看先锋艺术展，作品很抽象。",
    questionText: "你的感觉是？",
    primaryTraits: ["O", "A", "P"],
    discriminationIndex: 0.43,
    options: [
      {
        value: "A",
        text: "好有意思！想知道艺术家想表达什么",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: 0, P: 1 }
      },
      {
        value: "B",
        text: "不太懂，但氛围挺特别的",
        traitScores: { A: 1, C: 0, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "有点困惑，但陪朋友看看",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "真的欣赏不来，想早点走",
        traitScores: { A: 0, C: 0, E: 1, O: -2, X: 0, P: -1 }
      }
    ]
  },
  {
    id: "Q77",
    level: 2,
    category: "探索欲望",
    scenarioText: "旅行时，你有半天自由活动时间。",
    questionText: "你更想怎么安排？",
    primaryTraits: ["O", "C", "X"],
    discriminationIndex: 0.47,
    options: [
      {
        value: "A",
        text: "随便走走，看到有趣的就进去",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "提前查好小众景点，按计划探索",
        traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "去大众点评上评分最高的地方",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "找个舒服的咖啡馆待着，不想到处跑",
        traitScores: { A: 0, C: 0, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },

  // 注意力检查题
  {
    id: "Q69",
    level: 2,
    category: "注意力检查",
    scenarioText: "这是一道用于确保你认真作答的检测题。",
    questionText: "请选择下方第三个选项。",
    primaryTraits: ["C"],
    isAttentionCheck: true,
    options: [
      {
        value: "A",
        text: "我选择这个选项。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "我选择这个选项。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我选择这个选项。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我选择这个选项。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // ==================== 强制选择权衡题 (Q84-Q89) ====================
  // 这类题目强制用户在两个积极特质之间做选择，帮助区分相似原型
  
  {
    id: "Q84",
    level: 2,
    category: "权衡选择-亲和vs开放",
    scenarioText: "朋友想尝试一家评价两极分化的新餐厅，你内心更倾向...",
    questionText: "",
    primaryTraits: ["A", "O"],
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "顺着朋友的意愿去试试，ta开心比较重要",
        traitScores: { A: 3, C: 0, E: 0, O: -1, X: 0, P: 1 }
      },
      {
        value: "B",
        text: "建议去另一家更稳妥的选择，避免踩雷",
        traitScores: { A: 1, C: 2, E: 1, O: -2, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "好奇心驱动！评价两极反而更想亲自验证",
        traitScores: { A: -1, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "无所谓，反正是一起吃饭，去哪都行",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q85",
    level: 2,
    category: "权衡选择-外向vs情绪稳定",
    scenarioText: "连续参加了三天高强度社交活动，第四天又有个重要聚会。",
    questionText: "你会？",
    primaryTraits: ["X", "E"],
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "继续参加！社交让我越来越有能量",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: 4, P: 2 }
      },
      {
        value: "B",
        text: "去但早点撤，平衡社交和休息",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "推掉，我需要时间恢复才能保持好状态",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -2, P: -1 }
      },
      {
        value: "D",
        text: "虽然累但硬撑，不想错过任何可能的精彩",
        traitScores: { A: 0, C: -1, E: -1, O: 1, X: 2, P: 1 }
      }
    ]
  },
  {
    id: "Q86",
    level: 2,
    category: "权衡选择-亲和vs正能量",
    scenarioText: "朋友连续抱怨同一件事已经第三次了，你感觉...",
    questionText: "",
    primaryTraits: ["A", "P"],
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "继续耐心倾听，朋友需要我的支持",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: -1 }
      },
      {
        value: "B",
        text: "有点烦了，但还是配合表面应付",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: -2 }
      },
      {
        value: "C",
        text: "委婉转移话题，聊点开心的事",
        traitScores: { A: 1, C: 1, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "直接说：要不我们想办法解决它？总抱怨也不是办法",
        traitScores: { A: -1, C: 2, E: 0, O: 0, X: 0, P: 3 }
      }
    ]
  },
  {
    id: "Q87",
    level: 2,
    category: "权衡选择-开放vs责任心",
    scenarioText: "团队项目快到deadline，这时有个很吸引你的新想法冒出来。",
    questionText: "你会？",
    primaryTraits: ["O", "C"],
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "先把现有任务完成，新想法记下来以后再说",
        traitScores: { A: 0, C: 3, E: 1, O: -1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "立刻跟团队分享，说不定能让项目更出彩",
        traitScores: { A: 1, C: -1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "自己先快速验证可行性，再决定是否提出",
        traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "觉得现阶段改动太冒险，放弃这个想法",
        traitScores: { A: 0, C: 2, E: 2, O: -2, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q88",
    level: 2,
    category: "权衡选择-外向vs亲和",
    scenarioText: "聚会上你发现一个人独自站在角落，看起来有点格格不入。",
    questionText: "你会？",
    primaryTraits: ["X", "A"],
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "主动过去攀谈，把ta带入大家的圈子",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "继续和现有的朋友们热闹，ta可能更喜欢独处",
        traitScores: { A: -1, C: 0, E: 0, O: 0, X: 2, P: 0 }
      },
      {
        value: "C",
        text: "等合适的时机再搭话，不想显得太刻意",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "注意到了但不会主动，我自己也有点社恐",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q89",
    level: 2,
    category: "权衡选择-正能量vs情绪稳定",
    scenarioText: "今天运气很背，连续遇到好几件倒霉事。",
    questionText: "你的心态是？",
    primaryTraits: ["P", "E"],
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "虽然烦躁，但告诉自己明天会更好",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "需要一些时间消化这些负面情绪",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "主动找朋友吐槽发泄，然后就能释怀",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "心情会受影响很久，很难快速调节",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: 0, P: -2 }
      }
    ]
  },
  // === 针对易混淆原型的精准区分题 ===
  // Q90-Q92: 针对开心柯基vs太阳鸡、机智狐vs灵感章鱼、淡定海豚vs夸夸豚/暖心熊
  {
    id: "Q90",
    level: 2,
    category: "原型区分-柯基vs太阳鸡",
    scenarioText: "朋友聚会上，气氛有点冷场。",
    questionText: "你的第一反应是？",
    primaryTraits: ["X", "E", "C"],
    isForcedChoice: true,
    targetPairs: ["开心柯基", "太阳鸡"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.80,
    options: [
      {
        value: "A",
        text: "立刻开始讲笑话、起哄，用自己的热情带动气氛",
        traitScores: { A: 0, C: -1, E: 0, O: 1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "细心观察每个人的状态，找话题让大家都能参与进来",
        traitScores: { A: 2, C: 2, E: 2, O: 0, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "默默准备些零食饮料，照顾好大家的需要",
        traitScores: { A: 2, C: 2, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "等别人先打破僵局，我不太擅长主导场面",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q91",
    level: 2,
    category: "原型区分-机智狐vs灵感章鱼",
    scenarioText: "你有一个很棒的创意想法，需要把它变成现实。",
    questionText: "你一般会？",
    primaryTraits: ["C", "O"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "灵感章鱼"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.75,
    options: [
      {
        value: "A",
        text: "先列出详细的执行计划和时间表，一步步推进",
        traitScores: { A: -1, C: 3, E: 1, O: -1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "趁着灵感还在就直接动手，边做边调整",
        traitScores: { A: -1, C: -2, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "先和别人分享讨论，收集反馈再决定怎么做",
        traitScores: { A: 2, C: 0, E: -1, O: 1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "想法太多反而选择困难，可能最后什么都没做",
        traitScores: { A: 0, C: -1, E: -1, O: 2, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q92",
    level: 2,
    category: "原型区分-海豚vs夸夸豚vs暖心熊",
    scenarioText: "好朋友最近工作压力大，向你倾诉烦恼。",
    questionText: "你更愿意？",
    primaryTraits: ["A", "C", "E"],
    isForcedChoice: true,
    targetPairs: ["淡定海豚", "夸夸豚", "暖心熊"],
    cohortTag: 'steady_harmonizer',
    options: [
      {
        value: "A",
        text: "热情地给ta加油打气，分享正能量语录鼓励ta",
        traitScores: { A: 1, C: -1, E: -1, O: 0, X: 2, P: 3 }
      },
      {
        value: "B",
        text: "陪ta聊天，用温暖的态度给予情感支持",
        traitScores: { A: 3, C: 0, E: 2, O: 0, X: -1, P: 1 }
      },
      {
        value: "C",
        text: "帮ta理性分析问题，提供实用的解决建议",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "默默陪伴，觉得有时候安静的陪伴比说什么都重要",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q93",
    level: 2,
    category: "原型区分-暖心熊vs定心大象vs织网蛛",
    scenarioText: "朋友遇到困难需要帮忙，你一般会？",
    questionText: "你更倾向于？",
    primaryTraits: ["A", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "定心大象", "织网蛛"],
    cohortTag: 'steady_harmonizer',
    options: [
      {
        value: "A",
        text: "第一时间放下手头的事去帮忙，朋友有难义不容辞",
        traitScores: { A: 3, C: -1, E: 1, O: -1, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "先了解清楚情况，制定合理的帮助计划再行动",
        traitScores: { A: -1, C: 3, E: 2, O: 0, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "帮忙的同时也会协调其他资源，让帮助更有效率",
        traitScores: { A: 1, C: 2, E: 1, O: 1, X: 1, P: -1 }
      },
      {
        value: "D",
        text: "想帮但不太确定怎么帮最好，先观察再说",
        traitScores: { A: -1, C: 0, E: 1, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q94",
    level: 2,
    category: "原型区分-沉思猫头鹰vs稳如龟vs灵感章鱼",
    scenarioText: "学习新知识或技能时，你的习惯是？",
    questionText: "你一般会？",
    primaryTraits: ["O", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["沉思猫头鹰", "稳如龟", "灵感章鱼"],
    cohortTag: 'quiet_anchor',
    options: [
      {
        value: "A",
        text: "深入研究原理和细节，追求真正理解而非表面了解",
        traitScores: { A: 0, C: 2, E: 1, O: 2, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "稳扎稳打，按部就班地学习，不急于求成",
        traitScores: { A: 0, C: 3, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "喜欢跳跃式学习，哪里有灵感就学哪里",
        traitScores: { A: 0, C: -2, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "边学边实践，在应用中加深理解",
        traitScores: { A: 0, C: 1, E: 0, O: 1, X: 1, P: 1 }
      }
    ]
  },
  {
    id: "Q95",
    level: 2,
    category: "原型区分-沉思猫头鹰vs稳如龟",
    scenarioText: "面对一个复杂的问题，你需要做出决定。",
    questionText: "你更倾向于？",
    primaryTraits: ["O", "E"],
    isForcedChoice: true,
    targetPairs: ["沉思猫头鹰", "稳如龟"],
    cohortTag: 'quiet_anchor',
    options: [
      {
        value: "A",
        text: "深入探索各种可能性，挖掘问题的本质和深层含义",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "保持情绪稳定，不急不躁地按部就班处理",
        traitScores: { A: 0, C: 1, E: 3, O: -1, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "思考事物之间的联系，寻找创新的解决思路",
        traitScores: { A: 0, C: 0, E: -1, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "淡定面对，相信问题总会有出路",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: -1 }
      }
    ]
  },
  {
    id: "Q96",
    level: 2,
    category: "原型区分-机智狐vs织网蛛",
    scenarioText: "团队遇到一个棘手问题，需要有人来推动解决。",
    questionText: "你会？",
    primaryTraits: ["A", "O", "X"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "织网蛛"],
    cohortTag: 'creative_explorer',
    options: [
      {
        value: "A",
        text: "想出几个创意方案，灵活应变找到突破口",
        traitScores: { A: -1, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "串联相关的人，协调资源一起解决问题",
        traitScores: { A: 3, C: 1, E: 0, O: -1, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "观察形势，找到合适的时机出手",
        traitScores: { A: 0, C: 1, E: 1, O: 1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "默默研究问题，先想清楚再说",
        traitScores: { A: -1, C: 2, E: 1, O: 1, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q97",
    level: 2,
    category: "原型区分-开心柯基vs夸夸豚",
    scenarioText: "朋友考试/面试取得了好成绩，发消息告诉你。",
    questionText: "你的第一反应是？",
    primaryTraits: ["X", "A", "P"],
    isForcedChoice: true,
    targetPairs: ["开心柯基", "夸夸豚"],
    cohortTag: 'social_catalyst',
    options: [
      {
        value: "A",
        text: "发一堆表情包庆祝，跟着一起嗨起来！",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "认真夸ta的努力和付出，让ta知道自己有多棒",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "C",
        text: "约ta出来庆祝，热热闹闹吃一顿！",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "D",
        text: "表达祝贺，顺便问问接下来的打算",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q98",
    level: 3,
    category: "原型区分-灵感章鱼vs开心柯基",
    scenarioText: "周末有两个活动邀请：一个是朋友组织的热闹派对，另一个是小众艺术展览开幕。",
    questionText: "你更想去？",
    primaryTraits: ["O", "X", "P"],
    isForcedChoice: true,
    targetPairs: ["灵感章鱼", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.55,
    options: [
      {
        value: "A",
        text: "派对！热闹的氛围让我充满活力",
        traitScores: { A: 0, C: -1, E: 0, O: -1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "艺术展！独特的体验比热闹更吸引我",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "先去展览逛逛，再赶去派对凑热闹",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "看看哪边朋友更多再决定",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 1, P: 0 }
      }
    ]
  },
  {
    id: "Q99",
    level: 3,
    category: "原型区分-隐身猫vs定心大象",
    scenarioText: "新搬到一个社区，邻居们组织了一个欢迎聚会。",
    questionText: "你会？",
    primaryTraits: ["X", "C", "A"],
    isForcedChoice: true,
    targetPairs: ["隐身猫", "定心大象"],
    cohortTag: 'quiet_anchor',
    discriminationIndex: 0.52,
    options: [
      {
        value: "A",
        text: "找个借口婉拒，私下和邻居一对一认识就好",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -3, P: 0 }
      },
      {
        value: "B",
        text: "去但保持低调，观察环境和人群",
        traitScores: { A: 0, C: 2, E: 2, O: 1, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "准时参加，主动帮忙布置或端茶倒水",
        traitScores: { A: 2, C: 2, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "参加并尝试记住每个人的名字和特点",
        traitScores: { A: 1, C: 3, E: 0, O: 0, X: 1, P: 0 }
      }
    ]
  },
  {
    id: "Q100",
    level: 3,
    category: "原型区分-机智狐vs开心柯基",
    scenarioText: "团队头脑风暴会议上，你有一个很棒的点子。",
    questionText: "你更愿意？",
    primaryTraits: ["O", "X", "C"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "开心柯基"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.50,
    options: [
      {
        value: "A",
        text: "立刻大声分享，让大家一起讨论完善",
        traitScores: { A: 0, C: -1, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "先思考如何更好地表达，确保点子足够精彩再说",
        traitScores: { A: 0, C: 2, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "用幽默有趣的方式讲出来，带动气氛",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 2, P: 2 }
      },
      {
        value: "D",
        text: "先私下和信任的同事讨论，再一起提出",
        traitScores: { A: 1, C: 1, E: 1, O: 1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q101",
    level: 3,
    category: "原型区分-灵感章鱼vs沉思猫头鹰",
    scenarioText: "发现一个很有深度的话题，你想深入了解。",
    questionText: "你的方式是？",
    primaryTraits: ["O", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["灵感章鱼", "沉思猫头鹰"],
    cohortTag: 'creative_explorer',
    discriminationIndex: 0.48,
    options: [
      {
        value: "A",
        text: "随性探索，跟着兴趣跳转到各种相关话题",
        traitScores: { A: 0, C: -2, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "系统地收集资料，按逻辑整理后深入研究",
        traitScores: { A: 0, C: 3, E: 1, O: 2, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "和懂这个话题的人聊聊，从对话中获取灵感",
        traitScores: { A: 1, C: 0, E: 0, O: 2, X: 2, P: 0 }
      },
      {
        value: "D",
        text: "找一本权威书籍，从头到尾认真读完",
        traitScores: { A: 0, C: 3, E: 2, O: 1, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q102",
    level: 3,
    category: "原型区分-隐身猫vs稳如龟",
    scenarioText: "被邀请在小型聚会上分享自己的专业经验。",
    questionText: "你的反应是？",
    primaryTraits: ["X", "E", "C"],
    isForcedChoice: true,
    targetPairs: ["隐身猫", "稳如龟"],
    cohortTag: 'quiet_anchor',
    discriminationIndex: 0.45,
    options: [
      {
        value: "A",
        text: "婉拒，觉得自己不适合在众人面前讲话",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -3, P: -1 }
      },
      {
        value: "B",
        text: "接受，但会提前认真准备，确保讲得清楚",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "建议改成小范围讨论，这样更自在",
        traitScores: { A: 1, C: 1, E: 2, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "勉强答应但心里很紧张，担心表现不好",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: -1, P: -1 }
      }
    ]
  },
];
