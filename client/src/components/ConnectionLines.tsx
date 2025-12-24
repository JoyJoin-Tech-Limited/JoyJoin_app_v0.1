import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface ConnectionPoint {
  x: number;
  y: number;
  id: string;
}

interface ConnectionLinesProps {
  points: ConnectionPoint[];
  containerRef?: React.RefObject<HTMLElement>;
}

export default function ConnectionLines({ points }: ConnectionLinesProps) {
  const [particles, setParticles] = useState<Array<{ id: string; pathIndex: number }>>([]);

  useEffect(() => {
    const initialParticles = points.slice(0, -1).map((_, index) => ({
      id: `particle-${index}`,
      pathIndex: index,
    }));
    setParticles(initialParticles);
  }, [points]);

  if (points.length < 2) return null;

  const paths: Array<[ConnectionPoint, ConnectionPoint]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    paths.push([points[i], points[i + 1]]);
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%" }}
    >
      <defs>
        <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
        </linearGradient>
        
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {paths.map(([start, end], index) => {
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        const controlY = midY - 30;

        const path = `M ${start.x} ${start.y} Q ${midX} ${controlY} ${end.x} ${end.y}`;

        return (
          <g key={`connection-${index}`}>
            <motion.path
              d={path}
              fill="none"
              stroke="url(#connectionGradient)"
              strokeWidth="2"
              strokeDasharray="5,5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1, delay: index * 0.2, ease: "easeInOut" }}
            />

            <motion.circle
              r="3"
              fill="hsl(var(--primary))"
              filter="url(#glow)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2,
                delay: index * 0.3,
                repeat: Infinity,
                repeatDelay: 1,
              }}
            >
              <animateMotion dur="2s" repeatCount="indefinite" path={path} />
            </motion.circle>
          </g>
        );
      })}
    </svg>
  );
}
