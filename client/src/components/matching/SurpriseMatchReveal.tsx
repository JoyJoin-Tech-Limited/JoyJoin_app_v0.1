import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, 
  Star, 
  PartyPopper, 
  Gem,
  Heart,
  MapPin,
  Users,
  ChevronRight
} from "lucide-react";
import MatchPointsDisplay, { parseMatchPointsFromStrings, type MatchPoint } from "./MatchPointsDisplay";

interface SurpriseMatchRevealProps {
  matchPoints: string[];
  overallScore: number;
  onContinue: () => void;
  isFirstMatch?: boolean;
}

function getRarityLevel(matchPoints: MatchPoint[]): 'common' | 'rare' | 'epic' | 'legendary' {
  const rareCount = matchPoints.filter(p => p.isRare).length;
  if (rareCount >= 3) return 'legendary';
  if (rareCount >= 2) return 'epic';
  if (rareCount >= 1) return 'rare';
  return 'common';
}

const rarityConfig = {
  common: {
    label: '不错的匹配',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    icon: Users,
  },
  rare: {
    label: '优质匹配',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: Star,
  },
  epic: {
    label: '超级匹配',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: Gem,
  },
  legendary: {
    label: '传说匹配',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
    icon: PartyPopper,
  },
};

export default function SurpriseMatchReveal({
  matchPoints: matchPointStrings,
  overallScore,
  onContinue,
  isFirstMatch = false,
}: SurpriseMatchRevealProps) {
  const [stage, setStage] = useState<'countdown' | 'reveal' | 'details'>('countdown');
  const [countdown, setCountdown] = useState(3);

  const matchPoints = parseMatchPointsFromStrings(matchPointStrings);
  const rarity = getRarityLevel(matchPoints);
  const config = rarityConfig[rarity];
  const RarityIcon = config.icon;

  useEffect(() => {
    if (stage === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600);
      return () => clearTimeout(timer);
    } else if (stage === 'countdown' && countdown === 0) {
      setStage('reveal');
    }
  }, [stage, countdown]);

  useEffect(() => {
    if (stage === 'reveal') {
      const timer = setTimeout(() => setStage('details'), 1500);
      return () => clearTimeout(timer);
    }
  }, [stage]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        {stage === 'countdown' && (
          <motion.div
            key="countdown"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="text-center"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-8xl font-bold text-primary"
            >
              {countdown > 0 ? countdown : <Sparkles className="h-24 w-24 mx-auto" />}
            </motion.div>
            <p className="text-xl text-muted-foreground mt-4">
              {isFirstMatch ? '发现你的第一个匹配...' : '发现新匹配...'}
            </p>
          </motion.div>
        )}

        {stage === 'reveal' && (
          <motion.div
            key="reveal"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${config.bgColor} mb-4`}
              animate={{ 
                boxShadow: rarity !== 'common' 
                  ? ['0 0 0 0 rgba(168, 85, 247, 0.4)', '0 0 0 20px rgba(168, 85, 247, 0)', '0 0 0 0 rgba(168, 85, 247, 0.4)']
                  : undefined
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <RarityIcon className={`h-16 w-16 ${config.color}`} />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`text-3xl font-bold ${config.color}`}
            >
              {config.label}!
            </motion.h2>
            {rarity !== 'common' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-2 flex justify-center gap-1"
              >
                {[...Array(rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : 1)].map((_, i) => (
                  <Star key={i} className={`h-6 w-6 ${config.color} fill-current`} />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {stage === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <Card className="overflow-hidden">
              <div className={`p-4 ${config.bgColor}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RarityIcon className={`h-6 w-6 ${config.color}`} />
                    <span className={`font-bold ${config.color}`}>{config.label}</span>
                  </div>
                  <Badge variant="outline" className={config.color}>
                    匹配度 {overallScore}%
                  </Badge>
                </div>
              </div>
              
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    你们的共同点
                  </h3>
                  <MatchPointsDisplay 
                    matchPoints={matchPoints}
                    displayMode="tags"
                    showScore={false}
                  />
                </div>

                {matchPoints.filter(p => p.isRare).length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="p-3 rounded-lg bg-primary/5 border border-primary/10"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-sm font-medium">稀有匹配点</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {matchPoints.filter(p => p.isRare).map(p => p.label).join('、')}
                    </p>
                  </motion.div>
                )}

                <Button 
                  onClick={onContinue} 
                  className="w-full"
                  size="lg"
                  data-testid="button-continue-match"
                >
                  查看详情
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
