/**
 * InterestMapping Component
 * Duolingo-inspired interest visualization with insights and animations
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Star, Flame, Sparkles, TrendingUp, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  generateInterestInsights, 
  type InterestOption 
} from "@/lib/interestInsights";
import { Progress } from "@/components/ui/progress";

interface InterestMappingProps {
  selectedInterests: string[];
  primaryInterests: string[];
  allInterestsOptions: InterestOption[];
  archetype?: string;
}

export default function InterestMapping({
  selectedInterests,
  primaryInterests,
  allInterestsOptions,
  archetype,
}: InterestMappingProps) {
  // Generate insights
  const insights = useMemo(
    () => generateInterestInsights({
      selectedInterests,
      primaryInterests,
      allInterestsOptions,
      archetype,
    }),
    [selectedInterests, primaryInterests, allInterestsOptions, archetype]
  );

  // Get selected interest objects for display
  const selectedOptions = useMemo(
    () => allInterestsOptions.filter(opt => selectedInterests.includes(opt.id)),
    [allInterestsOptions, selectedInterests]
  );

  // Early return if no interests selected
  if (selectedOptions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h3 className="font-bold text-sm bg-gradient-to-r from-amber-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          ✨ 你的兴趣图谱
        </h3>
      </motion.div>

      {/* Interest Bubbles */}
      <div className="flex flex-wrap gap-2">
        {selectedOptions.map((interest, index) => {
          const isPrimary = primaryInterests.includes(interest.id);
          
          return (
            <motion.div
              key={interest.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                duration: 0.4, 
                delay: index * 0.05,
                type: "spring",
                stiffness: 300,
                damping: 20,
              }}
            >
              <Badge
                variant="secondary"
                className={`
                  px-3 py-1.5 text-sm font-medium
                  ${isPrimary 
                    ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-md" 
                    : "bg-gradient-to-r from-purple-400/20 to-pink-500/20 border-purple-300/30"
                  }
                  transition-transform hover:scale-105
                `}
              >
                <span className="mr-1.5">{interest.emoji}</span>
                {interest.label}
                {isPrimary && <Star className="ml-1.5 h-3 w-3 fill-current" />}
              </Badge>
            </motion.div>
          );
        })}
      </div>

      {/* Vibe Distribution */}
      {insights.vibePattern.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="w-6 h-px bg-gradient-to-r from-transparent to-border"></span>
            <span>📊 你的Vibe分布</span>
            <span className="flex-1 h-px bg-gradient-to-l from-transparent to-border"></span>
          </div>
          
          <div className="space-y-2">
            {insights.vibePattern.slice(0, 3).map((vibe, index) => (
              <motion.div
                key={vibe.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {vibe.emoji} {vibe.category}
                  </span>
                  <span className="text-muted-foreground">{vibe.percentage}%</span>
                </div>
                <Progress 
                  value={vibe.percentage} 
                  className="h-1.5 bg-gradient-to-r from-primary/10 to-purple-500/10"
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="grid grid-cols-2 gap-2"
      >
        {/* Diversity Score */}
        <div className="rounded-lg bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-xs font-medium text-muted-foreground">独特度</span>
          </div>
          <div className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {insights.diversityScore}/100
          </div>
        </div>

        {/* Rarity Score */}
        <div className="rounded-lg bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Flame className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs font-medium text-muted-foreground">稀有度</span>
          </div>
          <div className="text-lg font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            {insights.rarityScore}/100
          </div>
        </div>
      </motion.div>

      {/* Tagline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="rounded-lg bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border border-primary/20 p-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-xs">{insights.topEmoji}</span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">🎯 你的标签</span>
        </div>
        <p className="text-sm font-semibold text-foreground leading-relaxed">
          {insights.tagline}
        </p>
      </motion.div>

      {/* Fun Fact */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="rounded-lg bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border border-green-500/20 p-3"
      >
        <div className="flex items-start gap-2">
          <div className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mt-0.5">
            <span className="text-xs">💡</span>
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-muted-foreground mb-1">有趣发现</div>
            <p className="text-sm text-foreground leading-relaxed">
              {insights.funFact}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Matching Potential */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.9 }}
        className="rounded-lg bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-500/20 p-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-muted-foreground">匹配潜力</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {insights.matchingPotential}%
            </span>
            <TrendingUp className="h-3 w-3 text-blue-500" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          与{insights.matchingPotential}%的用户有共同话题
        </p>
      </motion.div>
    </div>
  );
}
