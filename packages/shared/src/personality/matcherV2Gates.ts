/**
 * Archetype confusion-pair gates and signature thresholds.
 * Extracted from matcherV2.ts to keep the core matcher file under the
 * maintainability line-count threshold.
 *
 * ── P5c recalibration (2026-09-14, debiased measurement scale) ──
 * Every numeric threshold below was re-derived from the measured per-archetype
 * trait distributions of the DEBIASED V4 pipeline (P5b, d5ab60f95): K=80
 * idealized members per archetype, clean end-to-end sessions
 * (scripts/simulate/recalibrate-centroids.ts; mean±sd evidence in
 * scripts/simulate/data/centroid-recalibration-latest.json). Gate topology,
 * multiplier values (0.15–1.45), and tier structure are UNCHANGED — only the
 * user-trait thresholds moved, from the old biased scale to the 50-centered
 * debiased scale. Each rule carries its old→new mapping + evidence comment.
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
    // rooster vs dolphin_calm: measured P rooster 83.5±3.8 vs dolphin 76.7±12.6 (P5c)
    // thresholds 78/72/68 → 90/87/84 (round 2: P blows up to 86 for dolphin's own
    // boundary members — the suppression tiers must sit above the blow-up or they
    // crush genuine dolphin-side users; rooster members still clear 84 at ~45%)
    trueArchetype: "rooster",
    rivalArchetype: "dolphin_calm",
    gate: (t) => {
      if (t.P >= 90) return 0.2;
      if (t.P >= 87) return 0.4;
      if (t.P >= 84) return 0.6;
      return 1.0;
    }
  },
  {
    // dolphin_calm vs rooster: measured dolphin P 76.7 / X 76.3 vs rooster P 83.5 / X 83.3
    // thresholds P<58&&X<55 / P<62 / P<68 → P<80&&X<79 / P<79 / P<77 (P5c)
    trueArchetype: "dolphin_calm",
    rivalArchetype: "rooster",
    gate: (t) => {
      if (t.P < 80 && t.X < 79) return 0.25; // 低P+低X强信号
      if (t.P < 79) return 0.4;
      if (t.P < 77) return 0.6;
      return 1.0;
    }
  },
  {
    // owl vs turtle: measured owl O 73.2±11.9 vs turtle 37.8±8.0, owl X 46.8±14.4
    // thresholds O≥75&&X<45 / O≥72 / O≥68 → O≥48&&X<40 / O≥45 / O≥42 (P5c round 2:
    // lowered so the 50/50 owl-octopus blend vector (O≈45) still suppresses turtle;
    // turtle members O 37.8±8.0 rarely reach 42, and turtle's base-distance
    // advantage absorbs the mild 0.55 tier)
    trueArchetype: "owl",
    rivalArchetype: "turtle",
    gate: (t) => {
      if (t.O >= 48 && t.X < 40) return 0.15;
      if (t.O >= 45) return 0.35;
      if (t.O >= 42) return 0.55;
      return 1.0;
    }
  },
  {
    // turtle vs owl: measured turtle O 37.8 vs owl 73.2
    // thresholds O<58 / O<65 → O<45 / O<55 (P5c)
    trueArchetype: "turtle",
    rivalArchetype: "owl",
    gate: (t) => {
      if (t.O < 45) return 0.3;
      if (t.O < 55) return 0.5;
      return 1.0;
    }
  },
  {
    // cat vs turtle: measured turtle C 77.4±7.4 / E 74.0±8.1, cat X 22.1±5.7 / A 36.7
    // (P5c) escape C≥75||E≥78 → C≥68||E≥90: the E escape protected old-scale turtle
    // (E≈82) but cat members now measure E 70–84 too, so the E escape is raised to
    // ≈inert (E max measured ≈89) and C (the real separator: turtle 77 vs cat 54)
    // lowered to cover turtle's exact-persona vector (C=70).
    trueArchetype: "cat",
    rivalArchetype: "turtle",
    gate: (t) => {
      if (t.C >= 68 || t.E >= 90) return 1.0; // High C/E → likely turtle, don't suppress
      if (t.X < 30 && t.A < 55) return 0.3;
      if (t.X < 35) return 0.6;
      return 1.0;
    }
  },
  {
    // turtle vs cat: measured turtle C 77.4 / E 74.0 (old-scale C≈90/E≈82 compressed)
    // thresholds C≥80/C≥75/E≥78&&C≥70/E≥75&&C≥65 → C≥75/C≥70/E≥72&&C≥70/E≥68&&C≥65 (P5c:
    // turtle exact-persona C=70 must suppress cat; cat C 54±13.7 rarely reaches 70)
    trueArchetype: "turtle",
    rivalArchetype: "cat",
    gate: (t) => {
      if (t.C >= 75) return 0.25;
      if (t.C >= 70) return 0.35;
      if (t.E >= 72 && t.C >= 70) return 0.4;
      if (t.E >= 68 && t.C >= 65) return 0.5;
      return 1.0;
    }
  },
  {
    // fox vs corgi: measured fox O 78–87 / corgi O 78 — O no longer separates by
    // itself; the O≥84 tier sits above corgi's blob vector (O=78) so fox/octopus
    // centroids (O 85/87) suppress corgi and win their own isolation (P5c round 2)
    trueArchetype: "fox",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.O >= 84 && t.X < 90) return 0.5;
      if (t.O >= 84) return 0.7;
      return 1.0;
    }
  },
  {
    // corgi vs rooster: measured corgi X 95.6±2.5 vs rooster X 83.3±9.2 (P no longer separates: 82.5 vs 83.5)
    // thresholds X≥82&&P≥80 / X≥80 → X≥93&&P≥78 / X≥90&&P≥80 (P5c round 2: the plain
    // X≥90 tier suppressed rooster for its OWN blown-X members — rooster's measured
    // X reaches 97 while its P stays ≤83·(1−1σ); requiring P≥80 keeps the tier
    // aimed at the corgi blob, P=82–88)
    trueArchetype: "corgi",
    rivalArchetype: "rooster",
    gate: (t) => {
      if (t.X >= 93 && t.P >= 78) return 0.4; // 超高X+P是柯基
      if (t.X >= 90 && t.P >= 80) return 0.6;
      return 1.0;
    }
  },
  {
    // rooster vs corgi: measured rooster A 55.9±13.7 vs corgi A 40.9±5.3 (A still separates)
    // thresholds A≥78&&X<82 / A≥72 → A≥60&&X<88 / A≥52 (P5c)
    trueArchetype: "rooster",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.A >= 60 && t.X < 88) return 0.4;
      if (t.A >= 52) return 0.6;
      return 1.0;
    }
  },
  {
    // elephant vs turtle: measured elephant A 63.8±19.2 / P 46.5±19.1 vs turtle A 40.2±11.2 / P 26.8±7.1
    // thresholds A≥68&&P≥42 / A≥64 → A≥58&&P≥38 / A≥52 (P5c)
    trueArchetype: "elephant",
    rivalArchetype: "turtle",
    gate: (t) => {
      // Threshold must be <= elephant's actual A (63.8) to catch genuine elephant users
      if (t.A >= 58 && t.P >= 38) return 0.4;
      if (t.A >= 52) return 0.6;
      return 1.0;
    }
  },
  {
    // hamster_praise vs corgi: measured hamster A 44–67 (A saturates under high X) vs
    // corgi A 35 (P5c): A≥82/75 → A≥48/42 — suppresses corgi inside hamster's A band
    // (corgi/hamster share the X≈96 attractor; A is the only separator there)
    trueArchetype: "hamster_praise",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.A >= 48) return 0.5;
      if (t.A >= 42) return 0.7;
      return 1.0;
    }
  },
  {
    // spider vs dolphin_calm: measured spider C 74.7±10.2 vs dolphin C 62.5±10.6
    // thresholds C≥82 / C≥78 → C≥72 / C≥68 (P5c)
    trueArchetype: "spider",
    rivalArchetype: "dolphin_calm",
    gate: (t) => {
      if (t.C >= 72) return 0.5;
      if (t.C >= 68) return 0.7;
      return 1.0;
    }
  },
  {
    // corgi vs koala: measured corgi X 95.6±2.5 vs koala X 54.0±18.4 — X remains the decisive differentiator
    // thresholds X≥70 / X≥65 / X≥60 → X≥80 / X≥70 / X≥60 (P5c)
    trueArchetype: "corgi",
    rivalArchetype: "koala",
    gate: (t) => {
      if (t.X >= 80) return 0.3; // High-X strongly favors 柯基
      if (t.X >= 70) return 0.5;
      if (t.X >= 60) return 0.7;
      return 1.0;
    }
  },
  {
    // koala vs corgi: measured koala X 54.0±18.4 vs corgi X 95.6±2.5
    // thresholds X<50 / X<55 / X<60 → X<50 / X<58 / X<65 (corgi X never <65 on debiased scale)
    trueArchetype: "koala",
    rivalArchetype: "corgi",
    gate: (t) => {
      if (t.X < 50) return 0.3; // Low-X strongly favors koala
      if (t.X < 58) return 0.5;
      if (t.X < 65) return 0.7;
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
    // rooster的灵魂是P — measured rooster P 83.5±3.8; P blows up to 86+ for non-rooster boundary members, so the boost tiers sit above the blow-up (P5c round 2): 87/83/79/72 → 90/88/84/72
    if (t.P >= 90) return 1.35;
    if (t.P >= 88) return 1.15;
    if (t.P >= 79) return 1.0;
    if (t.P >= 72) return 0.7;
    return 0.45;
  },
  "dolphin_calm": (t) => {
    // measured dolphin P 76.7 / E 74.7 vs rooster P 83.5 (P5c): P≥85→90, P≥80→88, boost P<75&&E≥78 → P<74&&E≥72 (round 2: P blows up to 86 for dolphin's own boundary members — suppression tiers must sit above the blow-up)
    if (t.P >= 90) return 0.35;
    if (t.P >= 88) return 0.55;
    if (t.P < 74 && t.E >= 72) return 1.25;
    return 1.0;
  },
  "owl": (t) => {
    // 猫头鹰高O低X是标志 — measured owl O 73.2±11.9 / X 46.8±14.4, turtle O 37.8 (P5c): O 82/78/75/72 → 68/62/55/45, X 50/55 → 40/48
    if (t.O >= 68 && t.X < 40) return 1.45;
    if (t.O >= 62 && t.X < 48) return 1.25;
    if (t.O >= 55) return 1.1;
    if (t.O < 45) return 0.5;
    return 1.0;
  },
  "turtle": (t) => {
    // 龟低O — measured turtle O 37.8 / E 74.0, owl O 73.2 (P5c): O 80/75/70/72 → 60/50/45/50, E≥80 → E≥70
    if (t.O >= 60) return 0.35;
    if (t.O >= 50) return 0.55;
    if (t.O < 45 && t.E >= 70) return 1.35;
    if (t.O < 50) return 1.15;
    return 1.0;
  },
  "cat": (t) => {
    // cat极低社交 — measured cat X 22.1±5.7 / A 36.7 (P5c): X<32&&A<50 → X<28&&A<45, X<38 → X<33, X≥55 → X≥45
    if (t.X < 28 && t.A < 45) return 1.4;
    if (t.X < 33) return 1.1;
    if (t.X >= 45) return 0.4;
    return 1.0;
  },
  "koala": (t) => {
    // measured koala X 54.0±18.4 / A 84.1±12.1 vs high-X archetypes 92–98 (P5c): X 85/75/65/58 → 95/88/78/68 (blown-X boundary members reach 86–92 — veto targets the true high-X cluster), A 80/75/70/60; A<62→0.45 / A<70→0.45 (P5c round 2: center-cloud users (A≈50) were pooling into the koala basin at 17.7% > 13% drift-gate cap — stronger center rejection deflates the basin; genuine koala members (A 84.1±12.1, ~12% below 70) keep their large base-distance advantage)
    if (t.X >= 95) return 0.1; // Near-VETO for very high-X users
    if (t.X >= 88) return 0.2; // Severe penalty
    if (t.X >= 78) return 0.3; // Strong penalty
    if (t.X >= 68) return 0.45; // Moderate penalty
    // Only apply A bonus if X is appropriate (low-X users)
    if (t.A >= 80 && t.X < 50) return 1.4; // High A + low X = strong match
    if (t.A >= 75 && t.X < 55) return 1.2;
    if (t.A >= 70) return 1.0;
    if (t.A < 62) return 0.45;
    return 1.0;
  },
  "fox": (t) => {
    // fox高开放性 — measured fox O 87.2±5.3 (P5c): O≥82→88 (round 2: keeps the boost off octopus's centroid O=87 so octopus wins its own isolation past the 100-clamp tie), O≥78→80, O<70→72
    if (t.O >= 88) return 1.3;
    if (t.O >= 80) return 1.15;
    if (t.O < 72) return 0.5;
    return 1.0;
  },
  "octopus": (t) => {
    // 章鱼高开放低条理 — measured octopus O 78–87 / C 28–31; C is the distinctive channel vs fox/corgi (C=35) (P5c): O≥85&&C<50 → O≥78&&C<34, O≥80→78, C≥70→68
    if (t.O >= 78 && t.C < 34) return 1.4;
    if (t.O >= 78) return 1.15;
    if (t.C >= 68) return 0.5;
    return 1.0;
  },
  "hamster_praise": (t) => {
    // measured hamster A 44–67 (A saturates under high X) / X 95.3 (P5c): A≥85&&X≥80 → A≥42&&X≥92, A≥82→40
    if (t.A >= 42 && t.X >= 92) return 1.4;
    if (t.A >= 40) return 1.1;
    return 1.0;
  },
  "corgi": (t) => {
    // 柯基高社交高正能量 — measured corgi X 95.6±2.5 / P 82.5±3.8 (P5c): X 75/70/65/60 → 90/85/78/65, P 65/60 → 78/72, X<55→50
    if (t.X >= 90 && t.P >= 78) return 1.4; // High X + moderate P = strong match
    if (t.X >= 85 && t.P >= 72) return 1.3;
    if (t.X >= 78) return 1.15; // Moderate boost for extroverts
    if (t.X >= 65) return 1.05;
    if (t.X < 50) return 0.5; // Penalty for low-X users
    return 1.0;
  },
  "elephant": (t) => {
    // 大象高稳定 — measured elephant E 68.2±10.7 (E collapsed 86→68 on debiased scale): E 88/82/75 → 75/68/58
    if (t.E >= 75) return 1.3;
    if (t.E >= 68) return 1.1;
    if (t.E < 58) return 0.5;
    return 1.0;
  },
  "spider": (t) => {
    // 蜘蛛高条理 — measured spider C 74.7±10.2 (C compressed 85→75): C 85/78/68 → 80/72/62
    if (t.C >= 80) return 1.25;
    if (t.C >= 72) return 1.1;
    if (t.C < 62) return 0.6;
    return 1.0;
  }
};
