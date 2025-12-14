import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EvolvingAvatarProps {
  clarityLevel: number;
  gender?: 'male' | 'female' | 'unknown';
  size?: number;
  isHighlight?: boolean;
  className?: string;
}

export default function EvolvingAvatar({
  clarityLevel,
  gender = 'unknown',
  size = 40,
  isHighlight = false,
  className = ''
}: EvolvingAvatarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [showHighlight, setShowHighlight] = useState(false);
  const [prevLevel, setPrevLevel] = useState(clarityLevel);

  const baseColor = useMemo(() => {
    switch (gender) {
      case 'female': return { primary: '#ec4899', secondary: '#f472b6', tertiary: '#fce7f3' };
      case 'male': return { primary: '#3b82f6', secondary: '#60a5fa', tertiary: '#dbeafe' };
      default: return { primary: '#8b5cf6', secondary: '#a78bfa', tertiary: '#ede9fe' };
    }
  }, [gender]);

  useEffect(() => {
    if (clarityLevel > prevLevel) {
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 400);
      return () => clearTimeout(timer);
    }
    setPrevLevel(clarityLevel);
  }, [clarityLevel, prevLevel]);

  useEffect(() => {
    if (isHighlight) {
      setShowHighlight(true);
      const timer = setTimeout(() => setShowHighlight(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isHighlight]);

  useEffect(() => {
    if (clarityLevel < 3) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDistance = Math.max(window.innerWidth, window.innerHeight);
      const x = Math.max(-1, Math.min(1, (e.clientX - centerX) / maxDistance * 2));
      const y = Math.max(-1, Math.min(1, (e.clientY - centerY) / maxDistance * 2));
      setMousePos({ x: 0.5 + x * 0.15, y: 0.5 + y * 0.15 });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [clarityLevel]);

  const getOpacity = () => {
    const opacityMap = [0.55, 0.65, 0.75, 0.82, 0.88, 0.95];
    return opacityMap[Math.min(clarityLevel, 5)];
  };

  const getBlur = () => {
    const blurMap = [3, 2, 1.5, 1, 0.5, 0];
    return blurMap[Math.min(clarityLevel, 5)];
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      data-testid="evolving-avatar"
    >
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        animate={{
          opacity: getOpacity(),
          filter: `blur(${getBlur()}px)`,
        }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ background: 'transparent' }}
        >
          <defs>
            <radialGradient id={`faceGradient-${gender}`} cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor={baseColor.tertiary} />
              <stop offset="70%" stopColor={baseColor.secondary} />
              <stop offset="100%" stopColor={baseColor.primary} />
            </radialGradient>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {clarityLevel === 0 && (
            <g className="animate-pulse">
              <circle cx="50" cy="50" r="35" fill="none" stroke={baseColor.primary} strokeWidth="1.5" opacity="0.6" />
              <circle cx="50" cy="50" r="28" fill="none" stroke={baseColor.secondary} strokeWidth="1" opacity="0.5" />
              {[...Array(8)].map((_, i) => (
                <circle
                  key={i}
                  cx={50 + Math.cos(i * Math.PI / 4) * 20}
                  cy={50 + Math.sin(i * Math.PI / 4) * 20}
                  r="2.5"
                  fill={baseColor.primary}
                  opacity="0.7"
                />
              ))}
              <motion.circle
                cx="50"
                cy="50"
                r="25"
                fill={`url(#faceGradient-${gender})`}
                opacity="0.4"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </g>
          )}

          {clarityLevel === 1 && (
            <g>
              <ellipse cx="50" cy="48" rx="28" ry="32" fill={`url(#faceGradient-${gender})`} opacity="0.7" />
              <ellipse cx="50" cy="35" rx="22" ry="12" fill={baseColor.primary} opacity="0.45" />
              <rect x="35" y="42" width="30" height="8" rx="4" fill={baseColor.secondary} opacity="0.35" />
            </g>
          )}

          {clarityLevel === 2 && (
            <g>
              <ellipse cx="50" cy="50" rx="30" ry="35" fill={`url(#faceGradient-${gender})`} opacity="0.75" />
              <ellipse cx="50" cy="32" rx="25" ry="15" fill={baseColor.primary} opacity="0.55" />
              <ellipse cx="40" cy="45" rx="5" ry="3" fill={baseColor.primary} opacity="0.5" />
              <ellipse cx="60" cy="45" rx="5" ry="3" fill={baseColor.primary} opacity="0.5" />
              <ellipse cx="50" cy="55" rx="3" ry="2" fill={baseColor.primary} opacity="0.45" />
              <path d="M 42 65 Q 50 70 58 65" stroke={baseColor.primary} strokeWidth="2" fill="none" opacity="0.45" />
            </g>
          )}

          {clarityLevel >= 3 && (
            <g filter={clarityLevel >= 4 ? 'url(#softGlow)' : undefined}>
              <ellipse cx="50" cy="52" rx="32" ry="38" fill={`url(#faceGradient-${gender})`} opacity="0.7" />
              <ellipse cx="50" cy="30" rx="28" ry="18" fill={baseColor.primary} opacity="0.5" />
              
              <ellipse cx="38" cy="46" rx="6" ry="4" fill="white" opacity="0.9" />
              <ellipse cx="62" cy="46" rx="6" ry="4" fill="white" opacity="0.9" />
              
              <motion.circle
                cx={38 + (mousePos.x - 0.5) * 4}
                cy={46 + (mousePos.y - 0.5) * 2}
                r={clarityLevel >= 4 ? 2.5 : 2}
                fill={baseColor.primary}
                opacity={clarityLevel >= 4 ? 0.9 : 0.7}
              />
              <motion.circle
                cx={62 + (mousePos.x - 0.5) * 4}
                cy={46 + (mousePos.y - 0.5) * 2}
                r={clarityLevel >= 4 ? 2.5 : 2}
                fill={baseColor.primary}
                opacity={clarityLevel >= 4 ? 0.9 : 0.7}
              />
              
              <ellipse cx="50" cy="58" rx="4" ry="3" fill={baseColor.primary} opacity="0.5" />
              
              <path
                d="M 40 68 Q 50 75 60 68"
                stroke={baseColor.primary}
                strokeWidth={clarityLevel >= 4 ? 2.5 : 2}
                fill="none"
                opacity={clarityLevel >= 4 ? 0.7 : 0.5}
                strokeLinecap="round"
              />
              
              {clarityLevel >= 4 && (
                <>
                  <ellipse cx="30" cy="52" rx="8" ry="5" fill={baseColor.secondary} opacity="0.2" />
                  <ellipse cx="70" cy="52" rx="8" ry="5" fill={baseColor.secondary} opacity="0.2" />
                  <path d="M 32 46 Q 38 42 44 46" stroke={baseColor.primary} strokeWidth="1" fill="none" opacity="0.4" />
                  <path d="M 56 46 Q 62 42 68 46" stroke={baseColor.primary} strokeWidth="1" fill="none" opacity="0.4" />
                </>
              )}
            </g>
          )}
        </svg>
      </motion.div>

      <AnimatePresence>
        {showHighlight && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `0 0 ${size * 0.3}px ${size * 0.1}px ${baseColor.primary}`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.6, scale: 1.1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: `1px solid ${baseColor.primary}`,
          opacity: 0.3 + clarityLevel * 0.1,
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
