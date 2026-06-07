/**
 * V4 Adaptive Assessment - L2 Core Exploration Questions (Q16-Q50)
 */

import { AdaptiveQuestion } from './types';

export const questionsV4L2: AdaptiveQuestion[] = [
  {
    id: "Q16",
    level: 2,
    category: "情感回应",
    scenarioText: "一个朋友在聚会上显得情绪低落，向你倾诉最近的烦恼。",
    questionText: "你最自然的回应方式是？",
    primaryTraits: ["A", "C", "P"],
    options: [
      {
        value: "A",
        text: "专注地看着ta，点头说我懂你的感受",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "等ta情绪平稳后，帮ta把问题分解，列出可能的解决步骤",
        traitScores: { A: 0, C: 3, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分享自己类似的经历，让ta知道并不孤单",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "心里有点烦，希望ta别在聚会上聊这些负面话题",
        traitScores: { A: -2, C: 0, E: 0, O: 0, X: 0, P: -2 }
      },
      {
        value: "E",
        text: "提议做些别的事情分散注意力",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 2, P: 2 }
      }
    ]
  },
  {
    id: "Q17",
    level: 2,
    category: "新奇发现",
    scenarioText: "你在城市某个角落偶然发现一家隐藏在小巷里、风格极其独特的咖啡店。",
    questionText: "接下来你最可能做什么？",
    primaryTraits: ["O", "X", "A"],
    options: [
      {
        value: "A",
        text: "立刻拍照发朋友圈/群里，并@几个朋友计划周末就去探险",
        traitScores: { A: -1, C: -1, E: 0, O: 2, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "沉迷于研究它的历史、店主故事或设计理念",
        traitScores: { A: -1, C: 1, E: 0, O: 3, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "收藏地址，等有特别适合的朋友或场合时再分享",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "自己一个人先去体验一次，再决定是否告诉别人",
        traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q18",
    level: 2,
    category: "能量恢复",
    scenarioText: "参加了一场持续4小时、需要高度社交投入的活动后，你感觉电量耗尽。",
    questionText: "结束后，你一般最需要什么样的恢复方式？",
    primaryTraits: ["E", "X"],
    options: [
      {
        value: "A",
        text: "立刻回家，确保有至少2小时完全独处的时间",
        traitScores: { A: -1, C: 0, E: 2, O: 0, X: -2, P: -1 }
      },
      {
        value: "B",
        text: "在活动线上群里继续回味，发照片、聊天，延续兴奋感",
        traitScores: { A: 1, C: -1, E: -1, O: 0, X: 2, P: 2 }
      },
      {
        value: "C",
        text: "和1-2个最亲近的参与者找个安静地方简单复盘，然后各自回家",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "需要一些低刺激的独处活动，如看书、听播客，但不必完全隔绝",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q19",
    level: 2,
    category: "助人行为",
    scenarioText: "活动群里，有人问一个你恰好知道答案的问题。",
    questionText: "你一般会？",
    primaryTraits: ["A", "C", "X"],
    options: [
      {
        value: "A",
        text: "直接给出准确答案和详细信息",
        traitScores: { A: 1, C: 2, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "先鼓励ta，然后@可能更了解的人一起来帮忙",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "C",
        text: "私聊告诉提问者，避免刷屏",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "看到已经有人回答了，就默默点赞",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q20",
    level: 2,
    category: "纠错倾向",
    scenarioText: "大家在热烈讨论一部电影，但其中一个人反复提到一个明显的事实错误。",
    questionText: "你更可能？",
    primaryTraits: ["C", "E", "A"],
    options: [
      {
        value: "A",
        text: "委婉但清晰地指出正确的信息，并提供来源",
        traitScores: { A: 1, C: 2, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "除非这个错误严重影响讨论结论，否则一笑置之",
        traitScores: { A: 1, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "私下告诉那个人，避免ta在公开场合尴尬",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "直接当众纠正，不管ta是否尴尬，事实就是事实",
        traitScores: { A: -2, C: 2, E: 0, O: 0, X: 1, P: -1 }
      },
      {
        value: "E",
        text: "顺着错误开个玩笑，把话题引向更有趣的方向",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 2 }
      }
    ]
  },
  {
    id: "Q21",
    level: 2,
    category: "规则利用",
    scenarioText: "玩桌游时，你发现有一条未被充分利用但完全合理的规则，可以让你的局面逆转。",
    questionText: "你会？",
    primaryTraits: ["O", "C", "A"],
    options: [
      {
        value: "A",
        text: "立刻兴奋地指出并利用，享受策略成功的快感",
        traitScores: { A: 0, C: 2, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "先向所有人确认这条规则的理解是否一致，避免争议",
        traitScores: { A: 1, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "犹豫是否使用，担心破坏游戏平衡或让对手不快",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "不提这个规则，继续正常玩",
        traitScores: { A: 0, C: 0, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q21_v1",
    level: 2,
    category: "规则利用",
    scenarioText: "抢群红包或积分活动时，你发现了一个提高成功率的合法小技巧。",
    questionText: "你会？",
    primaryTraits: ["O", "C", "A"],
    variantOf: "Q21",
    options: [
      {
        value: "A",
        text: "自己闷声发大财，先抢到再说。",
        traitScores: { A: -2, C: 1, E: 0, O: 2, X: 1, P: -1 }
      },
      {
        value: "B",
        text: "在群里大方分享技巧，带着大家一起抢。",
        traitScores: { A: 3, C: 0, E: 0, O: 2, X: 2, P: 2 }
      },
      {
        value: "C",
        text: "觉得麻烦，不想为了这点利去钻研技巧。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "担心破坏规则，选择不使用这个技巧。",
        traitScores: { A: 1, C: 3, E: 1, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q22",
    level: 2,
    category: "意见保留",
    scenarioText: "朋友推荐了一部ta极度喜爱的电影/音乐，但你看完后完全无感。",
    questionText: "下次聊起时，你会？",
    primaryTraits: ["A", "O", "E"],
    options: [
      {
        value: "A",
        text: "我觉得...不太是我的菜",
        traitScores: { A: -1, C: 0, E: 0, O: 2, X: 1, P: -1 }
      },
      {
        value: "B",
        text: "还不错，画面挺好看的！",
        traitScores: { A: 2, C: 0, E: 1, O: -1, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "哈哈你真的很喜欢这类型的对吧？",
        traitScores: { A: 2, C: 1, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "含糊带过，期待话题自然转移",
        traitScores: { A: 0, C: 0, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q22_v1",
    level: 2,
    category: "意见保留",
    scenarioText: "朋友带你去吃ta心目中全市最好吃的餐厅，但你觉得口味很平庸。",
    questionText: "当ta满怀期待问你怎么样时，你会？",
    primaryTraits: ["A", "O", "E"],
    variantOf: "Q22",
    options: [
      {
        value: "A",
        text: "坦白说出自己的真实评价，并指出不足。",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "礼貌称赞餐厅的装修或服务，避谈味道。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "夸奖对方眼光独到，询问ta是怎么发现这里的。",
        traitScores: { A: 3, C: 0, E: 0, O: 1, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "违心地点头说确实不错，不想扫兴。",
        traitScores: { A: 1, C: 0, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q23",
    level: 2,
    category: "账单处理",
    scenarioText: "AA结账时，发现金额有些零头，不太好平分。",
    questionText: "你一般的处理方式是？",
    primaryTraits: ["C", "A", "X"],
    options: [
      {
        value: "A",
        text: "多的那点我来吧～主动承担零头",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "精确计算到个位，确保每个人付得公平",
        traitScores: { A: 0, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "下次谁请客抵掉算了",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "跟着大家怎么说就怎么付",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q23_v1",
    level: 2,
    category: "账单处理",
    scenarioText: "几个朋友一起租车出游，加油费产生了一些零头和尾数。",
    questionText: "你会？",
    primaryTraits: ["A", "C", "E"],
    variantOf: "Q23",
    options: [
      {
        value: "A",
        text: "我是发起人，这点零头我就直接出了。",
        traitScores: { A: 3, C: 0, E: 1, O: -1, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "用账单小程序计算，确保每人分摊完全公平。",
        traitScores: { A: -1, C: 3, E: 1, O: 0, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "大概分一下就行，不用算那么细。",
        traitScores: { A: 2, C: -2, E: 2, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "先让大家记账，最后总金额算清楚。",
        traitScores: { A: 0, C: 2, E: 2, O: -1, X: 0, P: -1 }
      }
    ]
  },
  {
    id: "Q24",
    level: 2,
    category: "信息来源",
    scenarioText: "组织聚会前，你需要确定一家餐厅。",
    questionText: "你获取信息的主要方式是？",
    primaryTraits: ["O", "C", "X"],
    options: [
      {
        value: "A",
        text: "问群里有没有人去过或有推荐",
        traitScores: { A: 1, C: -1, E: 0, O: -1, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "刷点评APP，综合分析评分、评论、人均",
        traitScores: { A: -1, C: 3, E: 0, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "回忆自己去过或听说过的地方",
        traitScores: { A: 0, C: 1, E: 1, O: -1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "随便挑一个看起来不错的，到时候再说",
        traitScores: { A: -1, C: -2, E: 1, O: 2, X: 0, P: 1 }
      }
    ]
  },
  {
    id: "Q25",
    level: 2,
    category: "技能教授",
    scenarioText: "别人请你教一个你擅长的技能。",
    questionText: "你的教学风格是？",
    primaryTraits: ["C", "A", "O"],
    options: [
      {
        value: "A",
        text: "先演示一遍，然后让ta自己试，有问题随时问",
        traitScores: { A: 1, C: 1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "从头讲解原理和步骤，确保ta理解了再开始",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "手把手带着做，每一步都一起",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "发几个教程链接，让ta自己先看",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q26",
    level: 2,
    category: "圈子定位",
    scenarioText: "如果把你放在一个10人的社交圈子里，",
    questionText: "你觉得自己最常扮演的角色是？",
    primaryTraits: ["X", "A", "O", "C"],
    options: [
      {
        value: "A",
        text: "我是气氛发动机/活动发起者",
        traitScores: { A: 0, C: 1, E: 0, O: 1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "我是组织协调者/资源连接者",
        traitScores: { A: 3, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我是深度参与者/知识提供者",
        traitScores: { A: 0, C: 2, E: 0, O: 3, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我是边缘观察者/偶尔露面的人",
        traitScores: { A: -1, C: 0, E: 2, O: -1, X: -2, P: -1 }
      },
      {
        value: "E",
        text: "我是稳定参与者/支持性成员",
        traitScores: { A: 2, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q27",
    level: 2,
    category: "创意产出",
    scenarioText: "团队头脑风暴时，领导说任何天马行空的想法都可以。",
    questionText: "你的典型产出是？",
    primaryTraits: ["O", "C", "X"],
    options: [
      {
        value: "A",
        text: "大量短平快的点子，其中几个可能很有趣",
        traitScores: { A: 0, C: -1, E: 0, O: 2, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "几个经过初步推敲、可行性较高的方案",
        traitScores: { A: 0, C: 3, E: 0, O: -1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "一个深入、系统但可能略显复杂的框架性想法",
        traitScores: { A: -1, C: 2, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "在别人想法的基础上进行补充和优化",
        traitScores: { A: 1, C: 2, E: 1, O: -1, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q28",
    level: 2,
    category: "社交焦虑",
    scenarioText: "在一个热闹的微信群中，你发了一条消息，但一段时间内无人回应。",
    questionText: "你内心更可能？",
    primaryTraits: ["E", "X"],
    options: [
      {
        value: "A",
        text: "有点尴尬，担心自己刚才是不是说了什么不合时宜的话",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: -2, P: 0 }
      },
      {
        value: "B",
        text: "无所谓，大家可能都在忙，等下自然会有人回",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "主动@某个可能感兴趣的人，或发个表情包救场",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "反思消息的内容和形式，看是否可以提高表达清晰度",
        traitScores: { A: 0, C: 2, E: 0, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q29",
    level: 2,
    category: "惊喜反应",
    scenarioText: "朋友为你准备了一个惊喜生日派对。当你推开门，所有人齐声欢呼时，",
    questionText: "你的第一反应是？",
    primaryTraits: ["A", "X", "E"],
    options: [
      {
        value: "A",
        text: "惊喜又感动，可能有点眼眶湿润，拥抱最近的朋友",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "非常兴奋，大笑并做出夸张的反应，享受这个高光时刻",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "C",
        text: "有点不知所措，但努力配合大家的热情，说谢谢大家",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "内心感激，但会觉得被这么多人关注有些负担",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q30",
    level: 2,
    category: "反馈行为",
    scenarioText: "活动结束后，组织者在群里发起匿名反馈问卷。",
    questionText: "你一般会？",
    primaryTraits: ["C", "P", "E", "A"],
    options: [
      {
        value: "A",
        text: "认真填写，既提优点也提具体改进建议",
        traitScores: { A: 1, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "以鼓励为主，提一点建议时会特别注意措辞",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "C",
        text: "简单勾选评分，简短评论",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "看心情决定填不填，如果没强烈感受就跳过",
        traitScores: { A: 0, C: -1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q31",
    level: 2,
    category: "集体决策",
    scenarioText: "你和一群朋友计划一次旅行，有几种不同的风格选择。",
    questionText: "在讨论中，你更可能扮演什么角色？",
    primaryTraits: ["X", "A", "C", "E"],
    options: [
      {
        value: "A",
        text: "积极推销自己最感兴趣的风格",
        traitScores: { A: -1, C: 0, E: 0, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "倾听各方偏好，尝试找折中方案",
        traitScores: { A: 3, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分析每种方案的利弊、预算和可行性",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我都可以，大家决定好了告诉我",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q32",
    level: 2,
    category: "游戏偏好",
    scenarioText: "聚会上，大家玩真心话大冒险。轮到你选择时，",
    questionText: "你更倾向于？",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
        value: "A",
        text: "大冒险！越刺激有趣越好",
        traitScores: { A: 0, C: -1, E: -1, O: 1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "真心话，可以分享一些故事，但希望问题不要太私密",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "根据在场的人的熟悉程度和气氛来决定",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "尽量选一个最简单、最安全的任务或问题",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q33",
    level: 2,
    category: "意外冲突",
    scenarioText: "在狭窄的过道，你不小心和迎面走来的人撞了一下，对方看起来心情不好并咕哝了一句不客气的话。",
    questionText: "你的第一反应是？",
    primaryTraits: ["E", "A", "C"],
    options: [
      {
        value: "A",
        text: "立刻道歉并快步离开，不想卷入冲突",
        traitScores: { A: 2, C: 0, E: 3, O: 0, X: -1, P: 1 }
      },
      {
        value: "B",
        text: "皱眉或回看一眼，内心虽然不悦但忍住不发作",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "理直气壮地回一句你也撞到我了，维护自己的边界",
        traitScores: { A: -2, C: 0, E: -1, O: 0, X: 2, P: -1 }
      },
      {
        value: "D",
        text: "心平气和地说一句不好意思，并观察对方是否需要帮助",
        traitScores: { A: 3, C: 1, E: 2, O: 1, X: 0, P: 2 }
      }
    ]
  },
  {
    id: "Q34",
    level: 2,
    category: "信息分享",
    scenarioText: "看到一条关于你某个朋友感兴趣领域的深度干货，但内容很长且有一定的门槛。",
    questionText: "你会？",
    primaryTraits: ["A", "O", "C", "X"],
    options: [
      {
        value: "A",
        text: "立刻转发给ta，并附带一句这个你应该感兴趣",
        traitScores: { A: 2, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "自己先看完并总结出几个核心点，连同链接一起发给ta",
        traitScores: { A: 3, C: 3, E: 0, O: 3, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "先收藏，等下次见面或深度聊天时再当面交流",
        traitScores: { A: 1, C: 1, E: 1, O: 1, X: -1, P: 2 }
      },
      {
        value: "D",
        text: "没兴趣帮别人筛选信息，ta自己会看到的",
        traitScores: { A: -2, C: 0, E: 1, O: -1, X: 0, P: -1 }
      },
      {
        value: "E",
        text: "觉得可能打扰到对方，或者对方自己也能看到，就不发了",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q35",
    level: 2,
    category: "计划变动",
    scenarioText: "期待已久的周末出游计划因为天气原因临时取消，改为室内聚会。",
    questionText: "你的心态转变是？",
    primaryTraits: ["E", "O", "P"],
    options: [
      {
        value: "A",
        text: "非常失望，觉得心情全毁了，参与室内聚会也提不起劲",
        traitScores: { A: 0, C: 0, E: -3, O: -1, X: 0, P: -2 }
      },
      {
        value: "B",
        text: "虽然遗憾，但很快开始寻找室内的好玩项目",
        traitScores: { A: 1, C: 1, E: 2, O: 2, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "觉得室内聚会也挺好，可以更安静地聊天，也不错",
        traitScores: { A: 2, C: 0, E: 3, O: 1, X: 0, P: 2 }
      },
      {
        value: "D",
        text: "索性不去了，打算在家里休息或做自己的事",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q36",
    level: 2,
    category: "接受新事物",
    scenarioText: "朋友向你推荐一个ta非常喜欢、但你之前从未接触过的活动。",
    questionText: "你的第一反应是？",
    primaryTraits: ["O", "C", "A"],
    options: [
      {
        value: "A",
        text: "听起来很有趣，我很愿意尝试一下",
        traitScores: { A: 1, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "先了解一下细节再决定",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "如果朋友陪我一起去，我可能愿意试一试",
        traitScores: { A: 3, C: 0, E: 0, O: 1, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "不太感兴趣，我还是喜欢做自己熟悉的事",
        traitScores: { A: 0, C: 1, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q37",
    level: 2,
    category: "重大建议",
    scenarioText: "当朋友问你我该不该换工作/结束一段关系？这类重大人生抉择时，",
    questionText: "你一般如何回应？",
    primaryTraits: ["C", "A", "P"],
    options: [
      {
        value: "A",
        text: "帮ta列出所有利弊，分析每种选择的可能结果",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "先共情，问ta的感受和真实需求，而不是急于给建议",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分享自己或他人的类似经历和结果",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "直接给出我的建议，不绕弯子，就算ta可能不爱听",
        traitScores: { A: -2, C: 1, E: 0, O: 0, X: 1, P: -1 }
      },
      {
        value: "E",
        text: "鼓励ta跟随内心的直觉，你会支持ta的任何决定",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 3 }
      }
    ]
  },
  {
    id: "Q38",
    level: 2,
    category: "高强度社交",
    scenarioText: "在一个大型庆祝派对上，音乐很响，人非常多。",
    questionText: "一小时后，你感觉如何？",
    primaryTraits: ["X", "E"],
    options: [
      {
        value: "A",
        text: "渐入佳境，越来越嗨，享受这种能量场",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "有点累，需要去安静角落或室外透透气",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "找到了小圈子深入聊天，感觉还不错",
        traitScores: { A: 2, C: -1, E: 1, O: -1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "已经开始想什么时候可以礼貌地离开",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q39",
    level: 2,
    category: "展示偏好",
    scenarioText: "你们小组完成了一个项目，被要求派代表做总结展示。",
    questionText: "你更希望？",
    primaryTraits: ["X", "C", "E"],
    options: [
      {
        value: "A",
        text: "我来做！喜欢在台前演讲的感觉",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "我负责准备内容/PPT，让别人去讲",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我协助演讲者，做提示或补充",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我尽量不参与展示环节",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q40",
    level: 2,
    category: "关系深度",
    scenarioText: "你加入了一个每周活动的社团，已经三个月。",
    questionText: "现在你对社团里其他成员的了解程度通常是？",
    primaryTraits: ["A", "E", "X"],
    options: [
      {
        value: "A",
        text: "知道很多人的名字、职业和基本背景，有几个聊得来的",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "只和固定的一两个人熟，对其他人只是脸熟",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "几乎和所有人都能聊上几句，知道一些人的趣事",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "专注于活动本身，对人的了解比较表面",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q41",
    level: 2,
    category: "事后讨论",
    scenarioText: "和朋友看完一场电影，走出影院时，",
    questionText: "你一般会？",
    primaryTraits: ["O", "A", "E", "X"],
    options: [
      {
        value: "A",
        text: "立刻开始讨论剧情、演技、镜头，可能产生激烈辩论",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "先问朋友你觉得怎么样？，根据对方的反应再展开",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "简单分享感受，除非朋友想深入聊",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "沉浸在电影情绪里，可能需要点时间消化，不太想说话",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q42",
    level: 2,
    category: "介绍朋友",
    scenarioText: "你介绍两个原本不认识的朋友互相认识，但他们似乎没什么共同话题，对话冷场。",
    questionText: "你会？",
    primaryTraits: ["A", "E", "X"],
    options: [
      {
        value: "A",
        text: "主动提起他们可能都感兴趣的话题，或分享关于双方的趣事",
        traitScores: { A: 3, C: 1, E: -1, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "觉得有点责任，努力找些他们之间的共同话题",
        traitScores: { A: 2, C: 2, E: -1, O: 0, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "顺其自然，如果他们没话聊，也不用强求",
        traitScores: { A: -1, C: 0, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "开个玩笑缓和气氛，或者提议去做点别的事情",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 2, P: 2 }
      }
    ]
  },
  {
    id: "Q43",
    level: 2,
    category: "日程风格",
    scenarioText: "你的周末时间安排，更符合以下哪种模式？",
    questionText: "",
    primaryTraits: ["X", "E", "A", "C"],
    options: [
      {
        value: "A",
        text: "提前几周就有不少社交安排，周末经常有活动",
        traitScores: { A: 1, C: 1, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "有1-2项固定活动，其余时间随性而定",
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "更喜欢留白，最多提前一周安排，需要独处时间",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "会主动策划或答应一些深度、小范围的见面",
        traitScores: { A: 2, C: 1, E: 0, O: 1, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q44",
    level: 2,
    category: "求助方式",
    scenarioText: "你需要找一个朋友帮你一个不大不小的忙。",
    questionText: "你一般会如何开口？",
    primaryTraits: ["A", "C", "X"],
    options: [
      {
        value: "A",
        text: "直接问，并明确表示对方可以拒绝，不会介意",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "先寒暄，然后委婉地提出请求，并强调会回报",
        traitScores: { A: 2, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "纠结很久，确保这个请求不会给对方造成太大负担才说",
        traitScores: { A: 1, C: 0, E: -1, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "会在心里列一个可能愿意帮忙的朋友名单，选择最合适的人",
        traitScores: { A: 1, C: 3, E: 0, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q45",
    level: 2,
    category: "创造力表达",
    scenarioText: "参加一个手工DIY工作坊，老师讲解了基本步骤后让大家自由发挥。",
    questionText: "你会？",
    primaryTraits: ["C", "O", "A"],
    options: [
      {
        value: "A",
        text: "严格遵循老师教的步骤，做出一个标准、完美的作品",
        traitScores: { A: 0, C: 3, E: 1, O: -1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "在基础框架上加入自己的创意和改造",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "和旁边的人交流想法，可能会合作或互相模仿",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "有点迷茫，希望老师能多给一些具体指导",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q46",
    level: 2,
    category: "观点冲突",
    scenarioText: "在讨论中，你提出了一个观点，但被另一个人强烈反对。",
    questionText: "你的第一反应是？",
    primaryTraits: ["X", "E", "O"],
    options: [
      {
        value: "A",
        text: "感到被挑战，更努力地阐述自己的论据",
        traitScores: { A: 0, C: 1, E: -1, O: 1, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "有点紧张或不适，想尽快结束对峙",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -2, P: 0 }
      },
      {
        value: "C",
        text: "好奇对方为什么这么想，试图理解其立场",
        traitScores: { A: 1, C: 1, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "觉得这很正常，讨论本来就有不同声音",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q47",
    level: 2,
    category: "祝贺方式",
    scenarioText: "朋友取得了一个很棒的成就，在朋友圈公布。",
    questionText: "你一般会如何表示祝贺？",
    primaryTraits: ["P", "A", "E", "X"],
    options: [
      {
        value: "A",
        text: "立刻点赞评论，写一段热情洋溢的祝福",
        traitScores: { A: 1, C: -1, E: -1, O: 0, X: 1, P: 3 }
      },
      {
        value: "B",
        text: "私聊ta，表达更个人化的祝贺和关心",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "点个赞，或者简单评论恭喜！",
        traitScores: { A: -1, C: 0, E: 2, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "可能会记在心里，下次见面时再当面祝贺",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q48",
    level: 2,
    category: "知识探索",
    scenarioText: "你对一个历史/科学/文化话题产生了浓厚兴趣。",
    questionText: "你一般会如何满足这份好奇心？",
    primaryTraits: ["O", "C", "A"],
    options: [
      {
        value: "A",
        text: "上网进行碎片化搜索，看很多相关视频和短文",
        traitScores: { A: -1, C: -1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "找一本权威书籍或长篇深度报道系统学习",
        traitScores: { A: -1, C: 2, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "找对这个话题感兴趣的朋友一起讨论研究",
        traitScores: { A: 2, C: 0, E: -1, O: 1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "如果和工作生活无关，可能过一阵兴趣就淡了",
        traitScores: { A: 0, C: 0, E: 2, O: -2, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q49",
    level: 2,
    category: "探索行为",
    scenarioText: "一个大型节日市集，有各种小吃、手作和表演。",
    questionText: "你怎么逛？",
    primaryTraits: ["X", "C", "E", "O"],
    options: [
      {
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
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "人多的地方就不去了，找些人少的角落看看",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q50",
    level: 2,
    category: "秘密处理",
    scenarioText: "你无意中得知了一个关于某位朋友的、并非恶意的秘密。",
    questionText: "你会如何处理这个信息？",
    primaryTraits: ["A", "C", "E"],
    options: [
      {
        value: "A",
        text: "绝对保密，就当不知道",
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "可能会跟一两个最信任的朋友聊聊，但避开当事人",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "如果时机合适，可能会以关心的方式和当事人聊起",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "有点负担，不知道该如何面对这位朋友了",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -1, P: 0 }
      }
    ]
  },

  // ── Pure calibration questions (Q51-Q54) ──────────────────────────
  // Deterministic single-trait items injected after anchors based on
  // cohort detection.  Each option loads on exactly ONE trait at ±2
  // magnitude (gentler than standard ±3 to avoid overpowering adaptive
  // measurements).  Control: config.enableCalibrationQuestions.

  {
    id: "Q51_PureX",
    level: 2,
    category: "纯X矩阵",
    scenarioText: "周末你没有任何计划，朋友临时约你参加一个全是陌生人的聚会。",
    questionText: "你的真实感受是？",
    primaryTraits: ["X"],
    isForcedChoice: true,
    cohortTag: "social_catalyst",
    options: [
      { value: "A", text: "太好了，认识新朋友是最开心的事！", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 0 } },
      { value: "B", text: "有点兴趣，正好周末没事可以去看看", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 1, P: 0 } },
      { value: "C", text: "犹豫，不太确定能不能融入全是陌生人的场合", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 } },
      { value: "D", text: "完全不想去，和一群陌生人社交很消耗能量", traitScores: { A: 0, C: 0, E: 0, O: 0, X: -2, P: 0 } }
    ]
  },
  {
    id: "Q52_PureO",
    level: 2,
    category: "纯O矩阵",
    scenarioText: "朋友推荐了一本关于冷门历史事件的非虚构书籍。",
    questionText: "你会？",
    primaryTraits: ["O"],
    isForcedChoice: true,
    cohortTag: "creative_explorer",
    options: [
      { value: "A", text: "立刻下单，这种冷门知识最吸引我了", traitScores: { A: 0, C: 0, E: 0, O: 2, X: 0, P: 0 } },
      { value: "B", text: "加入书单，等有空的时候翻翻看", traitScores: { A: 0, C: 0, E: 0, O: 1, X: 0, P: 0 } },
      { value: "C", text: "除非是特别相关的领域，否则不太想花时间", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 } },
      { value: "D", text: "对冷门历史完全没兴趣，还不如看部热门电影", traitScores: { A: 0, C: 0, E: 0, O: -2, X: 0, P: 0 } }
    ]
  },
  {
    id: "Q53_PureC",
    level: 2,
    category: "纯C矩阵",
    scenarioText: "你答应帮朋友策划一个活动，离截止日期还有两周。",
    questionText: "你一般会？",
    primaryTraits: ["C"],
    isForcedChoice: true,
    cohortTag: "quiet_anchor",
    options: [
      { value: "A", text: "立刻列清单，把任务分解成每日计划并严格执行", traitScores: { A: 0, C: 2, E: 0, O: 0, X: 0, P: 0 } },
      { value: "B", text: "提前一周左右开始准备，按部就班完成", traitScores: { A: 0, C: 1, E: 0, O: 0, X: 0, P: 0 } },
      { value: "C", text: "拖延到最后一两天集中突击，每次都是这样", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 } },
      { value: "D", text: "经常忘记 deadline，需要别人提醒才能交", traitScores: { A: 0, C: -2, E: 0, O: 0, X: 0, P: 0 } }
    ]
  },
  {
    id: "Q54_PureP",
    level: 2,
    category: "纯P矩阵",
    scenarioText: "你特别期待的一场户外活动因为天气原因临时取消了。",
    questionText: "你内心的第一反应更接近？",
    primaryTraits: ["P"],
    isForcedChoice: true,
    cohortTag: "social_catalyst",
    options: [
      { value: "A", text: "没关系，好事多磨，改天去说不定更好玩", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 2 } },
      { value: "B", text: "有点失望但很快就能接受，换个室内计划也行", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 } },
      { value: "C", text: "挺郁闷的，半天都提不起精神做别的事", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 } },
      { value: "D", text: "非常烦躁，整个周末的心情都被毁了", traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -2 } }
    ]
  },
];
