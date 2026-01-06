import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hexagon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TraitData {
  key: string;
  name: string;
  nameCn: string;
  score: number;
  description: string;
  lowLabel: string;
  highLabel: string;
  color: string;
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
    color: 'from-rose-400 to-pink-500',
  },
  O: {
    key: 'O',
    name: 'Openness',
    nameCn: '开放性',
    description: '对新事物的好奇心和接纳度',
    lowLabel: '务实',
    highLabel: '开放',
    color: 'from-violet-400 to-purple-500',
  },
  C: {
    key: 'C',
    name: 'Conscientiousness',
    nameCn: '责任心',
    description: '可靠性和计划性',
    lowLabel: '灵活',
    highLabel: '严谨',
    color: 'from-emerald-400 to-teal-500',
  },
  E: {
    key: 'E',
    name: 'Emotional Stability',
    nameCn: '情绪稳定',
    description: '面对压力时的冷静程度',
    lowLabel: '敏感',
    highLabel: '稳定',
    color: 'from-cyan-400 to-blue-500',
  },
  X: {
    key: 'X',
    name: 'Extraversion',
    nameCn: '外向性',
    description: '社交能量和主动性',
    lowLabel: '内敛',
    highLabel: '外向',
    color: 'from-amber-400 to-orange-500',
  },
  P: {
    key: 'P',
    name: 'Positivity',
    nameCn: '正能量',
    description: '乐观积极的态度',
    lowLabel: '沉稳',
    highLabel: '阳光',
    color: 'from-yellow-400 to-amber-500',
  },
};

const HEX_POSITIONS = [
  { x: 50, y: 8 },    // Top center - E
  { x: 85, y: 30 },   // Top right - X
  { x: 85, y: 70 },   // Bottom right - P
  { x: 50, y: 92 },   // Bottom center - A
  { x: 15, y: 70 },   // Bottom left - O
  { x: 15, y: 30 },   // Top left - C
];

const TRAIT_ORDER = ['E', 'X', 'P', 'A', 'O', 'C'];

function getScoreLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

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

  const traits: TraitData[] = TRAIT_ORDER.map((key) => ({
    ...TRAIT_CONFIG[key],
    score: traitScores[key as keyof typeof traitScores] ?? 50,
  }));

  const selectedTraitData = selectedTrait ? traits.find(t => t.key === selectedTrait) : null;

  return (
    <Card data-testid="hex-resonance-board" className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          你的特质谱系
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="relative w-full aspect-square max-w-[280px] mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {traits.map((trait, index) => {
              const pos = HEX_POSITIONS[index];
              const level = getScoreLevel(trait.score);
              const isSelected = selectedTrait === trait.key;
              const opacity = level === 'high' ? 1 : level === 'medium' ? 0.7 : 0.4;
              
              return (
                <g key={trait.key} className="cursor-pointer" onClick={() => setSelectedTrait(isSelected ? null : trait.key)}>
                  <defs>
                    <linearGradient id={`grad-${trait.key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" className={cn("stop-color-current", trait.color.split(' ')[0].replace('from-', 'text-'))} style={{ stopColor: 'currentColor' }} />
                      <stop offset="100%" className={cn("stop-color-current", trait.color.split(' ')[1]?.replace('to-', 'text-'))} style={{ stopColor: 'currentColor' }} />
                    </linearGradient>
                  </defs>
                  <motion.polygon
                    points="50,0 93.3,25 93.3,75 50,100 6.7,75 6.7,25"
                    fill={`hsl(var(--primary) / ${opacity})`}
                    stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                    strokeWidth={isSelected ? 1.5 : 0.5}
                    transform={`translate(${pos.x - 50}, ${pos.y - 50}) scale(0.16)`}
                    initial={{ scale: 0 }}
                    animate={{ 
                      scale: isSelected ? 1.15 : 1,
                      opacity: 1
                    }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 300, 
                      delay: index * 0.08 
                    }}
                    style={{ transformOrigin: `${pos.x}% ${pos.y}%` }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[4px] font-bold fill-foreground pointer-events-none"
                  >
                    {trait.nameCn}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 4.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[3px] fill-muted-foreground pointer-events-none"
                  >
                    {trait.score}
                  </text>
                </g>
              );
            })}
            
            {primaryArchetype && (
              <text
                x="50"
                y="50"
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-[5px] font-medium fill-primary/60"
              >
                {primaryArchetype}
              </text>
            )}
          </svg>

          {traits.map((trait, index) => {
            const pos = HEX_POSITIONS[index];
            const level = getScoreLevel(trait.score);
            
            if (level !== 'high') return null;
            
            return (
              <motion.div
                key={`glow-${trait.key}`}
                className="absolute w-3 h-3 rounded-full bg-primary/30 blur-sm"
                style={{ 
                  left: `${pos.x}%`, 
                  top: `${pos.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.3,
                }}
              />
            );
          })}
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
                <span className="text-lg font-bold text-primary">{selectedTraitData.score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground text-center mt-4"
            >
              点击六边形查看特质详情
            </motion.p>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
