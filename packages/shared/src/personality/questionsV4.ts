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
    scenarioText: "🎉 工作日傍晚，同事群里突然有人发起：'今晚有人想一起去新开的居酒屋吗？'",
    questionText: "你的**第一反应和接下来的行动**会是？",
    primaryTraits: ["X", "C", "E"],
    isAnchor: true,
    discriminationIndex: 0.42,
    options: [
      {
        value: "A",
        text: "'好呀！正好想去看看！'（欣然加入，但可能牺牲独处时间）",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "'今晚吗？我看看安排...'（快速评估时间和精力成本）",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "'谢谢！我约了朋友，下次叫我～'（友好婉拒，守护已有计划）",
        traitScores: { A: 2, C: 1, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "'今天有点累...你们玩得开心！'（礼貌回避，优先恢复能量）",
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
        text: "'我都可以！哪个都好玩！'（牺牲选择权换取群体和谐）",
        traitScores: { A: 1, C: 0, E: 0, O: 3, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "'我查下距离和评分，做比较表？'（花时间精力做分析）",
        traitScores: { A: 1, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "'要不试试最特别的那个？'（承担可能踩雷的风险）",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "'我想去能安静聊天的地方。'（表达偏好，可能与主流不同）",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q3",
    level: 1,
    category: "能量优先级",
    scenarioText: "😌 一个你期待已久的周末个人计划（如看展、宅家），突然被朋友的热闹聚会邀请打断。",
    questionText: "你内心更强烈的倾向是？",
    primaryTraits: ["X", "C", "E"],
    isAnchor: true,
    discriminationIndex: 0.48,
    options: [
      {
        value: "A",
        text: "略带挣扎，但大概率会赴约——不愿错过热闹，即使有点累。",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "明确拒绝聚会，坚守自己的计划——这让我内心平静。",
        traitScores: { A: 0, C: 2, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "尝试把朋友拉入你的计划，或另约时间——两全其美。",
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
    options: [
      {
        value: "A",
        text: "'快讲完规则我们直接开一局试试！'（边玩边学，可能出错）",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "'一步一步来，有不清楚的我想随时问。'（可能耽误大家时间）",
        traitScores: { A: 0, C: 2, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "'我可以先看你们玩一局。'（放弃第一局参与机会）",
        traitScores: { A: 0, C: 0, E: 2, O: 1, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "'别让我第一个玩，我看懂后加入。'（承认自己需要更多准备）",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q5",
    level: 1,
    category: "团体形象",
    scenarioText: "📸 聚会合影时，大家闹哄哄地摆姿势。",
    questionText: "你通常的位置和状态是？",
    primaryTraits: ["X", "A", "E"],
    isAnchor: true,
    discriminationIndex: 0.52,
    options: [
      {
        value: "A",
        text: "主动指挥或提议搞怪姿势，站在中心附近——承担被关注的压力。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "把害羞的人拉到身边，照顾每个人——牺牲自己的舒适位置。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "听从安排，微笑，快速完成——随大流，不出头。",
        traitScores: { A: 0, C: 1, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "站在边缘，表情可能略显僵硬——宁愿不太上镜也要舒服。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
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
    options: [
      {
        value: "A",
        text: "立刻在群里@组织者，提出优化建议——可能显得多管闲事。",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "私聊组织者，委婉地提供信息——花额外精力但减少尴尬。",
        traitScores: { A: 2, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "算了，按大家的来——避免节外生枝，放弃更优方案。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "只告诉身边一两个人这个发现——小范围分享，不公开。",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q7",
    level: 1,
    category: "观点表达",
    scenarioText: "💬 群里话题聊得正热，你有个截然不同但有趣的角度。",
    questionText: "你会？",
    primaryTraits: ["X", "O", "E"],
    options: [
      {
        value: "A",
        text: "直接抛出，引发新讨论——可能被认为是杠精。",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "先观察大家反应，时机合适再提——谨慎但可能错过时机。",
        traitScores: { A: 0, C: 2, E: 2, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "私下跟聊得最嗨的人分享——避开公开场合的压力。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "想想算了——可能破坏当前气氛，保持沉默。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q8",
    level: 1,
    category: "延迟反应",
    scenarioText: "🕙 活动比预定时间晚了半小时才开始，大家都在等待。",
    questionText: "你逐渐感到？",
    primaryTraits: ["E", "A", "C"],
    options: [
      {
        value: "A",
        text: "有点焦躁，希望有人出来推动一下——不喜欢无序状态。",
        traitScores: { A: 0, C: 1, E: -2, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "没关系，正好多认识下旁边的人——利用等待时间社交。",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "开始观察组织疏漏在哪里，默默总结——理性分析问题。",
        traitScores: { A: 0, C: 2, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "完全放空，刷手机，等通知——无所谓，随遇而安。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: -1 }
      }
    ]
  },
  {
    id: "Q9",
    level: 1,
    category: "自我展示",
    scenarioText: "🎭 活动有个需要才艺展示的环节，自愿参与。",
    questionText: "你会？",
    primaryTraits: ["X", "E", "P"],
    options: [
      {
        value: "A",
        text: "第一个举手——早死早超生，享受表现自己的刺激。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "等别人先上，有人陪就上——降低独自表演的压力。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "除非被点名，否则坚决不上——保护自己的舒适区。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "帮忙起哄让别人上，自己负责鼓掌——贡献氛围但不出头。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 2 }
      }
    ]
  },
  {
    id: "Q10",
    level: 1,
    category: "应变态度",
    scenarioText: "🌧️ 户外活动当天早晨，发现天气可能变坏。",
    questionText: "你的第一念头是？",
    primaryTraits: ["O", "C", "E", "P"],
    options: [
      {
        value: "A",
        text: "'刺激！雨中玩耍别有风味。'——接受不确定性带来的惊喜。",
        traitScores: { A: 0, C: 0, E: 1, O: 3, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "'赶紧查备用室内方案，通知大家。'——主动承担协调责任。",
        traitScores: { A: 1, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "'组织者会处理吧，我等通知。'——信任他人，不多操心。",
        traitScores: { A: 0, C: -1, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "'正好，可以名正言顺取消了。'——诚实面对自己不想去的心情。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q11",
    level: 1,
    category: "入群行为",
    scenarioText: "👥 你被拉进一个全是陌生人的活动预备群。",
    questionText: "入群后，你通常会？",
    primaryTraits: ["X", "C", "E"],
    options: [
      {
        value: "A",
        text: "修改群昵称，发个自我介绍或表情包——主动破冰。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "默默围观，看大家聊天熟悉信息——先观察再决定。",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "点开几个活跃的人头像，看看资料——满足好奇心。",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "设置免打扰，等活动当天再看——节省注意力。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q12",
    level: 1,
    category: "决策风格",
    scenarioText: "🍽️ 点餐时，面对一本厚厚的陌生菜单。",
    questionText: "你倾向于？",
    primaryTraits: ["O", "C", "X"],
    isAnchor: true,
    discriminationIndex: 0.38,
    options: [
      {
        value: "A",
        text: "快速扫过，凭眼缘或名字有趣来点——可能踩雷但省时间。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "询问服务员招牌菜，或看邻桌点什么——借助外部信息。",
        traitScores: { A: 1, C: 1, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "仔细研究配料和做法，可能查评价——花时间确保不出错。",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "让同伴推荐或决定，省心——放弃选择权换取轻松。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q13",
    level: 1,
    category: "赠礼思维",
    scenarioText: "🎁 要为刚认识但投缘的新朋友选礼物。",
    questionText: "你更侧重？",
    primaryTraits: ["A", "O", "C"],
    isAnchor: true,
    discriminationIndex: 0.41,
    options: [
      {
        value: "A",
        text: "投其所好，选TA明确喜欢/需要的——花心思了解对方。",
        traitScores: { A: 3, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "选能代表我独特心意/品味的——展示自我风格。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "选实用、不出错的品质好物——安全稳妥的选择。",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "自制或有特殊纪念意义的东西——投入时间精力创造独特。",
        traitScores: { A: 2, C: 1, E: 0, O: 3, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q14",
    level: 1,
    category: "关系推进",
    scenarioText: "🤝 通过活动认识的新朋友，第二天在微信上找你闲聊。",
    questionText: "你的感受和回应倾向是？",
    primaryTraits: ["A", "E", "X"],
    options: [
      {
        value: "A",
        text: "开心，能这么快延续联系真好——积极回应。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "平常心，就跟其他朋友一样聊——不过度解读。",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "有点意外，会斟酌下回复内容——谨慎但不排斥。",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "轻微压力，希望聊天有明确目的——不喜欢无目的社交。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q15",
    level: 1,
    category: "胜负反应",
    scenarioText: "🏆 团队游戏你们这组赢了，对方组有些失落。",
    questionText: "你更可能？",
    primaryTraits: ["P", "A", "E", "X"],
    options: [
      {
        value: "A",
        text: "欢呼庆祝，享受胜利喜悦——尽情表达正面情绪。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "B",
        text: "主动去和对方组击掌，说'打得不错'——顾及对方感受。",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "分析我们赢在哪，对方输在哪——理性复盘。",
        traitScores: { A: 0, C: 2, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "低调，避免过度刺激对方——控制自己的表达。",
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
        text: "专注地看着ta，点头说'我懂你的感受'——深度共情，但可能吸收负面情绪。",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "等ta情绪平稳后，帮ta把问题分解，列出可能的解决步骤——理性帮助。",
        traitScores: { A: 0, C: 3, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分享自己类似的经历，让ta知道并不孤单——用故事连接。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "提议做些别的事情分散注意力——用行动转移焦点。",
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
        text: "立刻拍照发朋友圈/群里，并@几个朋友计划周末就去探险——即时分享。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "沉迷于研究它的历史、店主故事或设计理念——深度探索。",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "收藏地址，等有特别适合的朋友或场合时再分享——精准匹配。",
        traitScores: { A: 2, C: 1, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "自己一个人先去体验一次，再决定是否告诉别人——独享优先。",
        traitScores: { A: 0, C: 0, E: 2, O: 1, X: 0, P: 0 }
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
        text: "立刻回家，确保有至少2小时完全独处的时间——必须充电。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      },
      {
        value: "B",
        text: "在活动线上群里继续回味，发照片、聊天，延续兴奋感——越聊越嗨。",
        traitScores: { A: 1, C: 0, E: -1, O: 0, X: 2, P: 2 }
      },
      {
        value: "C",
        text: "和1-2个最亲近的参与者找个安静地方简单复盘，然后各自回家——小群体过渡。",
        traitScores: { A: 2, C: 1, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "需要一些低刺激的独处活动，如看书、听播客，但不必完全隔绝——柔性恢复。",
        traitScores: { A: 0, C: 1, E: 2, O: 1, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q19",
    level: 2,
    category: "助人行为",
    scenarioText: "❓ 活动群里，有人问一个你恰好知道答案的问题（如某个地点怎么走、某首歌名）。",
    questionText: "你通常会？",
    primaryTraits: ["A", "C", "X"],
    options: [
      {
        value: "A",
        text: "直接给出准确答案和详细信息——高效帮助。",
        traitScores: { A: 1, C: 2, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "先鼓励ta，然后@可能更了解的人一起来帮忙——调动群体。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "C",
        text: "私聊告诉提问者，避免刷屏——低调帮助。",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "看到已经有人回答了，就默默点赞——不重复贡献。",
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
        text: "委婉但清晰地指出正确的信息，并提供来源——追求准确。",
        traitScores: { A: 1, C: 2, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "除非这个错误严重影响讨论结论，否则一笑置之——不较真。",
        traitScores: { A: 1, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "私下告诉那个人，避免ta在公开场合尴尬——顾及面子。",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "顺着错误开个玩笑，把话题引向更有趣的方向——活跃气氛。",
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
        text: "立刻兴奋地指出并利用，享受策略成功的快感——抓住机会。",
        traitScores: { A: 0, C: 2, E: 0, O: 3, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "先向所有人确认这条规则的理解是否一致，避免争议——程序正义。",
        traitScores: { A: 1, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "犹豫是否使用，担心破坏游戏平衡或让对手不快——顾虑他人。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "不提这个规则，继续正常玩——维持现状。",
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
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: 1, P: 0 }
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
        text: "'我觉得...不太是我的菜'——诚实表达，可能让对方失望。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "'还不错，画面挺好看的！'——找到可以肯定的点。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "'哈哈你真的很喜欢这类型的对吧？'——转移到了解对方。",
        traitScores: { A: 2, C: 1, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "含糊带过，期待话题自然转移——回避冲突。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q22_v1",
    level: 2,
    category: "意见保留",
    scenarioText: "🍽️ 朋友带你去吃ta心目中全市最好吃的餐厅，但你觉得口味很平庸。",
    questionText: "当ta满怀期待问你'怎么样'时，你会？",
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
        text: "违心地点头说'确实不错'，不想扫兴。",
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
        text: "'多的那点我来吧～'主动承担零头——避免麻烦。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "精确计算到个位，确保每个人付得公平——追求精确。",
        traitScores: { A: 0, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "'下次谁请客抵掉算了'——灵活处理。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "跟着大家怎么说就怎么付——随大流。",
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
        traitScores: { A: 3, C: 1, E: 2, O: 0, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "用账单小程序计算，确保每人分摊完全公平。",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "大概分一下就行，不用算那么细。",
        traitScores: { A: 2, C: -1, E: 2, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "先让大家记账，最后总金额算清楚。",
        traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 }
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
        text: "问群里有没有人去过或有推荐——借助群体智慧。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "刷点评APP，综合分析评分、评论、人均——系统调研。",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "回忆自己去过或听说过的地方——依靠经验。",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "随便挑一个看起来不错的，到时候再说——直觉决策。",
        traitScores: { A: 0, C: -1, E: 1, O: 2, X: 0, P: 1 }
      }
    ]
  },
  {
    id: "Q25",
    level: 2,
    category: "技能教授",
    scenarioText: "🎓 别人请你教一个你擅长的技能（如摄影、调酒、健身动作）。",
    questionText: "你的教学风格是？",
    primaryTraits: ["C", "A", "O"],
    options: [
      {
        value: "A",
        text: "先演示一遍，然后让ta自己试，有问题随时问——实践导向。",
        traitScores: { A: 1, C: 1, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "从头讲解原理和步骤，确保ta理解了再开始——理论先行。",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "手把手带着做，每一步都一起——耐心陪伴。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "发几个教程链接，让ta自己先看——自学优先。",
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
        text: "我是气氛发动机/活动发起者——主动创造。",
        traitScores: { A: 0, C: 1, E: 0, O: 1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "我是组织协调者/资源连接者——穿针引线。",
        traitScores: { A: 3, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我是深度参与者/知识提供者——专业贡献。",
        traitScores: { A: 0, C: 2, E: 0, O: 3, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我是稳定参与者/支持性成员——默默在场。",
        traitScores: { A: 2, C: 1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q27",
    level: 2,
    category: "创意产出",
    scenarioText: "💡 团队 brainstorming 时，领导说'任何天马行空的想法都可以'。",
    questionText: "你的典型产出是？",
    primaryTraits: ["O", "C", "X"],
    options: [
      {
        value: "A",
        text: "大量短平快的点子，其中几个可能很有趣——发散优先。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "几个经过初步推敲、可行性较高的方案——质量优先。",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "一个深入、系统但可能略显复杂的框架性想法——体系思维。",
        traitScores: { A: 0, C: 2, E: 0, O: 3, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "在别人想法的基础上进行补充和优化——迭代改进。",
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 }
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
        text: "有点尴尬，怀疑自己是不是说错了什么或不合时宜——敏感反思。",
        traitScores: { A: 0, C: 0, E: -2, O: 0, X: -2, P: 0 }
      },
      {
        value: "B",
        text: "无所谓，大家可能都在忙，等下自然会有人回——淡定接受。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "主动@某个可能感兴趣的人，或发个表情包救场——主动化解。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "反思消息的内容 and 形式，看是否可以提高表达清晰度——理性分析。",
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
        text: "惊喜又感动，可能有点眼眶湿润，拥抱最近的朋友——情感外露。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "非常兴奋，大笑并做出夸张的反应，享受这个高光时刻——尽情表达。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "C",
        text: "有点不知所措，但努力配合大家的热情，说'谢谢大家'——克制但感激。",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "内心感激，但会觉得被这么多人关注有些负担——社交压力。",
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
        text: "认真填写，既提优点也提具体改进建议——建设性反馈，但花时间。",
        traitScores: { A: 1, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "以鼓励为主，提一点建议时会特别注意措辞——正面导向。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "C",
        text: "简单勾选评分，简短评论——效率优先。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "看心情决定填不填，如果没强烈感受就跳过——随性处理。",
        traitScores: { A: 0, C: -1, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q31",
    level: 2,
    category: "集体决策",
    scenarioText: "👥 你和一群朋友计划一次旅行，有几种不同的风格选择（如穷游探险、奢华度假、文化深度游）。",
    questionText: "在讨论中，你更可能扮演什么角色？",
    primaryTraits: ["X", "A", "C", "E"],
    options: [
      {
        value: "A",
        text: "积极推销自己最感兴趣的风格——但可能被认为太强势。",
        traitScores: { A: -1, C: 0, E: 0, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "倾听各方偏好，尝试找折中方案——但可能让自己的偏好被忽略。",
        traitScores: { A: 3, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分析每种方案的利弊、预算和可行性——但可能显得太理性。",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我都可以，大家决定好了告诉我——放弃影响力换取轻松。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q32",
    level: 2,
    category: "游戏偏好",
    scenarioText: "🎭 聚会上，大家玩'真心话大冒险'。轮到你选择时，",
    questionText: "你更倾向于？",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
        value: "A",
        text: "大冒险！越刺激有趣越好——享受肾上腺素，但可能出丑。",
        traitScores: { A: 0, C: -1, E: -1, O: 1, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "真心话，可以分享一些故事，但希望问题不要太私密——有限开放。",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "根据在场的人的熟悉程度 and 气氛来决定——灵活应对。",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "尽量选一个最简单、最安全的任务或问题——风险最小化。",
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
        text: "立刻道歉并快步离开，不想卷入冲突——回避型处理。",
        traitScores: { A: 2, C: 0, E: 3, O: 0, X: -1, P: 1 }
      },
      {
        value: "B",
        text: "皱眉或回看一眼，内心虽然不悦但忍住不发作——压抑型处理。",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "理直气壮地回一句'你也撞到我了'，维护自己的边界——防御型处理。",
        traitScores: { A: -2, C: 0, E: -1, O: 0, X: 2, P: -1 }
      },
      {
        value: "D",
        text: "心平气和地说一句'不好意思'，并观察对方是否需要帮助——超越型处理。",
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
        text: "立刻转发给ta，并附带一句'这个你应该感兴趣'——快捷分享。",
        traitScores: { A: 2, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "自己先看完并总结出几个核心点，连同链接一起发给ta——深度分享。",
        traitScores: { A: 3, C: 3, E: 0, O: 3, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "先收藏，等下次见面或深度聊天时再当面交流——沉浸分享。",
        traitScores: { A: 1, C: 1, E: 1, O: 1, X: -1, P: 2 }
      },
      {
        value: "D",
        text: "觉得可能打扰到对方，或者对方自己也能看到，就不发了——谨慎分享。",
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
        text: "非常失望，觉得心情全毁了，参与室内聚会也提不起劲——低韧性表现。",
        traitScores: { A: 0, C: 0, E: -3, O: -1, X: 0, P: -2 }
      },
      {
        value: "B",
        text: "虽然遗憾，但很快开始寻找室内的好玩项目——中高韧性表现。",
        traitScores: { A: 1, C: 1, E: 2, O: 2, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "觉得室内聚会也挺好，可以更安静地聊天，也不错——高适应性表现。",
        traitScores: { A: 2, C: 0, E: 3, O: 1, X: 0, P: 2 }
      },
      {
        value: "D",
        text: "索性不去了，打算在家里休息或做自己的事——自主性表现。",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q36",
    level: 2,
    category: "接受新事物",
    scenarioText: "🔄 朋友向你推荐一个TA非常喜欢、但你之前从未接触过的活动（如某种舞蹈、冥想、攀岩）。",
    questionText: "你的第一反应是？",
    primaryTraits: ["O", "C", "A"],
    options: [
      {
        value: "A",
        text: "听起来很有趣，我很愿意尝试一下——高开放性。",
        traitScores: { A: 1, C: 0, E: 0, O: 3, X: 1, P: 1 }
      },
      {
        value: "B",
        text: "先了解一下细节（如时间、难度、危险性）再决定——审慎尝试。",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "如果朋友陪我一起去，我可能愿意试一试——社交驱动。",
        traitScores: { A: 3, C: 0, E: 0, O: 1, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "不太感兴趣，我更倾向于待在自己的舒适区——守旧倾向。",
        traitScores: { A: 0, C: 1, E: 2, O: -1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q37",
    level: 2,
    category: "重大建议",
    scenarioText: "🤔 当朋友问你'我该不该换工作/结束一段关系？'这类重大人生抉择时，",
    questionText: "你通常如何回应？",
    primaryTraits: ["C", "A", "P"],
    options: [
      {
        value: "A",
        text: "帮TA列出所有利弊，分析每种选择的可能结果——理性支持。",
        traitScores: { A: 0, C: 3, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "先共情，问TA的感受和真实需求，而不是急于给建议——情感支持。",
        traitScores: { A: 3, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "分享自己或他人的类似经历和结果——故事分享。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "鼓励TA跟随内心的直觉，你会支持TA的任何决定——信任放手。",
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
        text: "渐入佳境，越来越嗨，享受这种能量场——社交充电。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "有点累，需要去安静角落或室外透透气——需要喘息。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "找到了小圈子深入聊天，感觉还不错——小群体舒适。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "已经开始想什么时候可以礼貌地离开——社交耗尽。",
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
        text: "我来做！喜欢在台前演讲的感觉——享受聚光灯。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "我负责准备内容/PPT，让别人去讲——幕后贡献。",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我协助演讲者，做提示或补充——支持角色。",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我尽量不参与展示环节——回避曝光。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -2, P: 0 }
      }
    ]
  },
  {
    id: "Q40",
    level: 2,
    category: "关系深度",
    scenarioText: "🌱 你加入了一个每周活动的社团（如运动、手工），已经三个月。",
    questionText: "现在你对社团里其他成员的了解程度通常是？",
    primaryTraits: ["A", "E", "X"],
    options: [
      {
        value: "A",
        text: "知道很多人的名字、职业 and 基本背景，有几个聊得来的——广泛了解。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "只和固定的一两个人熟，对其他人只是脸熟——深度聚焦。",
        traitScores: { A: 1, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "几乎和所有人都能聊上几句，知道一些人的趣事——社交达人。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "D",
        text: "专注于活动本身，对人的了解比较表面——任务导向。",
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
        text: "立刻开始讨论剧情、演技、镜头，可能产生激烈辩论——即时表达。",
        traitScores: { A: 0, C: 1, E: 0, O: 2, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "先问朋友'你觉得怎么样？'，根据对方的反应再展开——观察优先。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "简单分享感受（如'挺好看的'），除非朋友想深入聊——点到为止。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "沉浸在电影情绪里，可能需要点时间消化，不太想说话——内在处理。",
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
        text: "主动提起他们可能都感兴趣的话题，或分享关于双方的趣事——积极搭桥。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "感到有点责任，努力寻找他们之间的连接点——尽责但有压力。",
        traitScores: { A: 2, C: 2, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "顺其自然，如果他们没话聊，也不用强求——放手随缘。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "开个玩笑缓和气氛，或者提议去做点别的事情——转移焦点。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 2 }
      }
    ]
  },
  {
    id: "Q43",
    level: 2,
    category: "日程风格",
    scenarioText: "📅 你的周末时间安排，更符合以下哪种模式？",
    questionText: "（请想象一个典型的月份）",
    primaryTraits: ["X", "E", "A", "C"],
    options: [
      {
        value: "A",
        text: "提前几周就有不少社交安排，周末经常有活动——社交活跃。",
        traitScores: { A: 1, C: 1, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "有1-2项固定活动（如运动课），其余时间随性而定——结构灵活。",
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "更喜欢留白，最多提前一周安排， and 需要独处时间——保护空间。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "会主动策划或答应一些深度、小范围的见面——质量优于数量。",
        traitScores: { A: 2, C: 1, E: 0, O: 1, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q44",
    level: 2,
    category: "求助方式",
    scenarioText: "🤝 你需要找一个朋友帮你一个不大不小的忙（如搬家、接机、借东西）。",
    questionText: "你通常会如何开口？",
    primaryTraits: ["A", "C", "X"],
    options: [
      {
        value: "A",
        text: "直接问，并明确表示对方可以拒绝，不会介意——坦诚直接。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "先寒暄，然后委婉地提出请求，并强调会回报——铺垫周到。",
        traitScores: { A: 2, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "纠结很久，确保这个请求不会给对方造成太大负担才说——过度考虑。",
        traitScores: { A: 1, C: 0, E: -1, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "会在心里列一个可能愿意帮忙的朋友名单，选择最合适的人——策略选择。",
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
        text: "严格遵循老师教的步骤，做出一个标准、完美的作品——追求规范。",
        traitScores: { A: 0, C: 3, E: 1, O: -1, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "在基础框架上加入自己的创意 and 改造——创新尝试。",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "和旁边的人交流想法，可能会合作或互相模仿——社交创作。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "有点迷茫，希望老师能多给一些具体指导——需要方向。",
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
        text: "感到被挑战，更努力地阐述自己的论据——坚持立场。",
        traitScores: { A: 0, C: 1, E: -1, O: 1, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "有点紧张或不适，想尽快结束对峙——回避冲突。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -2, P: 0 }
      },
      {
        value: "C",
        text: "好奇对方为什么这么想，试图理解其立场——开放探索。",
        traitScores: { A: 1, C: 1, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "觉得这很正常，讨论本来就有不同声音——淡定接受。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q47",
    level: 2,
    category: "祝贺方式",
    scenarioText: "🌟 朋友取得了一个很棒的成就（如升职、获奖），在朋友圈公布。",
    questionText: "你通常会如何表示祝贺？",
    primaryTraits: ["P", "A", "E", "X"],
    options: [
      {
        value: "A",
        text: "立刻点赞评论，写一段热情洋溢的祝福——公开表达。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 1, P: 3 }
      },
      {
        value: "B",
        text: "私聊TA，表达更个人化的祝贺和关心——私密连接。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "点个赞，或者简单评论'恭喜！'——简洁表达。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "可能会记在心里，下次见面时再当面祝贺——延迟表达。",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: -1, P: 0 }
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
        text: "上网进行碎片化搜索，看很多相关视频和短文——广度探索。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "找一本权威书籍或长篇深度报道系统学习——深度钻研。",
        traitScores: { A: 0, C: 2, E: 0, O: 3, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "找对这个话题感兴趣的朋友一起讨论研究——社交学习。",
        traitScores: { A: 2, C: 0, E: 0, O: 1, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "如果和工作生活无关，可能过一阵兴趣就淡了——实用导向。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
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
        text: "每个摊位都看看，尝各种小吃，看热闹的表演——全面体验。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "先绕场一周了解全貌，再有选择地重点逛——系统规划。",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "和朋友一边逛一边聊天，逛什么是次要的——社交优先。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "人多的地方就不去了，找些人少的角落看看——避开人群。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q50",
    level: 2,
    category: "秘密处理",
    scenarioText: "🤫 你无意中得知了一个关于某位朋友的、并非恶意的秘密（如TA的恋情、家庭情况）。",
    questionText: "你会如何处理这个信息？",
    primaryTraits: ["A", "C", "E"],
    options: [
      {
        value: "A",
        text: "绝对保密，就当不知道——信守边界，但可能错过帮助机会。",
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "可能会告诉一两个最信任且与当事人无关的朋友——有限分享。",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "如果时机合适，可能会以关心的方式和当事人聊起——主动关怀。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "有点负担，不知道该如何面对这位朋友了——内心纠结。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -1, P: 0 }
      }
    ]
  },

  // ==================== L3 精准决胜题 (Q51-Q60) ====================
  {
    id: "Q51",
    level: 3,
    category: "自我价值认知",
    scenarioText: "🎯 在社交中，你认为自己最大的价值是？",
    questionText: "（请凭直觉选择最符合的一项，每个选项都有其独特价值）",
    primaryTraits: ["P", "A", "O", "C"],
    options: [
      {
        value: "A",
        text: "我能让气氛变得轻松愉快，带来欢笑——但有时可能显得不够严肃。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "B",
        text: "我能提供情感支持和深度理解，让人感到被接纳——但可能过于投入他人情绪。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "我能提供独特的视角、知识或创意灵感——但有时可能让人觉得太深奥。",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "我能确保事情顺利运行，考虑周全——但可能显得太谨慎。",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q52",
    level: 3,
    category: "负向恐惧",
    scenarioText: "😅 社交场合中，你最担心发生哪种情况？",
    questionText: "（请选择让你感觉最不适的一项，每个人都有自己的敏感点）",
    primaryTraits: ["P", "X", "E", "A"],
    options: [
      {
        value: "A",
        text: "冷场，或者气氛尴尬——感觉有责任去打破沉默。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "说错话或做错事，让他人对我有负面看法——在意他人评价。",
        traitScores: { A: 1, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "被迫成为焦点，或者需要即兴表演/发言——不喜欢被关注。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "卷入人际冲突或复杂的感情纠葛中——想要保持简单。",
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
        text: "火花塞——点燃气氛，激发活力。但有时需要休息充电。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "粘合剂——连接不同的人，促进关系。但可能忽略自己的需求。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "指南针——提供方向、见解和稳定性。但可能显得太严肃。",
        traitScores: { A: 0, C: 3, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "观察者——在一旁洞察、分析和学习。但可能参与度较低。",
        traitScores: { A: 0, C: 1, E: 2, O: 2, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q54",
    level: 3,
    category: "价值观权衡",
    scenarioText: "⚖️ 对你而言，在社交中，'做真实的自己'和'让周围的人感到舒服'",
    questionText: "哪个更重要？（两者都有价值，请选择更倾向的一方）",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
        value: "A",
        text: "做真实的自己更重要。我不需要为了迎合他人而改变——但可能有时让人觉得不够圆滑。",
        traitScores: { A: -1, C: 0, E: 1, O: 1, X: 2, P: 0 }
      },
      {
        value: "B",
        text: "让周围的人感到舒服更重要。和谐的关系需要适当的调整——但可能有时会压抑自己。",
        traitScores: { A: 3, C: 1, E: 0, O: -1, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "看情况。在亲密朋友面前真实，在陌生环境里随和——灵活切换。",
        traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "两者不冲突。我真实的自己就是能让别人舒服的——自然和谐。",
        traitScores: { A: 2, C: 0, E: 1, O: 0, X: 1, P: 2 }
      }
    ]
  },
  {
    id: "Q55",
    level: 3,
    category: "历史模式",
    scenarioText: "🔄 回顾你过往的社交经历，哪种模式更常发生？",
    questionText: "（每种模式都有其优势，请诚实选择）",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
        value: "A",
        text: "我经常是活动的发起者或核心组织者——付出更多精力，但掌控感强。",
        traitScores: { A: 1, C: 2, E: -1, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "我更多是活动的积极参与者和支持者——省心省力，但影响力有限。",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "C",
        text: "我倾向于参与小型、深度的交流——质量高，但社交圈较小。",
        traitScores: { A: 2, C: 0, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "我经常以观察者或偶尔参与者的身份加入——压力小，但可能错过一些机会。",
        traitScores: { A: 0, C: 1, E: 3, O: 1, X: -1, P: 0 }
      }
    ]
  },
  {
    id: "Q56",
    level: 3,
    category: "助人天赋",
    scenarioText: "👂 当朋友遇到困扰向你倾诉时，你觉得自己更擅长？",
    questionText: "（请选择一个更符合你天赋的选项）",
    primaryTraits: ["A", "C", "P"],
    options: [
      {
        value: "A",
        text: "耐心倾听，让ta感到被完全理解和接纳——情感共鸣型。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "帮ta理清思路，分析问题，找到可行的解决方案——逻辑分析型。",
        traitScores: { A: 0, C: 3, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "用我的乐观和幽默感染ta，让ta暂时忘掉烦恼——氛围转换型。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "D",
        text: "分享我相关的经历和感受，让ta知道并不孤单——经验分享型。",
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
        text: "放大这个笑点，开玩笑说这是今晚的高光时刻，让它成为经典梗——制造欢乐。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 3, P: 2 }
      },
      {
        value: "B",
        text: "一边笑一边赶紧递纸巾，并安慰朋友'没事没事，常有的事'——温暖关怀。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 2 }
      },
      {
        value: "C",
        text: "看看朋友是否真的尴尬，如果是，就帮忙解围转移话题——察言观色。",
        traitScores: { A: 2, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "跟着大家笑，但不会特别突出，等自然进入下一个话题——随群体节奏。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q58",
    level: 3,
    category: "助人消耗",
    scenarioText: "💆 同样是在帮助遇到困扰的朋友时，你认为哪件事更消耗你的心力（让你更累）？",
    questionText: "（与Q56配对验证一致性）",
    primaryTraits: ["A", "C", "P"],
    options: [
      {
        value: "A",
        text: "长时间地提供情绪接纳和陪伴，吸收对方的负面情绪——情感消耗。",
        traitScores: { A: -2, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "反复思考和分析，试图为对方找到一个完美的解决方案——脑力消耗。",
        traitScores: { A: 1, C: -2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "两者都不太消耗，我很乐意帮助朋友——能量充沛型。",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 2 }
      },
      {
        value: "D",
        text: "当我的帮助似乎没有效果时，感到无力——效果导向消耗。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: -1 }
      }
    ]
  },
  {
    id: "Q59",
    level: 3,
    category: "情绪敏感度",
    scenarioText: "📊 请评估以下陈述与你的符合程度：'我通常能敏锐地察觉到社交场合中微妙的氛围变化和他人未说出口的情绪。'",
    questionText: "",
    primaryTraits: ["A", "E", "O"],
    options: [
      {
        value: "A",
        text: "非常符合，我经常是第一个感觉到的人——高敏感度。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "比较符合，但有时我会过于专注自己的事情而忽略——选择性敏感。",
        traitScores: { A: 1, C: 0, E: 1, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "不太符合，我通常更关注大家明确表达的内容和活动本身——内容导向。",
        traitScores: { A: -1, C: 1, E: 1, O: 0, X: 1, P: 1 }
      },
      {
        value: "D",
        text: "完全不符合，我很少注意这些——低敏感度。",
        traitScores: { A: -2, C: 0, E: 2, O: 0, X: 0, P: 0 }
      }
    ]
  },
  {
    id: "Q60",
    level: 3,
    category: "终极价值观",
    scenarioText: "🎯 最后，请想象你理想中的一次完美社交活动。它最吸引你的核心是什么？",
    questionText: "（每个选项都代表一种有价值的体验）",
    primaryTraits: ["A", "O", "P", "C", "E"],
    options: [
      {
        value: "A",
        text: "人与人之间产生了真诚、深刻的连接和理解——深度连接。",
        traitScores: { A: 3, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "充满了新鲜感、创意和意想不到的惊喜——探索发现。",
        traitScores: { A: 0, C: 0, E: 0, O: 3, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "大家玩得非常尽兴、开心，笑声不断——欢乐氛围。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 3 }
      },
      {
        value: "D",
        text: "一切安排得当，流程顺畅，每个人都很舒适——有序和谐。",
        traitScores: { A: 1, C: 3, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "E",
        text: "我可以放松地做自己，没有压力和负担——自在舒适。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // ==================== 新增题目：反向计分题、E维度题、工作场景题、注意力检查题 ====================
  
  // 反向计分题1 - 用于检测作答一致性（与Q1社交启动形成对照）
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
        text: "有点烦躁，为什么总是临时打扰我的计划——保护个人空间。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: -1 }
      },
      {
        value: "B",
        text: "犹豫一下，但还是会去——社交义务感。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "C",
        text: "开心！正好想出去，独处可以改天——社交优先。",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 3, P: 2 }
      },
      {
        value: "D",
        text: "看情况，取决于是什么样的聚会和谁参加——理性评估。",
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
        text: "专注和身边的人聊天，手机放一边——享受当下。",
        traitScores: { A: 2, C: 0, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "帮大家拍照、修图，但自己不太上镜——服务他人。",
        traitScores: { A: 3, C: 1, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "积极参与合影和互动，顺便也发几条动态——融入热闹。",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 2, P: 2 }
      },
      {
        value: "D",
        text: "找个安静角落休息一会儿——需要喘息空间。",
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
        text: "几秒钟就过去了，不会放在心上——情绪弹性高。",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 1, P: 2 }
      },
      {
        value: "B",
        text: "当时会有点介意，但活动结束前就忘了——适度消化。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "可能会影响接下来一段时间的心情——持续影响。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: -1, P: 0 }
      },
      {
        value: "D",
        text: "会反复想这件事，甚至回家后还在琢磨——深度反刍。",
        traitScores: { A: 0, C: 1, E: -2, O: 1, X: -1, P: -1 }
      }
    ]
  },

  // E维度直接测量题2 - 压力应对
  {
    id: "Q64",
    level: 2,
    category: "压力应对",
    scenarioText: "⏰ 活动当天出现了意外状况（如交通堵塞、场地变更），需要临时调整计划。",
    questionText: "你的典型反应是？",
    primaryTraits: ["E", "C", "P"],
    options: [
      {
        value: "A",
        text: "保持冷静，迅速想办法应对——问题解决导向。",
        traitScores: { A: 0, C: 2, E: 3, O: 0, X: 0, P: 1 }
      },
      {
        value: "B",
        text: "虽然有点紧张，但还是能正常处理——适度应激。",
        traitScores: { A: 0, C: 1, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会感到焦虑，需要一点时间来调整情绪——情绪先行。",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "觉得很烦躁，这种意外让我很不舒服——抗拒变化。",
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
        text: "很快就能调整过来，开始想其他替代方案——高恢复力。",
        traitScores: { A: 0, C: 1, E: 3, O: 1, X: 0, P: 2 }
      },
      {
        value: "B",
        text: "会失落一会儿，但不会影响其他安排——正常波动。",
        traitScores: { A: 0, C: 0, E: 2, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "需要找人倾诉或做点别的事情来转移注意力——需要支持。",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "D",
        text: "整天心情都会受影响，很难振作起来——持续低落。",
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
        text: "先花时间了解对方的工作风格和偏好——建立关系优先。",
        traitScores: { A: 3, C: 1, E: 0, O: 0, X: 1, P: 0 }
      },
      {
        value: "B",
        text: "直接讨论分工，各自负责各自的部分——效率优先。",
        traitScores: { A: 0, C: 2, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "边做边磨合，遇到问题再沟通——灵活应对。",
        traitScores: { A: 1, C: 0, E: 1, O: 2, X: 0, P: 1 }
      },
      {
        value: "D",
        text: "希望有明确的流程和规则，减少不确定性——结构化协作。",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: -1, P: 0 }
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
        text: "积极发言，分享自己的观点和建议——主动展示。",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "先听别人说什么，找到合适的时机再补充——观察后行动。",
        traitScores: { A: 0, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "除非被点名，否则倾向于保持沉默——被动参与。",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: -2, P: 0 }
      },
      {
        value: "D",
        text: "会后私下跟相关人员分享想法——避开公开场合。",
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
        text: "找几个人一起学，互相讨论和督促——群体学习。",
        traitScores: { A: 2, C: 0, E: 0, O: 0, X: 2, P: 1 }
      },
      {
        value: "B",
        text: "自己按照系统的教程一步一步来——独立学习。",
        traitScores: { A: 0, C: 3, E: 1, O: 0, X: -1, P: 0 }
      },
      {
        value: "C",
        text: "边做边学，遇到问题再查资料——实践导向。",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 0, P: 2 }
      },
      {
        value: "D",
        text: "先广泛了解不同方法，找到最适合自己的再深入——探索式。",
        traitScores: { A: 0, C: 1, E: 0, O: 3, X: 0, P: 0 }
      }
    ]
  },

  // 注意力检查题
  {
    id: "Q69",
    level: 2,
    category: "注意力检查",
    scenarioText: "🔔 这是一道用于确保你认真作答的检测题。",
    questionText: "请选择下方第三个选项（选项C）。",
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
  }
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
