/**
 * ProfilePortraitCard - Comprehensive profile portrait after interest swiping
 * 
 * Displays:
 * - Basic info with avatar, archetype, profile completion
 * - Industry L1→L2→L3 hierarchy
 * - Personality traits with radar chart
 * - Interest map with category distribution and behavioral insights
 * - CTA to discover page
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Sparkles, 
  Users,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PersonalityRadarChart from "./PersonalityRadarChart";
import { archetypeConfig } from "@/lib/archetypes";
import { INTEREST_CARDS, MACRO_CATEGORY_LABELS, MACRO_CATEGORY_COLORS } from "@/data/interestCardsData";
import { cn } from "@/lib/utils";

interface ProfilePortraitCardProps {
  className?: string;
}

export function ProfilePortraitCard({ className }: ProfilePortraitCardProps) {
  const [, setLocation] = useLocation();
  
  // Fetch user data
  const { data: user } = useQuery<any>({ 
    queryKey: ["/api/auth/user"],
  });

  // Fetch personality assessment
  const { data: assessment } = useQuery<any>({ 
    queryKey: ["/api/assessment/result"],
  });

  // Get archetype config
  const archetype = user?.archetype || user?.primaryRole;
  const archetypeData = archetype ? archetypeConfig[archetype] : null;

  // Calculate age from birthdate or use age field
  const calculateAge = () => {
    if (user?.birthdate) {
      const birthDate = new Date(user.birthdate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    }
    return user?.age;
  };

  const age = calculateAge();

  // Gender emoji
  const genderEmoji = user?.gender === "女性" ? "👩" : user?.gender === "男性" ? "👨" : "";

  // Calculate profile completion
  const profileCompletion = useMemo(() => {
    const essentialFields = [
      user?.displayName,
      user?.gender,
      user?.birthdate || user?.age,
      user?.currentCity,
      user?.industryCategory || user?.industryCategoryLabel,
      user?.educationLevel,
    ];
    const completed = essentialFields.filter(Boolean).length;
    const total = essentialFields.length;
    return Math.round((completed / total) * 100);
  }, [user]);

  // Process interest swipe results
  const interestInsights = useMemo(() => {
    if (!user?.interestsDeep || !Array.isArray(user.interestsDeep)) {
      return null;
    }

    // Parse interest swipe results from interestsDeep
    // Format: "cardId:choice:reactionTimeMs"
    const swipeResults = user.interestsDeep
      .map((entry: string) => {
        const [cardId, choice, speedStr] = entry.split(':');
        return {
          cardId,
          choice,
          swipeSpeed: parseInt(speedStr) || 0,
        };
      })
      .filter((r: any) => r.cardId && r.choice);

    const lovedCards = swipeResults.filter((r: any) => r.choice === 'love');
    const likedCards = swipeResults.filter((r: any) => r.choice === 'like');
    const allLikedCards = [...lovedCards, ...likedCards];

    // Calculate average swipe speed for loved items
    const avgLovedSpeed = lovedCards.length > 0
      ? lovedCards.reduce((sum: number, r: any) => sum + r.swipeSpeed, 0) / lovedCards.length
      : null;

    // Category distribution
    const categoryMap = new Map<string, number>();
    allLikedCards.forEach((result: any) => {
      const card = INTEREST_CARDS.find(c => c.id === result.cardId);
      if (card) {
        const count = categoryMap.get(card.macroCategory) || 0;
        categoryMap.set(card.macroCategory, count + 1);
      }
    });

    const categoryDist = Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / allLikedCards.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Get loved card details
    const lovedCardDetails = lovedCards
      .slice(0, 8)
      .map((r: any) => INTEREST_CARDS.find(c => c.id === r.cardId))
      .filter(Boolean);

    return {
      avgLovedSpeed,
      categoryDist,
      lovedCards: lovedCardDetails,
    };
  }, [user?.interestsDeep]);

  // Top 2 traits
  const topTraits = useMemo(() => {
    if (!assessment) return [];
    
    const traits = [
      { name: '亲和力', score: assessment.affinityScore || 50 },
      { name: '开放性', score: assessment.opennessScore || 50 },
      { name: '责任心', score: assessment.conscientiousnessScore || 50 },
      { name: '情绪稳定', score: assessment.emotionalStabilityScore || 50 },
      { name: '外向性', score: assessment.extraversionScore || 50 },
      { name: '正能量', score: assessment.positivityScore || 50 },
    ];

    return traits
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
  }, [assessment]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.34, 1.56, 0.64, 1], // Spring easing
      },
    },
  };

  return (
    <motion.div
      className={cn("w-full max-w-2xl mx-auto space-y-6 p-4", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center space-y-2">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          你的专属画像
        </h1>
        <p className="text-sm text-muted-foreground">
          基于 AI 分析的个性化社交档案
        </p>
      </motion.div>

      {/* 1. Basic Info Card */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-br from-white to-gray-50 border-purple-100 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar with archetype badge */}
              <div className="relative">
                <div
                  onClick={() => setLocation("/personality-test/results")}
                  className="cursor-pointer rounded-full transition-transform hover:scale-105"
                  style={archetypeData?.color ? {
                    borderWidth: '4px',
                    borderColor: archetypeData.color.includes('purple') ? '#9333ea' : 
                                 archetypeData.color.includes('pink') ? '#ec4899' : '#9333ea',
                    borderStyle: 'solid',
                    padding: '2px',
                  } : undefined}
                >
                  <Avatar className="w-24 h-24">
                    <AvatarFallback className="text-4xl bg-gradient-to-br from-purple-100 to-pink-100">
                      {archetypeData?.icon || "✨"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {archetype && (
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-gradient-to-r from-purple-600 to-pink-600 border-0">
                    {archetype}
                  </Badge>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 space-y-3">
                {/* Name, gender, age */}
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{user?.displayName || "用户"}</h2>
                  {genderEmoji && <span className="text-lg">{genderEmoji}</span>}
                  {age && <span className="text-muted-foreground">{age}岁</span>}
                </div>

                {/* Location */}
                {user?.currentCity && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{user.currentCity}</span>
                  </div>
                )}

                {/* Industry L1→L2→L3 */}
                {(user?.industryCategoryLabel || user?.industrySegmentLabel || user?.industryNicheLabel) && (
                  <div className="flex items-start gap-2 text-sm">
                    <Briefcase className="w-4 h-4 mt-0.5 shrink-0 text-purple-600" />
                    <div className="flex flex-wrap items-center gap-1">
                      {user?.industryCategoryLabel && (
                        <span className="font-medium text-purple-600">{user.industryCategoryLabel}</span>
                      )}
                      {user?.industrySegmentLabel && (
                        <>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{user.industrySegmentLabel}</span>
                        </>
                      )}
                      {user?.industryNicheLabel && (
                        <>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                          <span className="text-pink-600 font-medium">{user.industryNicheLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Education */}
                {user?.educationLevel && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GraduationCap className="w-4 h-4" />
                    <span>{user.educationLevel}</span>
                  </div>
                )}

                {/* Profile completion */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">资料完整度</span>
                    <span className="font-semibold">{profileCompletion}%</span>
                  </div>
                  <Progress value={profileCompletion} className="h-2" />
                  {profileCompletion < 100 && (
                    <div className="flex items-center gap-1 text-xs text-purple-600">
                      <Sparkles className="w-3 h-3" />
                      <span>补全资料可解锁「VIP匹配」优先权</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 2. Personality Card */}
      {assessment && archetype && (
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>✨ 性格原型：{archetype}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Radar chart */}
              <div className="flex justify-center">
                <PersonalityRadarChart
                  affinityScore={assessment.affinityScore}
                  opennessScore={assessment.opennessScore}
                  conscientiousnessScore={assessment.conscientiousnessScore}
                  emotionalStabilityScore={assessment.emotionalStabilityScore}
                  extraversionScore={assessment.extraversionScore}
                  positivityScore={assessment.positivityScore}
                />
              </div>

              {/* Xiaoyue analysis */}
              {assessment.xiaoyueAnalysis && (
                <div className="p-4 bg-white/50 rounded-lg border border-purple-200">
                  <p className="text-sm text-muted-foreground italic">
                    {assessment.xiaoyueAnalysis}
                  </p>
                </div>
              )}

              {/* Top traits */}
              {topTraits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {topTraits.map((trait, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-purple-100 text-purple-700 border-0"
                    >
                      {trait.name} {Math.round(trait.score)}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 3. Interest Map Card */}
      {interestInsights && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle>🗺️ 兴趣地图</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Behavioral insight */}
              {interestInsights.avgLovedSpeed && interestInsights.avgLovedSpeed < 2000 && (
                <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-purple-900">
                      你对喜欢的内容平均只需{" "}
                      <span className="font-bold">
                        {(interestInsights.avgLovedSpeed / 1000).toFixed(1)}秒
                      </span>{" "}
                      就能决定，比85%的用户更果断！这说明你对自己的喜好很清楚。
                    </p>
                  </div>
                </div>
              )}

              {/* Category distribution bars */}
              {interestInsights.categoryDist.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">兴趣分布</h4>
                  {interestInsights.categoryDist.map((cat, i) => (
                    <div key={cat.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {MACRO_CATEGORY_LABELS[cat.category as keyof typeof MACRO_CATEGORY_LABELS]}
                        </span>
                        <span className="text-muted-foreground">{cat.percentage}%</span>
                      </div>
                      <motion.div
                        className="h-3 bg-gray-100 rounded-full overflow-hidden"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                      >
                        <motion.div
                          className={cn(
                            "h-full bg-gradient-to-r rounded-full",
                            MACRO_CATEGORY_COLORS[cat.category as keyof typeof MACRO_CATEGORY_COLORS]
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${cat.percentage}%` }}
                          transition={{ duration: 1, delay: i * 0.1 + 0.2, ease: "easeOut" }}
                        />
                      </motion.div>
                    </div>
                  ))}
                </div>
              )}

              {/* Loved items grid */}
              {interestInsights.lovedCards.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground">我的挚爱</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {interestInsights.lovedCards.map((card: any) => (
                      <motion.div
                        key={card.id}
                        className="aspect-square bg-white border-2 border-purple-200 rounded-lg p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-transform"
                        whileHover={{ scale: 1.05 }}
                      >
                        <div className="text-2xl">{card.label.slice(0, 2)}</div>
                        <div className="text-xs text-center line-clamp-1">{card.label}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibility teaser */}
              <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">
                    和你兴趣最像的人通常喜欢去{" "}
                    <span className="font-semibold">日料店、咖啡馆、艺术展</span>
                    ，期待在盲盒活动中遇见你！
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 4. CTA Button */}
      <motion.div variants={itemVariants} className="space-y-2 text-center">
        <Button
          size="lg"
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all"
          onClick={() => setLocation("/discover")}
        >
          <span className="mr-2">🎲</span>
          开始探索盲盒活动
        </Button>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
          <Sparkles className="w-4 h-4" />
          已为你匹配 37 场合适的小聚
        </p>
      </motion.div>
    </motion.div>
  );
}
