import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EvolvingAvatarProps {
  clarityLevel: number;
  gender?: 'male' | 'female' | 'unknown';
  size?: number;
  isHighlight?: boolean;
  className?: string;
}

// JoyJoin品牌紫色系 - 统一色调，不分性别
const BRAND_COLORS = {
  primary: '#8b5cf6',      // 紫色主色
  secondary: '#a78bfa',    // 紫色次色
  tertiary: '#c4b5fd',     // 紫色浅色
  glow: '#7c3aed',         // 发光紫
  face: '#ede9fe',         // 面部底色
  accent: '#6d28d9',       // 强调色
};

export default function EvolvingAvatar({
  clarityLevel,
  gender = 'unknown',
  size = 40,
  isHighlight = false,
  className = ''
}: EvolvingAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [showPulse, setShowPulse] = useState(false);
  const [prevLevel, setPrevLevel] = useState(clarityLevel);

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
      const timer = setTimeout(() => setShowPulse(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isHighlight]);

  // 整体倾斜追踪（level 2+）- 更自然的互动感
  useEffect(() => {
    if (clarityLevel < 2) {
      setTilt({ x: 0, y: 0 });
      return;
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxTilt = 8; // 最大倾斜角度
      
      const distanceX = (e.clientX - centerX) / window.innerWidth;
      const distanceY = (e.clientY - centerY) / window.innerHeight;
      
      setTilt({
        x: distanceX * maxTilt,
        y: distanceY * maxTilt * 0.5
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [clarityLevel]);

  // 信心环配置：每个level点亮一层
  const confidenceRings = useMemo(() => {
    const rings = [];
    const maxRings = 5;
    const baseRadius = 42; // 起始半径
    const ringGap = 4;     // 环间距
    
    for (let i = 0; i < maxRings; i++) {
      const isActive = i < clarityLevel;
      rings.push({
        radius: baseRadius + (i * ringGap),
        opacity: isActive ? 0.4 + (i * 0.08) : 0.08,
        strokeWidth: isActive ? 1.5 : 0.5,
        isActive,
        delay: i * 0.1
      });
    }
    return rings;
  }, [clarityLevel]);

  return (
    <div
      ref={containerRef}
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      data-testid="evolving-avatar"
    >
      {/* 主头像容器 - 带倾斜效果 */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-visible"
        animate={{
          rotateY: tilt.x,
          rotateX: -tilt.y,
        }}
        transition={{ type: 'spring', stiffness: 150, damping: 15 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* 品牌渐变 */}
            <radialGradient id="avatarGradient" cx="50%" cy="35%" r="60%">
              <stop offset="0%" stopColor={BRAND_COLORS.face} />
              <stop offset="60%" stopColor={BRAND_COLORS.tertiary} />
              <stop offset="100%" stopColor={BRAND_COLORS.secondary} />
            </radialGradient>
            
            {/* 发光效果 */}
            <filter id="avatarGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* 信心环渐变 */}
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={BRAND_COLORS.primary} />
              <stop offset="50%" stopColor={BRAND_COLORS.glow} />
              <stop offset="100%" stopColor={BRAND_COLORS.accent} />
            </linearGradient>
          </defs>

          {/* 信心环系统 - 从内到外渐进点亮 */}
          <g>
            {confidenceRings.map((ring, index) => (
              <motion.circle
                key={index}
                cx="50"
                cy="50"
                r={ring.radius}
                fill="none"
                stroke={ring.isActive ? "url(#ringGradient)" : BRAND_COLORS.tertiary}
                strokeWidth={ring.strokeWidth}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: ring.opacity,
                  scale: 1,
                  strokeDasharray: ring.isActive ? "none" : "2 4"
                }}
                transition={{ 
                  duration: 0.4, 
                  delay: ring.delay,
                  ease: 'easeOut'
                }}
              />
            ))}
          </g>

          {/* 基础头像圆形 - 始终清晰 */}
          <circle
            cx="50"
            cy="50"
            r="32"
            fill="url(#avatarGradient)"
            filter={clarityLevel >= 3 ? "url(#avatarGlow)" : undefined}
          />
          
          {/* 头像边框 */}
          <circle
            cx="50"
            cy="50"
            r="32"
            fill="none"
            stroke={BRAND_COLORS.primary}
            strokeWidth="1.5"
            opacity={0.6}
          />

          {/* 简约脸部符号 - 极简风格 */}
          <g opacity={0.85}>
            {/* 眼睛 - 简单圆点 */}
            <circle cx="40" cy="46" r="3" fill={BRAND_COLORS.primary} />
            <circle cx="60" cy="46" r="3" fill={BRAND_COLORS.primary} />
            
            {/* 微笑弧线 */}
            <path
              d="M 38 58 Q 50 66 62 58"
              stroke={BRAND_COLORS.primary}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </g>

          {/* Level 3+ 眼睛高光 */}
          {clarityLevel >= 3 && (
            <g>
              <circle cx="41" cy="45" r="1" fill="white" opacity="0.8" />
              <circle cx="61" cy="45" r="1" fill="white" opacity="0.8" />
            </g>
          )}

          {/* Level 4+ 腮红效果 */}
          {clarityLevel >= 4 && (
            <g opacity="0.25">
              <ellipse cx="32" cy="54" rx="6" ry="4" fill={BRAND_COLORS.secondary} />
              <ellipse cx="68" cy="54" rx="6" ry="4" fill={BRAND_COLORS.secondary} />
            </g>
          )}

          {/* Level 5 完整状态 - 额外光效 */}
          {clarityLevel >= 5 && (
            <motion.circle
              cx="50"
              cy="50"
              r="36"
              fill="none"
              stroke={BRAND_COLORS.glow}
              strokeWidth="1"
              opacity="0.5"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.5 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </svg>
      </motion.div>

      {/* 升级脉冲动画 - clarityLevel提升时触发 */}
      <AnimatePresence>
        {showPulse && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.4, opacity: [0, 0.6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              background: `radial-gradient(circle, ${BRAND_COLORS.glow}40 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* 外层装饰环 - 始终可见的边框 */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          border: `1px solid ${BRAND_COLORS.primary}`,
          opacity: 0.2 + clarityLevel * 0.1,
        }}
      />
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
