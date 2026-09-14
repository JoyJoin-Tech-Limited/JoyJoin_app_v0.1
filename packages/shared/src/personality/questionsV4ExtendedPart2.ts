/**
 * V4 Adaptive Assessment - Extended Questions Part 2
 *
 * E/P precision items (Q136-Q149), the pure-E anchor (Q150), E/A bridge items
 * (Q151-Q153), and consistency-pair seconds (Q166-Q167). Extracted verbatim
 * from questionsV4Extended.ts to keep that module under the harness file-size
 * limit. The owning module spreads this array in at its original position, so
 * ordering and the exported API are unchanged.
 */

import { AdaptiveQuestion } from './types';

export const questionsV4ExtendedPart2: AdaptiveQuestion[] = [
  // ── E/P precision items (Q136-Q145) ─────────────────────────────
  // Plan Item 11 (2026-09-09): the latent-trait recovery harness baseline
  // showed E r=0.612 / P r=0.665 clean @16q with E/P the most sample-starved
  // traits (E 7.9, P 7.2 mean samples vs X 11.0). Existing E/P items dilute
  // the signal: nonzero loadings on only some options, multi-trait
  // primaryTraits, and cohort-tagged strong items that take a 0.7x utility
  // penalty for most users. These items are deliberately PURE single-trait:
  //   - primaryTraits lists exactly one trait so utility information gain
  //     tracks that trait's uncertainty undiluted;
  //   - every option carries a nonzero score on the target trait
  //     ({+3,+1,-1,-3}) so every answer yields a sample and option drift
  //     sums to zero (no acquiescence/inflation bias);
  //   - all other traits are 0 so a pick never disturbs other measurements;
  //   - no cohortTag (no 0.7x mismatch penalty) and a high
  //     discriminationIndex so the utility selector prefers them whenever
  //     E/P confidence trails the other traits.
  // Copy follows the WeChat review posture (no 匹配/社交/灵魂/撮合/AI).

  // E精度题1 - 情绪调节（插队）
  {
    id: "Q136",
    level: 2,
    category: "情绪调节",
    scenarioText: "排队等位时，有人若无其事地插到了你前面。",
    questionText: "你的第一反应更接近？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "提醒一句就好，对方让不让都不影响我吃饭的心情",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点不爽，但懒得计较，刷刷手机就过去了",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会郁闷好一会儿，吃饭的时候还在想这件事",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "特别来气，整晚的心情都被毁了",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E精度题2 - 压力应对（突降大雨）
  {
    id: "Q137",
    level: 2,
    category: "压力应对",
    scenarioText: "出门赴约，半路突然下起大雨，而你没带伞。",
    questionText: "你当时的内心状态是？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "小事一桩，找个地方躲躲，顺便看看雨也不错",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点狼狈，但湿了就湿了，到了再说",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会烦躁一阵子，觉得自己今天特别不顺",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "心态直接崩了，一整天都被这场雨毁掉",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E精度题3 - 临场应变（展示故障）
  {
    id: "Q138",
    level: 2,
    category: "临场应变",
    scenarioText: "你正在给大家展示准备很久的内容，设备突然卡住不动了。",
    questionText: "那一刻你的状态更接近？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "该修修该等等，还能顺手讲个笑话救场",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点尴尬，但深呼吸几下就能稳住",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "脑子嗡的一下，好一会儿都回不过神",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "慌到手脚发凉，之后很久都在回想这个画面",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E精度题4 - 反刍思维（消息未回）
  {
    id: "Q139",
    level: 3,
    category: "反刍思维",
    scenarioText: "你在意的人一直没有回你消息，已经过了大半天。",
    questionText: "你的脑子里通常在上演什么？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "对方大概在忙，我该干嘛干嘛，回了再说",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "偶尔会看一眼手机，但不影响手头的事",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会忍不住想，是不是自己哪句话说错了",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "反复翻看聊天记录，做什么都心神不宁",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E精度题5 - 情绪恢复（被泼冷水）
  {
    id: "Q140",
    level: 2,
    category: "情绪恢复",
    scenarioText: "你兴冲冲地分享一个想法，却被身边人泼了冷水。",
    questionText: "你一般需要多久消化这种感觉？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "转头就忘了，别人的评价影响不了我多久",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "当下有点失落，睡一觉就翻篇了",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会蔫一两天，干什么都提不起劲",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "会反复琢磨好几天，甚至开始怀疑自己",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // P精度题1 - 日常心境（周一早晨）
  {
    id: "Q141",
    level: 2,
    category: "日常心境",
    scenarioText: "周一早上，闹钟响了，你睁开眼。",
    questionText: "你心里的第一个念头通常是？",
    primaryTraits: ["P"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "新的一周开始了，说不定会有好事发生",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "虽然不想起，但起来之后状态还不错",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "又要开始循环了，有点提不起劲",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "一想到这一周的事就觉得很累",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -3 }
      }
    ]
  },

  // P精度题2 - 小确幸（再来一瓶）
  {
    id: "Q142",
    level: 2,
    category: "小确幸",
    scenarioText: "买饮料时，你发现瓶盖里写着「再来一瓶」。",
    questionText: "你的反应更接近？",
    primaryTraits: ["P"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "开心！这种小运气能让我乐呵一整天",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "挺高兴的，顺手就去换了一瓶",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "还好吧，就是一瓶饮料而已",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "没什么感觉，这种小事不值得在意",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -3 }
      }
    ]
  },

  // P精度题3 - 预期风格（没做过的事）
  {
    id: "Q143",
    level: 2,
    category: "预期风格",
    scenarioText: "你们打算尝试一件谁都没做过的事，朋友问你：「你觉得会顺利吗？」",
    questionText: "你的真实预期更接近？",
    primaryTraits: ["P"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "大概率会有意思，就算不成也能收获经验",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "谨慎乐观，准备充分的话应该问题不大",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "不太敢抱希望，免得到时候失望",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "直觉会出岔子，还没开始就在想退路",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -3 }
      }
    ]
  },

  // P精度题4 - 叙事基调（回顾半年）
  {
    id: "Q144",
    level: 3,
    category: "叙事基调",
    scenarioText: "夜深人静，你回顾过去这半年的生活。",
    questionText: "浮现在你脑海里的更多是？",
    primaryTraits: ["P"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "很多值得开心和感谢的片段",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "有起有落，但总体是在往上走的",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "平平淡淡，说不上好也说不上坏",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "各种遗憾和没做好的事情",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -3 }
      }
    ]
  },

  // P精度题5 - 评价框架（新餐厅一般）
  {
    id: "Q145",
    level: 2,
    category: "评价框架",
    scenarioText: "你第一次尝试一家新餐厅，味道只能算一般。",
    questionText: "之后跟朋友聊起这家店，你会怎么说？",
    primaryTraits: ["P"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "虽然味道一般，但发现新店的过程挺好玩",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "中规中矩吧，至少有个别菜还有亮点",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "不太行，应该不会再去第二次了",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "踩雷了，早知道就不该抱期待",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -3 }
      }
    ]
  },

  // ── E/P precision items batch 2 (Q146-Q149) ─────────────────────
  // Follow-up to Q136-Q145: harness showed the first batch raised P past
  // target but E needed more clean samples (selector saturates E confidence
  // quickly, so additional high-discrimination pure-E picks are required
  // before saturation sets in).

  // E精度题6 - 当众被指出错误
  {
    id: "Q146",
    level: 3,
    category: "情绪调节",
    scenarioText: "大家讨论时，有人当众指出了你犯的一个小错误。",
    questionText: "你内心的第一反应更接近？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "错了就改，被指出问题没什么大不了",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点不好意思，但很快就过去了",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "脸上挂不住，好一会儿都觉得别扭",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "特别难堪，之后一直在想大家会怎么看我",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E精度题7 - 时间压力（导航带错路）
  {
    id: "Q147",
    level: 2,
    category: "压力应对",
    scenarioText: "赴约路上，你发现导航把你带错了地方，而约定时间快到了。",
    questionText: "你当时的状态更接近？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "先发消息说明情况，再慢慢找路，急也没用",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点着急，但还能边走边想办法",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "心跳加速，越想越慌，脚步都乱了",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "整个人都紧绷了，到了之后很久都缓不过来",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E精度题8 - 深夜回想（反刍）
  {
    id: "Q148",
    level: 3,
    category: "反刍思维",
    scenarioText: "深夜躺下后，你突然想起白天一件有点尴尬的事。",
    questionText: "接下来通常会发生什么？",
    primaryTraits: ["E"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "笑一下就翻篇了，照常入睡",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "会想一小会儿，但很快就能睡着",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "翻来覆去想半天，睡眠质量受影响",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "越想越清醒，尴尬的画面在脑子里循环播放",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // P精度题6 - 意外的夸奖
  {
    id: "Q149",
    level: 3,
    category: "日常心境",
    scenarioText: "一个不太熟的人突然真诚地夸了你一句。",
    questionText: "这件事在你心里会停留多久？",
    primaryTraits: ["P"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "能开心好几天，想起来还会偷着乐",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 3 }
      },
      {
        value: "B",
        text: "当下挺暖的，这一天心情都不错",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 1 }
      },
      {
        value: "C",
        text: "礼貌谢谢对方，但转头就忘了",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -1 }
      },
      {
        value: "D",
        text: "反而会怀疑对方是不是客套话",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: -3 }
      }
    ]
  },

  // E锚点题（第9个锚点，纯E）- 出行意外
  // The bank previously defined only 8 anchors while the engine reserves 9
  // anchor slots (config.anchorQuestionCount=9), so slot 9 fell through to
  // utility selection. This pure-E anchor is guaranteed to be served to
  // every session, giving every respondent exactly one clean, full-range
  // E sample regardless of selector dynamics. Pure single-trait scoring
  // keeps it from disturbing the other anchors' X/C/O/A baselines.
  {
    id: "Q150",
    level: 1,
    category: "压力应对",
    scenarioText: "假期出行，到了车站才发现自己买错了票。",
    questionText: "你的第一反应更接近？",
    primaryTraits: ["E"],
    isAnchor: true,
    discriminationIndex: 0.5,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "改签或重新买一张就好，路上就当多看了一段风景",
        traitScores: { A: 0, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点懊恼，但解决问题要紧，先处理再说",
        traitScores: { A: 0, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会非常自责，一路上都在想自己怎么这么粗心",
        traitScores: { A: 0, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "心态崩了，觉得这趟出行全毁了",
        traitScores: { A: 0, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // ── E/A bridge items (Q151-Q153) ────────────────────────────────
  // Batch 3 raised r(E) to target but E mean samples (8.5) still trailed
  // the >=9 bar, and A became the least-sampled trait (6.0). These items
  // are E-dominant (full +-3 range on E, every option nonzero) with a
  // face-valid secondary A loading, and list both E and A as
  // primaryTraits so the utility selector values them whenever EITHER
  // trait's confidence trails - A's residual uncertainty is currently the
  // largest in the bank, which gets these (and their E samples) picked.
  // Copy blends warmth/forgiveness with equanimity so both loadings are
  // psychometrically defensible.

  // E/A桥接题1 - 被放鸽子（宽容x稳定）
  {
    id: "Q151",
    level: 2,
    category: "情绪调节",
    scenarioText: "约好一起吃饭，朋友临时说有事来不了了，这已经是第二次。",
    questionText: "你的第一反应更接近？",
    primaryTraits: ["E", "A"],
    discriminationIndex: 0.8,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "可能真的有急事，改天再约就好",
        traitScores: { A: 2, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "有点失落，但表示理解，另约时间",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "会觉得不被重视，回复明显变冷淡",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "很受伤，开始重新评估这段关系",
        traitScores: { A: -2, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E/A桥接题2 - 队友出错（宽容x稳定）
  {
    id: "Q152",
    level: 2,
    category: "压力应对",
    scenarioText: "小组展示时，队友负责的环节出了错，连累整个组被扣分。",
    questionText: "事后你更可能？",
    primaryTraits: ["E", "A"],
    discriminationIndex: 0.8,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "安慰队友没关系，大家一起补救过就好",
        traitScores: { A: 2, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "不怪队友，但会一起复盘下次怎么避免",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "嘴上不说，心里会有点耿耿于怀",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "很难释怀，之后不太想再和这个人一组",
        traitScores: { A: -2, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // E/A桥接题3 - 说话被打断（宽容x稳定）
  {
    id: "Q153",
    level: 2,
    category: "临场应变",
    scenarioText: "聊天时你正在兴头上，却被别人打断了两次。",
    questionText: "你通常会？",
    primaryTraits: ["E", "A"],
    discriminationIndex: 0.8,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "笑笑让对方先说，等下再接着聊",
        traitScores: { A: 2, C: 0, E: 3, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "稍微停顿一下，等对方说完再继续",
        traitScores: { A: 1, C: 0, E: 1, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "兴致被打断，后面就有点不想讲了",
        traitScores: { A: -1, C: 0, E: -1, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "心里很不舒服，干脆闭嘴听别人说",
        traitScores: { A: -2, C: 0, E: -3, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // ── Consistency-pair seconds (Plan Item 2, 2026-09-09) ──────────────
  // Graded twins of the pure calibration items Q53_PureC / Q52_PureO,
  // authored because the bank contains no existing near-paraphrase C/O
  // pairs. Served ONLY by the consistency scheduler's closing-phase
  // fallback when AssessmentConfig.enableConsistencyFolding is on; they are
  // excluded from the utility/alternative pools in BOTH flag states so
  // flag-off behavior is byte-identical to before they existed
  // (consistencyPairs.ts CONSISTENCY_ONLY_QUESTION_IDS).
  // Loading structures mirror their twins exactly (+2/+1/0/−2) so a
  // trait-faithful respondent answers both members at the same level.

  // C一致性题 - 承诺推进节奏（Q53_PureC 的同构题）
  {
    id: "Q166",
    level: 2,
    category: "承诺推进",
    scenarioText: "你答应朋友下个月的聚会由你来订地方，时间还很宽裕。",
    questionText: "你一般会怎么推进？",
    primaryTraits: ["C"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "这周就把候选地点和备选方案都整理好",
        traitScores: { A: 0, C: 2, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "先记在心里，这两周内找时间看一圈",
        traitScores: { A: 0, C: 1, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "看当时的安排，想起来就处理一下",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "临近约定日期再一口气搞定",
        traitScores: { A: 0, C: -3, E: 0, O: 0, X: 0, P: 0 }
      }
    ]
  },

  // O一致性题 - 陌生领域好奇心（Q52_PureO 的同构题）
  {
    id: "Q167",
    level: 2,
    category: "好奇驱动",
    scenarioText: "聊天时朋友兴致勃勃地聊起一个你完全没接触过的领域，比如观星或城市漫步路线考据。",
    questionText: "你的反应更接近？",
    primaryTraits: ["O"],
    discriminationIndex: 0.85,
    isForcedChoice: true,
    options: [
      {
        value: "A",
        text: "来了兴趣，回头自己查了一堆相关资料",
        traitScores: { A: 0, C: 0, E: 0, O: 2, X: 0, P: 0 }
      },
      {
        value: "B",
        text: "会顺着追问几个自己感兴趣的点",
        traitScores: { A: 0, C: 0, E: 0, O: 1, X: 0, P: 0 }
      },
      {
        value: "C",
        text: "听着觉得挺新鲜，但不会主动深挖",
        traitScores: { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 }
      },
      {
        value: "D",
        text: "礼貌附和两句，内容实在提不起劲",
        traitScores: { A: 0, C: 0, E: 0, O: -3, X: 0, P: 0 }
      }
    ]
  },
];
