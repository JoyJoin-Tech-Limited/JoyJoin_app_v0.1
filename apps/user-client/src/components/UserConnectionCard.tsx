import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, GraduationCap, Briefcase, MapPin, RotateCw, Globe, Star,
  PartyPopper, MessageSquare, Sparkles
} from "lucide-react";
import EnergyRing from "./EnergyRing";
import MysteryBadge from "./MysteryBadge";
import type { AttendeeData } from "@/lib/attendeeAnalytics";
import { calculateMatchQuality } from "@/lib/attendeeAnalytics";
import { getInterestLabel } from "@shared/interests";
import { getArchetypeImage } from "@/lib/archetypeImages";

// Topic label helper (topics are free-form strings, so we just return them as-is)
const getTopicLabel = (topic: string) => topic;

interface ConnectionTag {
  icon: string;
  label: string;
  type: "interest" | "background" | "experience";
  rarity: "common" | "rare" | "epic";
}

interface UserConnectionCardProps {
  attendee: AttendeeData;
  connectionTags: ConnectionTag[];
  topicMatchCount?: number;
  threadId?: string;
  onMessageClick?: (userId: string, threadId: string) => void;
}

// 12动物原型系统 - 背景颜色配置
const archetypeBgColors: Record<string, string> = {
  "开心柯基": "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40",
  "太阳鸡": "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40",
  "夸夸豚": "bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40",
  "机智狐": "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40",
  "淡定海豚": "bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40",
  "织网蛛": "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40",
  "暖心熊": "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40",
  "灵感章鱼": "bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/40",
  "沉思猫头鹰": "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40",
  "定心大象": "bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/40 dark:to-gray-950/40",
  "稳如龟": "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40",
  "隐身猫": "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/40 dark:to-slate-950/40",
};

// Constants for match point display
const DEFAULT_VISIBLE_COUNT = 3;
const MAX_MATCH_POINTS = 10;

export default function UserConnectionCard({
  attendee,
  connectionTags,
  topicMatchCount = 0,
  threadId,
  onMessageClick,
}: UserConnectionCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [revealedBadges, setRevealedBadges] = useState<Set<number>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Total connection points count (for energy ring - always use full count)
  const totalConnectionPoints = connectionTags.length;
  
  // Sort by rarity (epic > rare > common) and limit display to max
  const sortedTags = [...connectionTags]
    .sort((a, b) => {
      const rarityOrder = { epic: 0, rare: 1, common: 2 };
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    })
    .slice(0, MAX_MATCH_POINTS);
  
  // Display tags: show 3 by default, all when expanded
  const displayTags = isExpanded ? sortedTags : sortedTags.slice(0, DEFAULT_VISIBLE_COUNT);
  // Ensure hiddenCount is never negative
  const hiddenCount = Math.max(0, sortedTags.length - DEFAULT_VISIBLE_COUNT);

  const archetypeBgColor = attendee.archetype && archetypeBgColors[attendee.archetype]
    ? archetypeBgColors[attendee.archetype]
    : "bg-muted/20";
  const archetypeImage = getArchetypeImage(attendee.archetype);

  // Calculate match quality based on rarity
  const sparkPredictions = connectionTags.map(tag => ({
    text: tag.label,
    rarity: tag.rarity
  }));
  
  const matchQuality = calculateMatchQuality(sparkPredictions);

  const handleBadgeReveal = (index: number) => {
    setRevealedBadges((prev) => new Set(prev).add(index));
  };

  // All revealed when current display set is fully revealed
  const allRevealed = isExpanded 
    ? revealedBadges.size >= sortedTags.length 
    : revealedBadges.size >= displayTags.length;

  // Format display values
  const genderDisplay = attendee.gender === "Woman" ? "女" : 
                       attendee.gender === "Man" ? "男" : 
                       attendee.gender || "";
  
  const educationDisplay = attendee.educationLevel === "Bachelor's" ? "本科" :
                          attendee.educationLevel === "Master's" ? "硕士" :
                          attendee.educationLevel === "Doctorate" ? "博士" :
                          attendee.educationLevel || "";
  
  // Match number color to energy ring tier
  const numberColorClass = {
    epic: 'text-[#F59E0B]',    // Gold for epic
    rare: 'text-[#8B5CF6]',    // Purple for rare
    common: 'text-[#6B7280]'   // Gray for common
  }[matchQuality.qualityTier];

  return (
    <div
      className="min-w-[240px] w-[240px] flex-shrink-0"
      data-testid={`connection-card-${attendee.userId}`}
    >
      <div 
        className="relative h-[468px]"
        style={{ perspective: "1200px", willChange: "transform" }}
      >
        <motion.div
          className="relative w-full h-full"
          style={{ 
            transformStyle: "preserve-3d",
            willChange: "transform"
          }}
          animate={{ 
            rotateY: isFlipped ? 180 : 0,
          }}
          transition={{ 
            duration: 0.5,
            ease: [0.4, 0.0, 0.2, 1],
          }}
        >
          {/* Front Side - User Info */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(0deg)",
            }}
          >
            <Card className="h-full overflow-hidden border-2 hover-elevate transition-all">
              <CardContent className="p-4 space-y-4 h-full flex flex-col">
                {/* Upper Zone: User Identity */}
                <div className="flex gap-3 items-start">
                  {/* Left: Archetype Icon */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className={`w-14 h-14 rounded-xl ${archetypeBgColor} flex items-center justify-center p-1`}>
                      {archetypeImage ? (
                        <img src={archetypeImage} alt={attendee.archetype || ""} className="h-full w-full object-contain" />
                      ) : (
                        <User className="h-7 w-7 text-muted-foreground" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-center text-primary">
                      {attendee.archetype}
                    </div>
                  </div>

                  {/* Right: Personal Info */}
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="space-y-1">
                      <div className="font-bold text-base" data-testid={`text-name-${attendee.userId}`}>
                        {attendee.displayName}
                      </div>
                      {attendee.socialTag && (
                        <Badge 
                          variant="secondary" 
                          className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border-purple-300"
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          {attendee.socialTag}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {/* Gender · Age */}
                      {(genderDisplay || attendee.age) && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {genderDisplay && <span>{genderDisplay}</span>}
                            {genderDisplay && attendee.age && <span> · </span>}
                            {attendee.age && <span>{attendee.age}岁</span>}
                          </span>
                        </div>
                      )}

                      {/* Education */}
                      {educationDisplay && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <GraduationCap className="h-3 w-3 text-muted-foreground" />
                          <span>{educationDisplay}</span>
                        </div>
                      )}

                      {/* Industry */}
                      {attendee.industry && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span>{attendee.industry}</span>
                        </div>
                      )}

                      {/* Hometown */}
                      {attendee.hometownRegionCity && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{attendee.hometownRegionCity}</span>
                        </div>
                      )}

                      {/* Languages */}
                      {attendee.languagesComfort && attendee.languagesComfort.length > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground leading-relaxed">
                          <Globe className="h-3 w-3" />
                          <span>{attendee.languagesComfort.join(" · ")}</span>
                        </div>
                      )}

                      {/* Starred Favorite Interest */}
                      {attendee.interestFavorite && (
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-current" />
                          <span className="font-medium">{getInterestLabel(attendee.interestFavorite)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Happy Topics Section */}
                {attendee.topicsHappy && attendee.topicsHappy.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>喜欢聊</span>
                      </div>
                      {topicMatchCount > 0 && (
                        <Badge 
                          variant="secondary" 
                          className="text-xs px-2 py-0.5 bg-primary/10 text-primary"
                          data-testid="badge-topic-match"
                        >
                          {topicMatchCount}个共同话题
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {attendee.topicsHappy.slice(0, 3).map((topic, idx) => (
                        <Badge 
                          key={idx}
                          variant="secondary" 
                          className="text-xs px-2 py-0.5"
                        >
                          {getTopicLabel(topic)}
                        </Badge>
                      ))}
                      {attendee.topicsHappy.length > 3 && (
                        <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
                          +{attendee.topicsHappy.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Lower Zone: Energy Ring surrounding Connection Count */}
                <div className="flex-1 flex flex-col justify-center items-center gap-4 border-t pt-6">
                  {/* Energy Ring with Connection Count - always based on ALL tags */}
                  <div className="relative">
                    <EnergyRing 
                      percentage={matchQuality.percentage}
                      qualityTier={matchQuality.qualityTier}
                      visualBoost={matchQuality.visualBoost}
                      size={140}
                      strokeWidth={8}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className={`text-5xl font-bold ${numberColorClass}`}>
                          {totalConnectionPoints}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground mt-1 text-center px-2">
                          个潜在契合点
                        </div>
                      </div>
                    </EnergyRing>
                    {/* +N indicator when there are hidden tags */}
                    {hiddenCount > 0 && !isExpanded && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md"
                        data-testid={`badge-hidden-count-${attendee.userId}`}
                      >
                        +{hiddenCount}
                      </motion.div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      onClick={() => setIsFlipped(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover-elevate active-elevate-2 text-sm font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      data-testid={`button-flip-${attendee.userId}`}
                    >
                      <RotateCw className="h-4 w-4" />
                      翻转探索
                    </motion.button>
                    
                    {threadId && onMessageClick && (
                      <motion.button
                        onClick={() => onMessageClick(attendee.userId, threadId)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover-elevate active-elevate-2 text-sm font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        data-testid={`button-message-${attendee.userId}`}
                      >
                        <MessageSquare className="h-4 w-4" />
                        发消息
                      </motion.button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Back Side - Mystery Badges Only */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <Card className="h-full overflow-hidden border-2 hover-elevate transition-all">
              <CardContent className="p-4 h-full flex flex-col">
                {/* Header with title and flip back button */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    我们的潜在契合点
                  </div>
                  <motion.button
                    onClick={() => setIsFlipped(false)}
                    className="p-1.5 rounded-md hover-elevate active-elevate-2 text-muted-foreground"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    data-testid={`button-flip-back-${attendee.userId}`}
                  >
                    <RotateCw className="h-4 w-4" />
                  </motion.button>
                </div>

                {/* Mystery Badges Grid - sorted by rarity, with expand functionality */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="grid grid-cols-2 gap-3">
                    {displayTags.map((badge, idx) => (
                      <MysteryBadge
                        key={idx}
                        icon={badge.icon}
                        label={badge.label}
                        type={badge.type}
                        rarity={badge.rarity}
                        isRevealed={revealedBadges.has(idx)}
                        onReveal={() => handleBadgeReveal(idx)}
                        delay={idx * 0.1}
                      />
                    ))}
                  </div>
                  
                  {/* Expand/Collapse button */}
                  {hiddenCount > 0 && (
                    <motion.button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="w-full mt-3 py-2 text-sm text-primary hover:text-primary/80 flex items-center justify-center gap-1"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      data-testid={`button-expand-${attendee.userId}`}
                    >
                      {isExpanded ? (
                        <>收起</>
                      ) : (
                        <>查看更多 (+{hiddenCount})</>
                      )}
                    </motion.button>
                  )}
                </div>

                {/* Completion Message */}
                <AnimatePresence>
                  {allRevealed && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium pt-3 border-t mt-3"
                    >
                      <PartyPopper className="h-4 w-4" />
                      全部解锁完成
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
