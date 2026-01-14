/**
 * SpiralWaveAnimation - Magical AI synthesis visualization
 * 
 * Features:
 * - 5 breathing rings with staggered animations
 * - Rotating spiral path with pathLength animation
 * - 8 sparkle particles with random drift
 * - Purple-pink gradient matching brand colors
 * - Glow filter for magical effect
 * - Respects prefers-reduced-motion (shows static sparkle if enabled)
 */

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function SpiralWaveAnimation() {
  const prefersReducedMotion = useReducedMotion();

  // If user prefers reduced motion, show a simple static sparkle
  if (prefersReducedMotion) {
    return (
      <div className="relative w-64 h-64 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-8xl"
        >
          ✨
        </motion.div>
      </div>
    );
  }

  // Spiral path data (Archimedean spiral)
  const spiralPath = generateSpiralPath(100, 5, 2);

  return (
    <svg
      width="256"
      height="256"
      viewBox="0 0 256 256"
      className="relative"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Define gradient */}
      <defs>
        <linearGradient id="spiral-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 5 Breathing rings */}
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.circle
          key={`ring-${i}`}
          cx="128"
          cy="128"
          r={40 + i * 15}
          fill="none"
          stroke="url(#spiral-gradient)"
          strokeWidth="2"
          opacity={0.2}
          filter="url(#glow)"
          animate={{
            scale: [0.8, 1.2, 0.8],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            delay: i * 0.1,
            ease: [0.34, 1.56, 0.64, 1], // Spring-like cubic-bezier
          }}
          style={{ transformOrigin: "128px 128px" }}
        />
      ))}

      {/* Rotating spiral path */}
      <motion.path
        d={spiralPath}
        fill="none"
        stroke="url(#spiral-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#glow)"
        initial={{ pathLength: 0, rotate: 0 }}
        animate={{
          pathLength: [0, 1, 0],
          rotate: 360,
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: [0.34, 1.56, 0.64, 1],
        }}
        style={{ transformOrigin: "128px 128px" }}
      />

      {/* 8 Sparkle particles */}
      {generateSparklePositions(8).map((pos, i) => (
        <motion.circle
          key={`sparkle-${i}`}
          cx={pos.x}
          cy={pos.y}
          r="3"
          fill="#ec4899"
          filter="url(#glow)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
            x: [0, pos.driftX, 0],
            y: [0, pos.driftY, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.15,
            ease: [0.34, 1.56, 0.64, 1],
          }}
        />
      ))}
    </svg>
  );
}

// Helper function to generate spiral path (Archimedean spiral)
function generateSpiralPath(centerX: number, turns: number, spacing: number): string {
  const points: string[] = [];
  const steps = 100;
  
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * turns * 2 * Math.PI;
    const radius = spacing * angle;
    const x = centerX + radius * Math.cos(angle);
    const y = centerX + radius * Math.sin(angle);
    
    if (i === 0) {
      points.push(`M ${x} ${y}`);
    } else {
      points.push(`L ${x} ${y}`);
    }
  }
  
  return points.join(' ');
}

// Helper function to generate sparkle positions with random drift
function generateSparklePositions(count: number) {
  const positions = [];
  const radius = 80;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    const x = 128 + radius * Math.cos(angle);
    const y = 128 + radius * Math.sin(angle);
    const driftX = (Math.random() - 0.5) * 20;
    const driftY = (Math.random() - 0.5) * 20;
    
    positions.push({ x, y, driftX, driftY });
  }
  
  return positions;
}
