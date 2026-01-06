import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { archetypeAvatars } from "@/lib/archetypeAdapter";

interface AdjacentStyle {
  archetype: string;
  score: number;
  similarity: number;
  blendLabel: string;
  emoji: string;
}

interface AdjacentArchetypesOrbitProps {
  primaryArchetype: string;
  adjacentStyles: AdjacentStyle[];
  isDecisive: boolean;
}

const ARCHETYPE_COLORS: Record<string, string> = {
  "开心柯基": "border-amber-300 bg-amber-50",
  "太阳鸡": "border-orange-300 bg-orange-50",
  "夸夸豚": "border-pink-300 bg-pink-50",
  "机智狐": "border-orange-300 bg-orange-50",
  "淡定海豚": "border-cyan-300 bg-cyan-50",
  "织网蛛": "border-violet-300 bg-violet-50",
  "暖心熊": "border-rose-300 bg-rose-50",
  "灵感章鱼": "border-purple-300 bg-purple-50",
  "沉思猫头鹰": "border-indigo-300 bg-indigo-50",
  "定心大象": "border-slate-300 bg-slate-50",
  "稳如龟": "border-emerald-300 bg-emerald-50",
  "隐身猫": "border-gray-300 bg-gray-50"
};

export default function AdjacentArchetypesOrbit({
  primaryArchetype,
  adjacentStyles,
  isDecisive
}: AdjacentArchetypesOrbitProps) {
  if (!adjacentStyles || adjacentStyles.length === 0 || isDecisive) {
    return null;
  }

  const topAdjacent = adjacentStyles.slice(0, 3);
  // Fixed: Use 120° separation to prevent overlap (270°=top, 30°=bottom-right, 150°=bottom-left)
  const orbitPositions = [
    { angle: 270, distance: 80 },   // Top center
    { angle: 30, distance: 80 },    // Bottom right
    { angle: 150, distance: 80 },   // Bottom left
  ];

  return (
    <Card data-testid="adjacent-archetypes-orbit" className="overflow-hidden">
      <CardContent className="py-6">
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground px-4">
            你融合了多种特质，也带有一点
            <span className="font-semibold text-primary px-1">
              {topAdjacent.map(s => s.archetype).join("、")}
            </span>
            的影子
          </p>
        </div>

        <div className="relative w-full aspect-square max-w-[280px] mx-auto">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-dashed border-muted-foreground/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          >
            <div 
              className={cn(
                "w-24 h-24 rounded-full border-3 flex items-center justify-center shadow-lg bg-white",
                ARCHETYPE_COLORS[primaryArchetype] || "border-primary/30"
              )}
            >
              <img 
                src={archetypeAvatars[primaryArchetype]} 
                alt={primaryArchetype}
                className="w-20 h-20 object-contain"
                data-testid="img-orbit-primary"
              />
            </div>
            <div className="text-center mt-2">
              <Badge variant="secondary" className="text-xs font-medium px-3 py-1 shadow-sm">
                {primaryArchetype}
              </Badge>
            </div>
          </motion.div>

          {topAdjacent.map((adjacent, index) => {
            const pos = orbitPositions[index] || orbitPositions[0];
            const radian = (pos.angle * Math.PI) / 180;
            const x = Math.cos(radian) * pos.distance;
            const y = Math.sin(radian) * pos.distance;

            return (
              <motion.div
                key={adjacent.archetype}
                className="absolute top-1/2 left-1/2"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  x: x,
                  y: y,
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 150, 
                  delay: 0.3 + index * 0.15 
                }}
                style={{ 
                  marginLeft: "-32px",
                  marginTop: "-32px",
                  zIndex: 10 + index
                }}
              >
                <motion.div
                  animate={{ 
                    y: [0, -4, 0],
                  }}
                  transition={{ 
                    duration: 2 + index * 0.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="flex flex-col items-center"
                >
                  <div 
                    className={cn(
                      "w-16 h-16 rounded-full border-2 flex items-center justify-center bg-white shadow-md cursor-pointer hover:scale-110 transition-transform",
                      ARCHETYPE_COLORS[adjacent.archetype] || "border-muted"
                    )}
                    data-testid={`orbit-adjacent-${index}`}
                  >
                    <img 
                      src={archetypeAvatars[adjacent.archetype]} 
                      alt={adjacent.archetype}
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                  <div className="text-center mt-1 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-xs border border-muted/20">
                    <div className="text-[9px] font-bold text-foreground leading-none">
                      {adjacent.archetype}
                    </div>
                    <div className="text-[8px] text-muted-foreground font-medium leading-tight">
                      {adjacent.similarity}%
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {topAdjacent.map((adjacent) => (
            <Badge 
              key={adjacent.archetype}
              variant="outline" 
              className="text-xs"
              data-testid={`badge-adjacent-${adjacent.archetype}`}
            >
              {adjacent.archetype}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/70 text-center mt-3 italic">
          这不是"不准"，而是你的特质更丰富
        </p>
      </CardContent>
    </Card>
  );
}
