import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion } from "framer-motion";
import { Sparkles, Star, Quote, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { archetypeAvatars } from "@/lib/archetypeAdapter";
import TraitSpectrum from "@/components/TraitSpectrum";
import { useRef } from "react";

interface AdjacentStyle {
  archetype: string;
  score: number;
  similarity: number;
  blendLabel: string;
  emoji: string;
}

function getImageSizeForScore(score: number, isPrimary: boolean): { container: string; image: string } {
  if (isPrimary) {
    return { container: "w-24 h-24", image: "w-24 h-24" };
  }
  if (score >= 85) return { container: "w-16 h-16", image: "w-16 h-16" };
  if (score >= 80) return { container: "w-14 h-14", image: "w-14 h-14" };
  if (score >= 75) return { container: "w-12 h-12", image: "w-12 h-12" };
  return { container: "w-10 h-10", image: "w-10 h-10" };
}

function getOrbitAngles(count: number): number[] {
  if (count === 0) return [];
  if (count === 1) return [270];
  if (count === 2) return [240, 300];
  if (count === 3) return [210, 270, 330];
  if (count === 4) return [200, 250, 290, 340];
  return [180, 225, 270, 315, 0].slice(0, count);
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
  decisionReason?: string;
  onLearnMore?: () => void;
  onClaimCard?: () => void;
  traitScores?: {
    A?: number;
    O?: number;
    C?: number;
    E?: number;
    X?: number;
    P?: number;
  };
  uniqueTraits?: { trait: string; description: string }[];
  epicDescription?: string;
  styleQuote?: string;
  counterIntuitiveInsight?: {
    text: string;
    rarityPercentage: number;
  };
}

const ARCHETYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "corgi": { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-800 dark:text-amber-200", border: "border-amber-200 dark:border-amber-800" },
  "rooster": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-800 dark:text-orange-200", border: "border-orange-200 dark:border-orange-800" },
  "hamster_praise": { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-800 dark:text-pink-200", border: "border-pink-200 dark:border-pink-800" },
  "fox": { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-800 dark:text-orange-200", border: "border-orange-200 dark:border-orange-800" },
  "dolphin_calm": { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-800 dark:text-cyan-200", border: "border-cyan-200 dark:border-cyan-800" },
  "spider": { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-800 dark:text-violet-200", border: "border-violet-200 dark:border-violet-800" },
  "koala": { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-800 dark:text-rose-200", border: "border-rose-200 dark:border-rose-800" },
  "octopus": { bg: "bg-purple-50 dark:bg-purple-950/30", text: "text-purple-800 dark:text-purple-200", border: "border-purple-200 dark:border-purple-800" },
  "owl": { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-800 dark:text-indigo-200", border: "border-indigo-200 dark:border-indigo-800" },
  "elephant": { bg: "bg-slate-50 dark:bg-slate-950/30", text: "text-slate-800 dark:text-slate-200", border: "border-slate-200 dark:border-slate-800" },
  "turtle": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-800 dark:text-emerald-200", border: "border-emerald-200 dark:border-emerald-800" },
  "cat": { bg: "bg-gray-50 dark:bg-gray-950/30", text: "text-gray-800 dark:text-gray-200", border: "border-gray-200 dark:border-gray-800" }
};

const traitLabels: Record<string, string> = {
  A: '亲和力',
  O: '开放性',
  C: '责任心',
  E: '情绪稳定性',
  X: '外向性',
  P: '正能量',
};

function generateTraitNarrative(
  archetype: string,
  traitScores: Record<string, number | undefined>,
  adjacentStyles: AdjacentStyle[]
): string {
  const traits = Object.entries(traitScores)
    .filter(([_, score]) => score !== undefined)
    .map(([key, score]) => ({ key, score: score as number }))
    .sort((a, b) => b.score - a.score);
  
  const topTrait = traits[0];
  const secondTrait = traits[1];
  const runnerUp = adjacentStyles[0];
  
  if (!topTrait || !secondTrait) {
    return `你的特质组合让你展现出${archetype}的社交风格。`;
  }
  
  const topLabel = traitLabels[topTrait.key];
  const secondLabel = traitLabels[secondTrait.key];
  
  let narrative = `你的${topLabel}(${Math.round(topTrait.score)}分)和${secondLabel}(${Math.round(secondTrait.score)}分)让你展现出${archetype}的特质`;
  
  if (runnerUp && runnerUp.score >= 70) {
    narrative += `，同时也有一点${runnerUp.archetype}的影子`;
  }
  
  return narrative + '。';
}

function UniqueTraitsCarousel({ traits }: { traits: { trait: string; description: string }[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="border-t pt-4">
      <h4 className="text-sm font-medium flex items-center gap-2 mb-3 px-1">
        <Star className="w-4 h-4 text-yellow-500" />
        你的独特之处
      </h4>
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-2 px-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {traits.map((item, index) => (
          <motion.div 
            key={index}
            className="flex-shrink-0 min-w-[16rem] max-w-[18rem] snap-center rounded-xl border border-border/60 bg-card/90 p-4 space-y-2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.1 }}
            data-testid={`unique-trait-${index}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold text-xs">{index + 1}</span>
              </div>
              <span className="font-semibold text-base">{item.trait}</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.description}
            </p>
          </motion.div>
        ))}
      </div>
      {traits.length > 1 && (
        <div className="flex justify-center mt-3">
          <div className="h-1 w-12 rounded-full bg-muted/70" />
        </div>
      )}
    </div>
  );
}

export default function StyleSpectrum({
  primary,
  adjacentStyles,
  spectrumPosition,
  isDecisive,
  decisionReason,
  onLearnMore,
  onClaimCard,
  traitScores,
  uniqueTraits,
  epicDescription,
  styleQuote,
  counterIntuitiveInsight
}: StyleSpectrumProps) {
  const colors = ARCHETYPE_COLORS[primary.archetype] || { 
    bg: "bg-primary/5", text: "text-primary", border: "border-primary/20" 
  };

  const highScoreAdjacent = adjacentStyles
    .filter(style => style.score >= 70)
    .slice(0, 4)
    .sort((a, b) => b.score - a.score);

  const traitNarrative = traitScores 
    ? generateTraitNarrative(primary.archetype, traitScores, highScoreAdjacent)
    : null;

  const showOrbitalSection = highScoreAdjacent.length > 0;

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
          <CardContent className="space-y-6">
            <motion.div 
              className="text-center py-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <div className="mb-3 flex justify-center">
                <motion.div
                  className="relative"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-110" />
                  {archetypeAvatars[primary.archetype] ? (
                    <img 
                      src={archetypeAvatars[primary.archetype]} 
                      alt={primary.archetype}
                      className="relative w-24 h-24 object-contain drop-shadow-lg"
                      data-testid="img-spectrum-primary-avatar"
                    />
                  ) : (
                    <div 
                      className="relative w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center"
                      data-testid="img-spectrum-primary-avatar"
                    >
                      <Sparkles className="w-10 h-10 text-primary" />
                    </div>
                  )}
                </motion.div>
              </div>
              <h2 className={cn("text-2xl font-bold mb-1", colors.text)}>
                {primary.archetype}
              </h2>
              <p className="text-muted-foreground text-sm">
                {primary.tagline}
              </p>
              
              {traitNarrative && (
                <motion.p 
                  className="text-sm text-muted-foreground mt-4 px-4 leading-relaxed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {traitNarrative}
                </motion.p>
              )}
              
              {isDecisive && highScoreAdjacent.length > 0 && (
                <motion.p 
                  className="text-xs text-muted-foreground/70 mt-2 px-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  次要风格：{highScoreAdjacent.slice(0, 2).map(s => `${s.archetype}(${Math.round(s.score)}%)`).join("、")}
                </motion.p>
              )}
            </motion.div>

            {epicDescription && (
              <motion.div
                className="px-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {epicDescription}
                </p>
              </motion.div>
            )}

            {/* Golden Foil Claim Card Button */}
            {onClaimCard && (
              <motion.div
                className="px-2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  className="relative w-full min-h-[3.5rem] h-14 rounded-xl text-lg font-bold overflow-hidden bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200 border-2 border-yellow-500/50"
                  style={{
                    boxShadow: "0 4px 14px rgba(251, 191, 36, 0.4), 0 2px 6px rgba(234, 179, 8, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5)",
                    textShadow: "0 1px 2px rgba(0,0,0,0.1)"
                  }}
                  onClick={() => {
                    // Add haptic feedback for mobile
                    try {
                      if (navigator.vibrate) navigator.vibrate(50);
                    } catch (e) {
                      // Silently fail if vibrate API throws an error
                    }
                    onClaimCard();
                  }}
                  aria-label={`领取你的${primary.archetype}卡片`}
                >
                  {/* Shine animation effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    initial={{ x: "-100%" }}
                    animate={{ x: "200%" }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3,
                      ease: "linear"
                    }}
                    style={{ width: "50%" }}
                  />
                  
                  <div className="relative flex items-center justify-center gap-3 w-full text-amber-900">
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                    <span>领取你的{primary.archetype}卡片</span>
                    <Badge 
                      variant="secondary" 
                      className="ml-2 bg-white/30 backdrop-blur-sm border-amber-100/60 text-xs text-amber-900 font-bold animate-pulse" 
                      aria-label="限定版"
                    >
                      ✨ 限定
                    </Badge>
                  </div>
                </Button>
              </motion.div>
            )}

            {styleQuote && (
              <motion.div 
                className={cn(
                  "relative rounded-lg p-4 border-l-4",
                  colors.bg,
                  colors.border
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Quote className={cn("w-5 h-5 absolute top-3 left-3 opacity-40", colors.text)} />
                <p className={cn("text-sm font-medium italic pl-6", colors.text)}>
                  {styleQuote}
                </p>
              </motion.div>
            )}

            {uniqueTraits && uniqueTraits.length > 0 && (
              <UniqueTraitsCarousel traits={uniqueTraits} />
            )}

            {counterIntuitiveInsight && (
              <motion.div 
                className="border-t pt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">你可能不知道的</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {counterIntuitiveInsight.text}
                  </p>
                </div>
              </motion.div>
            )}

            {traitScores && (
              <div className="border-t pt-4">
                <div className="text-center mb-3">
                  <p className="text-xs text-muted-foreground">
                    你的特质谱系
                  </p>
                </div>
                <TraitSpectrum traitScores={traitScores} />
              </div>
            )}

            {showOrbitalSection && (
              <div className="border-t pt-4">
                <div className="text-center mb-2">
                  <p className="text-xs text-muted-foreground">
                    你的社交风格光谱
                  </p>
                </div>

                <div className="relative w-full aspect-square max-w-[240px] mx-auto">
                  <motion.div
                    className="absolute inset-6 rounded-full border-2 border-dashed border-muted-foreground/15"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                  />

                  <motion.div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                  >
                    <motion.div
                      className="flex flex-col items-center"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl scale-125" />
                        <div className={cn("relative rounded-full overflow-hidden", getImageSizeForScore(primary.score, true).container)}>
                          {archetypeAvatars[primary.archetype] ? (
                            <img 
                              src={archetypeAvatars[primary.archetype]} 
                              alt={primary.archetype}
                              className={cn("object-cover drop-shadow-lg", getImageSizeForScore(primary.score, true).image)}
                              data-testid="img-orbit-primary"
                            />
                          ) : (
                            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                              <Sparkles className="w-10 h-10 text-primary" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-center mt-1">
                        <div className="text-xs font-semibold text-foreground">
                          {primary.archetype}
                        </div>
                        <div className="text-[10px] text-primary font-bold">
                          {Math.round(primary.score)}%
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>

                  {highScoreAdjacent.map((adjacent, index) => {
                    if (!adjacent || !adjacent.archetype) return null;
                    
                    const angles = getOrbitAngles(highScoreAdjacent.length);
                    const angle = angles[index];
                    const distance = 85;
                    const radian = (angle * Math.PI) / 180;
                    const x = Math.cos(radian) * distance;
                    const y = Math.sin(radian) * distance;
                    
                    const sizeClass = getImageSizeForScore(adjacent.score, false);

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
                          animate={{ y: [0, -3, 0] }}
                          transition={{ 
                            duration: 2 + index * 0.5, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                          className="flex flex-col items-center"
                        >
                          <div 
                            className={cn(
                              "flex items-center justify-center cursor-pointer hover:scale-110 transition-transform rounded-full overflow-hidden",
                              sizeClass.container
                            )}
                            data-testid={`orbit-adjacent-${index}`}
                          >
                            {archetypeAvatars[adjacent.archetype] ? (
                              <img 
                                src={archetypeAvatars[adjacent.archetype]} 
                                alt={adjacent.archetype}
                                className={cn("object-cover drop-shadow-md", sizeClass.image)}
                              />
                            ) : (
                              <div className={cn(
                                "rounded-full border-2 flex items-center justify-center shadow-sm",
                                sizeClass.container,
                                ARCHETYPE_COLORS[adjacent.archetype]?.bg || "bg-muted",
                                ARCHETYPE_COLORS[adjacent.archetype]?.border || "border-border"
                              )}>
                                <span className={cn(
                                  "text-xs font-bold",
                                  ARCHETYPE_COLORS[adjacent.archetype]?.text || "text-foreground"
                                )}>{adjacent.archetype.slice(0, 2)}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-center mt-1 px-2 py-0.5 rounded-full">
                            <div className="text-[9px] font-medium text-foreground leading-none">
                              {adjacent.archetype}
                            </div>
                            <div className="text-[8px] text-muted-foreground font-medium leading-tight">
                              {Math.round(adjacent.score)}%
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-muted-foreground/60 text-center mt-2 italic">
                  这不是"不准"，而是你的特质更丰富
                </p>
              </div>
            )}

            {/* Debug Score Display - Development mode only */}
            {import.meta.env.DEV && (
              <div className="border-t pt-4">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2">
                      <Badge variant="outline" className="text-xs">🔍 Debug Scores</Badge>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <div className="text-xs space-y-1 p-3 bg-muted/50 rounded-lg font-mono">
                      <div>
                        Primary: {primary.archetype} - {Math.round(primary.score)}% (confidence: {(primary.confidence * 100).toFixed(1)}%)
                      </div>
                      {adjacentStyles.length > 0 && (
                        <>
                          <div className="mt-2">Adjacent styles:</div>
                          {adjacentStyles.map(adj => (
                            <div key={adj.archetype} className="pl-4">
                              • {adj.archetype}: {Math.round(adj.score)}% ({adj.blendLabel})
                            </div>
                          ))}
                        </>
                      )}
                      <div className="pt-2 border-t mt-2">
                        <div>Spectrum Position: X={spectrumPosition.xAxis.value.toFixed(2)}, Y={spectrumPosition.yAxis.value.toFixed(2)}</div>
                        <div>Is Decisive: {isDecisive ? 'Yes' : 'No'}</div>
                        {decisionReason && <div>Reason: {decisionReason}</div>}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
