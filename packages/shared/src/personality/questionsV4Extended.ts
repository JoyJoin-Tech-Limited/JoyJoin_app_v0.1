/**
 * V4 Adaptive Assessment - Extended Questions (L2 supplement + L3 + reverse scoring + P dimension)
 */

import { AdaptiveQuestion } from './types';

export const questionsV4Extended: AdaptiveQuestion[] = [
  {
    id: "Q78",
    level: 2,
    category: "独处偏好",
    scenarioText: "周五晚上，你独自一人待在家，突然收到多个朋友的邀约。",
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
    scenarioText: "头脑风暴环节，大家在想活动创意。",
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
    scenarioText: "你在聚会上主动和新认识的人交流。",
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
        traitScores: { A: 1, C: 2, E: 1, O: 0, X: 0, P: 0 }
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
    scenarioText: "周末早上醒来，天气很好。",
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
    scenarioText: "朋友分享了一个你觉得有问题的观点。",
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
    scenarioText: "在社交中，你认为自己最大的价值是？",
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
    scenarioText: "社交场合中，你最担心发生哪种情况？",
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
    scenarioText: "如果用一个比喻来形容你在社交网络中的角色，你觉得最接近？",
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
    scenarioText: "对你而言，在社交中，做真实的自己和让周围的人感到舒服",
    questionText: "哪个更重要？",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
        value: "A",
        text: "做真实的自己更重要。我不需要为了迎合他人而改变",
        traitScores: { A: -2, C: 0, E: 1, O: 1, X: 2, P: -1 }
      },
      {
        value: "B",
        text: "让周围的人感到舒服更重要。和谐的关系需要适当的调整",
        traitScores: { A: 3, C: 1, E: -1, O: -1, X: -1, P: 1 }
      },
      {
        value: "C",
        text: "看情况。在亲密朋友面前真实，在陌生环境里随和",
        traitScores: { A: 1, C: 2, E: 2, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "两者不冲突。我真实的自己就是能让别人舒服的",
        traitScores: { A: 1, C: -1, E: 1, O: 0, X: 1, P: 1 }
      }
    ]
  },
  {
    id: "Q55",
    level: 3,
    category: "历史模式",
    scenarioText: "回顾你过往的社交经历，哪种模式更常发生？",
    questionText: "",
    primaryTraits: ["X", "A", "E"],
    options: [
      {
        value: "A",
        text: "我经常是活动的发起者或核心组织者",
        traitScores: { A: 0, C: 1, E: -1, O: 0, X: 3, P: 1 }
      },
      {
        value: "B",
        text: "我更多是活动的积极参与者和支持者",
        traitScores: { A: 1, C: 1, E: 1, O: 0, X: 1, P: 1 }
      },
      {
        value: "C",
        text: "我倾向于参与小型、深度的交流",
        traitScores: { A: 1, C: 0, E: 1, O: 1, X: -1, P: -1 }
      },
      {
        value: "D",
        text: "我经常以观察者或偶尔参与者的身份加入",
        traitScores: { A: -1, C: 0, E: 2, O: 1, X: -2, P: -1 }
      }
    ]
  },
  {
    id: "Q56",
    level: 2,
    category: "助人天赋",
    scenarioText: "当朋友遇到困扰向你倾诉时，你觉得自己更擅长？",
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
    scenarioText: "聚会中，一个朋友因为手滑，把饮料洒在了自己身上，大家先是一愣，随即笑作一团。",
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
    scenarioText: "同样是在帮助遇到困扰的朋友时，你认为哪件事更消耗你的心力？",
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
    scenarioText: "请评估以下陈述与你的符合程度：我通常能敏锐地察觉到社交场合中微妙的氛围变化和他人未说出口的情绪。",
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
    scenarioText: "最后，请想象你理想中的一次完美社交活动。它最吸引你的核心是什么？",
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
    scenarioText: "周五晚上，你正准备享受一个人的放松时光，这时收到朋友的临时聚会邀请。",
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
    scenarioText: "聚会上大家都在自拍、发动态，气氛热闹。",
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
    scenarioText: "活动中有人无意中说了一句让你不太舒服的话。",
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
    scenarioText: "一次期待已久的活动因故取消了。",
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
    scenarioText: "工作中需要和一个不太熟悉的同事合作完成一个项目。",
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
    scenarioText: "在一个重要的工作会议上，主持人请大家分享想法。",
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
    scenarioText: "你需要学习一项全新的技能或知识。",
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
    scenarioText: "朋友说发现了一个很刺激但略有风险的新活动。",
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
    scenarioText: "周末约了朋友玩桌游，其中有个规则有点复杂的策略游戏。",
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
    scenarioText: "聚会上有人提议玩即兴表演游戏，随机抽题目现场表演。",
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
    scenarioText: "你说了句话把朋友们逗笑了。",
    questionText: "你的感觉是？",
    primaryTraits: ["P", "X", "A"],
    discriminationIndex: 0.44,
    options: [
      {
        value: "A",
        text: "超开心！继续抖包袱",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 3, P: 3 }
      },
      {
        value: "B",
        text: "有点小得意，自然流露就好",
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
      }
    ]
  },
  {
    id: "Q74",
    level: 2,
    category: "惊喜偏好",
    scenarioText: "朋友说给你准备了一个神秘惊喜，但要等几天才能揭晓。",
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

];
