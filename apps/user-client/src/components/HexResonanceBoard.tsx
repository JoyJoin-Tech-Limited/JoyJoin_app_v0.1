import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface TraitData {
  key: string;
  name: string;
  nameCn: string;
  score: number;
  description: string;
  lowLabel: string;
  highLabel: string;
}

interface HexResonanceBoardProps {
  traitScores: {
    A?: number;
    O?: number;
    C?: number;
    E?: number;
    X?: number;
    P?: number;
  };
  primaryArchetype?: string;
}

const TRAIT_CONFIG: Record<string, Omit<TraitData, 'score'>> = {
  A: {
    key: 'A',
    name: 'Affinity',
    nameCn: '亲和力',
    description: '与他人建立温暖联系的能力',
    lowLabel: '独立',
    highLabel: '亲和',
  },
  O: {
    key: 'O',
    name: 'Openness',
    nameCn: '开放性',
    description: '对新事物的好奇心和接纳度',
    lowLabel: '务实',
    highLabel: '开放',
  },
  C: {
    key: 'C',
    name: 'Conscientiousness',
    nameCn: '责任心',
    description: '可靠性和计划性',
    lowLabel: '灵活',
    highLabel: '严谨',
  },
  E: {
    key: 'E',
    name: 'Emotional Stability',
    nameCn: '情绪稳定',
    description: '面对压力时的冷静程度',
    lowLabel: '敏感',
    highLabel: '稳定',
  },
  X: {
    key: 'X',
    name: 'Extraversion',
    nameCn: '外向性',
    description: '社交能量和主动性',
    lowLabel: '内敛',
    highLabel: '外向',
  },
  P: {
    key: 'P',
    name: 'Positivity',
    nameCn: '正能量',
    description: '乐观积极的态度',
    lowLabel: '沉稳',
    highLabel: '阳光',
  },
};

const TRAIT_ORDER = ['E', 'X', 'P', 'A', 'O', 'C'];

function getScoreLabel(score: number): string {
  if (score >= 80) return '非常突出';
  if (score >= 70) return '较为突出';
  if (score >= 55) return '适中偏高';
  if (score >= 45) return '均衡适中';
  if (score >= 30) return '适中偏低';
  return '相对低调';
}

export default function HexResonanceBoard({ traitScores, primaryArchetype }: HexResonanceBoardProps) {
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);

  // Check if we have actual trait scores
  const hasAnyScores = traitScores && Object.values(traitScores).some(v => v !== undefined && v !== null);
  
  // Use neutral defaults (50) for missing scores
  const traits: TraitData[] = TRAIT_ORDER.map((key) => ({
    ...TRAIT_CONFIG[key],
    score: Math.max(0, Math.min(100, traitScores?.[key as keyof typeof traitScores] ?? 50)),
  }));

  const selectedTraitData = selectedTrait ? traits.find(t => t.key === selectedTrait) : null;

  // Note: When hasAnyScores is false, we still render the neutral radar chart
  // but show an explanatory message below it

  // Calculate radar polygon points based on scores
  const centerX = 50;
  const centerY = 50;
  const maxRadius = 35;
  
  // Calculate vertices for the data polygon
  const getPolygonPoints = (scores: number[]) => {
    return scores.map((score, i) => {
      const angle = (i * 60 - 90) * (Math.PI / 180);
      const radius = (score / 100) * maxRadius;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  // Grid levels at 30, 50, 70, 100
  const gridLevels = [30, 50, 70, 100];
  
  // Label positions outside the hex
  const labelPositions = [
    { x: 50, y: 6 },    // Top - E
    { x: 88, y: 28 },   // Top right - X
    { x: 88, y: 72 },   // Bottom right - P
    { x: 50, y: 94 },   // Bottom - A
    { x: 12, y: 72 },   // Bottom left - O
    { x: 12, y: 28 },   // Top left - C
  ];

  const dataPoints = traits.map(t => t.score);
  const polygonPoints = getPolygonPoints(dataPoints);

  return (
    <Card data-testid="hex-resonance-board" className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          你的特质谱系
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="relative w-full aspect-square max-w-[300px] mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {/* Grid lines - hexagonal rings at each level */}
            {gridLevels.map((level) => {
              const radius = (level / 100) * maxRadius;
              const points = [0, 1, 2, 3, 4, 5].map(i => {
                const angle = (i * 60 - 90) * (Math.PI / 180);
                const x = centerX + radius * Math.cos(angle);
                const y = centerY + radius * Math.sin(angle);
                return `${x},${y}`;
              }).join(' ');
              
              return (
                <polygon
                  key={`grid-${level}`}
                  points={points}
                  fill="none"
                  stroke="hsl(var(--muted-foreground) / 0.15)"
                  strokeWidth="0.3"
                />
              );
            })}

            {/* Axis lines from center to each vertex */}
            {[0, 1, 2, 3, 4, 5].map(i => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const x = centerX + maxRadius * Math.cos(angle);
              const y = centerY + maxRadius * Math.sin(angle);
              return (
                <line
                  key={`axis-${i}`}
                  x1={centerX}
                  y1={centerY}
                  x2={x}
                  y2={y}
                  stroke="hsl(var(--muted-foreground) / 0.2)"
                  strokeWidth="0.3"
                />
              );
            })}

            {/* Data polygon - translucent fill with distinct stroke */}
            <motion.polygon
              points={polygonPoints}
              fill="hsl(var(--primary) / 0.2)"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              strokeLinejoin="round"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              style={{ transformOrigin: '50% 50%' }}
            />

            {/* Data points at each vertex with glow for high scores */}
            {traits.map((trait, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = (trait.score / 100) * maxRadius;
              const x = centerX + radius * Math.cos(angle);
              const y = centerY + radius * Math.sin(angle);
              const isHigh = trait.score >= 70;
              const isSelected = selectedTrait === trait.key;
              
              return (
                <g key={`point-${trait.key}`}>
                  {/* Glow effect for high scores */}
                  {isHigh && (
                    <motion.circle
                      cx={x}
                      cy={y}
                      r="3"
                      fill="hsl(var(--primary) / 0.4)"
                      animate={{
                        r: [3, 5, 3],
                        opacity: [0.4, 0.7, 0.4],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  )}
                  <motion.circle
                    cx={x}
                    cy={y}
                    r={isSelected ? 3.5 : 2.5}
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--background))"
                    strokeWidth="1"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="cursor-pointer"
                    onClick={() => setSelectedTrait(isSelected ? null : trait.key)}
                  />
                </g>
              );
            })}

            {/* Trait labels outside the hexagon */}
            {traits.map((trait, i) => {
              const pos = labelPositions[i];
              const isSelected = selectedTrait === trait.key;
              const isHigh = trait.score >= 70;
              
              return (
                <g 
                  key={`label-${trait.key}`} 
                  className="cursor-pointer"
                  onClick={() => setSelectedTrait(isSelected ? null : trait.key)}
                >
                  <text
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`text-[10px] font-medium pointer-events-none transition-colors ${
                      isSelected 
                        ? 'fill-primary' 
                        : isHigh 
                          ? 'fill-foreground' 
                          : 'fill-muted-foreground'
                    }`}
                  >
                    {trait.nameCn}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`text-[8px] pointer-events-none ${
                      isHigh ? 'fill-primary font-medium' : 'fill-muted-foreground'
                    }`}
                  >
                    {Math.round(trait.score)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <AnimatePresence mode="wait">
          {selectedTraitData ? (
            <motion.div
              key={selectedTraitData.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-3 bg-muted/50 rounded-lg border"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{selectedTraitData.nameCn}</span>
                <span className="text-xs text-muted-foreground">
                  {getScoreLabel(selectedTraitData.score)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {selectedTraitData.description}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{selectedTraitData.lowLabel}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedTraitData.score}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{selectedTraitData.highLabel}</span>
              </div>
              <div className="text-center mt-2">
                <span className="text-lg font-bold text-primary">{Math.round(selectedTraitData.score)}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </motion.div>
          ) : !hasAnyScores ? (
            <motion.div
              key="calibrating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-3 bg-muted/30 rounded-lg border border-dashed text-center"
            >
              <p className="text-xs text-muted-foreground">
                这是你的初始特质分布，完成更多问题后会更精准
              </p>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground text-center mt-4"
            >
              点击标签查看特质详情
            </motion.p>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
