/**
 * Archetype confusion-pair gates and signature thresholds.
 * Extracted from matcherV2.ts to keep the core matcher file under the
 * maintainability line-count threshold.
 */

import { TraitKey } from './types';

/**
 * 混淆对门控规则 - 针对已知的高混淆原型对
 * 当用户特质明确属于某一原型时，大幅抑制竞争原型的分数
 */
/**
 * V2.2 校准版：根据实际分数分布调整门控阈值
 */
export const CONFUSION_PAIR_GATES: Array<{
  trueArchetype: string;
  rivalArchetype: string;
  gate: (t: Record<TraitKey, number>) => number;
}> = [
  {
    // rooster vs dolphin_calm: 实际P分布 rooster74 vs 海豚55
    trueArchetype: "rooster",
    rivalArchetype: "dolphin_calm",
    gate: (t) => {
      if (t.P >= 78) return 0.2;
      if (t.P >= 72) return 0.4;
      if (t.P >= 68) return 0.6;
      return 1.0;
    }
  },
  {
    // dolphin_calm vs rooster: P<65的用户明显是dolphin_calm
    trueArchetype: "dolphin_calm",
    rivalArchetype: "rooster",
    gate: (t) => {
      if (t.P < 58 && t.X < 55) return 0.25; // 低P+低X强信号
      if (t.P < 62) return 0.4;
      if (t.P < 68) return 0.6;
      return 1.0;
    }
  },
  {
    // owl vs turtle: 实际O分布 猫头鹰75 vs 龟53
    trueArchetype: "owl",
    rivalArchetype: "turtle",
    gate: (t) => {
      if (t.O >= 75 && t.X < 45) return 0.15;
      if (t.O >= 72) return 0.35;
      if (t.O >= 68) return 0.55;
      return 1.0;
    }
  },
  {
    // turtle vs owl: O<60的用户明显是龟
    trueArchetype: "turtle",
    rivalArchetype: "owl",
    gate: (t) => {
      if (t.O < 58) return 0.3;
      if (t.O < 65) return 0.5;
      return 1.0;
    }
  },
  {
    // cat vs turtle: 实际X分布 cat28 vs 龟32
    trueArchetype: "cat",
    rivalArchetype: "turtle",
    gate: (t) => {
      if (t.X < 30 && t.A < 60) return 0.3;
      if (t.X < 35) return 0.6;
      return 1.0;
    }
  },
  {
    // fox vs corgi: 实际O分布 狐狸82 vs 柯基80
    trueArchetype: "fox",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.O >= 78 && t.X < 75) return 0.5;
      if (t.O >= 75) return 0.7;
      return 1.0;
    }
  },
  {
    // corgi vs rooster: 柯基X更高(84 vs 74)，P接近
    trueArchetype: "corgi",
    rivalArchetype: "rooster",
    gate: (t) => {
      if (t.X >= 82 && t.P >= 80) return 0.4; // 超高X+P是柯基
      if (t.X >= 80) return 0.6;
      return 1.0;
    }
  },
  {
    // rooster vs corgi: roosterA更高(84 vs 56)
    trueArchetype: "rooster",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.A >= 78 && t.X < 82) return 0.4;
      if (t.A >= 72) return 0.6;
      return 1.0;
    }
  },
  {
    // elephant vs turtle: 大象A更高(74 vs 60)
    trueArchetype: "elephant",
    rivalArchetype: "turtle",
    gate: (t) => {
      if (t.A >= 72 && t.P >= 38) return 0.4;
      if (t.A >= 68) return 0.6;
      return 1.0;
    }
  },
  {
    // hamster_praise vs rooster: hamster_praiseX更高(83 vs 74)
    trueArchetype: "hamster_praise",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.A >= 85) return 0.5;
      if (t.A >= 80) return 0.7;
      return 1.0;
    }
  },
  {
    // spider(C=88) vs dolphin_calm(C=70): 高C用户更可能是蜘蛛
    trueArchetype: "spider",
    rivalArchetype: "dolphin_calm",
    gate: (t) => {
      if (t.C >= 82) return 0.5;
      if (t.C >= 78) return 0.7;
      return 1.0;
    }
  },
  {
    // V2.3 FIX: corgi vs koala - 高X用户应该匹配柯基而非koala
    // corgi X:95, koala X:48 - 这是核心区分特质
    trueArchetype: "corgi",
    rivalArchetype: "koala",
    gate: (t) => {
      if (t.X >= 70) return 0.3; // High-X strongly favors 柯基
      if (t.X >= 65) return 0.5;
      if (t.X >= 60) return 0.7;
      return 1.0;
    }
  },
  {
    // V2.3 FIX: koala vs corgi - 低X用户应该匹配koala
    // koala X:48, corgi X:95
    trueArchetype: "koala",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.X < 50) return 0.3; // Low-X strongly favors koala
      if (t.X < 55) return 0.5;
      if (t.X < 60) return 0.7;
      return 1.0;
    }
  }
];

/**
 * Phase 1: 签名特质阈值 - 用于预过滤候选原型
 * 返回一个分数乘数：1.0=保留, <1.0=降权/排除
 */
export const SIGNATURE_THRESHOLDS: Record<string, (t: Record<TraitKey, number>) => number> = {
  "rooster": (t) => {
    // rooster的灵魂是P=92
    if (t.P >= 85) return 1.35;
    if (t.P >= 80) return 1.15;
    if (t.P >= 75) return 1.0;
    if (t.P >= 70) return 0.7;
    return 0.45;
  },
  "dolphin_calm": (t) => {
    // dolphin_calmP=68, E=85 - 高P用户不应匹配海豚
    if (t.P >= 85) return 0.35;
    if (t.P >= 80) return 0.55;
    if (t.P < 75 && t.E >= 78) return 1.25;
    return 1.0;
  },
  "owl": (t) => {
    // 猫头鹰O=88, X=40 - 高O低X是标志
    if (t.O >= 82 && t.X < 50) return 1.45;
    if (t.O >= 78 && t.X < 55) return 1.25;
    if (t.O >= 75) return 1.1;
    if (t.O < 72) return 0.5;
    return 1.0;
  },
  "turtle": (t) => {
    // 龟O=65 - 高O用户更像猫头鹰
    if (t.O >= 80) return 0.35;
    if (t.O >= 75) return 0.55;
    if (t.O < 70 && t.E >= 80) return 1.35;
    if (t.O < 72) return 1.15;
    return 1.0;
  },
  "cat": (t) => {
    // catX=25, A=40 - 极低社交
    if (t.X < 32 && t.A < 50) return 1.4;
    if (t.X < 38) return 1.1;
    if (t.X >= 55) return 0.4;
    return 1.0;
  },
  "koala": (t) => {
    // V2.3 FIX: HARD VETO for high-X users - koala A=90, X=48
    // This is a critical gate: X is the differentiator between koala and corgi
    if (t.X >= 75) return 0.1; // Near-VETO for very high-X users
    if (t.X >= 70) return 0.2; // Severe penalty
    if (t.X >= 65) return 0.3; // Strong penalty
    if (t.X >= 60) return 0.45; // Moderate penalty
    // Only apply A bonus if X is appropriate (low-X users)
    if (t.A >= 85 && t.X < 55) return 1.4; // High A + low X = strong match
    if (t.A >= 80 && t.X < 58) return 1.2;
    if (t.A >= 75) return 1.0;
    if (t.A < 72) return 0.6;
    return 1.0;
  },
  "fox": (t) => {
    // foxO=85 - 高开放性
    if (t.O >= 82) return 1.3;
    if (t.O >= 78) return 1.15;
    if (t.O < 70) return 0.5;
    return 1.0;
  },
  "octopus": (t) => {
    // 章鱼O=90, C=38 - 高开放低条理
    if (t.O >= 85 && t.C < 50) return 1.4;
    if (t.O >= 80) return 1.15;
    if (t.C >= 70) return 0.5;
    return 1.0;
  },
  "hamster_praise": (t) => {
    // hamster_praiseA=90, X=85 - 高亲和高社交
    if (t.A >= 85 && t.X >= 80) return 1.4;
    if (t.A >= 82) return 1.1;
    return 1.0;
  },
  "corgi": (t) => {
    // V2.3 FIX: 柯基X=95, P=85 - 高社交高正能量
    // Lower thresholds to capture more high-X users
    if (t.X >= 75 && t.P >= 65) return 1.4; // High X + moderate P = strong match
    if (t.X >= 70 && t.P >= 60) return 1.3;
    if (t.X >= 65) return 1.15; // Moderate boost for extroverts
    if (t.X >= 60) return 1.05;
    if (t.X < 55) return 0.5; // Penalty for low-X users
    return 1.0;
  },
  "elephant": (t) => {
    // 大象E=92 - 极高稳定性
    if (t.E >= 88) return 1.3;
    if (t.E >= 82) return 1.1;
    if (t.E < 75) return 0.5;
    return 1.0;
  },
  "spider": (t) => {
    // 蜘蛛C=88 - 高条理性
    if (t.C >= 85) return 1.25;
    if (t.C >= 78) return 1.1;
    if (t.C < 68) return 0.6;
    return 1.0;
  }
};
