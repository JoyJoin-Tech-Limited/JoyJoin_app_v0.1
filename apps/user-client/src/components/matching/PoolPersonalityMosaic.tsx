import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Flame, Users } from "lucide-react";
import {
  getEnergySlices,
  getPoolMicroSignals,
  getPoolVibeLabel,
  getPoolWarmthLabel,
  getPoolWarmthScore,
} from "@/lib/poolVibeCalculator";

interface PoolPersonalityMosaicProps {
  archetypeDistribution: Record<string, number>;
  userArchetype?: string | null;
}

export default function PoolPersonalityMosaic({
  archetypeDistribution,
  userArchetype,
}: PoolPersonalityMosaicProps) {
  const prefersReducedMotion = useReducedMotion();
  const slices = getEnergySlices(archetypeDistribution);
  const total = Object.values(archetypeDistribution).reduce((sum, count) => sum + count, 0);
  const warmthScore = getPoolWarmthScore(archetypeDistribution, userArchetype);
  const warmthLabel = getPoolWarmthLabel(warmthScore);
  const vibeLabel = getPoolVibeLabel(archetypeDistribution);
  const microSignals = getPoolMicroSignals(archetypeDistribution);

  if (total <= 0) return null;

  return (
    <div className="mt-6 w-full max-w-sm rounded-[28px] border border-white/12 bg-white/8 p-4 backdrop-blur-xl shadow-[0_18px_50px_rgba(76,29,149,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">Pool Personality</p>
          <h3 className="mt-1 text-base font-semibold text-white">
            这一桌正在变成「{vibeLabel}」系
          </h3>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/75 ring-1 ring-white/15">
          {total} 人气场已入场
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-full bg-white/10">
        <div className="flex h-3 w-full">
          {slices.map((slice) => (
            <motion.div
              key={slice.key}
              className={`h-full bg-gradient-to-r ${slice.colorClass}`}
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${slice.percentage}%` }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeOut" }}
              title={`${slice.label} ${slice.percentage}%`}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {slices.map((slice) => (
          <span
            key={slice.key}
            className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/65 ring-1 ring-white/10"
          >
            {slice.label} · {slice.percentage}%
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/7 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-white/75">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs">当前 vibe</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-white">{vibeLabel}</p>
          <p className="mt-1 text-xs text-white/45">来自整桌的能量分布</p>
        </div>

        <div className="rounded-2xl bg-white/7 p-3 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-white/75">
            <Flame className="h-4 w-4" />
            <span className="text-xs">与你的热度</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-white">{warmthLabel}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-violet-400 to-amber-300"
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${warmthScore}%` }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeOut", delay: 0.1 }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-black/15 p-3 ring-1 ring-white/8">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Users className="h-4 w-4" />
          小悦观察到这桌正在长成：
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {microSignals.map((signal) => (
            <span
              key={signal}
              className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/70"
            >
              {signal}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
