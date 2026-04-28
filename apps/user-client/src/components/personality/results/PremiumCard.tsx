/**
 * PremiumCard - Web personality result hero card.
 *
 * A tangible, collectible-card-like object that serves as the focal point
 * of the personality result page. Features subtle CSS 3D tilt on hover
 * (desktop) and touch-drag (mobile), capped at 5° for subtlety.
 *
 * Design tokens:
 * - Substrate: Warm Beige (#F5F1E8)
 * - Shadows: soft layered shadows
 * - Typography: font-cn-display for archetype name
 * - Tilt: CSS perspective transforms, transform-only, 5° cap
 * - Reduced motion: instant static render, no tilt
 */

import { useRef, useState, useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Badge } from '@/components/ui/badge';
import { Crown } from 'lucide-react';
import type { ArchetypeSkillSet } from '@joyjoin/shared/personality/archetypeSkills';
import { archetypeRegistry } from '@shared/personality/archetypeRegistry';

interface PremiumCardProps {
  archetypeName: string;
  nickname: string;
  tagline: string;
  avatarUrl?: string;
  rarityPercentage?: number;
  typeNo: string;
  skillSet?: ArchetypeSkillSet;
  isDecisive?: boolean;
  gradientClass?: string;
  onMaterializeComplete?: () => void;
}

const CARD_SUBSTRATE = '#F5F1E8';
const CARD_BORDER_RADIUS = '24px';
const MAX_TILT_DEG = 5;

export function PremiumCard({
  archetypeName,
  nickname,
  tagline,
  avatarUrl,
  rarityPercentage,
  typeNo,
  skillSet,
  isDecisive,
  gradientClass = 'from-purple-500 to-pink-500',
  onMaterializeComplete,
}: PremiumCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isPressed, setIsPressed] = useState(false);

  // ─── 3D Tilt Handlers ───
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    setTilt({
      rotateX: Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, -deltaY * MAX_TILT_DEG)),
      rotateY: Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, deltaX * MAX_TILT_DEG)),
    });
  }, [prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsPressed(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    setIsPressed(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const touch = e.touches[0];
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (touch.clientX - centerX) / (rect.width / 2);
    const deltaY = (touch.clientY - centerY) / (rect.height / 2);
    setTilt({
      rotateX: Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, -deltaY * MAX_TILT_DEG)),
      rotateY: Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, deltaX * MAX_TILT_DEG)),
    });
  }, [prefersReducedMotion]);

  const handleTouchEnd = useCallback(() => {
    setTilt({ rotateX: 0, rotateY: 0 });
    setIsPressed(false);
  }, []);

  // ─── Materialization Animation ───
  const materializationVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.2 } } }
    : {
        hidden: { opacity: 0, scale: 0.85 },
        visible: {
          opacity: 1,
          scale: 1,
          transition: {
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1],
            onComplete: onMaterializeComplete,
          },
        },
      };

  const glowVariants: Variants = prefersReducedMotion
    ? { hidden: {}, visible: {} }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: [0, 0.5, 0.3],
          transition: { duration: 0.4, ease: 'easeOut' },
        },
      };

  return (
    <div className="relative flex flex-col items-center justify-center px-4 py-8">
      {/* Ambient glow behind card */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          variants={glowVariants}
          initial="hidden"
          animate="visible"
        >
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-gradient-to-br ${gradientClass} opacity-20 blur-3xl`}
          />
        </motion.div>
      )}

      {/* The Card */}
      <motion.div
        ref={cardRef}
        className="relative w-full max-w-sm select-none"
        style={{
          perspective: '1200px',
          touchAction: 'pan-y',
        }}
        variants={materializationVariants}
        initial="hidden"
        animate="visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="relative overflow-hidden transition-shadow duration-300"
          style={{
            background: CARD_SUBSTRATE,
            borderRadius: CARD_BORDER_RADIUS,
            boxShadow: isPressed
              ? '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)'
              : '0 24px 64px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
            transform: prefersReducedMotion
              ? 'none'
              : `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}
        >
          {/* Top accent bar */}
          <div
            className={`h-1.5 w-full bg-gradient-to-r ${gradientClass}`}
            aria-hidden="true"
          />

          {/* Card content */}
          <div className="p-6 space-y-4">
            {/* Header row: TYPE badge + rarity */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-muted-foreground tracking-wider">
                {typeNo}
              </span>
              <div className="flex items-center gap-2">
                {isDecisive && (
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-0.5">
                    <Crown className="w-3 h-3" />
                    高置信
                  </Badge>
                )}
                {typeof rarityPercentage === 'number' && (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    稀有度 {Math.round(rarityPercentage)}%
                  </span>
                )}
              </div>
            </div>

            {/* Avatar */}
            <div className="flex justify-center">
              <div
                className={`w-32 h-32 rounded-2xl bg-gradient-to-br ${gradientClass} p-1 shadow-lg`}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={archetypeRegistry[archetypeName]?.name ?? archetypeName}
                    className="w-full h-full rounded-xl object-cover bg-background"
                    loading="eager"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-background flex items-center justify-center">
                    <span className="text-4xl">✨</span>
                  </div>
                )}
              </div>
            </div>

            {/* Name + Nickname + Tagline */}
            <div className="text-center space-y-1">
              <h1 className="font-cn-display text-3xl font-bold text-foreground">
                {archetypeRegistry[archetypeName]?.name ?? archetypeName}
              </h1>
              {nickname && (
                <p className="text-sm font-medium text-primary">{nickname}</p>
              )}
              {tagline && (
                <p className="text-xs text-muted-foreground italic">{tagline}</p>
              )}
            </div>

            {/* Skill Chips */}
            {skillSet && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/60 border border-white/40 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    主动技
                  </span>
                  <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
                    {skillSet.activeSkill.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {skillSet.activeSkill.shortEffect}
                  </p>
                </div>
                <div className="rounded-xl bg-white/60 border border-white/40 p-3 text-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    被动技
                  </span>
                  <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
                    {skillSet.passiveSkill.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {skillSet.passiveSkill.shortEffect}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
