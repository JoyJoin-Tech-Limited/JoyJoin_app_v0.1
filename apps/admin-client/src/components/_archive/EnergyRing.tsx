import { motion } from "framer-motion";

interface EnergyRingProps {
  percentage: number;
  qualityTier: 'common' | 'rare' | 'epic';
  visualBoost?: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

export default function EnergyRing({
  percentage,
  qualityTier,
  visualBoost = 0,
  size = 120,
  strokeWidth = 8,
  children,
}: EnergyRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Apply visual boost to percentage
  const displayPercentage = Math.min(percentage + visualBoost, 100);
  
  // Quality tier configurations
  const tierConfigs = {
    common: {
      gradientId: 'commonGradient',
      colors: {
        start: '#6B7280',
        mid: '#9CA3AF',
        end: '#6B7280'
      },
      glowColor: 'rgba(107, 114, 128, 0.3)',
      glowIntensity: [6, 8, 6],
      breathDuration: 3,
      particleCount: 0
    },
    rare: {
      gradientId: 'rareGradient',
      colors: {
        start: '#8B5CF6',
        mid: '#A78BFA',
        end: '#C4B5FD'
      },
      glowColor: 'rgba(139, 92, 246, 0.5)',
      glowIntensity: [8, 12, 8],
      breathDuration: 2.5,
      particleCount: 0
    },
    epic: {
      gradientId: 'epicGradient',
      colors: {
        start: '#F59E0B',
        mid: '#FBBF24',
        end: '#FCD34D'
      },
      glowColor: 'rgba(245, 158, 11, 0.6)',
      glowIntensity: [10, 16, 10],
      breathDuration: 2,
      particleCount: 6
    }
  };

  const config = tierConfigs[qualityTier];
  
  // Calculate segments
  const segments = 8;
  const segmentLength = circumference / segments;
  const gapLength = segmentLength * 0.15;
  const activeSegmentLength = segmentLength - gapLength;
  
  const activeSegments = Math.ceil((displayPercentage / 100) * segments);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        <defs>
          {/* Quality-based gradient */}
          <linearGradient id={config.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.colors.start} stopOpacity="1" />
            <stop offset="50%" stopColor={config.colors.mid} stopOpacity="0.95" />
            <stop offset="100%" stopColor={config.colors.end} stopOpacity="1" />
          </linearGradient>
          
          {/* Quality-based glow effect */}
          <filter id={`${qualityTier}Glow`}>
            <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Ring segments */}
        {Array.from({ length: segments }).map((_, index) => {
          const isActive = index < activeSegments;
          const offset = index * segmentLength;
          
          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={isActive ? `url(#${config.gradientId})` : "hsl(var(--muted))"}
              strokeWidth={strokeWidth}
              strokeDasharray={`${activeSegmentLength} ${circumference - activeSegmentLength}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              opacity={isActive ? 1 : 0.15}
              filter={isActive ? `url(#${qualityTier}Glow)` : "none"}
              initial={{ opacity: 0 }}
              animate={{
                opacity: isActive ? [0.75, 1, 0.75] : 0.15,
                filter: isActive 
                  ? [
                      `url(#${qualityTier}Glow) drop-shadow(0 0 ${config.glowIntensity[0]}px ${config.glowColor})`,
                      `url(#${qualityTier}Glow) drop-shadow(0 0 ${config.glowIntensity[1]}px ${config.glowColor})`,
                      `url(#${qualityTier}Glow) drop-shadow(0 0 ${config.glowIntensity[2]}px ${config.glowColor})`
                    ]
                  : "none"
              }}
              transition={{
                duration: config.breathDuration,
                repeat: Infinity,
                ease: "easeInOut",
                delay: index * 0.1,
              }}
              data-testid={`energy-segment-${index}`}
            />
          );
        })}

        {/* Epic tier: flowing light effect */}
        {qualityTier === 'epic' && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#epicGradient)"
            strokeWidth={strokeWidth * 0.5}
            strokeDasharray={`${activeSegmentLength * 0.3} ${circumference}`}
            strokeLinecap="round"
            opacity={0.6}
            animate={{
              strokeDashoffset: [0, -circumference],
              opacity: [0.4, 0.7, 0.4]
            }}
            transition={{
              strokeDashoffset: {
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              },
              opacity: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>

      {/* Epic tier: particle orbit effect */}
      {qualityTier === 'epic' && config.particleCount > 0 && (
        <>
          {Array.from({ length: config.particleCount }).map((_, i) => {
            const angle = (i * 360) / config.particleCount;
            return (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-amber-400"
                style={{
                  left: '50%',
                  top: '50%',
                }}
                animate={{
                  x: [
                    Math.cos((angle * Math.PI) / 180) * (radius + strokeWidth / 2),
                    Math.cos(((angle + 360) * Math.PI) / 180) * (radius + strokeWidth / 2)
                  ],
                  y: [
                    Math.sin((angle * Math.PI) / 180) * (radius + strokeWidth / 2),
                    Math.sin(((angle + 360) * Math.PI) / 180) * (radius + strokeWidth / 2)
                  ],
                  opacity: [0.6, 1, 0.6],
                  scale: [0.8, 1.2, 0.8]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "linear",
                  delay: i * 0.15
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
