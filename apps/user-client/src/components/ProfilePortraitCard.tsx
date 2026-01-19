/**
 * ProfilePortraitCard - Comprehensive profile portrait after interest selection
 * 
 * Displays:
 * - Basic info with avatar, archetype, profile completion
 * - Industry L1→L2→L3 hierarchy
 * - Personality traits with radar chart
 * - Interest map with heat-based category distribution and top priorities
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
  Heart,
  Target,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PersonalityRadarChart from "./PersonalityRadarChart";
import { archetypeConfig } from "@/lib/archetypes";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import { cn } from "@/lib/utils";

// Category configuration with visual styling
const CATEGORY_CONFIG: Record<string, { label: string; emoji: string; gradient: string }> = {
  career: { label: "职场野心", emoji: "💼", gradient: "from-blue-500 to-indigo-600" },
  philosophy: { label: "深度思想", emoji: "🧠", gradient: "from-purple-500 to-violet-600" },
  lifestyle: { label: "生活方式", emoji: "🍜", gradient: "from-green-500 to-emerald-600" },
  culture: { label: "文化娱乐", emoji: "🎬", gradient: "from-pink-500 to-rose-600" },
  city: { label: "城市探索", emoji: "🏙️", gradient: "from-orange-500 to-amber-600" },
  tech: { label: "前沿科技", emoji: "🚀", gradient: "from-cyan-500 to-blue-600" },
};

const HEAT_LEVEL_COLORS: Record<number, string> = {
  1: "bg-purple-100 text-purple-700 border-purple-300",
  2: "bg-pink-100 text-pink-700 border-pink-300",
  3: "bg-orange-100 text-orange-700 border-orange-300 shadow-orange-200 shadow-md",
};

// City name conversion helper
const getCityDisplayName = (city: string | undefined): string => {
  if (!city) return "";
  const cityMap: Record<string, string> = {
    "hongkong": "香港",
    "hong kong": "香港",
    "shenzhen": "深圳",
    "sz": "深圳",
  };
  const lowerCity = city.toLowerCase();
  return cityMap[lowerCity] || city;
};

// Relationship status labels
const RELATIONSHIP_LABELS: Record<string, string> = {
  "single": "单身",
  "in_relationship": "恋爱中",
  "married": "已婚",
  "divorced": "离异",
  "widowed": "丧偶",
  "complicated": "复杂",
  "开放": "开放",
  "保密": "保密",
};

// Intent labels
const INTENT_LABELS: Record<string, string> = {
  "make_friends": "交朋友",
  "dating": "脱单约会",
  "expand_network": "拓展人脉",
  "find_partner": "寻找合伙人",
  "casual_chat": "随便聊聊",
  "flexible": "随缘",
};

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

  // Fetch interest carousel data
  const { data: interestsData } = useQuery<any>({ 
    queryKey: ["/api/user/interests"],
    enabled: !!user?.hasCompletedInterestsCarousel,
  });

  // Get archetype config and avatar
  const archetype = user?.archetype || user?.primaryRole;
  const archetypeData = archetype ? archetypeConfig[archetype] : null;
  const archetypeAvatarUrl = archetype ? getArchetypeAvatar(archetype) : "";
  
  // Get display values for relationship status and intent
  const relationshipDisplay = user?.relationshipStatus 
    ? (RELATIONSHIP_LABELS[user.relationshipStatus] || user.relationshipStatus)
    : null;
  
  const intentDisplay = useMemo(() => {
    if (!user?.intent || !Array.isArray(user.intent) || user.intent.length === 0) {
      return null;
    }
    return user.intent.map((i: string) => INTENT_LABELS[i] || i).slice(0, 3);
  }, [user?.intent]);

  // Calculate age from birthdate or use age field
  const calculateAge = () => {
    if (user?.birthdate) {
      const birthDate = new Date(user.birthdate + 'T00:00:00');
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

  // Process interest carousel heat data
  const interestInsights = useMemo(() => {
    if (!interestsData?.selections || !Array.isArray(interestsData.selections)) {
      return null;
    }

    const { totalHeat, totalSelections, categoryHeat, selections } = interestsData;

    // Validate required data
    if (!categoryHeat || typeof categoryHeat !== 'object') {
      return null;
    }

    // Calculate average heat per selection for behavioral insights
    const avgHeat = totalSelections > 0 ? totalHeat / totalSelections : 0;

    // Generate behavioral insight message
    let behavioralInsight = "";
    if (avgHeat >= 20) {
      behavioralInsight = "你对兴趣的投入度很高！每个选择都经过深思熟虑。";
    } else if (avgHeat >= 10) {
      behavioralInsight = "你对喜欢的事物有明确的偏好，选择果断而清晰。";
    } else {
      behavioralInsight = "你保持开放的态度，愿意尝试各种有趣的事物。";
    }

    // Sort categories by total heat (descending) and take top 4
    const categoryDistribution = Object.entries(categoryHeat as Record<string, number>)
      .filter(([, heat]) => typeof heat === 'number' && heat > 0)
      .map(([categoryId, heat]) => ({
        categoryId,
        heat: heat as number,
        config: CATEGORY_CONFIG[categoryId] || { 
          label: categoryId, 
          emoji: "📌", 
          gradient: "from-gray-500 to-gray-600" 
        },
      }))
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 4);

    // Get top priority items (level 3 items)
    const topPriorityItems = selections
      .filter((s: any) => s.level === 3)
      .slice(0, 6);

    // Get top categories for compatibility teaser
    const topCategories = categoryDistribution.length > 0 
      ? categoryDistribution.slice(0, 2).map(c => c.config.label)
      : ["兴趣爱好", "生活方式"];

    return {
      totalHeat: totalHeat || 0,
      totalSelections: totalSelections || 0,
      avgHeat,
      behavioralInsight,
      categoryDistribution,
      topPriorityItems,
      topCategories,
    };
  }, [interestsData]);

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
              {/* Avatar with archetype badge - using transparent PNG */}
              <div className="relative">
                <div
                  onClick={() => setLocation("/personality-test/results")}
                  className="cursor-pointer rounded-full transition-transform hover:scale-105 bg-gradient-to-br from-purple-100 to-pink-100 p-1"
                  style={archetypeData?.color ? {
                    borderWidth: '3px',
                    borderColor: archetypeData.color.includes('purple') ? '#9333ea' : 
                                 archetypeData.color.includes('pink') ? '#ec4899' : '#9333ea',
                    borderStyle: 'solid',
                  } : undefined}
                >
                  <Avatar className="w-24 h-24 bg-transparent">
                    {archetypeAvatarUrl ? (
                      <AvatarImage 
                        src={archetypeAvatarUrl} 
                        alt={archetype || "头像"} 
                        className="object-contain p-1"
                      />
                    ) : (
                      <AvatarFallback className="text-4xl bg-gradient-to-br from-purple-100 to-pink-100">
                        {archetypeData?.icon || "✨"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </div>
                {archetype && (
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-gradient-to-r from-purple-600 to-pink-600 border-0 whitespace-nowrap">
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

                {/* Location - with Chinese conversion */}
                {user?.currentCity && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{getCityDisplayName(user.currentCity)}</span>
                  </div>
                )}

                {/* Relationship Status */}
                {relationshipDisplay && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Heart className="w-4 h-4 text-pink-500" />
                    <span>{relationshipDisplay}</span>
                  </div>
                )}

                {/* Social Intent */}
                {intentDisplay && intentDisplay.length > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="w-4 h-4 text-purple-500 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {intentDisplay.map((intent: string, idx: number) => (
                        <Badge 
                          key={idx} 
                          variant="secondary" 
                          className="text-xs bg-purple-100 text-purple-700 border-0"
                        >
                          {intent}
                        </Badge>
                      ))}
                    </div>
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
              <CardTitle className="flex items-center gap-2">
                <span>🗺️ 兴趣地图</span>
                <div className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>{interestInsights.totalHeat} 总热度</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Behavioral insight banner */}
              <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-purple-900">
                    {interestInsights.behavioralInsight}
                  </p>
                </div>
              </div>

              {/* Category heat distribution */}
              {interestInsights.categoryDistribution.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground">兴趣分布</h4>
                  {interestInsights.categoryDistribution.map((cat, i) => (
                    <div key={cat.categoryId} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span>{cat.config.emoji}</span>
                          <span className="font-medium">{cat.config.label}</span>
                        </div>
                        <span className="text-muted-foreground">{cat.heat} 热度</span>
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
                            cat.config.gradient
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, interestInsights.totalHeat > 0 ? (cat.heat / interestInsights.totalHeat) * 100 : 0)}%` }}
                          transition={{ duration: 1, delay: i * 0.1 + 0.2, ease: "easeOut" }}
                        />
                      </motion.div>
                    </div>
                  ))}
                </div>
              )}

              {/* Top priority interests (level 3) */}
              {interestInsights.topPriorityItems.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    我的优先级
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {interestInsights.topPriorityItems.map((item: any) => (
                      <motion.div
                        key={item.topicId}
                        className={cn(
                          "aspect-square border-2 rounded-lg p-2 flex flex-col items-center justify-center gap-1 relative",
                          HEAT_LEVEL_COLORS[item.level] || HEAT_LEVEL_COLORS[3]
                        )}
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2 }}
                      >
                        {/* Flame badge for level 3 */}
                        <div className="absolute top-1 right-1">
                          <Flame className="w-3 h-3 text-orange-600" />
                        </div>
                        <div className="text-2xl">{item.emoji}</div>
                        <div className="text-xs text-center line-clamp-2 font-medium">
                          {item.label}
                        </div>
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
                    和你兴趣最像的人通常关注{" "}
                    <span className="font-semibold">
                      {interestInsights.topCategories.join("、")}
                    </span>
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
