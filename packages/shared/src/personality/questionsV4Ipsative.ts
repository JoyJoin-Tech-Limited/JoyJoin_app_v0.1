/**
 * V4 Adaptive Assessment - Ipsative (Forced-Choice) Item Module
 * 自适应性格测评 V4 - 等社会期许二选一题库（Q154-Q165）
 *
 * Plan Item 1 (2026-09-09): each item presents TWO options that are equally
 * socially desirable but load on RIVAL traits, so self-presentation bias
 * ("pick the flattering one") is removed by design — there is no flattering
 * one. Items ship dark: the selector only serves them when
 * AssessmentConfig.enableIpsativeItems === true.
 *
 * Authoring rules (enforced by scripts/simulate/audit-ipsative-sdi.ts):
 *   - exactly 2 options per item; both options carry a declared
 *     socialDesirabilityIndex (SDI, 0-100) and |SDI_a - SDI_b| <= 10;
 *   - primaryTraits lists exactly the two rivalry traits;
 *   - scores stay in -3..+3 (tighter than the legacy -4..+6 bank range);
 *   - copy passes the WeChat review posture (no 匹配/社交/灵魂/撮合/AI), no
 *     emoji, both options framed positively.
 *
 * SCORING RULE (zero-sum rival debit): the pole option credits its trait
 * +3 and applies a small -1 debit to the rivalry counterpart; the rival
 * option mirrors this (pole +1, rival -3), so across the two options every
 * trait sums to exactly 0 — a random answerer's expected drift is 0 on
 * every trait and the bank's total-score geometry is preserved. The two
 * options deliberately differ in diagnostic strength: the pole option is
 * strong evidence FOR its trait, the rival option is strong evidence
 * AGAINST the pole (unequal-information forced choice, cf. 2PL items with
 * different discrimination per statement).
 * processAnswer applies option.traitScores unchanged — there is deliberately
 * NO ipsative branch in the engine's scoring path; the debit is data, not
 * code. One ipsative answer therefore yields one sample on EACH rivalry
 * trait, which is how these items raise per-trait sample throughput inside
 * the unchanged 8-16 question budget.
 *
 * M4 EVIDENCE NOTE (2026-09-09, docs/reports/2026-09-09-ipsative-items-ab.md):
 * in the bias-free clean-arm answer model this mechanic cannot lift r(X)/r(P)
 * (binary samples displace magnitude-graded ones); it ships dark pending a
 * desirability-biased harness arm that can measure its actual purpose.
 * processAnswer applies option.traitScores unchanged — there is deliberately
 * NO ipsative branch in the engine's scoring path; the debit is data, not
 * code. One ipsative answer therefore yields one sample on EACH rivalry
 * trait, which is how these items raise per-trait sample throughput inside
 * the unchanged 8-16 question budget.
 *
 * SDI assignment approach (pre-launch): author-assigned face-validity
 * estimates — each statement is written to read as an equally respectable
 * self-description to a peer audience, then rated on a shared 65-78 band.
 * Within every pair the gap is kept <= 4. These are prior estimates, not
 * measurements; recalibrate against live desirability ratings post-launch.
 *
 * Rivalry coverage (>=2 per high-value rivalry, 4 each here):
 *   X↔A  Q154-Q157  energizer initiative vs. caretaking attunement
 *   P↔C  Q158-Q161  optimistic reframing vs. steady discipline
 *   O↔C  Q162-Q165  novelty/improvisation vs. structure/craft
 */

import { AdaptiveQuestion } from './types';

export const questionsV4Ipsative: AdaptiveQuestion[] = [

  // ── X↔A 二选一（Q154-Q157）─────────────────────────────────────
  // 外向带动 vs 亲和照顾：两个选项都是群体里受欢迎的角色。

  // X/A题1 - 聚会冷场
  {
    id: "Q154",
    level: 3,
    category: "群体角色",
    scenarioText: "聚会上话题忽然冷场，空气安静了几秒。",
    questionText: "你更自然地成为哪一种人？",
    primaryTraits: ["X", "A"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "主动抛出新话题，把场子重新热起来的人",
        traitScores: { A: -1, C: 0, E: 0, O: 0, X: 3, P: 0 },
        socialDesirabilityIndex: 74
      },
      {
        value: "B",
        text: "照顾还不太熟的人，让他们慢慢放松下来的人",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: -3, P: 0 },
        socialDesirabilityIndex: 72
      }
    ]
  },

  // X/A题2 - 新朋友融入
  {
    id: "Q155",
    level: 3,
    category: "群体角色",
    scenarioText: "常聚的小圈子里来了一位大家都不认识的新朋友。",
    questionText: "你通常会怎么帮他融入？",
    primaryTraits: ["X", "A"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "主动迎上去聊，几分钟就让他熟络起来",
        traitScores: { A: -1, C: 0, E: 0, O: 0, X: 3, P: 0 },
        socialDesirabilityIndex: 76
      },
      {
        value: "B",
        text: "留意他的兴趣，帮他接上聊得来的话题和人",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: -3, P: 0 },
        socialDesirabilityIndex: 74
      }
    ]
  },

  // X/A题3 - 旅行分工
  {
    id: "Q156",
    level: 3,
    category: "协作分工",
    scenarioText: "和朋友们出门旅行，大家商量各自负责什么。",
    questionText: "你最想认领的角色是？",
    primaryTraits: ["X", "A"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "气氛担当，路上负责把大家逗开心",
        traitScores: { A: -1, C: 0, E: 0, O: 0, X: 3, P: 0 },
        socialDesirabilityIndex: 70
      },
      {
        value: "B",
        text: "细心担当，记住每个人的忌口和需求",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: -3, P: 0 },
        socialDesirabilityIndex: 72
      }
    ]
  },

  // X/A题4 - 分享好消息
  {
    id: "Q157",
    level: 3,
    category: "分享方式",
    scenarioText: "你收到一个期待已久的好消息。",
    questionText: "你的第一反应更接近？",
    primaryTraits: ["X", "A"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "马上讲给身边的人听，把开心传染出去",
        traitScores: { A: -1, C: 0, E: 0, O: 0, X: 3, P: 0 },
        socialDesirabilityIndex: 73
      },
      {
        value: "B",
        text: "先想到一直支持自己的人，单独跟他分享",
        traitScores: { A: 1, C: 0, E: 0, O: 0, X: -3, P: 0 },
        socialDesirabilityIndex: 75
      }
    ]
  },

  // ── P↔C 二选一（Q158-Q161）─────────────────────────────────────
  // 乐观重构 vs 稳定自律：两种都是被欣赏的处世方式。

  // P/C题1 - 计划被打乱
  {
    id: "Q158",
    level: 3,
    category: "节奏偏好",
    scenarioText: "周末的安排临时被打乱了。",
    questionText: "你心里的第一反应更接近？",
    primaryTraits: ["P", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "说不定会有更有意思的展开，随遇而安",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 0, P: 3 },
        socialDesirabilityIndex: 71
      },
      {
        value: "B",
        text: "马上重新排一下，把能完成的部分做好",
        traitScores: { A: 0, C: 1, E: 0, O: 0, X: 0, P: -3 },
        socialDesirabilityIndex: 73
      }
    ]
  },

  // P/C题2 - 长期目标
  {
    id: "Q159",
    level: 3,
    category: "目标风格",
    scenarioText: "聊到一件要坚持半年才能看到成果的事。",
    questionText: "你更认同哪种做法？",
    primaryTraits: ["P", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "轻装上阵，相信过程里会有意外收获",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 0, P: 3 },
        socialDesirabilityIndex: 72
      },
      {
        value: "B",
        text: "列好每个阶段的小目标，一步步踩实",
        traitScores: { A: 0, C: 1, E: 0, O: 0, X: 0, P: -3 },
        socialDesirabilityIndex: 74
      }
    ]
  },

  // P/C题3 - 刚好带伞
  {
    id: "Q160",
    level: 3,
    category: "日常心境",
    scenarioText: "出门不久下起了雨，而你刚好带了伞。",
    questionText: "你心里闪过的念头更接近？",
    primaryTraits: ["P", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "今天运气不错，心情反而更好了",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 0, P: 3 },
        socialDesirabilityIndex: 69
      },
      {
        value: "B",
        text: "庆幸自己有提前看天气预报的习惯",
        traitScores: { A: 0, C: 1, E: 0, O: 0, X: 0, P: -3 },
        socialDesirabilityIndex: 69
      }
    ]
  },

  // P/C题4 - 睡前复盘
  {
    id: "Q161",
    level: 3,
    category: "叙事基调",
    scenarioText: "睡前躺下，回想这一天。",
    questionText: "你脑海里停留更久的是？",
    primaryTraits: ["P", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "那些让人嘴角上扬的瞬间",
        traitScores: { A: 0, C: -1, E: 0, O: 0, X: 0, P: 3 },
        socialDesirabilityIndex: 73
      },
      {
        value: "B",
        text: "今天完成了什么，明天先做什么",
        traitScores: { A: 0, C: 1, E: 0, O: 0, X: 0, P: -3 },
        socialDesirabilityIndex: 71
      }
    ]
  },

  // ── O↔C 二选一（Q162-Q165）─────────────────────────────────────
  // 好奇尝新 vs 结构章法：两种都是把事情做好的方式。

  // O/C题1 - 学新技能
  {
    id: "Q162",
    level: 3,
    category: "学习方式",
    scenarioText: "你打算学一样全新的技能。",
    questionText: "你更习惯怎么开始？",
    primaryTraits: ["O", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "直接上手试，边玩边找感觉",
        traitScores: { A: 0, C: -1, E: 0, O: 3, X: 0, P: 0 },
        socialDesirabilityIndex: 72
      },
      {
        value: "B",
        text: "先找好教程和步骤，稳扎稳打",
        traitScores: { A: 0, C: 1, E: 0, O: -3, X: 0, P: 0 },
        socialDesirabilityIndex: 74
      }
    ]
  },

  // O/C题2 - 新餐厅点菜
  {
    id: "Q163",
    level: 3,
    category: "尝鲜偏好",
    scenarioText: "和朋友去一家谁都没去过的餐厅。",
    questionText: "点菜时你更接近哪种风格？",
    primaryTraits: ["O", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "挑菜单上最陌生的一道，想尝尝新鲜",
        traitScores: { A: 0, C: -1, E: 0, O: 3, X: 0, P: 0 },
        socialDesirabilityIndex: 68
      },
      {
        value: "B",
        text: "点几道评价稳定的招牌菜，吃得踏实",
        traitScores: { A: 0, C: 1, E: 0, O: -3, X: 0, P: 0 },
        socialDesirabilityIndex: 70
      }
    ]
  },

  // O/C题3 - 布置新房间
  {
    id: "Q164",
    level: 3,
    category: "生活秩序",
    scenarioText: "你刚搬进一个新房间。",
    questionText: "布置这件事，你通常？",
    primaryTraits: ["O", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "随手先住起来，住出感觉了再慢慢调整",
        traitScores: { A: 0, C: -1, E: 0, O: 3, X: 0, P: 0 },
        socialDesirabilityIndex: 68
      },
      {
        value: "B",
        text: "先规划好收纳和动线，一次收拾到位",
        traitScores: { A: 0, C: 1, E: 0, O: -3, X: 0, P: 0 },
        socialDesirabilityIndex: 72
      }
    ]
  },

  // O/C题4 - 远期任务推进
  {
    id: "Q165",
    level: 3,
    category: "推进方式",
    scenarioText: "手上有一件期限还早、但迟早要完成的事。",
    questionText: "你的推进方式更接近？",
    primaryTraits: ["O", "C"],
    discriminationIndex: 0.92,
    isForcedChoice: true,
    questionType: "ipsative",
    options: [
      {
        value: "A",
        text: "灵感来了再一鼓作气，状态到位效率最高",
        traitScores: { A: 0, C: -1, E: 0, O: 3, X: 0, P: 0 },
        socialDesirabilityIndex: 70
      },
      {
        value: "B",
        text: "每天推进一点，提前完成才安心",
        traitScores: { A: 0, C: 1, E: 0, O: -3, X: 0, P: 0 },
        socialDesirabilityIndex: 74
      }
    ]
  },

];
