/**
 * PokemonShareCard Component
 * Pokemon-inspired personality test result card for viral social sharing
 * Features: Holographic gradient, dual-layer border, hexagonal radar chart, enlarged archetype graphic
 * 
 * Design System:
 * - Spacing: 4px (0.5), 8px (2), 12px (3), 16px (4), 24px (6), 32px (8)
 * - Font Sizes: text-xs (12px), text-sm (14px), text-base (16px), text-lg (18px), text-xl (20px), text-2xl (24px)
 * - Border Radius: rounded-lg (8px), rounded-xl (12px), rounded-2xl (16px), rounded-3xl (24px), rounded-full
 * - Mobile-first: Optimized for 375px-428px viewports
 */

import { motion } from "framer-motion";
import { forwardRef, useState, useEffect } from "react";
import type { ShareCardVariant } from "@/lib/archetypeShareVariants";
import TraitBarsCompact from "./TraitBarsCompact";
import { archetypeConfig } from "@/lib/archetypes";
import logoFull from "@/assets/joyjoin-logo.png";
import { getCardImagePath, hasCardImage } from "@/lib/archetypeCardImages";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { getArchetypeSkills } from "@shared/personality/archetypeSkills";

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
    
    // Track image loading state for skeleton and fade-in
    const [imageLoaded, setImageLoaded] = useState(false);

    // Check if user prefers reduced motion
    const prefersReducedMotion = useReducedMotion();

    // Get the actual personality test result card image path (only if it exists)
    const cardImagePath = (expression && hasCardImage(archetype, expression)) 
      ? getCardImagePath(archetype, expression) 
      : "";
    
    // Use card image if available and expression is provided, otherwise fallback to illustrationUrl
    const finalImageUrl = cardImagePath || illustrationUrl;

    // Get skills for this archetype (safely)
    const skillSet = getArchetypeSkills(archetype);

    // Reset imageLoaded state when finalImageUrl changes
    useEffect(() => {
      setImageLoaded(false);
    }, [finalImageUrl]);

    // Haptic feedback for skill badge animations in preview mode (trigger only once)
    useEffect(() => {
      if (isPreview) {
        // Subtle haptic when badges animate in
        const timer = setTimeout(() => {
          haptics.light();
        }, 300); // Match badge animation start
        
        return () => clearTimeout(timer);
      }
    }, []); // Empty deps - only trigger on mount

    // Format date - use provided shareDate or default to current date
    const formattedDate = shareDate || new Date().toISOString().split('T')[0];

    return (
      <motion.div
        ref={ref}
        data-card-root
        tabIndex={-1}
        aria-hidden="true" // Card is display-only for image export, not interactive
        initial={prefersReducedMotion ? {} : { scale: 0.8, opacity: 0 }}
        animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
        transition={prefersReducedMotion ? {} : { type: "spring", stiffness: 200, damping: 20 }}
        className="relative w-full max-w-[360px] mx-auto"
        style={{ 
          // Fixed height with overflow hidden to prevent mobile overflow
          height: 'clamp(560px, 78vh, 720px)',
          overflow: 'hidden',
          fontFamily: 'var(--font-cn-display)'
        }}
      >
        {/* Card container with dual-layer border - gradient applied to border */}
        <div
          className={`relative bg-gradient-to-br ${variant.gradient} rounded-3xl p-3 shadow-2xl h-full`}
          style={{ boxShadow: `0 25px 70px ${variant.primaryColor}50` }}
        >
          {/* Enhanced dual-layer golden border - adjusted for 9:16 */}
          <div className="absolute inset-0 rounded-3xl border-[6px] border-yellow-400/90 pointer-events-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]" 
               style={{ 
                 background: `linear-gradient(135deg, rgba(250,204,21,0.3) 0%, transparent 50%, rgba(250,204,21,0.2) 100%)`,
               }}
          />
          <div className="absolute inset-[6px] rounded-2xl border-[3px] border-yellow-500/60 pointer-events-none shadow-[inset_0_1px_4px_rgba(0,0,0,0.15)]" />
          
          {/* Enhanced holographic overlay - Pokemon card style - only in preview */}
          {isPreview && (
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/30 via-transparent to-purple-200/20 pointer-events-none" />
          )}
          
          {/* Enhanced corner shine effects (Pokemon card style) - only in preview mode */}
          {isPreview && (
            <>
              <div className="absolute top-6 right-6 w-16 h-16 bg-white/40 rounded-full blur-xl pointer-events-none" />
              <div className="absolute top-8 right-8 w-10 h-10 bg-yellow-200/50 rounded-full blur-lg pointer-events-none" />
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
          <div className="relative bg-white/98 rounded-[20px] h-full flex flex-col py-4">
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
                {/* Loading skeleton with shimmer - uses variant color with low opacity */}
                {!imageLoaded && (
                  <div 
                    className="absolute inset-0 rounded-full animate-pulse overflow-hidden"
                    style={{ backgroundColor: `${variant.primaryColor}20` }} // 20 = 12.5% opacity in hex
                  >
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
                    }
                    setImageLoaded(true); // Set to true even on error to hide skeleton
                  }}
                />
              </div>

              {/* Type and Name */}
              <h1 className="text-2xl font-black text-center tracking-tight text-gray-900 leading-tight">
                {archetype}
              </h1>
              
              {/* English name as tag/label below */}
              <div 
                className="text-xs uppercase tracking-wider font-bold text-center mt-0.5 mb-1"
                style={{ 
                  color: variant.primaryColor,
                  textShadow: `
                    0 0 8px rgba(255,255,255,0.9),
                    0 1px 2px rgba(0,0,0,0.3),
                    -1px -1px 0 rgba(255,255,255,0.8),
                    1px -1px 0 rgba(255,255,255,0.8),
                    -1px 1px 0 rgba(255,255,255,0.8),
                    1px 1px 0 rgba(255,255,255,0.8)
                  `,
                  WebkitTextStroke: '0.5px rgba(255,255,255,0.5)'
                }}
              >
                {archetypeEnglish}
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
                    className="text-xs font-medium text-center truncate"
                    style={{ color: variant.primaryColor }}
                    title={tagline}
                  >
                    {tagline}
                  </p>
                </div>
              )}
            </div>

            {/* Stats Section - 2 Column Layout with Prominent Archetype Collection Number */}
            <div className="bg-white/50 rounded-2xl px-4 py-3 mb-1.5 sm:mb-2 shadow-sm border border-gray-100">
              <div className="grid grid-cols-[1.8fr_1fr] gap-3">
                {/* LEFT: HERO TAG - 原型编号 with glassmorphism */}
                <div className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/40 border border-white/50 shadow-lg px-3 py-2.5">
                  {/* Label */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs">🎴</span>
                    <span className="text-xs font-medium text-indigo-600/80 tracking-wide uppercase">
                      原型编号
                    </span>
                  </div>
                  
                  {/* Hero Content - Larger numbers */}
                  <div className="flex items-baseline gap-1.5">
                    <div className="flex items-baseline">
                      <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                        No.
                      </span>
                      <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 tracking-tight">
                        {rankings.archetypeRank}
                      </span>
                    </div>
                    
                    {/* Archetype Name */}
                    <span className="text-xs font-bold text-indigo-700 truncate">
                      {archetype}
                    </span>
                  </div>
                </div>

                {/* RIGHT: Secondary Tag - 总榜编号 with glassmorphism */}
                <div className="relative overflow-hidden rounded-xl backdrop-blur-md bg-white/35 border border-white/45 shadow-md px-3 py-2.5">
                  {/* Label */}
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs">🏅</span>
                    <span className="text-xs font-medium text-amber-700/80 tracking-wide uppercase">
                      全球排名
                    </span>
                  </div>
                  
                  {/* Rank Number - PROMINENT with gradient */}
                  <div className="relative z-10 flex items-baseline gap-0.5">
                    <span className="text-lg font-semibold text-amber-600">#</span>
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                      {rankings.totalUserRank.toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Stack Layout - Full width sections */}
            <div className="space-y-3.5 px-4">
              {/* 1. Trait Bars - Full width */}
              <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 rounded-xl px-4 py-3 border border-indigo-200/30">
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">📊</span>
                  <span className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                    特质面板
                  </span>
                </div>
                
                {/* Trait Bars */}
                <TraitBarsCompact
                  affinityScore={traitScores.A}
                  opennessScore={traitScores.O}
                  conscientiousnessScore={traitScores.C}
                  emotionalStabilityScore={traitScores.E}
                  extraversionScore={traitScores.X}
                  positivityScore={traitScores.P}
                  primaryColor={variant.primaryColor}
                  animated={isPreview}
                />
              </div>
              
              {/* 2. Energy Bar - Full width */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-700">⚡ 社交能量</span>
                  <span className="text-sm font-black text-orange-600">{archetypeInfo?.energyLevel}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"
                    initial={prefersReducedMotion ? { width: `${archetypeInfo?.energyLevel || 50}%` } : { width: 0 }}
                    animate={{ width: `${archetypeInfo?.energyLevel || 50}%` }}
                    transition={prefersReducedMotion ? {} : { duration: 1, delay: 0.3, ease: "easeOut" }}
                  />
                </div>
              </div>
              
              {/* 3. Skills Section - Side by side with improved readability */}
              {skillSet ? (
                <div className="bg-gradient-to-br from-purple-50/90 to-pink-50/90 rounded-xl p-2 border border-purple-200/30">
                  {/* Header with Attribute */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚡</span>
                      <span className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                        技能树
                      </span>
                    </div>
                    <div className="text-xs font-bold px-2.5 py-1 bg-white/90 rounded-full border border-purple-200/50 shadow-sm"
                         style={{ color: variant.primaryColor }}>
                      {skillSet.attribute}
                    </div>
                  </div>
                  
                  {/* Two-Column Layout: Active | Passive with improved spacing */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* ACTIVE SKILL - Left Column */}
                    <div className="relative bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-2 border-2 border-orange-300/60 shadow-sm">
                      {/* Active Badge */}
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-md z-10">
                        主动
                      </div>
                      
                      {/* Icon Circle */}
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-red-100 rounded-full flex items-center justify-center mb-2 mx-auto border-2 border-orange-300/50">
                        <span className="text-xl">{skillSet.activeSkill.icon}</span>
                      </div>
                      
                      {/* Skill Name - REDUCED */}
                      <div className="text-sm font-bold text-orange-800 text-center mb-2 leading-tight">
                        {skillSet.activeSkill.name}
                      </div>
                      
                      {/* Energy Cost - More prominent */}
                      <div className="flex items-center justify-center gap-1 mb-2 bg-orange-100/80 rounded-full py-1 px-2.5 mx-auto w-fit">
                        <span className="text-sm font-bold text-orange-700">
                          {skillSet.activeSkill.energyCost}
                        </span>
                        <span className="text-base">
                          {skillSet.activeSkill.energyType}
                        </span>
                      </div>
                      
                      {/* Short Effect - REDUCED with line-clamp */}
                      <p className="text-xs font-semibold text-orange-700 text-center leading-snug line-clamp-2" title={skillSet.activeSkill.shortEffect}>
                        {skillSet.activeSkill.shortEffect}
                      </p>
                    </div>
                    
                    {/* PASSIVE SKILL - Right Column */}
                    <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-2 border-2 border-blue-300/60 shadow-sm">
                      {/* Passive Badge */}
                      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-md z-10">
                        被动
                      </div>
                      
                      {/* Icon Circle */}
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-2 mx-auto border-2 border-blue-300/50">
                        <span className="text-xl">{skillSet.passiveSkill.icon}</span>
                      </div>
                      
                      {/* Skill Name - REDUCED */}
                      <div className="text-sm font-bold text-blue-800 text-center mb-2 leading-tight">
                        {skillSet.passiveSkill.name}
                      </div>
                      
                      {/* Always Active Indicator - More visible */}
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-gray-600 font-medium">常驻效果</span>
                      </div>
                      
                      {/* Short Effect - REDUCED with line-clamp */}
                      <p className="text-xs font-semibold text-blue-700 text-center leading-snug line-clamp-2" title={skillSet.passiveSkill.shortEffect}>
                        {skillSet.passiveSkill.shortEffect}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200/30 text-center">
                  <span className="text-sm text-gray-500">技能加载中...</span>
                </div>
              )}
              
              {/* 4. Social Positioning - Full width */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg px-3 py-2.5">
                <div className="text-sm font-bold text-gray-700 mb-1">🎯 社交定位</div>
                <p className="text-xs text-gray-600 leading-relaxed line-clamp-3" title={archetypeInfo?.description}>
                  {archetypeInfo?.description}
                </p>
              </div>
            </div>

            {/* SECTION 3: FOOTER - Foil Stamp Authentication Bar with STICKY positioning */}
            <div className="flex-none relative overflow-hidden">
              {/* Main metallic gold bar */}
              <div 
                className={`relative px-3 py-2.5 ${
                  isPreview ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-shimmer-slow' : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400'
                }`}
                style={{ backgroundSize: '200% 100%' }}
              >
                {/* Sparkle overlay - preview mode only */}
                {isPreview && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"
                    initial={{ x: '-100%', opacity: 0 }}
                    animate={{ 
                      x: ['100%', '200%'],
                      opacity: [0, 1, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "easeInOut"
                    }}
                  />
                )}
                
                {/* 3-column layout */}
                <div className="relative flex items-center justify-between text-amber-900">
                  {/* Left Column - Certification Mark */}
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-8 bg-gradient-to-b from-amber-600 to-amber-800 rounded-full" />
                    <div className="flex flex-col">
                      <span className="text-xs uppercase tracking-wide text-amber-900/60 leading-tight">Certified By</span>
                      <img 
                        src={logoFull} 
                        alt="JoyJoin" 
                        className="h-4 w-auto object-contain"
                        style={{ filter: 'brightness(0.7) contrast(1.3)' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>

                  {/* Center Column - Serial Number */}
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-xs text-amber-900/80 font-bold leading-tight">
                      #{String(rankings.totalUserRank).padStart(5, '0')}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-amber-800/60 leading-tight">Holographic Ed.</span>
                  </div>

                  {/* Right Column - Issue Date */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                      <span className="text-xs uppercase tracking-wide text-amber-900/60 leading-tight">Issued</span>
                      <span className="text-xs font-semibold text-amber-900 leading-tight">{formattedDate}</span>
                    </div>
                    <div className="w-1 h-8 bg-gradient-to-b from-amber-600 to-amber-800 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Bottom border */}
              <div className="h-1 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);

PokemonShareCard.displayName = "PokemonShareCard";
