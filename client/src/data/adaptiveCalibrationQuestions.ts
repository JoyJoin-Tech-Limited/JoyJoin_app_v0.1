/**
 * 自适应校准题库 V7.2
 * 
 * 设计原理：
 * 在Q6后（中点），根据用户当前特质分布，插入针对性的校准题
 * 目的是增强对"弱信号"特质的区分能力
 * 
 * V7.2 弱信号检测：
 * - 归一化公式限制：有曝光(>=1)时分数范围是56-75
 * - 弱信号条件：曝光=1次 + 分数=56（归一化最低值）
 * - 预期触发率：约30%（基于2000用户模拟验证）
 * 
 * 优先级排序：O > X > P > E > C > A
 * （基于Q1-Q6特质曝光分析，O维度曝光最少）
 */

import type { TraitScores, QuestionV2 } from "./personalityQuestionsV2";

// 基准分数 - 50分代表中性
const BASELINE = 50;
// V7.2 弱信号检测配置
// 归一化公式限制：有曝光(>=1)时分数范围是56-75
// 弱信号特质：极低曝光(仅1次) + 最低分(仅56)
const WEAK_SIGNAL_SCORE_MAX = 56;    // 弱信号分数上限（仅最低值56）
const LOW_EXPOSURE_MAX = 1;           // 低曝光定义（仅1次曝光）
const MIN_EXPOSURE_COUNT = 1;         // 最小曝光次数

/**
 * 校准题 - 每个针对特定维度
 * 这些题目会根据用户当前分数动态插入
 */
export const calibrationQuestions: Record<string, QuestionV2> = {
  // X (外向性) 校准题
  X: {
    id: 101,
    category: "校准：外向性",
    scenarioText: "🎤 朋友说你唱歌好听，KTV里大家起哄让你唱...",
    questionText: "你的第一反应是？",
    questionType: "single",
    options: [
      {
        value: "A",
        text: "「好！来首拿手的！」直接站到C位开嗓",
        traitScores: { X: 4, P: 2 },
        tag: "舞台享受"
      },
      {
        value: "B",
        text: "「一起唱吧！」拉几个人合唱分散注意力",
        traitScores: { A: 2, X: 2 },
        tag: "分散焦点"
      },
      {
        value: "C",
        text: "「我来点歌！」把麦克风递给别人自己当点歌员",
        traitScores: { A: 1, C: 2 },
        tag: "幕后支持"
      },
      {
        value: "D",
        text: "「我嗓子不舒服...」找理由婉拒",
        traitScores: { E: 2, C: 1 },
        tag: "回避关注"
      },
    ],
  },

  // P (积极性) 校准题
  P: {
    id: 102,
    category: "校准：积极性",
    scenarioText: "⛈️ 期待已久的户外活动，出门发现下雨了...",
    questionText: "你的反应是？",
    questionType: "single",
    options: [
      {
        value: "A",
        text: "「雨中漫步也很浪漫！」反而觉得是惊喜",
        traitScores: { O: 2, P: 4 },
        tag: "逆境乐观"
      },
      {
        value: "B",
        text: "「看场电影也不错～」快速切换备选方案",
        traitScores: { E: 2, P: 2 },
        tag: "灵活应变"
      },
      {
        value: "C",
        text: "「有点可惜...不过下周再约」平静接受",
        traitScores: { E: 2, C: 1 },
        tag: "平和接受"
      },
      {
        value: "D",
        text: "「怎么这么倒霉...」心情有点低落",
        traitScores: { C: 1, E: 1 },
        tag: "失望沮丧"
      },
    ],
  },

  // A (亲和力) 校准题
  A: {
    id: 103,
    category: "校准：亲和力",
    scenarioText: "🛒 排队时后面有人轻轻碰了你一下没道歉...",
    questionText: "你的内心反应是？",
    questionType: "single",
    options: [
      {
        value: "A",
        text: "转身友善一笑，心想「可能没注意」",
        traitScores: { A: 4, P: 1 },
        tag: "善意推测"
      },
      {
        value: "B",
        text: "没什么感觉，继续玩手机",
        traitScores: { E: 2, C: 1 },
        tag: "无感忽略"
      },
      {
        value: "C",
        text: "心里有点不舒服，但不至于计较",
        traitScores: { E: 1, A: 1 },
        tag: "轻微介意"
      },
      {
        value: "D",
        text: "回头看一眼，希望对方意识到",
        traitScores: { C: 2, X: 1 },
        tag: "期待自觉"
      },
    ],
  },

  // O (开放性) 校准题
  O: {
    id: 104,
    category: "校准：开放性",
    scenarioText: "📱 朋友推荐了一个你从没听过的小众APP...",
    questionText: "你会？",
    questionType: "single",
    options: [
      {
        value: "A",
        text: "「有意思！」立刻下载研究功能",
        traitScores: { O: 4, X: 1 },
        tag: "即刻探索"
      },
      {
        value: "B",
        text: "先问问有什么特别的，再决定要不要试",
        traitScores: { O: 2, C: 1 },
        tag: "了解再说"
      },
      {
        value: "C",
        text: "收藏链接，有空再说",
        traitScores: { C: 2, E: 1 },
        tag: "暂时搁置"
      },
      {
        value: "D",
        text: "「用惯了现在的就好」不太想折腾",
        traitScores: { C: 2, E: 2 },
        tag: "维持现状"
      },
    ],
  },

  // E (情绪稳定) 校准题
  E: {
    id: 105,
    category: "校准：情绪稳定",
    scenarioText: "💬 工作群里老板突然@你，要你马上汇报进度...",
    questionText: "你的第一反应是？",
    questionType: "single",
    options: [
      {
        value: "A",
        text: "深呼吸，冷静整理好信息再回复",
        traitScores: { E: 4, C: 2 },
        tag: "镇定从容"
      },
      {
        value: "B",
        text: "心跳加速但很快平复，开始写回复",
        traitScores: { E: 2, C: 2 },
        tag: "短暂紧张"
      },
      {
        value: "C",
        text: "有点慌，反复检查确认再发送",
        traitScores: { C: 2, E: 1 },
        tag: "谨慎焦虑"
      },
      {
        value: "D",
        text: "紧张到打字都在抖，担心出错",
        traitScores: { A: 1, C: 1 },
        tag: "高度紧张"
      },
    ],
  },

  // C (责任心) 校准题
  C: {
    id: 106,
    category: "校准：责任心",
    scenarioText: "📋 项目deadline还有一周，你已完成80%...",
    questionText: "接下来你会？",
    questionType: "single",
    options: [
      {
        value: "A",
        text: "列详细计划，每天完成一点确保按时交付",
        traitScores: { C: 4, E: 1 },
        tag: "有序推进"
      },
      {
        value: "B",
        text: "先休息两天，最后两天集中冲刺",
        traitScores: { P: 2, O: 1 },
        tag: "张弛有度"
      },
      {
        value: "C",
        text: "随缘，反正差不多了",
        traitScores: { E: 2, P: 1 },
        tag: "随遇而安"
      },
      {
        value: "D",
        text: "继续优化打磨，争取超预期完成",
        traitScores: { C: 3, O: 1 },
        tag: "追求卓越"
      },
    ],
  },
};

/**
 * 计算当前特质分数（基于已答题目）
 * 返回归一化到0-100的分数和曝光次数
 */
export interface TraitScoresWithExposure {
  scores: TraitScores;
  counts: TraitScores;
}

export function calculateCurrentTraitScores(
  answers: Record<number, { traitScores: TraitScores; secondTraitScores?: TraitScores }>
): TraitScoresWithExposure {
  const totals: TraitScores = { A: 0, O: 0, C: 0, E: 0, X: 0, P: 0 };
  const counts: TraitScores = { A: 0, O: 0, C: 0, E: 0, X: 0, P: 0 };

  Object.values(answers).forEach(answer => {
    // 主选项权重1.0
    if (answer.traitScores) {
      Object.entries(answer.traitScores).forEach(([trait, score]) => {
        totals[trait as keyof TraitScores] = (totals[trait as keyof TraitScores] || 0) + score;
        counts[trait as keyof TraitScores] = (counts[trait as keyof TraitScores] || 0) + 1;
      });
    }
    // 副选项权重0.5（如果存在）
    if (answer.secondTraitScores) {
      Object.entries(answer.secondTraitScores).forEach(([trait, score]) => {
        totals[trait as keyof TraitScores] = (totals[trait as keyof TraitScores] || 0) + score * 0.5;
        counts[trait as keyof TraitScores] = (counts[trait as keyof TraitScores] || 0) + 0.5;
      });
    }
  });

  // 归一化到0-100 (基准50)
  const normalized: TraitScores = {};
  Object.keys(totals).forEach(trait => {
    const t = trait as keyof TraitScores;
    const avg = counts[t] ? totals[t]! / counts[t]! : 0;
    // 假设单题最高得分为4，将平均值映射到50±25的范围
    normalized[t] = Math.round(BASELINE + (avg / 4) * 25);
  });

  return { scores: normalized, counts };
}

/**
 * V7.2 检测"弱信号"特质
 * 弱信号定义：低曝光(仅1次) + 分数接近最低值(56)
 * 这些特质需要校准题来增强信号强度
 */
export function detectUncertainTraits(
  scores: TraitScores, 
  counts: TraitScores
): (keyof TraitScores)[] {
  const weakSignal: (keyof TraitScores)[] = [];
  
  Object.entries(scores).forEach(([trait, score]) => {
    const t = trait as keyof TraitScores;
    const exposure = counts[t] || 0;
    
    // V7.2 弱信号检测：
    // 1. 曝光次数在1次（有数据但极少）
    // 2. 分数为56（归一化公式最低值）
    if (score !== undefined && 
        exposure >= MIN_EXPOSURE_COUNT &&
        exposure <= LOW_EXPOSURE_MAX &&
        score <= WEAK_SIGNAL_SCORE_MAX) {
      weakSignal.push(t);
    }
  });

  return weakSignal;
}

/**
 * V7.2 获取最需要校准的特质
 * 策略：多个弱信号特质时，按优先级排序
 */
export function getMostNeededCalibration(
  weakSignalTraits: (keyof TraitScores)[], 
  scores: TraitScores
): keyof TraitScores | null {
  if (weakSignalTraits.length === 0) return null;
  
  // 优先级排序（基于V6.1分析：O维度在Q1-Q6中曝光最少）
  const priority: (keyof TraitScores)[] = ['O', 'X', 'P', 'E', 'C', 'A'];
  
  // 按优先级排序
  const sorted = [...weakSignalTraits].sort((a, b) => {
    return priority.indexOf(a) - priority.indexOf(b);
  });
  
  return sorted[0] || null;
}

/**
 * V7.2 主函数：判断是否需要插入校准题，并返回对应题目
 * 在Q6回答后调用
 * 
 * 弱信号检测条件：曝光=1次 + 分数=56（归一化最低值）
 */
export function getCalibrationQuestion(
  answers: Record<number, { traitScores: TraitScores; secondTraitScores?: TraitScores }>
): QuestionV2 | null {
  // 计算当前特质分数和曝光次数
  const { scores: currentScores, counts } = calculateCurrentTraitScores(answers);
  
  // V7.2: 检测弱信号特质（低曝光+低分数）
  const weakSignalTraits = detectUncertainTraits(currentScores, counts);
  
  // 如果没有弱信号特质，不需要校准
  if (weakSignalTraits.length === 0) {
    console.log('📊 V7.2: 所有特质信号明确，无需校准');
    console.log('   分数:', currentScores);
    console.log('   曝光:', counts);
    return null;
  }
  
  console.log('📊 V7.2: 检测到弱信号特质:', weakSignalTraits);
  console.log('   分数:', currentScores);
  console.log('   曝光:', counts);
  
  // V7.2: 获取最需要校准的特质（按优先级）
  const targetTrait = getMostNeededCalibration(weakSignalTraits, currentScores);
  
  if (!targetTrait || !calibrationQuestions[targetTrait]) {
    return null;
  }
  
  console.log('📝 V7.2: 插入校准题，目标维度:', targetTrait);
  
  return calibrationQuestions[targetTrait];
}

/**
 * 开发环境：打印校准题覆盖度
 */
if (import.meta.env?.DEV) {
  console.log('📋 自适应校准题库已加载');
  console.log('📊 可校准维度:', Object.keys(calibrationQuestions));
}
