/**
 * PokemonShareCard Component
 * Pokemon-inspired personality test result card for viral social sharing
 * Features: Holographic gradient, dual-layer border, hexagonal radar chart, enlarged archetype graphic
 */

import { motion } from "framer-motion";
import { forwardRef, useState, useEffect } from "react";
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
    
    // Track image loading state for skeleton and fade-in
    const [imageLoaded, setImageLoaded] = useState(false);

    // Get the actual personality test result card image path (only if it exists)
    const cardImagePath = (expression && hasCardImage(archetype, expression)) 
      ? getCardImagePath(archetype, expression) 
      : "";
    
    // Use card image if available and expression is provided, otherwise fallback to illustrationUrl
    const finalImageUrl = cardImagePath || illustrationUrl;

    // Reset imageLoaded state when finalImageUrl changes
    useEffect(() => {
      setImageLoaded(false);
    }, [finalImageUrl]);

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
        style={{ 
          aspectRatio: '9/16',
          fontFamily: '"ZCOOL QingKe HuangYou", -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif'
        }}
      >
        {/* Card container with dual-layer border - gradient applied to border */}
        <div
          className={`relative bg-gradient-to-br ${variant.gradient} rounded-3xl p-3 shadow-2xl h-full`}
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
                {/* Loading skeleton with shimmer */}
                {!imageLoaded && (
                  <div className="absolute inset-0 rounded-full bg-gray-200 animate-pulse overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-shimmer" />
                  </div>
                )}
                
                {/* Actual image with fade-in transition */}
                <img
                  src={finalImageUrl}
                  alt={archetype}
                  className={`w-full h-full object-contain drop-shadow-2xl transition-opacity duration-500 ${
                    imageLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(true)}
                  onError={(e) => {
                    const imgElement = e.target as HTMLImageElement;
                    if (cardImagePath && imgElement.src.includes('personality test result card')) {
                      console.warn(`Card image failed to load: ${cardImagePath}, falling back to illustration image`);
                      imgElement.src = illustrationUrl;
                    } else {
                      imgElement.style.display = 'none';
                      setImageLoadError(true);
                    }
                    setImageLoaded(true); // Set to true even on error to hide skeleton
                  }}
                />
              </div>

              {/* Archetype name + English subtitle with improved styling */}
              <div className="text-center mb-1 space-y-0.5">
                {/* Chinese archetype name - primary */}
                <h2 
                  className="text-2xl sm:text-3xl font-black tracking-wide"
                  style={{
                    background: `linear-gradient(135deg, ${variant.primaryColor}, ${variant.secondaryColor || variant.primaryColor})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: `0 2px 8px ${variant.primaryColor}40`,
                  }}
                >
                  {archetype}
                </h2>
                
                {/* English name - secondary label below Chinese */}
                <p 
                  className="text-xs font-medium tracking-wider uppercase opacity-70"
                  style={{
                    color: variant.secondaryColor || variant.primaryColor,
                    textShadow: `0 1px 3px ${(variant.secondaryColor || variant.primaryColor)}20`,
                  }}
                >
                  {archetypeEnglish}
                </p>
              </div>

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

            {/* Stats Section - 2 Column Layout with Prominent Archetype Rank */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl px-4 py-3 mb-1.5 sm:mb-2 shadow-sm border border-gray-100">
              <div className="grid grid-cols-[1.8fr_1fr] gap-3">
                {/* LEFT: HERO TAG - 原型排名 (Archetype Rank) */}
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px] shadow-lg">
                  {/* Animated shimmer effect - only in preview mode */}
                  {isPreview && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
                  )}
                  
                  <div className="relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[10px] px-3 py-2.5 h-full flex flex-col justify-center">
                    {/* Label */}
                    <div className="text-[10px] font-bold text-indigo-600/70 mb-0.5 tracking-wide">
                      原型编号
                    </div>
                    
                    {/* Hero Content - Rank + Archetype */}
                    <div className="flex items-baseline gap-1.5">
                      {/* Rank Number */}
                      <div className="flex items-baseline">
                        <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                          No.
                        </span>
                        <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 tracking-tight">
                          {rankings.archetypeRank}
                        </span>
                      </div>
                      
                      {/* Archetype Name */}
                      <span className="text-base font-bold text-indigo-700 truncate">
                        {archetype}
                      </span>
                    </div>
                    
                    {/* Decorative accent */}
                    <div className="absolute top-1 right-1 w-6 h-6 bg-gradient-to-br from-yellow-300 to-amber-400 rounded-full opacity-20 blur-sm" />
                    <div className="absolute bottom-1 left-1 w-4 h-4 bg-gradient-to-br from-pink-300 to-purple-400 rounded-full opacity-20 blur-sm" />
                  </div>
                </div>

                {/* RIGHT: Secondary Tag - 总榜排名 (Global Rank) */}
                <div className="rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 px-3 py-2.5 flex flex-col justify-center border border-gray-200/50 shadow-sm">
                  {/* Label */}
                  <div className="text-[10px] font-bold text-gray-500 mb-0.5 tracking-wide">
                    总榜编号
                  </div>
                  
                  {/* Rank Number */}
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-semibold text-gray-400">#</span>
                    <span className="text-xl font-bold text-gray-700">
                      {rankings.totalUserRank}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pokemon-style 2-column Skills Section */}
            <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl px-4 py-2.5 mb-1.5 sm:mb-2 border border-gray-100">
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
                    variant="compact"
                  />
                </div>
                
                {/* Right: Pokemon Skills Info (55% width) */}
                <div className="w-[55%] flex flex-col justify-center space-y-3">
                  {/* Energy Bar - Pokemon HP style */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs sm:text-sm font-bold text-gray-700">⚡ 社交能量</span>
                      <span className="text-xs sm:text-sm font-black text-orange-600">{archetypeInfo?.energyLevel}</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                        style={{ width: `${archetypeInfo?.energyLevel || 50}%` }}
                      />
                    </div>
                  </div>

                  {/* Core Contributions */}
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">💎 核心技能</div>
                    <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed">
                      {archetypeInfo?.coreContributions}
                    </p>
                  </div>

                  {/* Social Positioning */}
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-gray-700 mb-1">🎯 社交定位</div>
                    <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed">
                      {archetypeInfo?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: FOOTER - full-width bar with logo and date */}
            <div className="flex-none px-4 py-3.5 border-t border-gray-200/60 bg-gradient-to-r from-gray-50 via-white to-gray-50/50 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                {/* Left: JoyJoin logo */}
                <img 
                  src={logoFull} 
                  alt="悦聚 JoyJoin" 
                  className="h-5 w-auto object-contain opacity-90"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />

                {/* Right: Minimalist date UI */}
                <div className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg">
                  <span className="text-[10px] font-black text-white tracking-wider">
                    {formattedDate}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

PokemonShareCard.displayName = "PokemonShareCard";
