import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, GraduationCap, Briefcase, MapPin, RotateCw, Globe, Star,
  Zap, Compass, MessageCircle, Target, Heart, Scale, Music, ThumbsUp,
  Dog, Sun, Sparkles, Search, Anchor, Network, Bird, Brain, Shell, Shield, PartyPopper, MessageSquare
} from "lucide-react";
import EnergyRing from "./EnergyRing";
import MysteryBadge from "./MysteryBadge";
import type { AttendeeData } from "@/lib/attendeeAnalytics";
import { calculateMatchQuality } from "@/lib/attendeeAnalytics";
import { getInterestLabel, getTopicLabel } from "@/data/interestsTopicsData";

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
}

// 12动物原型系统 - Lucide图标和颜色配置
const archetypeConfig: Record<string, { IconComponent: typeof Zap; color: string; bgColor: string }> = {
  "开心柯基": {
    IconComponent: Dog,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40"
  },
  "太阳鸡": {
    IconComponent: Sun,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40"
  },
  "夸夸豚": {
    IconComponent: ThumbsUp,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40"
  },
  "机智狐": {
    IconComponent: Search,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40"
  },
  "淡定海豚": {
    IconComponent: Anchor,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40"
  },
  "织网蛛": {
    IconComponent: Network,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40"
  },
  "暖心熊": {
    IconComponent: Heart,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40"
  },
  "灵感章鱼": {
    IconComponent: Sparkles,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/40"
  },
  "沉思猫头鹰": {
    IconComponent: Brain,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40"
  },
  "定心大象": {
    IconComponent: Shield,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/40 dark:to-gray-950/40"
  },
  "稳如龟": {
    IconComponent: Shell,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40"
  },
  "隐身猫": {
    IconComponent: Bird,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/40 dark:to-slate-950/40"
  },
  "火花塞": {
    IconComponent: Zap,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40"
  },
  "探索者": {
    IconComponent: Compass,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40"
  },
  "故事家": {
    IconComponent: MessageCircle,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40"
  },
  "挑战者": {
    IconComponent: Target,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40"
  },
  "连接者": {
    IconComponent: Heart,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40"
  },
  "协调者": {
    IconComponent: Scale,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40"
  },
  "氛围组": {
    IconComponent: Music,
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bgColor: "bg-gradient-to-br from-pink-50 to-fuchsia-50 dark:from-pink-950/40 dark:to-fuchsia-950/40"
  },
  "肯定者": {
    IconComponent: ThumbsUp,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-gradient-to-br from-teal-50 to-green-50 dark:from-teal-950/40 dark:to-green-950/40"
  },
};

export default function UserConnectionCard({
  attendee,
  connectionTags,
  topicMatchCount = 0,
}: UserConnectionCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [revealedBadges, setRevealedBadges] = useState<Set<number>>(new Set());

  const archetypeData = attendee.archetype && archetypeConfig[attendee.archetype]
    ? archetypeConfig[attendee.archetype]
    : { IconComponent: Sparkles, color: "text-muted-foreground", bgColor: "bg-muted/20" };

  // Calculate match quality based on rarity
  const sparkPredictions = connectionTags.map(tag => ({
    text: tag.label,
    rarity: tag.rarity
  }));
  
  const matchQuality = calculateMatchQuality(sparkPredictions);

  const handleBadgeReveal = (index: number) => {
    setRevealedBadges((prev) => new Set(prev).add(index));
  };

  const allRevealed = revealedBadges.size === connectionTags.length;

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
                    <div className={`w-14 h-14 rounded-xl ${archetypeData.bgColor} flex items-center justify-center`}>
                      <archetypeData.IconComponent className={`h-7 w-7 ${archetypeData.color}`} />
                    </div>
                    <div className={`text-xs font-semibold text-center ${archetypeData.color}`}>
                      {attendee.archetype}
                    </div>
                  </div>

                  {/* Right: Personal Info */}
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="font-bold text-base" data-testid={`text-name-${attendee.userId}`}>
                      {attendee.displayName}
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

                      {/* Education · Field of Study */}
                      {(educationDisplay || attendee.fieldOfStudy) && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <GraduationCap className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {educationDisplay && <span>{educationDisplay}</span>}
                            {educationDisplay && attendee.fieldOfStudy && <span className="text-muted-foreground"> · </span>}
                            {attendee.fieldOfStudy && <span className="text-muted-foreground">{attendee.fieldOfStudy}</span>}
                          </span>
                        </div>
                      )}

                      {/* Industry · Seniority */}
                      {(attendee.industry || attendee.seniority) && (
                        <div className="flex items-center gap-1.5 text-foreground">
                          <Briefcase className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {attendee.industry && <span>{attendee.industry}</span>}
                            {attendee.industry && attendee.seniority && <span className="text-muted-foreground"> · </span>}
                            {attendee.seniority && (
                              <span className="text-muted-foreground">
                                {attendee.seniority === "Junior" ? "初级" : 
                                 attendee.seniority === "Mid" ? "中级" : 
                                 attendee.seniority === "Senior" ? "高级" :
                                 attendee.seniority === "Founder" ? "创始人" : attendee.seniority}
                              </span>
                            )}
                          </span>
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
                  {/* Energy Ring with Connection Count */}
                  <EnergyRing 
                    percentage={matchQuality.percentage}
                    qualityTier={matchQuality.qualityTier}
                    visualBoost={matchQuality.visualBoost}
                    size={140}
                    strokeWidth={8}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className={`text-5xl font-bold ${numberColorClass}`}>
                        {connectionTags.length}
                      </div>
                      <div className="text-xs font-medium text-muted-foreground mt-1 text-center px-2">
                        个潜在契合点
                      </div>
                    </div>
                  </EnergyRing>

                  <motion.button
                    onClick={() => setIsFlipped(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover-elevate active-elevate-2 text-sm font-medium"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-testid={`button-flip-${attendee.userId}`}
                  >
                    <RotateCw className="h-4 w-4" />
                    点击翻转探索
                  </motion.button>
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

                {/* Mystery Badges Grid */}
                <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  <div className="grid grid-cols-2 gap-3">
                    {connectionTags.map((badge, idx) => (
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
