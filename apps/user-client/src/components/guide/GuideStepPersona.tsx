import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useMemo } from "react";
import { archetypeConfig } from "@/lib/archetypes";
import { getArchetypeAvatar } from "@/lib/archetypeAdapter";
import useXiaoyueAnalysis from "@/hooks/useXiaoyueAnalysis";
import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import type { UserProfile } from "@/lib/profileHelpers";

interface GuideStepPersonaProps {
  /** 是否减少动画 */
  reducedMotion?: boolean;
  className?: string;
}

interface AssessmentResult {
  primaryArchetype: string;
  secondaryArchetype?: string;
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
  totalQuestions: number;
  validityScore: number;
}

interface InterestsData {
  id: string;
  userId: string;
  totalHeat: number;
  totalSelections: number;
  categoryHeat: Record<string, number>;
  selections: Array<{
    topicId: string;
    emoji: string;
    label: string;
    category: string;
    heat: number;
  }>;
  topPriorities?: Array<{
    topicId: string;
    label: string;
    heat: number;
  }>;
}

/**
 * Character Dossier 2.0: Premium Profile Reveal Experience
 * Redesigned to showcase AI-generated insights and personality analysis
 */
export function GuideStepPersona({
  reducedMotion = false,
  className,
}: GuideStepPersonaProps) {
  const [, setLocation] = useLocation();
  
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
  
  // Fetch assessment results
  const { data: assessment } = useQuery<AssessmentResult>({
    queryKey: ["/api/assessment/result"],
    queryFn: async () => {
      const response = await fetch("/api/assessment/result");
      if (!response.ok) {
        throw new Error("Failed to fetch assessment");
      }
      return response.json();
    },
  });
  
  // Fetch interests data
  const { data: interestsData } = useQuery<InterestsData | null>({
    queryKey: ["/api/user/interests"],
    queryFn: async () => {
      const response = await fetch("/api/user/interests");
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No interests data yet
        }
        throw new Error("Failed to fetch interests");
      }
      return response.json();
    },
  });
  
  // Get archetype information
  const archetype = user?.archetype || user?.primaryArchetype;
  const archetypeData = archetype ? archetypeConfig[archetype] : null;
  const archetypeImageUrl = archetype ? getArchetypeAvatar(archetype) : "";
  
  // Get Xiaoyue AI analysis
  const xiaoyueAnalysis = useXiaoyueAnalysis({
    archetype: archetype || null,
    traitScores: assessment ? {
      // Normalize to 0–1 to align with PersonalityTestResultPage and backend caching
      A: assessment.affinityScore / 100,
      O: assessment.opennessScore / 100,
      C: assessment.conscientiousnessScore / 100,
      E: assessment.extraversionScore / 100,
      X: assessment.emotionalStabilityScore / 100,
      P: assessment.positivityScore / 100,
    } : null,
    enabled: !!archetype && !!assessment,
  });
  
  // Calculate top 3 traits
  const topTraits = useMemo(() => {
    if (!assessment) return [];
    
    const traits = [
      { name: "开放性", score: assessment.opennessScore, icon: "🎯" },
      { name: "外向性", score: assessment.extraversionScore, icon: "💫" },
      { name: "亲和力", score: assessment.affinityScore, icon: "🌟" },
      { name: "尽责性", score: assessment.conscientiousnessScore, icon: "⚡" },
      { name: "情绪稳定", score: assessment.emotionalStabilityScore, icon: "🛡️" },
      { name: "正能量", score: assessment.positivityScore, icon: "☀️" },
    ];
    
    return traits.sort((a, b) => b.score - a.score).slice(0, 3);
  }, [assessment]);
  
  // Process interest heat map
  const interestHeatMap = useMemo(() => {
    if (!interestsData?.categoryHeat) return [];
    
    const categoryEmojis: Record<string, string> = {
      career: "💼",
      philosophy: "🧠",
      lifestyle: "🍜",
      culture: "🎬",
      city: "🏙️",
      tech: "🚀",
    };
    
    const categoryLabels: Record<string, string> = {
      career: "职业发展",
      philosophy: "思想哲学",
      lifestyle: "生活方式",
      culture: "文化娱乐",
      city: "城市探索",
      tech: "科技创新",
    };
    
    return Object.entries(interestsData.categoryHeat)
      .map(([category, heat]) => ({
        category,
        label: categoryLabels[category] || category,
        heat: heat as number,
        emoji: categoryEmojis[category] || "✨",
      }))
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 5);
  }, [interestsData]);
  
  // Animation variants
  const sectionVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: (custom: number) => ({
          opacity: 1,
          y: 0,
          transition: {
            delay: custom,
            duration: 0.5,
            ease: "easeOut"
          }
        })
      };
  
  return (
    <div className={cn("min-h-[100dvh] bg-background pb-24", className)}>
      {/* Social Tag Banner */}
      <motion.div
        custom={0}
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 py-6 px-6 text-center overflow-hidden"
      >
        {/* Shimmer animation */}
        {!reducedMotion && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        )}
        
        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-5 py-2 rounded-full border border-white/40 mb-2"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-xs font-bold text-white tracking-wider">
              AI生成的社交印象
            </span>
          </motion.div>
          
          <h1 className="text-3xl font-black text-white drop-shadow-lg mb-1">
            {user?.socialTag || archetypeData?.tagline || "探索你的独特标签"}
          </h1>
          
          <p className="text-sm text-white/90">
            {archetypeData?.description || "基于你的性格与兴趣生成"}
          </p>
        </div>
      </motion.div>
      
      {/* Archetype Character */}
      <motion.div
        custom={0.5}
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center mt-8 px-6"
      >
        {archetypeImageUrl && (
          <motion.div
            initial={{ scale: 0.8, filter: "blur(10px)", opacity: 0 }}
            animate={{ scale: 1, filter: "blur(0px)", opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6, type: "spring" }}
            className="relative"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 blur-3xl rounded-full" />
            
            <img
              src={archetypeImageUrl}
              alt={archetype || "角色"}
              className="relative w-[280px] h-[320px] object-contain drop-shadow-2xl"
            />
          </motion.div>
        )}
        
        {/* Name badge below character */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="mt-4 text-center"
        >
          {archetypeData ? (
            <>
              <div className="text-4xl mb-2">{archetypeData.icon}</div>
              <h2 className="text-2xl font-black text-foreground mb-1">
                {archetype}
              </h2>
              <p className="text-sm text-muted-foreground">
                {archetypeData.nickname}
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mb-2">🎭</div>
              <h2 className="text-2xl font-black text-foreground mb-1">
                你的角色画像
              </h2>
              <p className="text-sm text-muted-foreground">
                完成性格测试后显示
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
      
      {/* Xiaoyue Analysis Card */}
      <motion.div
        custom={1.5}
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
        className="mx-4 mt-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-3xl p-5 border-2 border-blue-200 dark:border-blue-800 shadow-xl"
      >
        <div className="flex items-start gap-3 mb-3">
          <img 
            src={xiaoyueNormal} 
            alt="小悦" 
            className="w-12 h-12 rounded-full shadow-lg"
          />
          <div>
            <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
              💬 小悦的专属洞察
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              基于你的性格测试生成
            </div>
          </div>
        </div>
        
        {xiaoyueAnalysis.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>小悦正在分析你的特质...</span>
          </div>
        ) : xiaoyueAnalysis.error ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            小悦分析暂时无法加载，请稍后再试
          </p>
        ) : xiaoyueAnalysis.analysis ? (
          <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
            {xiaoyueAnalysis.analysis}
          </p>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            完成性格测试后，小悦会为你生成专属的性格分析
          </p>
        )}
      </motion.div>
      
      {/* Top 3 Traits */}
      {topTraits.length > 0 && (
        <div className="px-4 mt-6">
          <h3 className="text-lg font-bold text-foreground mb-3 text-center">
            ✨ 核心特质 Top 3
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {topTraits.map((trait, idx) => (
              <motion.div
                key={trait.name}
                initial={reducedMotion ? { opacity: 1 } : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reducedMotion ? {} : { delay: 2.5 + (idx * 0.15), type: "spring" }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border-2 border-purple-200 dark:border-purple-800 text-center"
              >
                <div className="text-3xl mb-2">{trait.icon}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {trait.name}
                </div>
                <div className="text-xl font-black text-purple-600 dark:text-purple-400">
                  {trait.score}%
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
      
      {/* Interest Heat Map */}
      {interestHeatMap.length > 0 && (
        <motion.div
          custom={3.5}
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          className="px-4 mt-6"
        >
          <h3 className="text-lg font-bold text-foreground mb-3 text-center">
            🔥 兴趣热力榜 Top 5
          </h3>
          <div className="space-y-3">
            {interestHeatMap.map((item, idx) => (
              <motion.div
                key={item.category}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={reducedMotion ? {} : { delay: 4.0 + (idx * 0.1) }}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{item.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                    {item.heat}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.heat}%` }}
                    transition={reducedMotion ? {} : { delay: 4.0 + (idx * 0.1), duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Sticky CTA Footer */}
      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? {} : { delay: 5.0, duration: 0.5 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-purple-200 dark:border-purple-800 shadow-2xl p-4 pb-safe"
      >
        <Button 
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-purple-500/50 text-white"
          onClick={() => setLocation("/discover")}
        >
          开始探索活动
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
        
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          我们已为你匹配推荐活动
        </p>
      </motion.div>
    </div>
  );
}
