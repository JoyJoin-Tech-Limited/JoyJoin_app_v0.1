/**
 * V4 Adaptive Assessment - 60-Question Bank (Optimized)
 * 自适应性格测评 V4 - 优化后的60题题库
 */

import { AdaptiveQuestion } from './types';

export const questionsV4: AdaptiveQuestion[] = [
  // ==================== L1 基础枢纽题 (Q1-Q15) ====================
  {
    id: "Q1",
    level: 1,
    category: "社交启动",
    scenarioText: "🎉 工作日傍晚，同事群里突然有人发起：今晚有人想一起去新开的居酒屋吗？",
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
    scenarioText: "🤔 大家讨论周末活动：剧本杀、Livehouse、清吧聊天、密室逃脱...",
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
    scenarioText: "😌 一个你期待已久的周末个人计划，突然被朋友的热闹聚会邀请打断。",
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
    scenarioText: "🎮 朋友教你玩一个规则复杂的新桌游，大家都在等。",
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
    scenarioText: "📸 朋友聚餐后要拍合影发朋友圈。",
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
    scenarioText: "🚗 参加活动，发现组织者指的路线上有个明显更优的选择。",
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
    scenarioText: "💬 群里话题聊得正热，你有个截然不同但有趣的角度。",
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
    scenarioText: "🕙 活动比预定时间晚了半小时才开始，大家都在等待。",
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
    scenarioText: "🎭 活动有个需要才艺展示的环节，自愿参与。",
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
    scenarioText: "🌧️ 户外活动当天早晨，发现天气可能变坏。",
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
    scenarioText: "👥 你被拉进一个全是陌生人的活动预备群。",
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
    scenarioText: "🍽️ 朋友群里讨论周五去哪吃饭，推荐了好几家。",
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
    scenarioText: "🎁 新朋友下周生日，你想送个小礼物。",
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
    scenarioText: "🤝 通过活动认识的新朋友，第二天在微信上找你闲聊。",
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
    scenarioText: "🏆 团队游戏你们这组赢了，对方组有些失落。",
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
  },

  // ==================== L2 核心探索题 (Q16-Q50) ====================
  {
    id: "Q16",
    level: 2,
    category: "情感回应",
    scenarioText: "😔 一个朋友在聚会上显得情绪低落，向你倾诉最近的烦恼。",
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
    scenarioText: "🗺️ 你在城市某个角落偶然发现一家隐藏在小巷里、风格极其独特的咖啡店。",
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
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q18",
    level: 2,
    category: "能量恢复",
    scenarioText: "🔋 参加了一场持续4小时、需要高度社交投入的活动后，你感觉电量耗尽。",
    questionText: "结束后，你通常最需要什么样的恢复方式？",
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
    scenarioText: "❓ 活动群里，有人问一个你恰好知道答案的问题。",
    questionText: "你通常会？",
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
    scenarioText: "💬 大家在热烈讨论一部电影，但其中一个人反复提到一个明显的事实错误。",
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
    scenarioText: "🎲 玩桌游时，你发现有一条未被充分利用但完全合理的规则，可以让你的局面逆转。",
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
    scenarioText: "📱 抢群红包或积分活动时，你发现了一个提高成功率的合法小技巧。",
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
    scenarioText: "🗣️ 朋友推荐了一部ta极度喜爱的电影/音乐，但你看完后完全无感。",
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
    scenarioText: "🍽️ 朋友带你去吃ta心目中全市最好吃的餐厅，但你觉得口味很平庸。",
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
    scenarioText: "💰 AA结账时，发现金额有些零头，不太好平分。",
    questionText: "你通常的处理方式是？",
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
    scenarioText: "🧺 几个朋友一起租车出游，加油费产生了一些零头 and 尾数。",
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
    scenarioText: "📱 组织聚会前，你需要确定一家餐厅。",
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
    scenarioText: "🎓 别人请你教一个你擅长的技能。",
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
    scenarioText: "👥 如果把你放在一个10人的社交圈子里，",
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
    scenarioText: "💡 团队 brainstorming 时，领导说任何天马行空的想法都可以。",
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
    scenarioText: "📱 在一个热闹的微信群中，你发了一条消息，但一段时间内无人回应。",
    questionText: "你内心更可能？",
    primaryTraits: ["E", "X"],
    options: [
      {
        value: "A",
        text: "有点尴尬，怀疑自己是不是说错了什么或不合时宜",
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
        text: "反思消息的内容 and 形式，看是否可以提高表达清晰度",
        traitScores: { A: 0, C: 2, E: 0, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q29",
    level: 2,
    category: "惊喜反应",
    scenarioText: "🎉 朋友为你准备了一个惊喜生日派对。当你推开门，所有人齐声欢呼时，",
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
    scenarioText: "📝 活动结束后，组织者在群里发起匿名反馈问卷。",
    questionText: "你通常会？",
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
    scenarioText: "👥 你和一群朋友计划一次旅行，有几种不同的风格选择。",
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
    scenarioText: "🎭 聚会上，大家玩真心话大冒险。轮到你选择时，",
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
        text: "根据在场的人的熟悉程度 and 气氛来决定",
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
    scenarioText: "🚶 在狭窄的过道，你不小心和迎面走来的人撞了一下，对方看起来心情不好并咕哝了一句不客气的话。",
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
    scenarioText: "📰 看到一条关于你某个朋友感兴趣领域的深度干货，但内容很长且有一定的门槛。",
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
    scenarioText: "📅 期待已久的周末出游计划因为天气原因临时取消，改为室内聚会。",
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
    scenarioText: "🔄 朋友向你推荐一个TA非常喜欢、但你之前从未接触过的活动。",
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
        text: "不太感兴趣，我更倾向于待在自己的舒适区",
        traitScores: { A: 0, C: 1, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q37",
    level: 2,
    category: "重大建议",
    scenarioText: "🤔 当朋友问你我该不该换工作/结束一段关系？这类重大人生抉择时，",
    questionText: "你通常如何回应？",
    primaryTraits: ["C", "A", "P"],
    options: [
      {
        value: "A",
        text: "帮TA列出所有利弊，分析每种选择的可能结果",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "先共情，问TA的感受和真实需求，而不是急于给建议",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分享自己或他人的类似经历和结果",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "直接给出我的建议，不绕弯子，就算TA可能不爱听",
        traitScores: { A: -2, C: 1, E: 0, O: 0, X: 1, P: -1 }
      },
      {
        value: "E",
        text: "鼓励TA跟随内心的直觉，你会支持TA的任何决定",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 3 }
      }
    ]
  },
  {
    id: "Q38",
    level: 2,
    category: "高强度社交",
    scenarioText: "🎉 在一个大型庆祝派对上，音乐很响，人非常多。",
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
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 0 }
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
    scenarioText: "📊 你们小组完成了一个项目，被要求派代表做总结展示。",
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
    scenarioText: "🌱 你加入了一个每周活动的社团，已经三个月。",
    questionText: "现在你对社团里其他成员的了解程度通常是？",
    primaryTraits: ["A", "E", "X"],
    options: [
      {
        value: "A",
        text: "知道很多人的名字、职业 and 基本背景，有几个聊得来的",
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
    scenarioText: "🎬 和朋友看完一场电影，走出影院时，",
    questionText: "你通常会？",
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
    scenarioText: "🔄 你介绍两个原本不认识的朋友互相认识，但他们似乎没什么共同话题，对话冷场。",
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
        text: "感到有点责任，努力寻找他们之间的连接点",
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
    scenarioText: "📅 你的周末时间安排，更符合以下哪种模式？",
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
        text: "更喜欢留白，最多提前一周安排， and 需要独处时间",
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
    scenarioText: "🤝 你需要找一个朋友帮你一个不大不小的忙。",
    questionText: "你通常会如何开口？",
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
    scenarioText: "🎨 参加一个手工DIY工作坊，老师讲解了基本步骤后让大家自由发挥。",
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
        text: "在基础框架上加入自己的创意 and 改造",
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
    scenarioText: "🗣️ 在讨论中，你提出了一个观点，但被另一个人强烈反对。",
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
    scenarioText: "🌟 朋友取得了一个很棒的成就，在朋友圈公布。",
    questionText: "你通常会如何表示祝贺？",
    primaryTraits: ["P", "A", "E", "X"],
    options: [
      {
        value: "A",
        text: "立刻点赞评论，写一段热情洋溢的祝福",
        traitScores: { A: 1, C: -1, E: -1, O: 0, X: 1, P: 3 }
      },
      {
        value: "B",
        text: "私聊TA，表达更个人化的祝贺和关心",
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
    scenarioText: "🕵️ 你对一个历史/科学/文化话题产生了浓厚兴趣。",
    questionText: "你通常会如何满足这份好奇心？",
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
    scenarioText: "🎪 一个大型节日市集，有各种小吃、手作和表演。",
    questionText: "你怎么逛？",
    primaryTraits: ["X", "C", "E", "O"],
    options: [
      {
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
      }
    ]
  },
  {
    id: "Q50",
    level: 2,
    category: "秘密处理",
    scenarioText: "🤫 你无意中得知了一个关于某位朋友的、并非恶意的秘密。",
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
        text: "可能会告诉一两个最信任且与当事人无关的朋友",
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
  // ==================== L2 补充题 - 减少社会期望偏差 ====================
  {
    id: "Q78",
    level: 2,
    category: "独处偏好",
    scenarioText: "🎧 周五晚上，你独自一人待在家，突然收到多个朋友的邀约。",
    questionText: "你的真实想法是？",
    primaryTraits: ["X", "A", "P"],
    discriminationIndex: 0.55,
    options: [
      {
        value: "A",
        text: "终于有人约了！一个人待着太无聊，立刻出门",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: 2 }
      },
      {
        value: "B",
        text: "看看是谁约、去干嘛，合适就去",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "其实挺享受一个人的时间，但不好意思拒绝",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "今晚就想一个人，直接说有事不去",
        traitScores: { A: -1, C: 1, E: 2, O: 0, X: -3, P: 0 }
      }
    ]
  },
  {
    id: "Q79",
    level: 2,
    category: "创意类型",
    scenarioText: "💡 头脑风暴环节，大家在想活动创意。",
    questionText: "你更擅长贡献什么类型的想法？",
    primaryTraits: ["O", "C", "X"],
    discriminationIndex: 0.52,
    options: [
      {
        value: "A",
        text: "天马行空的脑洞，可能不太现实但很有趣",
        traitScores: { A: -1, C: -2, E: 0, O: 4, X: -1, P: 0 }
      },
      {
        value: "B",
        text: "结合现实条件的创意，可行性高",
        traitScores: { A: 0, C: 2, E: 1, O: 1, X: 0, P: -1 }
      },
      {
        value: "C",
        text: "倾向于改良别人的想法，让它更完善",
        traitScores: { A: 1, C: 2, E: 0, O: -1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "不太主动提想法，但会认真评估每个方案",
        traitScores: { A: 0, C: 2, E: 1, O: -1, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q80",
    level: 2,
    category: "社交动机",
    scenarioText: "🤝 你在聚会上主动和新认识的人交流。",
    questionText: "你这样做的主要原因是？",
    primaryTraits: ["A", "X", "C"],
    discriminationIndex: 0.58,
    options: [
      {
        value: "A",
        text: "单纯觉得有意思，想认识更多人",
        traitScores: { A: -1, C: 0, E: 0, O: 1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "ta看起来有点落单，想让ta感觉被欢迎",
        traitScores: { A: 4, C: 0, E: 1, O: 0, X: -1, P: 1 }
      },
      {
        value: "C",
        text: "觉得ta可能和我某个朋友合得来，想当个桥梁",
        traitScores: { A: 2, C: 2, E: 0, O: -1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "说实话我一般不会主动找新认识的人聊",
        traitScores: { A: -1, C: 0, E: 1, O: 0, X: -3, P: -1 }
      }
    ]
  },
  {
    id: "Q81",
    level: 2,
    category: "帮助边界",
    scenarioText: "🆘 朋友半夜发消息说心情不好想聊聊。",
    questionText: "你会怎么做？",
    primaryTraits: ["A", "E", "P"],
    discriminationIndex: 0.55,
    options: [
      {
        value: "A",
        text: "立刻回复，陪ta聊到凌晨也没问题",
        traitScores: { A: 4, C: 0, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "简单安慰几句，约明天再细聊",
        traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "已经睡了不一定能看到，明天再说吧",
        traitScores: { A: -1, C: 1, E: 2, O: 0, X: -1, P: -1 }
      },
      {
        value: "D",
        text: "看到了但不太想回，假装没看见",
        traitScores: { A: -3, C: 0, E: 1, O: 0, X: -2, P: -2 }
      }
    ]
  },
  {
    id: "Q82",
    level: 2,
    category: "活力状态",
    scenarioText: "☀️ 周末早上醒来，天气很好。",
    questionText: "你的第一反应是？",
    primaryTraits: ["X", "P", "O"],
    discriminationIndex: 0.52,
    options: [
      {
        value: "A",
        text: "太棒了！叫上朋友出去玩",
        traitScores: { A: 1, C: 0, E: 0, O: 1, X: 4, P: 3 }
      },
      {
        value: "B",
        text: "自己出门走走，享受阳光",
        traitScores: { A: 0, C: 0, E: 1, O: 1, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "在家里待着，开窗晒晒太阳就好",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "继续睡觉，天气好不好跟我没关系",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: -3, P: -2 }
      }
    ]
  },
  {
    id: "Q83",
    level: 2,
    category: "观点态度",
    scenarioText: "💬 朋友分享了一个你觉得有问题的观点。",
    questionText: "你通常会怎么反应？",
    primaryTraits: ["A", "O", "E"],
    discriminationIndex: 0.54,
    options: [
      {
        value: "A",
        text: "直接指出问题，不怕讨论冲突",
        traitScores: { A: -2, C: 0, E: 2, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "委婉提出不同看法，注意措辞",
        traitScores: { A: 2, C: 1, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "想说但又懒得解释，算了不说了",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: -1, P: -1 }
      },
      {
        value: "D",
        text: "表面附和，心里不认同",
        traitScores: { A: 0, C: -1, E: -1, O: -1, X: 0, P: 0 }
      }
    ]
  },

  // ==================== L3 精准决胜题 (Q51-Q60) ====================
  {
    id: "Q51",
    level: 3,
    category: "自我价值认知",
    scenarioText: "🎯 在社交中，你认为自己最大的价值是？",
    questionText: "",
    primaryTraits: ["P", "A", "O", "C"],
    options: [
      {
        value: "A",
        text: "我能让气氛变得轻松愉快，带来欢笑",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "B",
        text: "我能提供情感支持和深度理解，让人感到被接纳",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我能提供独特的视角、知识或创意灵感",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "我不太确定...我更多是享受参与，而非扮演特定角色",
        traitScores: { A: -1, C: 0, E: 2, O: -1, X: -1, P: -1 }
      },
      {
        value: "E",
        text: "我能确保事情顺利运行，考虑周全",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q52",
    level: 3,
    category: "负向恐惧",
    scenarioText: "😅 社交场合中，你最担心发生哪种情况？",
    questionText: "",
    primaryTraits: ["P", "X", "E", "A"],
    options: [
      {
        value: "A",
        text: "冷场，或者气氛尴尬",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "说错话或做错事，让他人对我有负面看法",
        traitScores: { A: 1, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "被迫成为焦点，或者需要即兴表演/发言",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "卷入人际冲突或复杂的感情纠葛中",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q53",
    level: 3,
    category: "隐喻认知",
    scenarioText: "🧩 如果用一个比喻来形容你在社交网络中的角色，你觉得最接近？",
    questionText: "",
    primaryTraits: ["X", "A", "C", "O"],
    options: [
      {
        value: "A",
        text: "火花塞",
        traitScores: { A: -1, C: -1, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "粘合剂",
        traitScores: { A: 3, C: 1, E: 0, O: -1, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "指南针",
        traitScores: { A: -1, C: 3, E: 1, O: 1, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "观察者",
        traitScores: { A: -1, C: 1, E: 2, O: 2, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q54",
    level: 3,
    category: "价值观权衡",
    scenarioText: "⚖️ 对你而言，在社交中，做真实的自己和让周围的人感到舒服",
    questionText: "哪个更重要？",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
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
      }
    ]
  },
  {
    id: "Q55",
    level: 3,
    category: "历史模式",
    scenarioText: "🔄 回顾你过往的社交经历，哪种模式更常发生？",
    questionText: "",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
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
      }
    ]
  },
  {
    id: "Q56",
    level: 2,
    category: "助人天赋",
    scenarioText: "👂 当朋友遇到困扰向你倾诉时，你觉得自己更擅长？",
    questionText: "",
    primaryTraits: ["A", "C", "P"],
    options: [
      {
        value: "A",
        text: "耐心倾听，让ta感到被完全理解和接纳",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "帮ta理清思路，分析问题，找到可行的解决方案",
        traitScores: { A: 0, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "用我的乐观和幽默感染ta，让ta暂时忘掉烦恼",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "D",
        text: "老实说，我不太擅长处理别人的情绪问题",
        traitScores: { A: -2, C: 0, E: 1, O: 0, X: -1, P: -2 }
      },
      {
        value: "E",
        text: "分享我相关的经历和感受，让ta知道并不孤单",
        traitScores: { A: 1, C: 0, E: 0, O: 1, X: 1, P: 1 }
      }
    ]
  },
  {
    id: "Q57",
    level: 3,
    category: "高精度区分",
    scenarioText: "😂 聚会中，一个朋友因为手滑，把饮料洒在了自己身上，大家先是一愣，随即笑作一团。",
    questionText: "你更可能？",
    primaryTraits: ["X", "A", "P", "E"],
    options: [
      {
        value: "A",
        text: "放大这个笑点，开玩笑说这是今晚的高光时刻，让它成为经典梗",
        traitScores: { A: -1, C: 0, E: 0, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "一边笑一边赶紧递纸巾，并安慰朋友没事没事，常有的事",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "C",
        text: "看看朋友是否真的尴尬，如果是，就帮忙解围转移话题",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "觉得无聊，玩手机等这波热闹过去",
        traitScores: { A: -2, C: 0, E: 1, O: 0, X: -2, P: -1 }
      },
      {
        value: "E",
        text: "跟着大家笑，但不会特别突出，等自然进入下一个话题",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q58",
    level: 2,
    category: "助人消耗",
    scenarioText: "💆 同样是在帮助遇到困扰的朋友时，你认为哪件事更消耗你的心力？",
    questionText: "",
    primaryTraits: ["A", "C", "P"],
    options: [
      {
        value: "A",
        text: "长时间地提供情绪接纳和陪伴，吸收对方的负面情绪",
        traitScores: { A: -2, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "反复思考和分析，试图为对方找到一个完美的解决方案",
        traitScores: { A: 1, C: -2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "两者都不太消耗，我很乐意帮助朋友",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "当我的帮助似乎没有效果时，感到无力",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: -1 }
      }
    ]
  },
  {
    id: "Q59",
    level: 3,
    category: "情绪敏感度",
    scenarioText: "📊 请评估以下陈述与你的符合程度：我通常能敏锐地察觉到社交场合中微妙的氛围变化和他人未说出口的情绪。",
    questionText: "",
    primaryTraits: ["A", "E", "O"],
    options: [
      {
        value: "A",
        text: "非常符合，我经常是第一个感觉到的人",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "比较符合，但有时我会过于专注自己的事情而忽略",
        traitScores: { A: 1, C: 0, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "不太符合，我通常更关注大家明确表达的内容和活动本身",
        traitScores: { A: -1, C: 1, E: 1, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "完全不符合，我很少注意这些",
        traitScores: { A: -2, C: 0, E: 2, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q60",
    level: 3,
    category: "终极价值观",
    scenarioText: "🎯 最后，请想象你理想中的一次完美社交活动。它最吸引你的核心是什么？",
    questionText: "",
    primaryTraits: ["A", "O", "P", "C", "E"],
    options: [
      {
        value: "A",
        text: "人与人之间产生了真诚、深刻的连接和理解",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "充满了新鲜感、创意和意想不到的惊喜",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "大家玩得非常尽兴、开心，笑声不断",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "D",
        text: "一切安排得当，流程顺畅，每个人都很舒适",
        traitScores: { A: 1, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "E",
        text: "活动快点结束，我能回家充电",
        traitScores: { A: -1, C: 0, E: 2, O: -1, X: -2, P: -1 }
      },
      {
        value: "F",
        text: "我可以放松地做自己，没有压力和负担",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // ==================== 新增题目：反向计分题、E维度题、工作场景题、注意力检查题 ====================
  
  // 反向计分题1 - 用于检测作答一致性
  {
    id: "Q61",
    level: 2,
    category: "社交回避",
    scenarioText: "🏠 周五晚上，你正准备享受一个人的放松时光，这时收到朋友的临时聚会邀请。",
    questionText: "你内心最真实的感受是？",
    primaryTraits: ["X", "E"],
    isReversed: true,
    options: [
      {
        value: "A",
        text: "有点烦躁，为什么总是临时打扰我的计划",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: -1 }
      },
      {
        value: "B",
        text: "犹豫一下，但还是会去",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "开心！正好想出去，独处可以改天",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 3, P: 2 }
      },
      {
        value: "D",
        text: "看情况，取决于是什么样的聚会和谁参加",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // 反向计分题2 - 与Q5团体形象形成对照
  {
    id: "Q62",
    level: 2,
    category: "注意力分配",
    scenarioText: "📱 聚会上大家都在自拍、发动态，气氛热闹。",
    questionText: "你更可能在做什么？",
    primaryTraits: ["X", "E", "A"],
    isReversed: true,
    options: [
      {
        value: "A",
        text: "专注和身边的人聊天，手机放一边",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "帮大家拍照、修图，但自己不太上镜",
        traitScores: { A: 3, C: 1, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "积极参与合影和互动，顺便也发几条动态",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 2 }
      },
      {
        value: "D",
        text: "找个安静角落休息一会儿",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: -2, P: -1 }
      }
    ]
  },

  // E维度直接测量题1 - 情绪稳定性
  {
    id: "Q63",
    level: 2,
    category: "情绪调节",
    scenarioText: "😤 活动中有人无意中说了一句让你不太舒服的话。",
    questionText: "你通常需要多久才能释怀？",
    primaryTraits: ["E", "A", "P"],
    options: [
      {
        value: "A",
        text: "几秒钟就过去了，不会放在心上",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "当时会有点介意，但活动结束前就忘了",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "可能会影响接下来一段时间的心情",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "会反复想这件事，甚至回家后还在琢磨",
        traitScores: { A: 0, C: 1, E: -2, O: 1, X: -1, P: -1 }
      }
    ]
  },

  // E维度直接测量题2 - 压力应对
  {
    id: "Q64",
    level: 2,
    category: "压力应对",
    scenarioText: "⏰ 活动当天出现了意外状况，需要临时调整计划。",
    questionText: "你的典型反应是？",
    primaryTraits: ["E", "C", "P"],
    options: [
      {
        value: "A",
        text: "保持冷静，迅速想办法应对",
        traitScores: { A: 0, C: 2, E: 3, O: 0, X: 0, P: 1 }
      },
      {
        value: "B",
        text: "虽然有点紧张，但还是能正常处理",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会感到焦虑，需要一点时间来调整情绪",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "觉得很烦躁，这种意外让我很不舒服",
        traitScores: { A: 0, C: 0, E: -2, O: -1, X: 0, P: -1 }
      }
    ]
  },

  // E维度直接测量题3 - 情绪恢复
  {
    id: "Q65",
    level: 2,
    category: "情绪恢复",
    scenarioText: "💔 一次期待已久的活动因故取消了。",
    questionText: "你的情绪恢复速度通常是？",
    primaryTraits: ["E", "P", "O"],
    options: [
      {
        value: "A",
        text: "很快就能调整过来，开始想其他替代方案",
        traitScores: { A: 0, C: 1, E: 3, O: 1, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "会失落一会儿，但不会影响其他安排",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "需要找人倾诉或做点别的事情来转移注意力",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "整天心情都会受影响，很难振作起来",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: -1, P: -1 }
      }
    ]
  },

  // 工作场景题1
  {
    id: "Q66",
    level: 2,
    category: "工作协作",
    scenarioText: "💼 工作中需要和一个不太熟悉的同事合作完成一个项目。",
    questionText: "你更倾向于什么样的协作方式？",
    primaryTraits: ["A", "C", "X"],
    options: [
      {
        value: "A",
        text: "先花时间了解对方的工作风格和偏好",
        traitScores: { A: 3, C: 0, E: -1, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "直接讨论分工，各自负责各自的部分",
        traitScores: { A: -1, C: 2, E: 1, O: -1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "边做边磨合，遇到问题再沟通",
        traitScores: { A: 1, C: -1, E: 1, O: 2, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "希望有明确的流程和规则，减少不确定性",
        traitScores: { A: -1, C: 3, E: 1, O: -1, X: -1, P: 0 }
      }
    ]
  },

  // 工作场景题2
  {
    id: "Q67",
    level: 2,
    category: "会议表现",
    scenarioText: "🎤 在一个重要的工作会议上，主持人请大家分享想法。",
    questionText: "你通常的表现是？",
    primaryTraits: ["X", "C", "E"],
    options: [
      {
        value: "A",
        text: "积极发言，分享自己的观点和建议",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "先听别人说什么，找到合适的时机再补充",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "除非被点名，否则倾向于保持沉默",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "会后私下跟相关人员分享想法",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: -1, P: 0 }
      }
    ]
  },

  // 学习场景题
  {
    id: "Q68",
    level: 2,
    category: "学习方式",
    scenarioText: "📚 你需要学习一项全新的技能或知识。",
    questionText: "你更偏好哪种学习方式？",
    primaryTraits: ["O", "C", "X"],
    options: [
      {
        value: "A",
        text: "找几个人一起学，互相讨论和督促",
        traitScores: { A: 2, C: -1, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "自己按照系统的教程一步一步来",
        traitScores: { A: 0, C: 3, E: 1, O: -1, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "边做边学，遇到问题再查资料",
        traitScores: { A: 0, C: -1, E: 0, O: 2, X: 0, P: 2 }
      },
      {
        value: "D",
        text: "先广泛了解不同方法，找到最适合自己的再深入",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: -1, P: 0 }
      }
    ]
  },

  // ==================== 新增P维度题目 (Q70-Q74) ====================
  {
    id: "Q70",
    level: 2,
    category: "冒险尝鲜",
    scenarioText: "🎢 朋友说发现了一个很刺激但略有风险的新活动。",
    questionText: "你的第一反应是？",
    primaryTraits: ["P", "O", "X"],
    discriminationIndex: 0.45,
    options: [
      {
        value: "A",
        text: "走！这种刺激的我最喜欢了！",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 3 }
      },
      {
        value: "B",
        text: "听起来有意思，我先查查安全措施再决定。",
        traitScores: { A: 0, C: 2, E: 1, O: 1, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "你们去吧，我在旁边给你们拍照加油！",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "这种我不太行，有没有其他选择？",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q71",
    level: 2,
    category: "玩乐态度",
    scenarioText: "🎲 周末约了朋友玩桌游，其中有个规则有点复杂的策略游戏。",
    questionText: "你更期待的是？",
    primaryTraits: ["P", "C", "X"],
    discriminationIndex: 0.42,
    options: [
      {
        value: "A",
        text: "认真研究策略，争取赢得比赛",
        traitScores: { A: -1, C: 3, E: 0, O: 0, X: 1, P: -1 }
      },
      {
        value: "B",
        text: "边玩边搞笑，制造欢乐氛围",
        traitScores: { A: 1, C: -1, E: -1, O: 0, X: 2, P: 3 }
      },
      {
        value: "C",
        text: "观察每个人的玩法风格，很有趣",
        traitScores: { A: 2, C: 0, E: 1, O: 1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "希望规则简单点，复杂的有点累",
        traitScores: { A: 0, C: -1, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q72",
    level: 2,
    category: "即兴能力",
    scenarioText: "🎤 聚会上有人提议玩即兴表演游戏，随机抽题目现场表演。",
    questionText: "你会？",
    primaryTraits: ["P", "X", "E"],
    discriminationIndex: 0.48,
    options: [
      {
        value: "A",
        text: "第一个举手参加！即兴发挥最好玩了",
        traitScores: { A: 0, C: 0, E: -1, O: 1, X: 3, P: 3 }
      },
      {
        value: "B",
        text: "等别人先上，看看什么难度再决定",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "负责出题或当裁判，贡献氛围但不上场",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "这种太社死了，我选择观众席",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q73",
    level: 2,
    category: "幽默风格",
    scenarioText: "😄 你说了句话把朋友们逗笑了。",
    questionText: "你的感觉是？",
    primaryTraits: ["P", "X", "A"],
    discriminationIndex: 0.44,
    options: [
      {
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
      }
    ]
  },
  {
    id: "Q74",
    level: 2,
    category: "惊喜偏好",
    scenarioText: "🎁 朋友说给你准备了一个神秘惊喜，但要等几天才能揭晓。",
    questionText: "你的状态是？",
    primaryTraits: ["P", "E", "O"],
    discriminationIndex: 0.40,
    options: [
      {
        value: "A",
        text: "超期待！每天都在猜测是什么",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 3 }
      },
      {
        value: "B",
        text: "开心但也有点焦虑，不知道是好惊喜还是吓一跳",
        traitScores: { A: 0, C: 1, E: -1, O: 1, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "平常心，到时候知道就知道了",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "其实更希望直接告诉我，不太喜欢等待",
        traitScores: { A: 0, C: 2, E: 1, O: -1, X: 0, P: -1 }
      }
    ]
  },

  // ==================== 新增O维度题目 (Q75-Q77) ====================
  {
    id: "Q75",
    level: 2,
    category: "新观点接纳",
    scenarioText: "💭 朋友分享了一个你从未听过、甚至有点颠覆认知的观点或理论。",
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
    scenarioText: "🎨 朋友带你看先锋艺术展，作品很抽象。",
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
    scenarioText: "🗺️ 旅行时，你有半天自由活动时间。",
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
    scenarioText: "🔔 这是一道用于确保你认真作答的检测题。",
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
    scenarioText: "⚖️ 朋友想尝试一家评价两极分化的新餐厅，你内心更倾向...",
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
    scenarioText: "⚖️ 连续参加了三天高强度社交活动，第四天又有个重要聚会。",
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
    scenarioText: "⚖️ 朋友连续抱怨同一件事已经第三次了，你感觉...",
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
    scenarioText: "⚖️ 团队项目快到deadline，这时有个很吸引你的新想法冒出来。",
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
    scenarioText: "⚖️ 聚会上你发现一个人独自站在角落，看起来有点格格不入。",
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
    scenarioText: "⚖️ 今天运气很背，连续遇到好几件倒霉事。",
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
    scenarioText: "🎉 朋友聚会上，气氛有点冷场。",
    questionText: "你的第一反应是？",
    primaryTraits: ["X", "E", "C"],
    isForcedChoice: true,
    targetPairs: ["开心柯基", "太阳鸡"],
    cohortTag: 'social_catalyst',
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
    scenarioText: "💡 你有一个很棒的创意想法，需要把它变成现实。",
    questionText: "你通常会？",
    primaryTraits: ["C", "O"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "灵感章鱼"],
    cohortTag: 'creative_explorer',
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
    scenarioText: "😊 好朋友最近工作压力大，向你倾诉烦恼。",
    questionText: "你倾向于？",
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
    scenarioText: "🤝 朋友遇到困难需要帮忙，你通常会？",
    questionText: "你更倾向于？",
    primaryTraits: ["A", "C", "X"],
    isForcedChoice: true,
    targetPairs: ["暖心熊", "定心大象", "织网蛛"],
    cohortTag: 'steady_harmonizer',
    options: [
      {
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
      }
    ]
  },
  {
    id: "Q94",
    level: 2,
    category: "原型区分-沉思猫头鹰vs稳如龟vs灵感章鱼",
    scenarioText: "📚 学习新知识或技能时，你的习惯是？",
    questionText: "你通常会？",
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
    scenarioText: "🤔 面对一个复杂的问题，你需要做出决定。",
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
    scenarioText: "💼 团队遇到一个棘手问题，需要有人来推动解决。",
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
    scenarioText: "🎉 朋友考试/面试取得了好成绩，发消息告诉你。",
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
    scenarioText: "🌈 周末有两个活动邀请：一个是朋友组织的热闹派对，另一个是小众艺术展览开幕。",
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
    scenarioText: "🏠 新搬到一个社区，邻居们组织了一个欢迎聚会。",
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
    scenarioText: "💡 团队头脑风暴会议上，你有一个很棒的点子。",
    questionText: "你倾向于？",
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
    scenarioText: "📖 发现一个很有深度的话题，你想深入了解。",
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
    scenarioText: "🎤 被邀请在小型聚会上分享自己的专业经验。",
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
  // ==================== Q103-Q110: 开心柯基 Attractor 专项区分题 ====================
  // 针对 灵感章鱼/机智狐/太阳鸡/夸夸豚 → 开心柯基 的主要混淆
  {
    id: "Q103",
    level: 3,
    category: "原型区分-灵感章鱼vs开心柯基-创意深度",
    scenarioText: "💡 朋友分享了一个有趣的新想法，邀请你一起参与。",
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
    scenarioText: "🎭 参加一个话题讨论活动，气氛开始变得热闹。",
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
    scenarioText: "🌙 一个安静的周末晚上，你有一整晚自由时间。",
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
    scenarioText: "🧩 遇到一个棘手的问题需要解决。",
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
    scenarioText: "⚡ 连续工作一周后，你感觉能量有点低。",
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
      }
    ]
  },
  {
    id: "Q108",
    level: 3,
    category: "原型区分-太阳鸡vs开心柯基-社交目标",
    scenarioText: "🥳 参加一个人比较多的聚会活动。",
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
      }
    ]
  },
  {
    id: "Q109",
    level: 3,
    category: "原型区分-夸夸豚vs开心柯基-表达方式",
    scenarioText: "🎁 朋友完成了一件很棒的事情。",
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
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 4, P: -1 }
      },
      {
        value: "C",
        text: "分享到朋友圈帮ta宣传，让更多人知道",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "默默记在心里，下次有机会帮ta一把",
        traitScores: { A: 2, C: 2, E: 1, O: 0, X: -2, P: 1 }
      }
    ]
  },
  {
    id: "Q110",
    level: 3,
    category: "原型区分-夸夸豚vs开心柯基-关注焦点",
    scenarioText: "👥 在一个新认识的小群体里。",
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
      }
    ]
  },
  // Q111-Q112: 价值取舍题 - 区分赞美驱动(夸夸豚) vs 玩乐驱动(开心柯基)
  {
    id: "Q111",
    level: 3,
    category: "价值取舍-夸夸豚vs开心柯基-社交满足感",
    scenarioText: "🌟 回顾一次让你特别满足的社交经历。",
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
    scenarioText: "💝 朋友正在经历低谷期，需要你的支持。",
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
      }
    ]
  },
  // Q113-Q114: 太阳鸡 vs 暖心熊 专项区分题 (E+X vs A+P)
  {
    id: "Q113",
    level: 3,
    category: "原型区分-太阳鸡vs暖心熊-社交能量",
    scenarioText: "🎉 聚会上气氛开始变得热烈起来。",
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
    scenarioText: "💫 朋友向你倾诉最近的烦恼。",
    questionText: "你通常会怎么回应？",
    primaryTraits: ["A", "P", "E", "X"],
    isForcedChoice: true,
    targetPairs: ["太阳鸡", "暖心熊"],
    cohortTag: 'social_catalyst',
    discriminationIndex: 0.58,
    options: [
      {
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
      }
    ]
  },
  // Q115-Q116: 沉思猫头鹰 vs 稳如龟 专项区分题 (O+reflection vs E+steadiness)
  // Key diff: 猫头鹰 O:85/E:75, 稳如龟 O:70/E:85 - need O vs E tradeoff
  {
    id: "Q115",
    level: 3,
    category: "原型区分-沉思猫头鹰vs稳如龟-充电方式",
    scenarioText: "🌙 一场热闹的社交活动结束后。",
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
    scenarioText: "🎯 团队在讨论一个重要决定。",
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
    scenarioText: "💡 你想到了一个很棒的新点子。",
    questionText: "你更倾向于怎么处理这个点子？",
    primaryTraits: ["O", "X"],
    isForcedChoice: true,
    targetPairs: ["机智狐", "灵感章鱼"],
    cohortTag: 'creative_explorer',
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
    scenarioText: "🎪 一个创意活动正在进行。",
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
    scenarioText: "🎈 朋友邀请你参加一个派对。",
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
    scenarioText: "⏰ 等待的事情比预期延迟了很久。",
    questionText: "你通常会怎么应对？",
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
    scenarioText: "😢 一个不太熟的同事看起来心情很低落。",
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
    scenarioText: "🤝 朋友分享了一个好消息。",
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
    scenarioText: "😔 好朋友刚经历了一次挫折，向你倾诉。",
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
    scenarioText: "🎂 你在组织一个朋友的生日聚会。",
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
      }
    ]
  },
  // Q125-Q126: 太阳鸡 vs 淡定海豚 加强区分题 (高能量鼓励 vs 稳定陪伴)
  {
    id: "Q125",
    level: 3,
    category: "原型区分-太阳鸡vs淡定海豚-能量输出",
    scenarioText: "⚡ 团队项目遇到困难，大家有点泄气。",
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
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 5, P: 6 }
      },
      {
        value: "B",
        text: "保持冷静，说\"慢慢来，一步一步解决\"",
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
      }
    ]
  },
  {
    id: "Q126",
    level: 3,
    category: "原型区分-太阳鸡vs淡定海豚-日常状态",
    scenarioText: "☀️ 普通的一天，没什么特别的事。",
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
    scenarioText: "🎭 朋友圈里有人发了一条很有争议的观点，评论区热闹得很。",
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
    scenarioText: "🎊 你被邀请去一个大部分人都不认识的派对。",
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
      }
    ]
  },
  {
    id: "Q129",
    level: 3,
    category: "独处风格区分",
    scenarioText: "🌙 周末晚上独自在家，有一整个晚上的时间。",
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
    scenarioText: "💬 朋友跟你吐槽工作上的烦恼。",
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
      }
    ]
  },

  // ==================== Q131-Q135: 新增高混淆对区分题 ====================
  // 针对持续混淆对：太阳鸡↔淡定海豚、沉思猫头鹰↔稳如龟、机智狐↔灵感章鱼、织网蛛↔定心大象、夸夸豚↔暖心熊
  
  {
    id: "Q131",
    level: 3,
    category: "能量表达方式",
    scenarioText: "🌟 团队项目遇到困难,大家情绪有点低落。",
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
      }
    ]
  },
  {
    id: "Q132",
    level: 3,
    category: "思维方式偏好",
    scenarioText: "📋 策划一个周末小型聚会，还没有具体方案。",
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
      }
    ]
  },
  {
    id: "Q133",
    level: 3,
    category: "创意产生方式",
    scenarioText: "💡 需要想一个创意方案，没有时间限制。",
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
    scenarioText: "🗓️ 组织一次3天小团队旅行。",
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
      }
    ]
  },
  {
    id: "Q135",
    level: 3,
    category: "情感表达深度",
    scenarioText: "❤️ 好朋友分享了一个好消息。",
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
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 4, P: 6 }
      },
      {
        value: "B",
        text: "给一个温暖的拥抱，真诚地说\"我为你感到开心\"",
        traitScores: { A: 5, C: 0, E: 3, O: 0, X: 1, P: 2 }
      },
      {
        value: "C",
        text: "微笑点头，说\"恭喜\"，保持礼貌距离",
        traitScores: { A: 1, C: 1, E: 3, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "\"意料之中，你一直都很优秀\"，冷静肯定",
        traitScores: { A: 2, C: 1, E: 4, O: 1, X: 0, P: -1 }
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
    scenarioText: "🌙 周五下班，终于自由了——",
    questionText: "拖动滑条，找到最符合你此刻感受的位置",
    primaryTraits: ["X", "P"],
    questionType: "slider",
    isAnchor: false,
    discriminationIndex: 0.55,
    sliderConfig: {
      leftLabel: "想一个人待着",
      rightLabel: "快叫上朋友！",
      leftEmoji: "😮‍💨",
      rightEmoji: "🥳",
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
    scenarioText: "👀 你看到两个朋友在微信群里因为一件小事杠起来了……",
    questionText: "你的第一反应？（别想，直接按）",
    primaryTraits: ["A", "X", "E"],
    questionType: "emoji_tap",
    isAnchor: false,
    isForcedChoice: true,
    discriminationIndex: 0.58,
    options: [
      {
        value: "popcorn",
        text: "🍿 吃瓜围观，看看怎么发展",
        traitScores: { O: 2, A: -2 },
      },
      {
        value: "dm",
        text: "💬 私信其中一个：你还好吗？",
        traitScores: { A: 4, X: -1 },
      },
      {
        value: "leave",
        text: "🤫 默默退出群聊一小会儿",
        traitScores: { E: 2, X: -3 },
      },
      {
        value: "dove",
        text: "🕊️ 发条轻松消息转移话题",
        traitScores: { A: 2, P: 2, C: 1 },
      },
      {
        value: "direct",
        text: "🔥 直接说：好了好了，你们都有道理",
        traitScores: { X: 2, C: 2, A: 1 },
      },
    ],
  },
];

export const ANCHOR_QUESTION_IDS = questionsV4
  .filter(q => q.isAnchor)
  .map(q => q.id);

export function getQuestionById(id: string): AdaptiveQuestion | undefined {
  return questionsV4.find(q => q.id === id);
}

export function getQuestionsByLevel(level: 1 | 2 | 3): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.level === level);
}

export function getAnchorQuestions(): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.isAnchor);
}

export function getReversedQuestions(): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.isReversed);
}

export function getAttentionCheckQuestions(): AdaptiveQuestion[] {
  return questionsV4.filter(q => q.isAttentionCheck);
}

export function validateAttentionCheck(questionId: string, selectedOption: string): boolean {
  const question = getQuestionById(questionId);
  if (!question?.isAttentionCheck) return true;
  return selectedOption === 'C';
}

export const REVERSED_QUESTION_IDS = questionsV4
  .filter(q => q.isReversed)
  .map(q => q.id);

export const ATTENTION_CHECK_QUESTION_IDS = questionsV4
  .filter(q => q.isAttentionCheck)
  .map(q => q.id);
