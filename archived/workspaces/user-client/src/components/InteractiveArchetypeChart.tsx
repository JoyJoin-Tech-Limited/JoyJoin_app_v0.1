import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Users, X, type LucideIcon } from "lucide-react";

interface ArchetypeData {
  name: string;
  percentage: number;
  color: string;
  IconComponent: LucideIcon;
  description: string;
}

interface InteractiveArchetypeChartProps {
  data: ArchetypeData[];
}

export default function InteractiveArchetypeChart({ data }: InteractiveArchetypeChartProps) {
  const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeData | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.percentage, 0);
  let currentAngle = -90;

  return (
    <div className="space-y-2">
      <div className="relative w-full aspect-square max-w-[240px] mx-auto">
        <svg viewBox="0 0 200 200" className="transform -rotate-90">
          {data.map((item, index) => {
            const percentage = (item.percentage / total) * 100;
            const angle = (percentage / 100) * 360;
            const radius = 70;
            const strokeWidth = 20;
            const normalizedRadius = radius - strokeWidth / 2;
            const circumference = normalizedRadius * 2 * Math.PI;
            const strokeDashoffset = circumference - (percentage / 100) * circumference;

            const startAngle = currentAngle;
            currentAngle += angle;

            const isHovered = hoveredIndex === index;
            const isSelected = selectedArchetype?.name === item.name;
            const scale = isHovered || isSelected ? 1.05 : 1;

            return (
              <g key={item.name}>
                <circle
                  cx="100"
                  cy="100"
                  r={normalizedRadius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-300 cursor-pointer hover-elevate"
                  style={{
                    transform: `rotate(${startAngle}deg)`,
                    transformOrigin: "100px 100px",
                    opacity: isHovered || isSelected ? 1 : 0.85,
                    filter: isHovered || isSelected ? "brightness(1.2)" : "none",
                    strokeWidth: isHovered || isSelected ? strokeWidth + 2 : strokeWidth,
                  }}
                  onClick={() => setSelectedArchetype(item)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  data-testid={`chart-segment-${index}`}
                />
              </g>
            );
          })}
          
          <circle
            cx="100"
            cy="100"
            r="45"
            fill="hsl(var(--card))"
            className="pointer-events-none"
          />
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              {hoveredIndex !== null ? (() => {
                const HoveredIcon = data[hoveredIndex].IconComponent;
                return <HoveredIcon className="h-8 w-8" style={{ color: data[hoveredIndex].color }} />;
              })() : (
                <Users className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {hoveredIndex !== null ? `${data[hoveredIndex].percentage}%` : "人群"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {data.map((item, index) => (
          <motion.button
            key={item.name}
            onClick={() => setSelectedArchetype(item)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="flex items-center gap-1.5 p-1.5 rounded-md hover-elevate active-elevate-2 text-left transition-all"
            whileTap={{ scale: 0.98 }}
            data-testid={`archetype-button-${index}`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{item.name}</div>
              <div className="text-xs text-muted-foreground">{item.percentage}%</div>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {selectedArchetype && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-2" style={{ borderColor: selectedArchetype.color }}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex items-center justify-center">
                    <selectedArchetype.IconComponent className="h-6 w-6" style={{ color: selectedArchetype.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base mb-0.5">{selectedArchetype.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedArchetype.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedArchetype(null)}
                    className="text-muted-foreground hover:text-foreground p-1 hover-elevate active-elevate-2 rounded"
                    data-testid="button-close-archetype"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
