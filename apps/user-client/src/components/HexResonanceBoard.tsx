import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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
  E: {
    key: 'E',
    name: 'Emotional Stability',
    nameCn: '情绪稳定',
    description: '面对压力时的冷静程度',
    lowLabel: '细腻',
    highLabel: '淡定',
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
    lowLabel: '随性',
    highLabel: '自律',
  },
};

const TRAIT_ORDER = ['E', 'X', 'P', 'A', 'O', 'C'];

export default function HexResonanceBoard({ traitScores, primaryArchetype }: HexResonanceBoardProps) {
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);

  const hasAnyScores = traitScores && Object.values(traitScores).some(v => v !== undefined && v !== null);
  
  const traits: TraitData[] = TRAIT_ORDER.map((key) => ({
    ...TRAIT_CONFIG[key],
    score: Math.max(0, Math.min(100, traitScores?.[key as keyof typeof traitScores] ?? 50)),
  }));

  return (
    <Card data-testid="hex-resonance-board" className="overflow-hidden bg-card/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          你的特质谱系
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-6 px-4">
        <div className="space-y-6">
          {traits.map((trait, index) => (
            <motion.div
              key={trait.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-2 cursor-pointer"
              onClick={() => setSelectedTrait(selectedTrait === trait.key ? null : trait.key)}
            >
              <div className="flex justify-between items-center px-1">
                <span className="text-sm font-medium text-foreground/80">{trait.nameCn}</span>
                <span className="text-lg font-bold text-primary tabular-nums">
                  {Math.round(trait.score)}
                </span>
              </div>
              
              <div className="relative h-8 flex items-center">
                {/* Spectrum Labels */}
                <div className="absolute inset-0 flex justify-between items-center text-[10px] text-muted-foreground px-1 pointer-events-none">
                  <span className={cn(trait.score < 40 && "text-foreground font-medium")}>{trait.lowLabel}</span>
                  <span className={cn(trait.score > 60 && "text-foreground font-medium")}>{trait.highLabel}</span>
                </div>

                {/* Slider Track */}
                <div className="w-full h-1.5 bg-muted rounded-full relative overflow-hidden">
                  <motion.div 
                    className="absolute inset-y-0 left-0 bg-primary/20"
                    initial={{ width: 0 }}
                    animate={{ width: `${trait.score}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.5 + index * 0.1 }}
                  />
                </div>

                {/* Indicator Dot */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background shadow-sm z-10"
                  style={{ left: `calc(${trait.score}% - 8px)` }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ 
                    type: "spring", 
                    stiffness: 260, 
                    damping: 20, 
                    delay: 0.8 + index * 0.1 
                  }}
                />
              </div>

              {/* Expansion Detail */}
              <AnimatePresence>
                {selectedTrait === trait.key && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg mt-1 border border-border/50">
                      {trait.description}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {!hasAnyScores && (
          <div className="mt-6 p-3 bg-muted/30 rounded-lg border border-dashed text-center">
            <p className="text-xs text-muted-foreground">
              这是基于初步印象的特质定位，完成更多互动后将自动校准
            </p>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground text-center mt-6">
          点击条目查看特质详情
        </p>
      </CardContent>
    </Card>
  );
}
