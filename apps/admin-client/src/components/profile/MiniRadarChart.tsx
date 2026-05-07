import { motion } from "framer-motion";

interface MiniRadarChartProps {
  progress: number; // 0-100
  answeredQuestions: number;
  totalQuestions: number;
}

export default function MiniRadarChart({ progress, answeredQuestions, totalQuestions }: MiniRadarChartProps) {
  // Calculate how many dimensions to show based on progress
  const dimensionsToShow = Math.min(6, Math.floor((answeredQuestions / totalQuestions) * 6) + 1);
  
  // Mock data that "grows" as user answers
  const dimensions = [
    { label: "亲", value: progress * 0.7 },
    { label: "开", value: progress * 0.8 },
    { label: "严", value: progress * 0.6 },
    { label: "稳", value: progress * 0.75 },
    { label: "外", value: progress * 0.65 },
    { label: "正", value: progress * 0.85 },
  ];

  const size = 60;
  const center = size / 2;
  const maxRadius = size / 2 - 8;

  // Calculate polygon points
  const calculatePoint = (value: number, index: number, total: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return `${x},${y}`;
  };

  const visibleDimensions = dimensions.slice(0, dimensionsToShow);
  const points = visibleDimensions.map((dim, i) => 
    calculatePoint(dim.value, i, dimensionsToShow)
  ).join(' ');

  return (
    <div className="relative inline-block">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background circles */}
        {[20, 40, 60, 80, 100].map((percent, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={(maxRadius * percent) / 100}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="0.5"
            opacity={0.3}
          />
        ))}

        {/* Axis lines */}
        {visibleDimensions.map((_, i) => {
          const angle = (Math.PI * 2 * i) / dimensionsToShow - Math.PI / 2;
          const x2 = center + maxRadius * Math.cos(angle);
          const y2 = center + maxRadius * Math.sin(angle);
          return (
            <motion.line
              key={i}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--muted))"
              strokeWidth="0.5"
              opacity={0.4}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            />
          );
        })}

        {/* Data polygon */}
        {visibleDimensions.length >= 3 && (
          <motion.polygon
            points={points}
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
        )}

        {/* Data points */}
        {visibleDimensions.map((dim, i) => {
          const angle = (Math.PI * 2 * i) / dimensionsToShow - Math.PI / 2;
          const radius = (dim.value / 100) * maxRadius;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r="2"
              fill="hsl(var(--primary))"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            />
          );
        })}
      </svg>

      {/* Growing indicator */}
      {answeredQuestions > 0 && answeredQuestions < totalQuestions && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold"
        >
          ✨
        </motion.div>
      )}
    </div>
  );
}
