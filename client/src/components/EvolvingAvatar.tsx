import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EvolvingAvatarProps {
  clarityLevel: number;
  gender?: 'male' | 'female' | 'unknown';
  size?: number;
  isHighlight?: boolean;
  className?: string;
}

// JoyJoin品牌紫色系
const BRAND_COLORS = {
  light: '#c4b5fd',     // 浅紫
  medium: '#a78bfa',    // 中紫
  primary: '#8b5cf6',   // 主紫
  dark: '#7c3aed',      // 深紫
};

export default function EvolvingAvatar({
  clarityLevel,
  gender = 'unknown',
  size = 40,
  isHighlight = false,
  className = ''
}: EvolvingAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPulse, setShowPulse] = useState(false);
  const [prevLevel, setPrevLevel] = useState(clarityLevel);

  // 当clarityLevel提升时触发脉冲动画
  useEffect(() => {
    if (clarityLevel > prevLevel) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 500);
      setPrevLevel(clarityLevel);
      return () => clearTimeout(timer);
    }
    setPrevLevel(clarityLevel);
  }, [clarityLevel, prevLevel]);

  // 外部高亮触发
  useEffect(() => {
    if (isHighlight) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isHighlight]);

  // 根据clarityLevel调整透明度和发光强度
  const getOpacity = () => {
    // 0级时略透明，5级时完全不透明
    return 0.7 + clarityLevel * 0.06;
  };

  const getGlowIntensity = () => {
    // 等级越高发光越强
    return clarityLevel * 2;
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      data-testid="evolving-avatar"
    >
      {/* 简单的紫色渐变球体 */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        animate={{
          opacity: getOpacity(),
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          boxShadow: clarityLevel >= 2 
            ? `0 0 ${getGlowIntensity()}px ${BRAND_COLORS.primary}40`
            : 'none',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <defs>
            {/* 紫色径向渐变 - 从浅到深 */}
            <radialGradient id="avatarGradient" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor={BRAND_COLORS.light} />
              <stop offset="50%" stopColor={BRAND_COLORS.medium} />
              <stop offset="100%" stopColor={BRAND_COLORS.primary} />
            </radialGradient>
            
            {/* 高光 */}
            <radialGradient id="highlightGradient" cx="30%" cy="25%" r="30%">
              <stop offset="0%" stopColor="white" stopOpacity="0.4" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 主球体 */}
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="url(#avatarGradient)"
          />
          
          {/* 高光效果 - 让球体更立体 */}
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="url(#highlightGradient)"
          />
        </svg>
      </motion.div>

      {/* 升级脉冲动画 */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1.3, opacity: [0, 0.5, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              background: `radial-gradient(circle, ${BRAND_COLORS.primary}50 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function calculateClarityLevel(collectedInfo: Record<string, any>): number {
  const fields = [
    'displayName',
    'gender',
    'birthYear',
    'currentCity',
    'occupationDescription',
    'interestsTop',
    'intent',
    'hometown',
    'hasPets',
    'relationshipStatus'
  ];

  let score = 0;
  fields.forEach(field => {
    const value = collectedInfo[field];
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length > 0) {
        score += 1;
      } else if (!Array.isArray(value)) {
        score += 1;
      }
    }
  });

  if (score === 0) return 0;
  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 6) return 3;
  if (score <= 8) return 4;
  return 5;
}
