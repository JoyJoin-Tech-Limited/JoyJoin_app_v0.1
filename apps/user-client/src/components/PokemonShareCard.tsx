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
  shareDate?: string; // Optional share date in YYYY-MM-DD format (defaults to current date)
}

export const PokemonShareCard = forwardRef<HTMLDivElement, PokemonShareCardProps>(
  ({ archetype, archetypeEnglish, variant, illustrationUrl, rankings, traitScores, expression, nickname, isPreview = true, hasExpressionAsset = false, shareDate }, ref) => {
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

    // Format date - use provided shareDate or default to current date
    const formattedDate = shareDate || new Date().toISOString().split('T')[0];

    return (
      <motion.div
        ref={ref}
        data-card-root
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative w-full max-w-[360px] mx-auto"
        style={{ aspectRatio: '9/16' }}
      >
        {/* Card container with dual-layer border - gradient applied to border */}
        <div
          className={`relative bg-gradient-to-br ${variant.gradient} rounded-3xl p-2 shadow-2xl h-full`}
          style={{ boxShadow: `0 25px 70px ${variant.primaryColor}50` }}
        >
          {/* Enhanced dual-layer golden border - adjusted for 9:16 */}
          <div className="absolute inset-0 rounded-3xl border-[10px] border-yellow-400/90 pointer-events-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]" 
               style={{ 
                 background: `linear-gradient(135deg, rgba(250,204,21,0.3) 0%, transparent 50%, rgba(250,204,21,0.2) 100%)`,
               }}
          />
          <div className="absolute inset-[10px] rounded-2xl border-[6px] border-yellow-500/60 pointer-events-none shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]" />
          
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
              <div className="absolute top-6 right-6 w-16 h-16 bg-white/40 rounded-full blur-xl pointer-events-none" />
              <div className="absolute top-8 right-8 w-10 h-10 bg-yellow-200/50 rounded-full blur-lg pointer-events-none" />
              <div className="absolute bottom-6 left-6 w-14 h-14 bg-white/30 rounded-full blur-lg pointer-events-none" />
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
          
          {/* Content - white/light background as default - 3-section layout */}
          <div className="relative bg-white/98 rounded-[20px] h-full flex flex-col">
            {/* SECTION 1: HERO (TOP) - centered mascot + type/name + tagline */}
            <div className="flex-none px-4 pt-4 pb-3 flex flex-col items-center">
              {/* Archetype illustration in circular frame */}
              <div
                className="relative w-[120px] h-[120px] rounded-full flex items-center justify-center mb-2"
                style={{
                  boxShadow: `0 0 40px ${variant.primaryColor}70, 0 0 70px ${variant.primaryColor}40`,
                  background: `radial-gradient(circle, ${variant.primaryColor}15, transparent 70%)`,
                }}
              >
                <img
                  src={finalImageUrl}
                  alt={archetype}
                  className="w-full h-full object-contain drop-shadow-2xl"
                  onError={(e) => {
                    const imgElement = e.target as HTMLImageElement;
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

              {/* Type and Name */}
              <h1 className="text-2xl font-black text-center mb-0.5 tracking-tight text-gray-900">
                {archetype} ({archetypeEnglish})
              </h1>

              {/* User nickname (if provided) */}
              {nickname && (
                <p className="text-sm font-bold text-center mb-1.5 text-gray-800">
                  「{nickname}」
                </p>
              )}

              {/* Tagline pill */}
              {tagline && (
                <div className="bg-gray-100 rounded-full px-3 py-1 border border-gray-200">
                  <p 
                    className="text-[10px] font-medium text-center"
                    style={{ color: variant.primaryColor }}
                  >
                    {tagline}
                  </p>
                </div>
              )}
            </div>

            {/* SECTION 2: MIDDLE - two-column split with vertical divider */}
            <div className="flex-1 px-4 py-3 flex gap-3 min-h-0">
              {/* Left column: KPI stack */}
              <div className="flex-1 flex flex-col justify-center space-y-2">
                {/* TYPE ranking */}
                <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-2 border border-gray-100 text-center">
                  <div className="text-[9px] font-semibold text-gray-500 mb-0.5">#TYPE</div>
                  <div className="text-lg font-black text-gray-900">
                    {rankings.archetypeRank}/12
                  </div>
                </div>

                {/* ARCH ranking */}
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg p-2 border border-blue-100 text-center">
                  <div className="text-[9px] font-semibold text-blue-600 mb-0.5">#ARCH</div>
                  <div className="text-lg font-black text-blue-700">
                    {rankings.archetypeRank}
                  </div>
                </div>

                {/* ALL ranking */}
                <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg p-2 border border-purple-100 text-center">
                  <div className="text-[9px] font-semibold text-purple-600 mb-0.5">#ALL</div>
                  <div className="text-lg font-black text-purple-700">
                    {rankings.totalUserRank}
                  </div>
                </div>
              </div>

              {/* Vertical divider */}
              <div className="w-px bg-gradient-to-b from-transparent via-gray-300 to-transparent" />

              {/* Right column: Radar chart */}
              <div className="flex-1 flex items-center justify-center">
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
            </div>

            {/* SECTION 3: FOOTER - full-width bar with logo and date */}
            <div className="flex-none px-4 py-3 border-t border-gray-200 bg-gray-50/50">
              <div className="flex items-center justify-between">
                {/* Left: JoyJoin logo */}
                <img 
                  src={logoFull} 
                  alt="悦聚 JoyJoin" 
                  className="h-6 w-auto object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />

                {/* Right: Date */}
                <span className="text-[10px] font-semibold text-gray-600">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

PokemonShareCard.displayName = "PokemonShareCard";
