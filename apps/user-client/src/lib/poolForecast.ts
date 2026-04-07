/**
 * Pool Forecast — deterministic, rules-based pool atmosphere forecast.
 *
 * Generates a short, vivid pool-level atmospheric forecast for the discovery
 * card's Pool Forecast strip.
 *
 * LAYER BOUNDARY — Pool vs 成桌
 * ─────────────────────────────────────────────────────────────────────────────
 * This module operates at the Event Pool layer only. It describes momentum,
 * atmosphere, and tendency — it does NOT predict 成桌 outcomes or imply a
 * table has already formed.
 *
 * "Bridge" references (e.g. mentioning the matching threshold) are intentional
 * and acceptable: they orient the user toward the pool lifecycle without
 * promising a specific formed-group result.
 *
 * V1 is intentionally rules-based — no live LLM call, no blocking network
 * dependency. All output comes from curated copy buckets driven by safe
 * signals already available on the discovery card.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Input signals:
 *   - registrationCount  — current pool head-count
 *   - sampleArchetypes   — archetypes visible on the card (up to 6)
 *   - minGroupSize       — pool matching threshold (default: 4)
 *   - eventType          — 饭局 | 酒局
 */

import { archetypeConfig } from "./archetypes";

// ── Phase classification ──────────────────────────────────────────────────────

export type ForecastPhase = "spark" | "building" | "momentum" | "ready";

/**
 * Classify pool momentum phase based on head-count vs matching threshold.
 *
 * spark:    0–1 people — just lit
 * building: 2 people up to 60% of threshold — growing
 * momentum: 60% to just-below threshold — near-critical
 * ready:    at or above threshold — matching can begin (bridge state)
 */
export function getPoolPhase(
  registrationCount: number,
  minGroupSize: number,
): ForecastPhase {
  if (registrationCount >= minGroupSize) return "ready";
  if (registrationCount >= Math.ceil(minGroupSize * 0.6)) return "momentum";
  if (registrationCount >= 2) return "building";
  return "spark";
}

// ── Archetype analysis helpers ────────────────────────────────────────────────

/** Count unique archetypes in the pool sample. */
function uniqueArchetypeCount(sampleArchetypes: string[]): number {
  return new Set(sampleArchetypes).size;
}

/** Average social energy level across pool archetypes, or null when empty. */
export function avgArchetypeEnergy(sampleArchetypes: string[]): number | null {
  if (!sampleArchetypes.length) return null;
  const total = sampleArchetypes.reduce(
    (sum, a) => sum + (archetypeConfig[a]?.energyLevel ?? 65),
    0,
  );
  return total / sampleArchetypes.length;
}

// ── Copy buckets ─────────────────────────────────────────────────────────────
//
// Each bucket has 2–3 curated lines. The primary line is selected
// deterministically (registrationCount % bucket.length) so the card
// shows natural variety across different pools without randomness.

const PHASE_COPY: Record<ForecastPhase, string[]> = {
  spark: [
    "这池刚有点火苗 · 先来的人往往最有趣",
    "池子刚开 · 最有意思的故事往往从这里起头",
  ],
  building: [
    "这池开始有点想聊了",
    "同城有趣的人正在往这个方向靠",
    "这池正在慢慢有温度",
  ],
  momentum: [
    "这池气氛在升温 · 进来的时机不错",
    "这池越来越有意思了",
  ],
  ready: [
    "这池已摸到成桌门槛 · 等系统找出最对味的一组",
    "这池人味道对了 · 等系统完成最后的配对",
  ],
};

const DIVERSITY_COPY: Record<"medium" | "high", string> = {
  medium: "不同路数的人正在往这池里靠",
  high: "这池汇了几种不同性格 · 碰撞感会有",
};

const ENERGY_COPY = {
  high: "这池能量偏高 · 适合热聊开场",
  balanced: "这池搭配感不错 · 深聊浅聊都能接住",
  low: "这池慢热但有料 · 话题容易走深",
};

// ── Public API ────────────────────────────────────────────────────────────────

export interface PoolForecastResult {
  /**
   * 1–3 pool-level atmosphere lines to display/cycle on the card strip.
   * The first element is always the primary phase-based line.
   */
  lines: [string, ...string[]];
  /** Momentum phase driving the copy selection. */
  phase: ForecastPhase;
}

/**
 * Generate a deterministic pool-level atmosphere forecast.
 *
 * Returns 1–3 lines suitable for rotating display on the discovery card.
 * Outputs are strictly pool-layer language — no 成桌 certainty implied.
 */
export function getPoolForecast(input: {
  registrationCount: number;
  sampleArchetypes: string[];
  minGroupSize?: number;
  eventType?: "饭局" | "酒局";
}): PoolForecastResult {
  const {
    registrationCount,
    sampleArchetypes,
    minGroupSize = 4,
    eventType,
  } = input;

  const phase = getPoolPhase(registrationCount, minGroupSize);

  // Primary line — deterministic selection by count for natural variety
  const bucket = PHASE_COPY[phase];
  const primaryLine = bucket[registrationCount % bucket.length];

  // For the momentum phase, generate a precise seat-count bridge line
  // to orient the user toward the matching threshold without overpromising.
  const seatsNeeded = Math.max(minGroupSize - registrationCount, 0);
  const primaryLineFinal =
    phase === "momentum" && seatsNeeded > 0
      ? `再来 ${seatsNeeded} 位，系统就会优先开始成桌匹配`
      : primaryLine;

  const lines: string[] = [primaryLineFinal];

  // Supplement: archetype diversity / energy signal
  const uniqueCount = uniqueArchetypeCount(sampleArchetypes);
  if (uniqueCount >= 4) {
    lines.push(DIVERSITY_COPY.high);
  } else if (uniqueCount === 3) {
    lines.push(DIVERSITY_COPY.medium);
  } else {
    // Fewer unique archetypes — use energy tone signal instead
    const energy = avgArchetypeEnergy(sampleArchetypes);
    if (energy !== null) {
      if (energy >= 80) lines.push(ENERGY_COPY.high);
      else if (energy >= 58) lines.push(ENERGY_COPY.balanced);
      else lines.push(ENERGY_COPY.low);
    }
  }

  // Supplement: eventType flavour for 酒局 (if room, and pool not yet ready)
  if (eventType === "酒局" && lines.length < 3 && phase !== "ready") {
    lines.push("酒局场子 · 气氛开了就停不下来");
  }

  return {
    lines: lines as [string, ...string[]],
    phase,
  };
}
