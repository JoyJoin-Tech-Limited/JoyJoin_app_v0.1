import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, ChevronLeft, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { archetypeAvatars } from "@/lib/archetypeAdapter";

interface AdjacentStyle {
  archetype: string;
  score: number;
  similarity: number;
  blendLabel: string;
  emoji: string;
}

interface StyleSpectrumProps {
  primary: {
    archetype: string;
    score: number;
    confidence: number;
    emoji: string;
    tagline: string;
  };
  adjacentStyles: AdjacentStyle[];
  spectrumPosition: {
    xAxis: { label: string; value: number };
    yAxis: { label: string; value: number };
  };
  isDecisive: boolean;
  onLearnMore?: () => void;
}

const ARCHETYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "开心柯基": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "太阳鸡": { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200" },
  "夸夸豚": { bg: "bg-pink-50", text: "text-pink-800", border: "border-pink-200" },
  "机智狐": { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-200" },
  "淡定海豚": { bg: "bg-cyan-50", text: "text-cyan-800", border: "border-cyan-200" },
  "织网蛛": { bg: "bg-violet-50", text: "text-violet-800", border: "border-violet-200" },
  "暖心熊": { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  "灵感章鱼": { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-200" },
  "沉思猫头鹰": { bg: "bg-indigo-50", text: "text-indigo-800", border: "border-indigo-200" },
  "定心大象": { bg: "bg-slate-50", text: "text-slate-800", border: "border-slate-200" },
  "稳如龟": { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
  "隐身猫": { bg: "bg-gray-50", text: "text-gray-800", border: "border-gray-200" }
};

export default function StyleSpectrum({
  primary,
  adjacentStyles,
  spectrumPosition,
  isDecisive,
  onLearnMore
}: StyleSpectrumProps) {
  const [activeAdjacentIndex, setActiveAdjacentIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  
  const colors = ARCHETYPE_COLORS[primary.archetype] || { 
    bg: "bg-primary/5", text: "text-primary", border: "border-primary/20" 
  };

  const handleNext = () => {
    setActiveAdjacentIndex((prev) => 
      prev < adjacentStyles.length - 1 ? prev + 1 : 0
    );
  };

  const handlePrev = () => {
    setActiveAdjacentIndex((prev) => 
      prev > 0 ? prev - 1 : adjacentStyles.length - 1
    );
  };

  return (
    <div className="space-y-4" data-testid="style-spectrum">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className={cn("border-2 shadow-lg overflow-hidden", colors.border, colors.bg)}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className={cn("text-lg flex items-center gap-2", colors.text)}>
                <Sparkles className="h-5 w-5" />
                你的社交风格
              </CardTitle>
              {!isDecisive && (
                <Badge variant="outline" className="text-xs">
                  多元风格
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <motion.div 
              className="text-center py-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="mb-2 flex justify-center">
                <img 
                  src={archetypeAvatars[primary.archetype]} 
                  alt={primary.archetype}
                  className="w-20 h-20 object-contain"
                  data-testid="img-spectrum-primary-avatar"
                />
              </div>
              <h2 className={cn("text-2xl font-bold mb-1", colors.text)}>
                {primary.archetype}
              </h2>
              <p className="text-muted-foreground text-sm">
                {primary.tagline}
              </p>
              
              <div className="flex items-center justify-center gap-2 mt-3">
                <Badge 
                  variant="secondary" 
                  className={cn("font-medium", colors.bg, colors.text)}
                >
                  匹配度 {primary.score}%
                </Badge>
                <Badge variant="outline" className="text-xs">
                  置信度 {Math.round(primary.confidence * 100)}%
                </Badge>
              </div>
            </motion.div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  你的相邻风格
                </h3>
                <div className="flex items-center gap-1">
                  {adjacentStyles.map((_, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        idx === activeAdjacentIndex 
                          ? "bg-primary" 
                          : "bg-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeAdjacentIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-background border"
                  >
                    <div className="flex-shrink-0">
                      <img 
                        src={archetypeAvatars[adjacentStyles[activeAdjacentIndex]?.archetype]} 
                        alt={adjacentStyles[activeAdjacentIndex]?.archetype}
                        className="w-10 h-10 object-contain"
                        data-testid={`img-spectrum-adjacent-${activeAdjacentIndex}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {adjacentStyles[activeAdjacentIndex]?.archetype}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {adjacentStyles[activeAdjacentIndex]?.similarity}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {adjacentStyles[activeAdjacentIndex]?.blendLabel}
                        {adjacentStyles[activeAdjacentIndex]?.archetype}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="absolute inset-y-0 left-0 flex items-center -ml-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full bg-background shadow-sm"
                    onClick={handlePrev}
                    data-testid="button-spectrum-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center -mr-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full bg-background shadow-sm"
                    onClick={handleNext}
                    data-testid="button-spectrum-next"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-toggle-spectrum-details"
            >
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                你的风格定位
              </span>
              <ChevronRight 
                className={cn(
                  "h-4 w-4 transition-transform",
                  showDetails && "rotate-90"
                )} 
              />
            </button>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{spectrumPosition.xAxis.label.split("←")[0]?.trim()}</span>
                        <span>{spectrumPosition.xAxis.label.split("→")[1]?.trim()}</span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full">
                        <motion.div 
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-md"
                          initial={{ left: "50%" }}
                          animate={{ left: `${spectrumPosition.xAxis.value}%` }}
                          transition={{ type: "spring", stiffness: 300 }}
                          style={{ marginLeft: "-8px" }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{spectrumPosition.yAxis.label.split("←")[0]?.trim()}</span>
                        <span>{spectrumPosition.yAxis.label.split("→")[1]?.trim()}</span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full">
                        <motion.div 
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary shadow-md"
                          initial={{ left: "50%" }}
                          animate={{ left: `${spectrumPosition.yAxis.value}%` }}
                          transition={{ type: "spring", stiffness: 300 }}
                          style={{ marginLeft: "-8px" }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground text-center pt-2">
                      这些滑块展示你在不同维度上的位置
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      {onLearnMore && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button 
            className="w-full" 
            onClick={onLearnMore}
            data-testid="button-learn-more-spectrum"
          >
            了解更多关于你的风格
          </Button>
        </motion.div>
      )}
    </div>
  );
}
