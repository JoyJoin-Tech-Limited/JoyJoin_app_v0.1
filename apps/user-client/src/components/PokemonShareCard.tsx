/**
 * PokemonShareCard Component
 * Pokemon-inspired personality test result card for viral social sharing
 * Features: Holographic gradient, dual-layer border, hexagonal radar chart, enlarged archetype graphic
 */

import { motion } from "framer-motion";
import { forwardRef, useState } from "react";
import type { ShareCardVariant } from "@/lib/archetypeShareVariants";
import PersonalityRadarChart from "./PersonalityRadarChart";
import { archetypeConfig } from "@/lib/archetypes";
import logoFull from "@/assets/joyjoin-logo-full.png";
import { getCardImagePath, hasCardImage } from "@/lib/archetypeCardImages";
import { getArchetypeIndex, formatTypeNo } from "@/lib/archetypeCanonical";

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
  nickname?: string; // Optional user nickname
  isPreview?: boolean; // Whether this is preview mode (show animation) or download mode
  hasExpressionAsset?: boolean; // Whether a dedicated expression asset exists
}

export const PokemonShareCard = forwardRef<HTMLDivElement, PokemonShareCardProps>(
  ({ archetype, archetypeEnglish, variant, illustrationUrl, rankings, traitScores, expression, nickname, isPreview = true, hasExpressionAsset = false }, ref) => {
    // Get archetype tagline from config
    const archetypeInfo = archetypeConfig[archetype];
    const tagline = archetypeInfo?.tagline || "";
    
    // Track if the image failed to load (use emoji overlay as fallback)
    const [imageLoadError, setImageLoadError] = useState(false);

    // Get the actual personality test result card image path (only if it exists)
    const cardImagePath = (expression && hasCardImage(archetype, expression)) 
      ? getCardImagePath(archetype, expression) 
      : "";
    
    // Use card image if available and expression is provided, otherwise fallback to illustrationUrl
    const finalImageUrl = cardImagePath || illustrationUrl;

    return (
      <motion.div
        ref={ref}
        data-card-root
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative w-full max-w-[420px] mx-auto"
      >
        {/* Card container with dual-layer border - gradient applied to border */}
        <div
          className={`relative bg-gradient-to-br ${variant.gradient} rounded-3xl p-2 shadow-2xl`}
          style={{ boxShadow: `0 25px 70px ${variant.primaryColor}50` }}
        >
          {/* Enhanced dual-layer golden border - adjusted for 9:16 */}
          <div className="absolute inset-0 rounded-3xl border-[12px] border-yellow-400/90 pointer-events-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]" 
               style={{ 
                 background: `linear-gradient(135deg, rgba(250,204,21,0.3) 0%, transparent 50%, rgba(250,204,21,0.2) 100%)`,
               }}
          />
          <div className="absolute inset-[12px] rounded-2xl border-[8px] border-yellow-500/60 pointer-events-none shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]" />
          
          {/* Enhanced holographic overlay - Pokemon card style - only in preview */}
          {isPreview && (
            <>
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-purple-200/20 pointer-events-none" />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-tl from-pink-200/20 via-transparent to-blue-200/20 pointer-events-none" />
            </>
          )}
          
          {/* Enhanced corner shine effects (Pokemon card style) - only in preview mode */}
          {isPreview && (
            <>
              <div className="absolute top-6 right-6 w-20 h-20 bg-white/40 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute top-8 right-8 w-12 h-12 bg-yellow-200/50 rounded-full blur-xl pointer-events-none" />
              <div className="absolute bottom-6 left-6 w-16 h-16 bg-white/30 rounded-full blur-xl pointer-events-none" />
            </>
          )}
          
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
          <div className="relative bg-white/98 rounded-[20px] p-4 sm:p-5 flex flex-col">
            {/* Header badge with long logo */}
            <div className="text-center mb-1.5 sm:mb-2">
              <div className="inline-flex items-center justify-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full shadow-md">
                <img 
                  src={logoFull} 
                  alt="悦聚 JoyJoin" 
                  className="h-8 sm:h-10 w-auto object-contain"
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const fallbackText = document.createElement('p');
                      fallbackText.className = 'text-xs font-black tracking-wider text-gray-800';
                      fallbackText.textContent = '悦聚 JOYJOIN 性格图鉴';
                      parent.appendChild(fallbackText);
                    }
                  }}
                />
              </div>
            </div>

            {/* Archetype illustration with glow - responsive sizing */}
            <div className="flex justify-center mb-1 sm:mb-1.5">
              <div
                className="relative w-[150px] h-[150px] sm:w-[180px] sm:h-[180px] max-w-[45vw] max-h-[45vw] rounded-full flex items-center justify-center"
                style={{
                  boxShadow: `0 0 50px ${variant.primaryColor}70, 0 0 90px ${variant.primaryColor}40`,
                  background: `radial-gradient(circle, ${variant.primaryColor}15, transparent 70%)`,
                }}
              >
                <img
                  src={finalImageUrl}
                  alt={archetype}
                  className="w-full h-full object-contain drop-shadow-2xl"
                  onError={(e) => {
                    const imgElement = e.target as HTMLImageElement;
                    // Fallback to illustration image on error
                    // Check if we're currently showing a card image (contains the path signature)
                    if (cardImagePath && imgElement.src.includes('personality test result card')) {
                      console.warn(`Card image failed to load: ${cardImagePath}, falling back to illustration image`);
                      imgElement.src = illustrationUrl;
                    } else {
                      imgElement.style.display = 'none';
                      setImageLoadError(true);
                    }
                  }}
                />
              </div>
            </div>

            {/* Archetype name */}
            <h1 className="text-3xl sm:text-4xl font-black text-center mb-0.5 tracking-tight text-gray-900">
              {archetype}
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-center tracking-widest uppercase text-gray-600 mb-1 sm:mb-1.5">
              {archetypeEnglish}
            </p>

            {/* User nickname (if provided) */}
            {nickname && (
              <p className="text-sm sm:text-base font-bold text-center mb-1 sm:mb-1.5 px-4 text-gray-800">
                「{nickname}」
              </p>
            )}

            {/* Archetype tagline - positioned description with improved readability */}
            {tagline && (
              <div className="flex justify-center mb-1.5 sm:mb-2 px-3">
                <div className="bg-white/80 backdrop-blur-sm rounded-lg px-2 sm:px-2.5 py-0.5 sm:py-1 border border-white/40">
                  <p 
                    className="text-[10px] sm:text-xs font-medium text-center"
                    style={{ 
                      color: variant.primaryColor,
                    }}
                  >
                    {tagline}
                  </p>
                </div>
              </div>
            )}

            {/* Stats section - KPI tags */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-3 sm:p-4 mb-1.5 sm:mb-2 shadow-sm border border-gray-100">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                {/* #TYPE tag - archetype type number */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-gray-500">#TYPE</span>
                  <span className="px-2 sm:px-2.5 py-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-md">
                    <span className="text-xs sm:text-sm font-black text-white">
                      {(() => {
                        const archetypeIndex = getArchetypeIndex(archetype);
                        // Default to 1 if not found (should not happen in normal operation)
                        return formatTypeNo(archetypeIndex ?? 1);
                      })()}
                    </span>
                  </span>
                </div>
                
                {/* #ARCH tag - archetype-specific rank */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-gray-500">#ARCH</span>
                  <span className="px-2 sm:px-2.5 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full shadow-md">
                    <span className="text-xs sm:text-sm font-black text-white">
                      #{rankings.archetypeRank}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Pokemon-style 2-column Skills Section */}
            <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl p-2 sm:p-2.5 mb-1.5 sm:mb-2 border border-gray-100">
              <div className="flex gap-2 sm:gap-3">
                {/* Left: Radar Chart (45% width for better readability) */}
                <div className="w-[45%] flex items-center justify-center">
                  <PersonalityRadarChart 
                    affinityScore={traitScores.A}
                    opennessScore={traitScores.O}
                    conscientiousnessScore={traitScores.C}
                    emotionalStabilityScore={traitScores.E}
                    extraversionScore={traitScores.X}
                    positivityScore={traitScores.P}
                    primaryColor={variant.primaryColor}
                    compactMode={true}
                  />
                </div>
                
                {/* Right: Pokemon Skills Info (55% width) */}
                <div className="w-[55%] flex flex-col justify-center space-y-1.5 sm:space-y-2">
                  {/* Energy Bar - Pokemon HP style */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                      <span className="text-[9px] sm:text-[10px] font-bold text-gray-700">⚡ 社交能量</span>
                      <span className="text-[9px] sm:text-[10px] font-black text-orange-600">{archetypeInfo?.energyLevel}</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                        style={{ width: `${archetypeInfo?.energyLevel || 50}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Core Skill Box */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-1.5 sm:p-2 border border-purple-200">
                    <div className="text-[9px] sm:text-[10px] font-bold text-purple-700 mb-0.5">🎯 核心技能</div>
                    <div className="text-[9px] sm:text-[10px] leading-tight text-gray-800">{archetypeInfo?.coreContributions}</div>
                  </div>
                  
                  {/* Social Role Box */}
                  <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-lg p-1.5 sm:p-2 border border-pink-200">
                    <div className="text-[9px] sm:text-[10px] font-bold text-pink-700 mb-0.5">💫 社交定位</div>
                    <div className="text-[9px] sm:text-[10px] leading-tight text-gray-800">"{archetypeInfo?.nickname}"</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom sparkle decoration - fixed overflow */}
            <div className="text-center text-base sm:text-lg leading-none py-0.5 sm:py-1">
              <span className="inline-block">✨⭐✨</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

PokemonShareCard.displayName = "PokemonShareCard";
