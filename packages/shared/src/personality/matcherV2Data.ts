/**
 * V4 Adaptive Assessment - MatcherV2 Data Tables
 * 纯数据模块：灵魂特质权重矩阵、原型专属调整规则、展示用 emoji/tagline 表
 *
 * Extracted verbatim from matcherV2.ts (2026-09-15) to keep the matcher module
 * under the harness file-size warn limit. No logic/weights/threshold changes.
 */

import { TraitKey } from './types';

/**
 * 12原型灵魂特质权重矩阵
 * primary: 核心特质 (权重2.0)
 * secondary: 次要特质 (权重1.5)
 * avoid: 应避免的特质 (权重降低)
 */
export const PROTOTYPE_SOUL_TRAITS: Record<string, {
  primary: Partial<Record<TraitKey, number>>;
  secondary: Partial<Record<TraitKey, number>>;
  avoid: Partial<Record<TraitKey, number>>;
}> = {
  // Reduced weights for Manhattan distance: primary 1.6-1.8, secondary 1.2-1.3, avoid 0.6-0.8
  "elephant": {
    primary: { E: 1.8 },
    secondary: { C: 1.3, A: 1.2 },
    avoid: { X: 0.7, O: 0.7 }
  },
  "spider": {
    primary: { C: 1.8 },
    secondary: { E: 1.3, A: 1.2 },
    avoid: { P: 0.7, X: 0.8 }
  },
  "rooster": {
    primary: { P: 1.8 },
    secondary: { E: 1.3, C: 1.2, X: 1.2 },
    avoid: { O: 0.6 }
  },
  "hamster_praise": {
    primary: { A: 1.7, X: 1.6 },
    secondary: { P: 1.3 },
    avoid: { C: 0.7, O: 0.8 }
  },
  "fox": {
    primary: { O: 1.8 },
    secondary: { X: 1.3, P: 1.2 },
    avoid: { A: 0.7, C: 0.7 }
  },
  "koala": {
    primary: { A: 1.8 },
    secondary: { E: 1.3, P: 1.2 },
    // V2.3 FIX: X avoid weight lowered to 0.4 for stronger penalty on high-X users
    avoid: { O: 0.7, X: 0.4 }
  },
  "turtle": {
    primary: { E: 1.8, C: 1.7 },
    secondary: { A: 1.2 },
    avoid: { X: 0.6, O: 0.6, P: 0.7 }
  },
  "corgi": {
    primary: { X: 1.7, P: 1.6 },
    secondary: { A: 1.3, E: 1.2 },
    avoid: { C: 0.8, O: 0.8 }
  },
  "owl": {
    primary: { O: 1.8 },
    secondary: { C: 1.3, E: 1.2 },
    avoid: { X: 0.6, A: 0.7, P: 0.7 }
  },
  "dolphin_calm": {
    primary: { E: 1.7, O: 1.5 },
    secondary: { A: 1.2 },
    avoid: { X: 0.7, P: 0.6 }
  },
  "cat": {
    primary: { E: 1.6 },
    secondary: { O: 1.2 },
    avoid: { X: 0.6, A: 0.6 }
  },
  "octopus": {
    primary: { O: 1.8 },
    secondary: { P: 1.3, X: 1.2 },
    avoid: { C: 0.6, E: 0.8 }
  }
};

/**
 * 原型专属调整规则 (返回乘数 0.3-1.3)
 * 1.0 = 中性, <1.0 = 惩罚, >1.0 = 加成
 * 规则更简单，依赖灵魂特质权重做主要区分
 *
 * ── P5c recalibration (2026-09-14, debiased measurement scale) ──
 * All user-trait thresholds re-derived from the measured per-archetype
 * distributions of the DEBIASED pipeline (K=80 members/archetype, clean
 * end-to-end; scripts/simulate/data/centroid-recalibration-latest.json).
 * Multiplier values and rule topology UNCHANGED — thresholds only.
 */
export const ARCHETYPE_VETO_RULES: Record<string, (traits: Record<TraitKey, number>) => number> = {
  "rooster": (t) => {
    // P是rooster的灵魂 — measured rooster P 83.5±3.8; P blows up to 86+ for non-rooster boundary members (P5c round 2): 87/82/68 → 88/85/68
    if (t.P >= 88) return 1.25;
    if (t.P >= 85) return 1.1;
    if (t.P < 68) return 0.5;
    return 1.0;
  },
  "dolphin_calm": (t) => {
    // measured dolphin P 76.7 / E 74.7 / X 76.3, rooster P 83.5 (P5c): P≥78→88 (P blows up to 86 for dolphin's own boundary members — the suppression must sit above the blow-up), boost E≥75&&X<55&&P<65 → E≥72&&X<80&&P<74, E≥72&&P<68 → E≥70&&P<76
    if (t.P >= 88) return 0.5; // 高P更像rooster
    if (t.E >= 72 && t.X < 80 && t.P < 74) return 1.25; // 强化低X信号
    if (t.E >= 70 && t.P < 76) return 1.1;
    return 1.0;
  },
  "owl": (t) => {
    // 猫头鹰核心: 高O + 低X — measured owl O 73.2±11.9 / X 46.8±14.4 (P5c): O 75/70/65 → 68/62/50, X<45→40, X>55→60; O<50→0.5 → O<42→0.5 (round 2: the 50/50 owl-octopus blend measures O≈45 and must not be crushed)
    if (t.O >= 68 && t.X < 40) return 1.35;
    if (t.O >= 62) return 1.15;
    if (t.O < 42) return 0.5;
    if (t.X > 60) return 0.6;
    return 1.0;
  },
  "turtle": (t) => {
    // 龟核心: 高E+C + 低X + 低O — measured turtle O 37.8 / X 24.2 (P5c): O>72/>68 → >60/>50, X<38&&O<60 → X<30&&O<45
    if (t.O > 60) return 0.4; // 高O更像猫头鹰
    if (t.O > 50) return 0.6;
    if (t.X < 30 && t.O < 45) return 1.3;
    return 1.0;
  },
  "fox": (t) => t.O >= 88 ? 1.15 : (t.O < 72 ? 0.5 : 1.0), // P5c round 2: measured fox O 78–87 (mean 87.2±5.3); O≥88 keeps the boost off octopus's centroid (O=87) so octopus wins its own isolation past the 100-clamp tie
  "octopus": (t) => {
    // measured octopus O 78–87 / C 28–31 (C is the distinctive channel; fox C=35, corgi C=35): O≥82&&C<60 → O≥78&&C<34, C>65→62
    if (t.O >= 78 && t.C < 34) return 1.2;
    if (t.C > 62) return 0.7;
    return 1.0;
  },
  "cat": (t) => {
    // measured cat X 22.1±5.7 / A 36.7 (P5c): X<35&&A<60 → X<28&&A<48, X>50→40
    if (t.X < 28 && t.A < 48) return 1.2;
    if (t.X > 40) return 0.5;
    return 1.0;
  },
  "koala": (t) => {
    // measured koala X 54.0±18.4 / A 84.1±12.1 vs high-X archetypes 92–98 (P5c): X 85/75/65/58 → 95/88/78/68 (blown-X boundary members reach 86–92 — veto targets the true high-X cluster); A<68→0.6 → A<70→0.45 (P5c round 2: center-cloud koala basin 17.7% > 13% drift-gate cap — stronger center rejection; ~12% of genuine koala members sit below 70 and retain their base-distance advantage)
    if (t.X >= 95) return 0.15; // Near-VETO for very high-X users
    if (t.X >= 88) return 0.25; // Severe penalty
    if (t.X >= 78) return 0.35; // Strong penalty
    if (t.X >= 68) return 0.5; // Moderate penalty
    // Only give bonus for A if X is appropriate (low-X users)
    if (t.A >= 78 && t.X < 50) return 1.15;
    if (t.A < 70) return 0.45;
    return 1.0;
  },
  "hamster_praise": (t) => {
    // measured hamster A 44–67 (A saturates under high X) / X 95.3 (P5c): A≥70&&X≥88 → A≥42&&X≥92, A≥64&&X≥80 → A≥38&&X≥85 → A≥42&&X≥85 (round 2: the A≥38 tier boosted hamster for rooster's own blown-X persona, A=39)
    if (t.A >= 42 && t.X >= 92) return 1.2;
    if (t.A >= 42 && t.X >= 85) return 1.1;
    return 1.0;
  },
  "corgi": (t) => {
    // measured corgi X 95.6±2.5 / P 82.5±3.8 (P5c): X 75/70/65/60 → 92/88/82/70, P 70/65/60 → 78/72/68, X<55 → X<55 (low-X penalty region unchanged — nobody measures below 55 on the new scale except turtle/cat/owl X)
    if (t.X >= 92 && t.P >= 78) return 1.3; // Strong match for high-X + good-P
    if (t.X >= 88 && t.P >= 72) return 1.2; // Good match
    if (t.X >= 82 && t.P >= 68) return 1.1; // Moderate match
    if (t.X >= 70) return 1.05; // Slight boost for extroverts
    if (t.X < 55) return 0.6; // Penalty for low-X users
    return 1.0;
  },
  "elephant": (t) => {
    // measured elephant E 68.2±10.7 / A 63.8±19.2 / P 46.5±19.1 / X 42.3, turtle X 24.2 / P 26.8 (P5c): X<32→30, P<38→35, E≥76&&A≥70&&P≥40 → E≥72&&A≥68&&P≥42, E≥75→68, E<72→58
    if (t.X < 30) return 0.5; // Very low X is turtle territory
    if (t.P < 35) return 0.6; // Very low P is turtle territory
    if (t.E >= 72 && t.A >= 68 && t.P >= 42) return 1.25;
    if (t.E >= 68) return 1.1;
    if (t.E < 58) return 0.6;
    return 1.0;
  },
  "spider": (t) => {
    // measured spider C 74.7±10.2 / E 55.1, dolphin E 74.7 (P5c): E≥78→72, C≥73→74, C<60→64
    if (t.E >= 72) return 0.5; // Very high E is dolphin_calm territory
    if (t.C >= 74) return 1.1;
    if (t.C < 64) return 0.6;
    return 1.0;
  }
};

export const ARCHETYPE_EMOJI: Record<string, string> = {
  "corgi": "🐕",
  "rooster": "🐔",
  "hamster_praise": "🐷",
  "fox": "🦊",
  "dolphin_calm": "🐬",
  "spider": "🕷️",
  "koala": "🐻",
  "octopus": "🐙",
  "owl": "🦉",
  "elephant": "🐘",
  "turtle": "🐢",
  "cat": "🐱"
};

export const ARCHETYPE_TAGLINE: Record<string, string> = {
  "corgi": "快乐感染者，派对灵魂",
  "rooster": "积极阳光，热情洋溢",
  "hamster_praise": "暖场达人，社交催化剂",
  "fox": "灵动聪慧，观察敏锐",
  "dolphin_calm": "从容不迫，温和可靠",
  "spider": "细心周到，默默付出",
  "koala": "温暖陪伴，善解人意",
  "octopus": "创意无限，思维跳跃",
  "owl": "深度思考，洞察本质",
  "elephant": "稳重可靠，值得信赖",
  "turtle": "踏实内敛，专注当下",
  "cat": "独立自在，享受独处"
};
