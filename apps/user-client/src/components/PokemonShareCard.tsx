/**
 * PokemonShareCard Component
 * Pokemon-inspired personality test result card for viral social sharing
 * Features: Holographic gradient, dual-layer border, hexagonal radar chart, enlarged archetype graphic
 */

import { motion } from "framer-motion";
import { forwardRef } from "react";
import type { ShareCardVariant } from "@/lib/archetypeShareVariants";
import PersonalityRadarChart from "./PersonalityRadarChart";
import { archetypeConfig } from "@/lib/archetypes";

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
  expression?: string; // Optional expression variant
  isPreview?: boolean; // Whether this is preview mode (show animation) or download mode
}

export const PokemonShareCard = forwardRef<HTMLDivElement, PokemonShareCardProps>(
  ({ archetype, archetypeEnglish, variant, illustrationUrl, rankings, traitScores, expression, isPreview = true }, ref) => {
    // Get archetype tagline from config
    const archetypeInfo = archetypeConfig[archetype];
    const tagline = archetypeInfo?.tagline || "";

    return (
      <motion.div
        ref={ref}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative w-full max-w-[360px] mx-auto"
        style={{ aspectRatio: '2/3' }}
      >
        {/* Card container with dual-layer border - gradient applied to border */}
        <div
          className={`relative h-full bg-gradient-to-br ${variant.gradient} rounded-3xl p-2 shadow-2xl`}
          style={{ boxShadow: `0 25px 70px ${variant.primaryColor}50` }}
        >
          {/* Enhanced dual-layer golden border with more depth */}
          <div className="absolute inset-0 rounded-3xl border-[14px] border-yellow-400/90 pointer-events-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]" 
               style={{ 
                 background: `linear-gradient(135deg, rgba(250,204,21,0.3) 0%, transparent 50%, rgba(250,204,21,0.2) 100%)`,
               }}
          />
          <div className="absolute inset-[14px] rounded-2xl border-[10px] border-yellow-500/60 pointer-events-none shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]" />
          
          {/* Enhanced holographic overlay - Pokemon card style */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-purple-200/20 pointer-events-none" />
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tl from-pink-200/20 via-transparent to-blue-200/20 pointer-events-none" />
          
          {/* Enhanced corner shine effects (Pokemon card style) */}
          <div className="absolute top-6 right-6 w-20 h-20 bg-white/40 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute top-8 right-8 w-12 h-12 bg-yellow-200/50 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-6 left-6 w-16 h-16 bg-white/30 rounded-full blur-xl pointer-events-none" />
          
          {/* Holographic reflection animation - only in preview mode */}
          {isPreview && (
            <motion.div
              className="absolute inset-0 rounded-3xl pointer-events-none overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                repeatDelay: 2,
                ease: "easeInOut"
              }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ width: '200%' }}
                animate={{ 
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 2,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          )}
          
          {/* Content - white/light background as default */}
          <div className="relative h-full bg-white/98 rounded-[20px] p-6 flex flex-col overflow-hidden">
            {/* Header badge */}
            <div className="text-center mb-3">
              <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-md">
                <p className="text-xs font-black tracking-wider text-gray-800">
                  悦聚 JOYJOIN 性格图鉴
                </p>
              </div>
            </div>

            {/* Archetype illustration with glow - 5x larger (260px) */}
            <div className="flex justify-center mb-2">
              <div
                className="relative w-[260px] h-[260px] rounded-full flex items-center justify-center"
                style={{
                  boxShadow: `0 0 60px ${variant.primaryColor}70, 0 0 100px ${variant.primaryColor}40`,
                  background: `radial-gradient(circle, ${variant.primaryColor}15, transparent 70%)`,
                }}
              >
                <img
                  src={illustrationUrl}
                  alt={archetype}
                  className="w-full h-full object-contain drop-shadow-2xl"
                  onError={(e) => {
                    // Fallback to placeholder on error
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Archetype name */}
            <h1 className="text-4xl font-black text-center mb-1 tracking-tight text-gray-900">
              {archetype}
            </h1>
            <p className="text-sm font-semibold text-center tracking-widest uppercase text-gray-600 mb-2">
              {archetypeEnglish}
            </p>

            {/* Archetype tagline - positioned description */}
            {tagline && (
              <p 
                className="text-sm font-medium text-center mb-3 px-4"
                style={{ color: variant.primaryColor }}
              >
                {tagline}
              </p>
            )}

            {/* Stats section (Pokemon HP style) */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100">
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
                <div className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full shadow-md">
                  <span className="text-xs font-black text-white">
                    #{rankings.totalUserRank}
                  </span>
                </div>
              </div>
            </div>

            {/* Hexagonal radar chart replacing progress bars */}
            <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl px-2 py-1 mb-3 flex-1 flex items-center justify-center border border-gray-100">
              <PersonalityRadarChart 
                affinityScore={traitScores.A}
                opennessScore={traitScores.O}
                conscientiousnessScore={traitScores.C}
                emotionalStabilityScore={traitScores.E}
                extraversionScore={traitScores.X}
                positivityScore={traitScores.P}
                primaryColor={variant.primaryColor}
              />
            </div>

            {/* Bottom sparkle decoration - fixed overflow */}
            <div className="text-center text-lg leading-none py-1">
              <span className="inline-block">✨⭐✨</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

PokemonShareCard.displayName = "PokemonShareCard";
