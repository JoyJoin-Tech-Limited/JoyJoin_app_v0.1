import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, GraduationCap, Briefcase, MapPin, Globe, Star,
  PartyPopper, MessageSquare, Sparkles, ChevronDown
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
  "corgi": "bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40",
  "rooster": "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40",
  "hamster_praise": "bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/40 dark:to-rose-950/40",
  "fox": "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40",
  "dolphin_calm": "bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40",
  "spider": "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40",
  "koala": "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/40",
  "octopus": "bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/40",
  "owl": "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40",
  "elephant": "bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-950/40 dark:to-gray-950/40",
  "turtle": "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/40",
  "cat": "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/40 dark:to-slate-950/40",
};

// Constants for match point display
const MAX_MATCH_POINTS = 10;

// Card height constants
const COLLAPSED_HEIGHT = 200;
const EXPANDED_HEIGHT = 468;

export default function UserConnectionCard({
  attendee,
  connectionTags,
  topicMatchCount = 0,
  threadId,
  onMessageClick,
}: UserConnectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [revealedBadges, setRevealedBadges] = useState<Set<number>>(new Set());
  
  // Total connection points count (for energy ring - always use full count)
  const totalConnectionPoints = connectionTags.length;
  
  // Sort by rarity (epic > rare > common) and limit display to max
  const sortedTags = [...connectionTags]
    .sort((a, b) => {
      const rarityOrder = { epic: 0, rare: 1, common: 2 };
      return rarityOrder[a.rarity] - rarityOrder[b.rarity];
    })
    .slice(0, MAX_MATCH_POINTS);
  
  // Pick highest rarity tag for collapsed view (first epic, or first rare, or first common)
  const topConnectionTag = sortedTags[0];

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

  const allRevealed = revealedBadges.size >= sortedTags.length;

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
      <motion.div
        animate={{ 
          height: isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
        }}
        transition={{ 
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className="overflow-hidden"
      >
        <Card 
          className="border-2 hover-elevate transition-all cursor-pointer"
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target && target.closest('button, [role="button"], a, input, textarea, [data-stop-card-toggle="true"]')) {
              return;
            }
            setIsExpanded((prev) => !prev);
          }}
        >
          <CardContent className="p-4 space-y-3">
            {/* Collapsed View - Minimal Info */}
            <AnimatePresence>
              {!isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {/* Archetype & Name */}
                  <div className="flex gap-3 items-center">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-xl ${archetypeBgColor} flex items-center justify-center p-1`}>
                        {archetypeImage ? (
                          <img src={archetypeImage} alt={attendee.archetype || ""} className="h-full w-full object-contain" />
                        ) : (
                          <User className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base truncate" data-testid={`text-name-${attendee.userId}`}>
                        {attendee.displayName}
                      </div>
                      <div className="text-xs text-primary font-medium">
                        {attendee.archetype}
                      </div>
                    </div>
                  </div>

                  {/* Top Connection Tag */}
                  {topConnectionTag && (
                    <div className="flex items-center justify-center">
                      <Badge 
                        variant={topConnectionTag.rarity === 'epic' ? 'default' : 'secondary'}
                        className={`text-xs px-3 py-1 ${
                          topConnectionTag.rarity === 'epic' ? 'bg-amber-500 text-white' :
                          topConnectionTag.rarity === 'rare' ? 'bg-purple-100 text-purple-700' :
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span className="mr-1">{topConnectionTag.icon}</span>
                        {topConnectionTag.label}
                      </Badge>
                    </div>
                  )}

                  {/* Tap Affordance */}
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <ChevronDown className="h-3 w-3" />
                    <span>点击查看更多</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Expanded View - Full Details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
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

                  {/* Connection Tags Section */}
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                      我们的潜在契合点
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                      {sortedTags.map((badge, idx) => (
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
                    
                    {/* Completion Message */}
                    <AnimatePresence>
                      {allRevealed && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ delay: 0.3 }}
                          className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium pt-2"
                        >
                          <PartyPopper className="h-4 w-4" />
                          全部解锁完成
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Energy Ring with Match Quality */}
                  <div className="flex justify-center items-center border-t pt-3">
                    <div className="relative">
                      <EnergyRing 
                        percentage={matchQuality.percentage}
                        qualityTier={matchQuality.qualityTier}
                        visualBoost={matchQuality.visualBoost}
                        size={100}
                        strokeWidth={6}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className={`text-3xl font-bold ${numberColorClass}`}>
                            {totalConnectionPoints}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground text-center px-1">
                            契合点
                          </div>
                        </div>
                      </EnergyRing>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {threadId && onMessageClick && (
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMessageClick(attendee.userId, threadId);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover-elevate active-elevate-2 text-sm font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      data-testid={`button-message-${attendee.userId}`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      发消息
                    </motion.button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
