/**
 * ConfidenceRing - SVG progress ring for confidence visualization
 */

import { memo } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface ConfidenceRingProps {
  /** Confidence value between 0 and 1 */
  confidence: number;
  /** Size of the ring in pixels */
  size: number;
  /** Stroke width of the ring */
  strokeWidth?: number;
  /** Color of the filled portion */
  color?: string;
  /** Background track color */
  trackColor?: string;
  /** Children to render in center */
  children?: React.ReactNode;
}

function ConfidenceRingComponent({
  confidence,
  size,
  strokeWidth = 4,
  color = "hsl(var(--primary))",
  trackColor = "hsl(var(--muted))",
  children,
}: ConfidenceRingProps) {
  const prefersReducedMotion = useReducedMotion();
  
  // Calculate SVG dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, confidence)));
  const center = size / 2;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          className="opacity-30"
        />
        
        {/* Confidence fill */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{
            duration: prefersReducedMotion ? 0 : 1,
            ease: "easeOut",
          }}
          style={{
            willChange: prefersReducedMotion ? "auto" : "stroke-dashoffset",
          }}
        />
      </svg>
      
      {/* Center content */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}

export const ConfidenceRing = memo(ConfidenceRingComponent);
