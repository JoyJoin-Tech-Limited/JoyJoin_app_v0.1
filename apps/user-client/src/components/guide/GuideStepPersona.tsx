import { motion } from "framer-motion";
import { User, Sparkles, Check, Briefcase, Heart, GraduationCap, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { guideCopy } from "@/copy/guide";
import { useQuery } from "@tanstack/react-query";
import {
  calculateProfileCompleteness,
  getRelationshipLabel,
  getEducationLabel,
  getIntentLabel,
  getIntentIcon,
  getCityLabel,
  calculateAge,
  type UserProfile,
} from "@/lib/profileHelpers";

interface GuideStepPersonaProps {
  /** 用户原型名称 */
  archetype?: string;
  /** 原型描述 */
  archetypeDescription?: string;
  /** 是否减少动画 */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * 引导页步骤 1: 用户画像预览卡片
 */
export function GuideStepPersona({
  archetype,
  archetypeDescription,
  reducedMotion = false,
  className,
}: GuideStepPersonaProps) {
  const copy = guideCopy.step1;
  
  // Fetch user data
  const { data: user } = useQuery<UserProfile>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user");
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      return response.json();
    },
  });
  
  const containerVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.4, ease: "easeOut" }
        },
      };
  
  const cardVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { scale: 0.9, opacity: 0 },
        visible: { 
          scale: 1, 
          opacity: 1,
          transition: { delay: 0.2, duration: 0.4, type: "spring", stiffness: 200 }
        },
      };
  
  // Calculate completeness
  const completeness = user ? calculateProfileCompleteness(user) : 0;
  const age = user?.birthdate ? calculateAge(user.birthdate) : null;
  
  // Get interests (top 6)
  const interests = user?.interests || [];
  const topInterests = interests.slice(0, 3);
  const otherInterests = interests.slice(3, 6);
  const moreCount = interests.length > 6 ? interests.length - 6 : 0;
  
  // Get intents
  const intents = user?.intent || [];
  
  return (
    <motion.div
      className={cn("flex flex-col items-center text-center px-6 pb-8", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h1 className="text-2xl font-bold text-foreground">
            {copy.title}
          </h1>
          <Sparkles className="w-5 h-5 text-yellow-500" />
        </div>
        
        <p className="text-muted-foreground">
          {copy.subtitle}
        </p>
      </motion.div>
      
      {/* Profile Preview Card - Tinder/Bumble Style */}
      <motion.div
        variants={cardVariants}
        className="relative w-full max-w-sm"
      >
        {/* Floating badge */}
        <motion.div
          initial={{ scale: 0, rotate: 0 }}
          animate={{ scale: 1, rotate: -12 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
          className="absolute -top-4 -right-4 z-10"
        >
          <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white border-0 px-3 py-1 text-sm font-bold shadow-lg">
            ⭐ 这就是你！
          </Badge>
        </motion.div>
        
        {/* Main card */}
        <div className="relative bg-card rounded-3xl border-2 border-purple-200 dark:border-purple-800 shadow-2xl overflow-hidden">
          {/* Gradient background for header */}
          <div className="h-24 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 relative">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/20" />
          </div>
          
          {/* Avatar circle overlapping header */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2">
            <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1 shadow-xl">
              <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                <span className="text-4xl font-black text-purple-600">
                  {user?.displayName?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
            </div>
          </div>
          
          {/* Profile content */}
          <div className="pt-16 px-5 pb-5 space-y-4">
            {/* Display name, gender, age, city */}
            <div className="text-center">
              <h2 className="text-2xl font-black mb-1">
                {user?.displayName || "未设置昵称"}
              </h2>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>{user?.gender === "Woman" ? "👩" : user?.gender === "Man" ? "👨" : "👤"}</span>
                {age && <span>{age}岁</span>}
                {user?.currentCity && (
                  <>
                    <span>•</span>
                    <span>{getCityLabel(user.currentCity)}</span>
                  </>
                )}
              </div>
              
              {/* Archetype badge */}
              {archetype && (
                <Badge className="mt-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {archetype}
                </Badge>
              )}
            </div>
            
            {/* Essential Data Grid (2 columns) */}
            <div className="grid grid-cols-2 gap-2">
              {/* Industry */}
              {user?.industryCategoryLabel && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-100 dark:border-blue-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">行业</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-2">
                    {user.industrySegmentLabel || user.industryCategoryLabel}
                  </p>
                </div>
              )}
              
              {/* Relationship Status */}
              {user?.relationshipStatus && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 border border-pink-100 dark:border-pink-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Heart className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                    <span className="text-[10px] uppercase font-bold text-pink-600 dark:text-pink-400">感情</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {getRelationshipLabel(user.relationshipStatus)}
                  </p>
                </div>
              )}
              
              {/* Education */}
              {user?.education && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-100 dark:border-purple-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">学历</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {getEducationLabel(user.education)}
                  </p>
                </div>
              )}
              
              {/* Hometown */}
              {user?.hometown && (
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-100 dark:border-green-900">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">家乡</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground line-clamp-1">
                    {user.hometown}
                  </p>
                </div>
              )}
            </div>
            
            {/* Interests Section */}
            {interests.length > 0 && (
              <div className="text-left">
                <h3 className="text-xs uppercase font-bold text-muted-foreground mb-2">兴趣爱好</h3>
                <div className="flex flex-wrap gap-1.5">
                  {topInterests.map((interest: string, index: number) => (
                    <Badge
                      key={index}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      {interest}
                    </Badge>
                  ))}
                  {otherInterests.map((interest: string, index: number) => (
                    <Badge
                      key={index + topInterests.length}
                      variant="secondary"
                      className="text-xs"
                    >
                      {interest}
                    </Badge>
                  ))}
                  {moreCount > 0 && (
                    <Badge variant="outline" className="text-xs">
                      +{moreCount} 更多
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {/* Intent/Goals Section */}
            {intents.length > 0 && (
              <div className="text-left">
                <h3 className="text-xs uppercase font-bold text-muted-foreground mb-2">社交目标</h3>
                <div className="flex flex-wrap gap-1.5">
                  {intents.map((intent: string, index: number) => (
                    <Badge
                      key={index}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 rounded-full text-xs"
                    >
                      <span className="mr-1">{getIntentIcon(intent)}</span>
                      {getIntentLabel(intent)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Completeness Footer */}
            <div className="pt-3 border-t">
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div className="text-left">
                  <p className="text-xs font-bold text-green-700 dark:text-green-300">
                    画像完整度 {completeness}%
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-400">
                    完美！可以开始匹配了 ✨
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {/* 底部 CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-6 text-center space-y-2"
      >
        <p className="text-sm text-muted-foreground">
          其他用户会看到这样的你
        </p>
        <p className="text-xs text-muted-foreground">
          点击"继续"探索更多玩法 →
        </p>
      </motion.div>
    </motion.div>
  );
}
