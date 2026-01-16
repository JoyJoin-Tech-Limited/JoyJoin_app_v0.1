/**
 * PokemonShareCard Component
 * Pokemon-inspired personality test result card for viral social sharing
 * Features: Holographic gradient, dual-layer border, HP-style stats, trait bars
 */

import { motion } from "framer-motion";
import { forwardRef } from "react";
import type { ShareCardVariant } from "@/lib/archetypeShareVariants";

interface PokemonShareCardProps {
  archetype: string;
  archetypeEnglish: string;
  variant: ShareCardVariant;
  illustrationUrl: string;
  rankings: {
    totalUserRank: number;
    archetypeRank: number;
  };
  traitScores: {
    A: number;
    O: number;
    C: number;
    E: number;
    X: number;
    P: number;
  };
}

const traitLabels: Record<string, string> = {
  A: '亲和力',
  O: '开放性',
  C: '责任心',
  E: '情绪稳定',
  X: '外向性',
  P: '正能量',
};

export const PokemonShareCard = forwardRef<HTMLDivElement, PokemonShareCardProps>(
  ({ archetype, archetypeEnglish, variant, illustrationUrl, rankings, traitScores }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative w-full max-w-[360px] mx-auto"
        style={{ aspectRatio: '2/3' }}
      >
        {/* Card container with dual-layer border */}
        <div
          className={`relative h-full bg-gradient-to-br ${variant.gradient} rounded-3xl p-1.5 shadow-2xl`}
          style={{ boxShadow: `0 20px 60px ${variant.primaryColor}40` }}
        >
          {/* Inner yellow border */}
          <div className="absolute inset-0 rounded-3xl border-[12px] border-yellow-400 pointer-events-none shadow-inner" />
          <div className="absolute inset-[12px] rounded-2xl border-[8px] border-yellow-500/50 pointer-events-none" />
          
          {/* Holographic overlay */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-white/10 pointer-events-none" />
          
          {/* Corner shine effect (Pokemon card style) */}
          <div className="absolute top-8 right-8 w-16 h-16 bg-white/30 rounded-full blur-xl pointer-events-none" />
          
          {/* Content */}
          <div className="relative h-full bg-white/95 rounded-[20px] p-6 flex flex-col">
            {/* Header badge */}
            <div className="text-center mb-4">
              <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full">
                <p className="text-xs font-black tracking-wider text-gray-800">
                  悦聚 JOYJOIN 性格图鉴
                </p>
              </div>
            </div>

            {/* Archetype illustration with glow */}
            <div className="flex justify-center mb-3">
              <div
                className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center"
                style={{
                  boxShadow: `0 0 30px ${variant.primaryColor}60`,
                  background: `radial-gradient(circle, ${variant.primaryColor}20, transparent)`,
                }}
              >
                <img
                  src={illustrationUrl}
                  alt={archetype}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Archetype name */}
            <h1 className="text-4xl font-black text-center mb-1 tracking-tight text-gray-900">
              {archetype}
            </h1>
            <p className="text-sm font-semibold text-center tracking-widest uppercase text-gray-600 mb-4">
              {archetypeEnglish}
            </p>

            {/* Stats section (Pokemon HP style) */}
            <div className="bg-white/95 rounded-2xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between">
                {/* Left: Archetype rank */}
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-5xl font-black bg-gradient-to-br from-red-500 to-pink-500 bg-clip-text text-transparent"
                  >
                    No.{rankings.archetypeRank}
                  </span>
                  <span className="text-xs font-bold text-gray-700">
                    /{archetype}
                  </span>
                </div>
                
                {/* Right: Total user badge */}
                <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full">
                  <span className="text-xs font-black text-white">
                    #{rankings.totalUserRank}
                  </span>
                </div>
              </div>
            </div>

            {/* Six trait bars */}
            <div className="bg-white/95 rounded-2xl p-4 mb-4 space-y-2 flex-1">
              {Object.entries(traitScores).map(([key, score], index) => (
                <motion.div
                  key={key}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{ duration: 1, delay: index * 0.2, ease: "easeOut" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-gray-700 w-14 flex-shrink-0">
                      {traitLabels[key]}
                    </span>
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(score * 100)}%` }}
                        transition={{ duration: 1, delay: index * 0.2, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: variant.primaryColor }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600 w-8 text-right">
                      {Math.round(score * 100)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom sparkle decoration */}
            <div className="text-center text-lg">
              ✨⭐✨
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

PokemonShareCard.displayName = "PokemonShareCard";
