import { useState, useEffect, useId } from 'react';
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
  face: '#6d28d9',      // 脸部特征色
};

export default function EvolvingAvatar({
  clarityLevel,
  gender = 'unknown',
  size = 40,
  isHighlight = false,
  className = ''
}: EvolvingAvatarProps) {
  const uniqueId = useId();
  const [showPulse, setShowPulse] = useState(false);
  const [prevLevel, setPrevLevel] = useState(clarityLevel);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // 检测用户是否偏好减少动态
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // 当clarityLevel提升时触发脉冲动画
  useEffect(() => {
    if (clarityLevel > prevLevel) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 600);
      setPrevLevel(clarityLevel);
      return () => clearTimeout(timer);
    }
    setPrevLevel(clarityLevel);
  }, [clarityLevel, prevLevel]);

  // 外部高亮触发
  useEffect(() => {
    if (isHighlight) {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 700);
      return () => clearTimeout(timer);
    }
  }, [isHighlight]);

  // 脸部特征透明度：随clarityLevel渐显
  const getFaceOpacity = () => {
    // 0级: 0.3, 1级: 0.45, 2级: 0.6, 3级: 0.75, 4级: 0.88, 5级: 1
    return 0.3 + clarityLevel * 0.14;
  };

  // 发光强度
  const getGlowIntensity = () => clarityLevel * 3;

  const gradientId = `avatar-gradient-${uniqueId}`;
  const highlightId = `avatar-highlight-${uniqueId}`;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      data-testid="evolving-avatar"
    >
      {/* 主头像容器 - 带呼吸动画 */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-visible"
        animate={prefersReducedMotion ? {} : {
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          boxShadow: clarityLevel >= 2 
            ? `0 0 ${getGlowIntensity()}px ${BRAND_COLORS.primary}50`
            : 'none',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          <defs>
            {/* 紫色径向渐变 */}
            <radialGradient id={gradientId} cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor={BRAND_COLORS.light} />
              <stop offset="50%" stopColor={BRAND_COLORS.medium} />
              <stop offset="100%" stopColor={BRAND_COLORS.primary} />
            </radialGradient>
            
            {/* 高光渐变 */}
            <radialGradient id={highlightId} cx="30%" cy="25%" r="35%">
              <stop offset="0%" stopColor="white" stopOpacity="0.5" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 主球体 */}
          <circle
            cx="50"
            cy="50"
            r="46"
            fill={`url(#${gradientId})`}
          />
          
          {/* 高光效果 */}
          <circle
            cx="50"
            cy="50"
            r="46"
            fill={`url(#${highlightId})`}
          />

          {/* 可爱脸部表情 - 随clarityLevel渐显 */}
          <g opacity={getFaceOpacity()}>
            {/* 左眼 - 圆点 */}
            <circle 
              cx="38" 
              cy="45" 
              r="4" 
              fill={BRAND_COLORS.face}
            />
            {/* 左眼高光 */}
            <circle 
              cx="39.5" 
              cy="43.5" 
              r="1.5" 
              fill="white"
              opacity={clarityLevel >= 3 ? 0.9 : 0.5}
            />
            
            {/* 右眼 - 圆点 */}
            <circle 
              cx="62" 
              cy="45" 
              r="4" 
              fill={BRAND_COLORS.face}
            />
            {/* 右眼高光 */}
            <circle 
              cx="63.5" 
              cy="43.5" 
              r="1.5" 
              fill="white"
              opacity={clarityLevel >= 3 ? 0.9 : 0.5}
            />
            
            {/* 微笑弧线 */}
            <path
              d="M 36 58 Q 50 68 64 58"
              stroke={BRAND_COLORS.face}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* Level 4+ 腮红 */}
          {clarityLevel >= 4 && (
            <g opacity={0.35}>
              <ellipse cx="30" cy="54" rx="6" ry="4" fill="#f472b6" />
              <ellipse cx="70" cy="54" rx="6" ry="4" fill="#f472b6" />
            </g>
          )}
        </svg>
      </motion.div>

      {/* 升级脉冲动画 */}
      <AnimatePresence>
        {showPulse && !prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1.4, opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              background: `radial-gradient(circle, ${BRAND_COLORS.primary}60 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Level 5 完成状态小星星 */}
      {clarityLevel >= 5 && !prefersReducedMotion && (
        <motion.div
          className="absolute -top-1 -right-1 text-yellow-400"
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </motion.div>
      )}
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
