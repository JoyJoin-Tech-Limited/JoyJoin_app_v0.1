/**
 * V4 Adaptive Assessment - L1 Foundation Questions (Q1-Q15)
 */

import { AdaptiveQuestion } from './types';

export const questionsV4L1: AdaptiveQuestion[] = [
  {
    id: "Q1",
    level: 1,
    category: "社交启动",
    scenarioText: "工作日傍晚，同事群里突然有人发起：今晚有人想一起去新开的居酒屋吗？",
    questionText: "你的第一反应和接下来的行动会是？",
    primaryTraits: ["X", "C", "E"],
    isAnchor: true,
    discriminationIndex: 0.42,
    options: [
      {
        value: "A",
        text: "好呀！正好想去看看！",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "今晚吗？我看看安排...",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "谢谢！我约了朋友，下次叫我～",
        traitScores: { A: 2, C: 1, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "今天有点累...你们玩得开心！",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q2",
    level: 1,
    category: "决策参与",
    scenarioText: "大家讨论周末活动：剧本杀、Livehouse、清吧聊天、密室逃脱...",
    questionText: "你更倾向扮演什么角色？",
    primaryTraits: ["O", "C", "X"],
    isAnchor: true,
    discriminationIndex: 0.45,
    options: [
      {
        value: "A",
        text: "我都可以！哪个都好玩！",
        traitScores: { A: 1, C: -1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "我查下距离和评分，做比较表？",
        traitScores: { A: 0, C: 3, E: 0, O: -1, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "要不试试最特别的那个？",
        traitScores: { A: -1, C: -1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "我想去能安静聊天的地方。",
        traitScores: { A: 0, C: 1, E: 2, O: -1, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q3",
    level: 1,
    category: "能量优先级",
    scenarioText: "一个你期待已久的周末个人计划，突然被朋友的热闹聚会邀请打断。",
    questionText: "你内心更强烈的倾向是？",
    primaryTraits: ["X", "C", "E"],
    isAnchor: true,
    discriminationIndex: 0.48,
    options: [
      {
        value: "A",
        text: "太好了！立刻调整计划加入，越多人越开心",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 4, P: 2 }
      },
      {
        value: "B",
        text: "明确拒绝聚会，坚守自己的计划",
        traitScores: { A: 0, C: 2, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "尝试把朋友拉入你的计划，或另约时间",
        traitScores: { A: 2, C: 1, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "感到烦躁和纠结，需要时间消化这个冲突。",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: 0, P: -1 }
      }
    ]
  },
  {
    id: "Q4",
    level: 1,
    category: "学习偏好",
    scenarioText: "朋友教你玩一个规则复杂的新桌游，大家都在等。",
    questionText: "你希望的教学节奏是？",
    primaryTraits: ["O", "C", "X"],
    isAnchor: true,
    discriminationIndex: 0.44,
    options: [
      {
        value: "A",
        text: "快讲完规则我们直接开一局试试！",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "一步一步来，有不清楚的我想随时问。",
        traitScores: { A: 0, C: 2, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我可以先看你们玩一局。",
        traitScores: { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "别让我第一个玩，我看懂后加入。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q5",
    level: 1,
    category: "团体形象",
    scenarioText: "朋友聚餐后要拍合影发朋友圈。",
    questionText: "你会？",
    primaryTraits: ["X", "A", "E"],
    isAnchor: true,
    discriminationIndex: 0.52,
    options: [
      {
        value: "A",
        text: "主动当摄影师，指挥大家站位",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "把站边缘的人拉进来，照顾每个人",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "找个位置站好，配合大家",
        traitScores: { A: 0, C: 1, E: 2, O: -1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "站最边上，尽量不抢镜",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q6",
    level: 1,
    category: "优化倾向",
    scenarioText: "参加活动，发现组织者指的路线上有个明显更优的选择。",
    questionText: "你会怎么做？",
    primaryTraits: ["O", "A", "C"],
    isAnchor: true,
    discriminationIndex: 0.46,
    options: [
      {
        value: "A",
        text: "立刻在群里@组织者，提出优化建议",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "私聊组织者，委婉地提供信息",
        traitScores: { A: 2, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "算了，按大家的来",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "只告诉身边一两个人这个发现",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q9",
    level: 2,
    category: "观点表达",
    scenarioText: "群里话题聊得正热，你有个截然不同但有趣的角度。",
    questionText: "你会？",
    cohortTag: 'creative_explorer',
    primaryTraits: ["X", "O", "E"],
    options: [
      {
        value: "A",
        text: "直接抛出，引发新讨论",
        traitScores: { A: -1, C: -1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "先观察大家反应，时机合适再提",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: -1, P: -1 }
      },
      {
        value: "C",
        text: "私下跟聊得最嗨的人分享",
        traitScores: { A: 2, C: 0, E: 0, O: -1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "想想算了",
        traitScores: { A: 0, C: 0, E: 1, O: -1, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q10",
    level: 2,
    category: "延迟反应",
    scenarioText: "活动比预定时间晚了半小时才开始，大家都在等待。",
    questionText: "你逐渐感到？",
    cohortTag: 'quiet_anchor',
    primaryTraits: ["E", "A", "C"],
    options: [
      {
        value: "A",
        text: "有点焦躁，希望有人出来推动一下",
        traitScores: { A: 0, C: 1, E: -2, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "没关系，正好多认识下旁边的人",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "开始观察组织疏漏在哪里，默默总结",
        traitScores: { A: 0, C: 2, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "完全放空，刷手机，等通知",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q11",
    level: 2,
    category: "自我展示",
    scenarioText: "活动有个需要才艺展示的环节，自愿参与。",
    questionText: "你会？",
    primaryTraits: ["X", "E", "P"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.48,
    options: [
      {
        value: "A",
        text: "第一个举手",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "等别人先上，有人陪就上",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "除非被点名，否则坚决不上",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "帮忙起哄让别人上，自己负责鼓掌",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 2 }
      }
    ]
  },
  {
    id: "Q12",
    level: 2,
    category: "应变态度",
    scenarioText: "户外活动当天早晨，发现天气可能变坏。",
    questionText: "你的第一念头是？",
    cohortTag: 'creative_explorer',
    primaryTraits: ["O", "C", "E", "P"],
    options: [
      {
        value: "A",
        text: "刺激！雨中玩耍别有风味。",
        traitScores: { A: 0, C: 0, E: 1, O: 3, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "赶紧查备用室内方案，通知大家。",
        traitScores: { A: 1, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "组织者会处理吧，我等通知。",
        traitScores: { A: 0, C: -1, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "正好，可以名正言顺取消了。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q13",
    level: 2,
    category: "入群行为",
    scenarioText: "你被拉进一个全是陌生人的活动预备群。",
    questionText: "入群后，你通常会？",
    cohortTag: 'quiet_anchor',
    primaryTraits: ["X", "C", "E"],
    options: [
      {
        value: "A",
        text: "修改群昵称，发个自我介绍或表情包",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "默默围观，看大家聊天熟悉信息",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "点开几个活跃的人头像，看看资料",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "设置免打扰，等活动当天再看",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q14",
    level: 2,
    category: "决策风格",
    scenarioText: "朋友群里讨论周五去哪吃饭，推荐了好几家。",
    questionText: "你的反应是？",
    cohortTag: 'steady_harmonizer',
    primaryTraits: ["O", "C", "X"],
    discriminationIndex: 0.38,
    options: [
      {
        value: "A",
        text: "随便都行，你们定！",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "查大众点评对比评分再决定",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "推荐一家新开的店，尝尝鲜",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "问最懂吃的朋友，跟着ta选",
        traitScores: { A: 1, C: 1, E: 0, O: 1, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q7",
    level: 1,
    category: "赠礼思维",
    scenarioText: "新朋友下周生日，你想送个小礼物。",
    questionText: "你会选？",
    primaryTraits: ["A", "O", "C"],
    isAnchor: true,
    discriminationIndex: 0.41,
    options: [
      {
        value: "A",
        text: "找ta提过喜欢的东西，投其所好",
        traitScores: { A: 3, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "送我喜欢的小众好物，分享品味",
        traitScores: { A: -1, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "买个实用好物，不踩雷有品质",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "发个红包，省事又不出错",
        traitScores: { A: -1, C: 0, E: 1, O: -2, X: 0, P: 0 }
      },
      {
        value: "E",
        text: "手写卡片或做手工，用心最重要",
        traitScores: { A: 2, C: 1, E: 0, O: 3, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q15",
    level: 2,
    category: "关系推进",
    scenarioText: "通过活动认识的新朋友，第二天在微信上找你闲聊。",
    questionText: "你的感受和回应倾向是？",
    cohortTag: 'social_catalyst',
    primaryTraits: ["A", "E", "X"],
    options: [
      {
        value: "A",
        text: "开心，能这么快延续联系真好",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "平常心，就跟其他朋友一样聊",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "有点意外，会斟酌下回复内容",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "轻微压力，希望聊天有明确目的",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q8",
    level: 1,
    category: "胜负反应",
    scenarioText: "团队游戏你们这组赢了，对方组有些失落。",
    questionText: "你更可能？",
    primaryTraits: ["P", "A", "E", "X"],
    isAnchor: true,
    discriminationIndex: 0.45,
    options: [
      {
        value: "A",
        text: "欢呼庆祝，享受胜利喜悦",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "B",
        text: "主动去和对方组击掌，说打得不错",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "分析我们赢在哪，对方输在哪",
        traitScores: { A: -1, C: 2, E: 1, O: 1, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "低调，避免过度刺激对方",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  }

];
