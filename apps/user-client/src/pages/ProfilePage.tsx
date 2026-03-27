import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import SocialRoleCard from "@/components/SocialRoleCard";
import PersonalityRadarChart from "@/components/PersonalityRadarChart";
import QuizIntro from "@/components/QuizIntro";
import EditFullProfileDialog from "@/components/EditFullProfileDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Edit, LogOut, Shield, HelpCircle, Sparkles, Heart, Quote, Target,
  RefreshCw, MessageCircle, Star, ChevronDown, Globe, Users,
  Zap, Crown, Check,
  Calendar, Gift, ChevronRight, Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { invalidateUserDerivedQueries } from "@/lib/userStateInvalidation";
import { useToast } from "@/hooks/use-toast";
import { archetypeConfig } from "@/lib/archetypes";
import { archetypeGradients, archetypeAvatars, archetypeEmojis } from "@/lib/archetypeAvatars";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { getTopCompatibleArchetypes } from "@/lib/archetypeCompatibility";
import { getMatchesWithDescriptions } from "@/lib/archetypeCompatibilityDescriptions";
import xiaoyueAvatar from "@/assets/Xiao_Yue_Avatar-04.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyueThinking from "@/assets/Xiao_Yue_Avatar-01.png";
import {
  getGenderDisplay,
  calculateAge,
  formatAge,
  getEducationDisplay,
  getStudyLocaleDisplay,
  getRelationshipDisplay,
  getChildrenDisplay,
  formatArray,
} from "@/lib/userFieldMappings";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import { INDUSTRY_ID_TO_LABEL, getIndustryDisplayLabel } from "@shared/occupations";

// ─── Local helper component ──────────────────────────────────────────────────

interface MissionItemProps {
  label: string;
  completed: boolean;
  xp: number;
}

function MissionItem({ label, completed, xp }: MissionItemProps) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/5 border border-white/10">
      {/* Checkbox */}
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
          completed
            ? "bg-gradient-to-br from-green-400 to-emerald-500"
            : "border-2 border-purple-400/40"
        }`}
      >
        {completed && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Label */}
      <span
        className={`flex-1 text-sm ${
          completed ? "line-through text-white/40" : "text-white/80"
        }`}
      >
        {label}
      </span>

      {/* XP pill */}
      <div
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          completed
            ? "bg-green-400/20 text-green-400"
            : "bg-amber-400/20 text-amber-400"
        }`}
      >
        {completed ? "✓ " : "+"}
        {xp} XP
      </div>
    </div>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VIP_MATCH_THRESHOLD = 80;
const ITEMS_PER_TIER_GAIN = 5;
const DEFAULT_XP_PROGRESS = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionType = "basic" | "education" | "work" | "personal" | "interests";

// Extended gamification type with optional fields returned by the API
interface GamificationData {
  currentLevel: number;
  levelConfig: { level: number; nameCn: string };
  experiencePoints?: number;
  nextLevelInfo?: { xpNeeded?: number; progress?: number };
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const [showQuizIntro, setShowQuizIntro] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [socialDnaOpen, setSocialDnaOpen] = useState(true);
  const { toast } = useToast();

  // ── Data queries ────────────────────────────────────────────────────────────

  const { data: user, isLoading: userLoading } = useQuery<any>({
    queryKey: ["/api/auth/user"],
  });

  const { data: personalityResults } = useQuery<any>({
    queryKey: ["/api/personality-test/results"],
    enabled: !!user?.hasCompletedPersonalityTest,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    eventsCompleted: number;
    connectionsMade: number;
  }>({
    queryKey: ["/api/profile/stats"],
    enabled: !!user,
  });

  const { data: gamification } = useQuery<GamificationData>({
    queryKey: ["/api/user/gamification"],
    enabled: !!user,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await invalidateUserDerivedQueries();
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "已退出登录", description: "您已成功退出登录" });
      setLocation("/auth/phone");
    },
    onError: () => {
      toast({
        title: "退出失败",
        description: "退出登录时出现问题，请重试",
        variant: "destructive",
      });
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEditClick = () => setEditDialogOpen(true);
  const handleSaveProfile = (data: any) => updateProfileMutation.mutate(data);
  const handleLogout = () => logoutMutation.mutate();
  const handleStartQuiz = () => setLocation("/personality-test");
  const handleEditProfile = () => setLocation("/profile/edit");

  const hasCompletedQuiz = !!user?.hasCompletedPersonalityTest;

  // ── Display helpers ─────────────────────────────────────────────────────────

  const getUserName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.firstName && user?.lastName)
      return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    return "用户";
  };

  const getArchetypeAvatar = () => {
    const archetype = user?.primaryArchetype || user?.archetype || "开心柯基";
    const defaultConfig = archetypeConfig["开心柯基"];
    const config = archetypeConfig[archetype] || defaultConfig;
    return { icon: config.icon, bgColor: config.bgColor, color: config.color };
  };

  const getArchetypeDetails = () => {
    const archetype =
      personalityResults?.primaryArchetype || user?.primaryArchetype;
    if (!archetype) return null;
    const config = archetypeConfig[archetype];
    if (!config) return null;
    return {
      epicDescription: config.epicDescription,
      styleQuote: config.styleQuote,
      coreContributions: config.coreContributions,
    };
  };

  const avatarConfig = getArchetypeAvatar();
  const archetypeDetails = getArchetypeDetails();

  // Derived completion values (evaluated once)
  const completion = user ? calculateProfileCompletion(user) : null;
  const profileComplete = (completion?.percentage ?? 0) >= 90;

  // XP progress percentage for the bar
  const xpProgress =
    gamification?.nextLevelInfo?.progress ?? DEFAULT_XP_PROGRESS;

  const xpCurrent = gamification?.experiencePoints ?? 0;
  const xpNext =
    xpCurrent +
    (gamification?.nextLevelInfo?.xpNeeded ?? (2000 - xpCurrent));

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-20 bg-epic-gradient">
      {/* ── Top navigation bar ── */}
      <MobileHeader title="我的" showSettings={true} />

      {/* ══════════════════════════════════════════════════
          SECTION 1 · Hero Player Card
      ══════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center pt-6 pb-4 px-4"
      >
        {/* ── Glowing Avatar with LV badge ── */}
        <div className="relative mb-3">
          {/* Aura pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full blur-lg"
            aria-hidden="true"
            style={{
              background: "rgba(168, 85, 247, 0.5)",
              transform: "scale(1.3)",
            }}
          />

          {/* Avatar circle */}
          {userLoading ? (
            <Skeleton className="h-24 w-24 rounded-full" />
          ) : (
            <div
              className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-purple-400/50"
              style={{
                boxShadow:
                  "0 0 20px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.3)",
              }}
            >
              {/* Try archetype image first, then emoji fallback, then text emoji */}
              {getArchetypeImage(
                personalityResults?.primaryArchetype || user?.primaryArchetype
              ) ? (
                <img
                  src={
                    getArchetypeImage(
                      personalityResults?.primaryArchetype ||
                        user?.primaryArchetype
                    )!
                  }
                  alt={`你的原型：${personalityResults?.primaryArchetype || user?.primaryArchetype || "未知"}`}
                  className="w-full h-full object-contain bg-purple-900/40"
                />
              ) : (
                <div
                  className={`w-full h-full flex items-center justify-center text-4xl ${avatarConfig.bgColor}`}
                >
                  {avatarConfig.icon}
                </div>
              )}
            </div>
          )}

          {/* LV badge */}
          {gamification && (
            <div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 text-xs font-bold px-3 py-0.5 rounded-full border-2 border-amber-300 whitespace-nowrap z-10"
              style={{
                boxShadow:
                  "0 0 10px rgba(251,191,36,0.7), 0 0 20px rgba(251,191,36,0.3)",
              }}
              data-testid="badge-level"
            >
              LV.{gamification.levelConfig?.level ?? gamification.currentLevel}{" "}
              · {gamification.levelConfig?.nameCn ?? "冒险者"}
            </div>
          )}
        </div>

        {/* ── XP progress bar ── */}
        {gamification && (
          <div className="w-48 mt-4 mb-2">
            <div className="flex justify-between text-xs text-purple-300 mb-1">
              <span>XP</span>
              <span>
                {xpCurrent} / {xpNext}
              </span>
            </div>
            <div
              className="h-2 bg-white/10 rounded-full overflow-hidden"
              role="progressbar"
              aria-label="经验值进度"
              aria-valuenow={xpCurrent}
              aria-valuemin={0}
              aria-valuemax={xpNext}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1, delay: 0.5 }}
                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
              />
            </div>
          </div>
        )}

        {/* ── Display name ── */}
        {userLoading ? (
          <Skeleton className="h-7 w-32 mt-3 rounded-lg" />
        ) : (
          <h1 className="text-2xl font-bold text-white mt-2 text-glow">
            {getUserName()}
          </h1>
        )}

        {/* ── Holographic archetype tag ── */}
        <div className="holo-tag mt-1">
          <Sparkles className="w-3 h-3" />
          {user?.socialTag ||
            user?.primaryArchetype ||
            personalityResults?.primaryArchetype ||
            "探索中..."}
        </div>

        {/* ── Edit profile pill ── */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleEditProfile}
          className="mt-3 flex items-center gap-1.5 px-4 py-1.5 rounded-full glass text-white/80 text-xs border border-white/20 hover:bg-white/10 transition-colors"
          data-testid="button-edit-profile"
        >
          <Edit className="w-3 h-3" />
          编辑资料
        </motion.button>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          SECTION 2 · 3D Stats Grid (3-column bento)
      ══════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-4 grid grid-cols-3 gap-3 mb-4"
      >
        {/* Stat: Events completed */}
        <div className="stat-glass-3d p-3 text-center">
          {statsLoading ? (
            <Skeleton className="h-7 w-10 mx-auto rounded" />
          ) : (
            <div
              className="text-2xl font-bold text-white text-glow"
              data-testid="text-events-completed"
            >
              {stats?.eventsCompleted ?? 0}
            </div>
          )}
          <div className="text-xs text-purple-300 mt-1">活动参加</div>
          <Calendar className="w-4 h-4 text-purple-400 mx-auto mt-1" />
        </div>

        {/* Stat: Connections made */}
        <div className="stat-glass-3d p-3 text-center">
          {statsLoading ? (
            <Skeleton className="h-7 w-10 mx-auto rounded" />
          ) : (
            <div
              className="text-2xl font-bold text-white text-glow"
              data-testid="text-connections-made"
            >
              {stats?.connectionsMade ?? 0}
            </div>
          )}
          <div className="text-xs text-purple-300 mt-1">人脉连接</div>
          <Users className="w-4 h-4 text-purple-400 mx-auto mt-1" />
        </div>

        {/* Stat: Openness score */}
        <div className="stat-glass-3d p-3 text-center">
          <div className="text-2xl font-bold text-white text-glow">
            {personalityResults?.opennessScore
              ? Math.round(personalityResults.opennessScore)
              : "--"}
          </div>
          <div className="text-xs text-purple-300 mt-1">社交开放度</div>
          <Globe className="w-4 h-4 text-purple-400 mx-auto mt-1" />
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          SECTION 3 · Next Best Action
          • Profile < 90% → Xiaoyue completion card
          • Profile ≥ 90% → Monthly mission tracker
      ══════════════════════════════════════════════════ */}
      {!userLoading && user && !profileComplete && completion && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mission-glass mx-4 mb-4 p-5 overflow-hidden"
        >
          {/* ── Xiaoyue avatar + message ── */}
          {(() => {
            const getXiaoyueState = () => {
              if (completion.percentage >= 70)
                return {
                  avatar: xiaoyueExcited,
                  message: "快完成了！再补几项就能解锁VIP匹配~",
                };
              if (completion.percentage >= 40)
                return {
                  avatar: xiaoyueAvatar,
                  message: "不错哦！再补充几项就能解锁VIP匹配啦",
                };
              return {
                avatar: xiaoyueThinking,
                message: "期待认识你！聊几句就能提升匹配精准度~",
              };
            };

            const getMatchTier = () => {
              if (completion.percentage >= VIP_MATCH_THRESHOLD)
                return {
                  tier: "VIP匹配",
                  icon: <Crown className="h-3.5 w-3.5 text-amber-400" />,
                  barClass: "from-amber-400 to-amber-500",
                };
              if (completion.percentage >= 50)
                return {
                  tier: "优先匹配",
                  icon: <Zap className="h-3.5 w-3.5 text-purple-400" />,
                  barClass: "from-purple-400 to-pink-400",
                };
              return {
                tier: "普通匹配",
                icon: <Star className="h-3.5 w-3.5 text-white/50" />,
                barClass: "from-slate-400 to-slate-500",
              };
            };

            const matchTier = getMatchTier();
            const xiaoyueState = getXiaoyueState();
            const itemsToNextTier = Math.max(
              1,
              Math.ceil((VIP_MATCH_THRESHOLD - completion.percentage) / ITEMS_PER_TIER_GAIN)
            );

            return (
              <>
                {/* Xiaoyue avatar row */}
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="relative mb-3">
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: "rgba(168,85,247,0.25)",
                        transform: "scale(1.2)",
                      }}
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-purple-400/40 shadow-lg">
                      <img
                        src={xiaoyueState.avatar}
                        alt="小悦"
                        className="w-full h-full object-cover object-top"
                        data-testid="img-xiaoyue-completion"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg text-white">
                      小悦
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 border border-purple-400/30">
                      AI助手
                    </span>
                  </div>
                  <p
                    className="text-sm text-purple-200/80 leading-snug max-w-[280px]"
                    data-testid="text-xiaoyue-prompt"
                  >
                    {xiaoyueState.message}
                  </p>
                </div>

                {/* Progress milestone block */}
                <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {matchTier.icon}
                      <span className="font-medium text-sm text-white">
                        {matchTier.tier}
                      </span>
                    </div>
                    <span className="text-sm text-purple-300 font-semibold">
                      {completion.percentage}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completion.percentage}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className={`h-full rounded-full bg-gradient-to-r ${matchTier.barClass}`}
                    />
                  </div>

                  {completion.percentage < VIP_MATCH_THRESHOLD ? (
                    <p className="text-xs text-purple-300/70 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      再补充 {itemsToNextTier} 项 → 解锁「VIP匹配」
                    </p>
                  ) : (
                    <p className="text-xs text-green-400 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      已解锁最高匹配等级！
                    </p>
                  )}
                </div>

                {/* CTA button with breathing halo */}
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.div
                    className="absolute inset-0 rounded-xl blur-lg bg-gradient-to-r from-purple-500/40 via-pink-500/40 to-purple-500/40"
                    animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <Button
                    onClick={() =>
                      setLocation("/registration/chat?mode=enrichment")
                    }
                    size="lg"
                    className="relative w-full gap-3 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 shadow-xl border-0 min-h-[56px] text-base font-semibold text-white"
                    data-testid="button-chat-with-xiaoyue"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0">
                      <img
                        src={xiaoyueExcited}
                        alt="小悦"
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="leading-tight">立即补齐，解锁VIP匹配</span>
                      <span className="text-[10px] opacity-80 font-normal">
                        小悦陪你3分钟搞定
                      </span>
                    </div>
                    <div className="ml-auto bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm animate-bounce">
                      +200XP
                    </div>
                  </Button>
                </motion.div>
              </>
            );
          })()}
        </motion.div>
      )}

      {/* Monthly mission tracker (shown when profile ≥ 90%) */}
      {!userLoading && user && profileComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mission-glass mx-4 mb-4 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-white">本月活动任务</span>
          </div>
          <div className="space-y-2">
            <MissionItem
              label="参加首次活动"
              completed={(stats?.eventsCompleted ?? 0) >= 1}
              xp={200}
            />
            <MissionItem
              label="参加2场活动"
              completed={(stats?.eventsCompleted ?? 0) >= 2}
              xp={500}
            />
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
          SECTION 4 · Social DNA (TCG Collectible Card)
      ══════════════════════════════════════════════════ */}

      {/* Card shown when quiz IS completed */}
      {hasCompletedQuiz && personalityResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-1"
        >
          <Collapsible open={socialDnaOpen} onOpenChange={setSocialDnaOpen}>
            <CollapsibleTrigger asChild>
              <div
                className="collectible-card-wrapper mx-4 mb-1"
                data-testid="collectible-card-trigger"
              >
                <div className="collectible-card p-4 holographic-card">
                  {/* Holographic shimmer layer */}
                  <div className="shine-effect" />

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs text-purple-400 font-semibold tracking-wider mb-1 uppercase">
                        Rare · 社交DNA
                      </div>
                      <h3 className="text-lg font-bold text-white leading-tight">
                        {personalityResults.primaryArchetype}
                      </h3>
                      {personalityResults.secondaryArchetype && (
                        <div className="text-xs text-purple-300 mt-0.5">
                          副型: {personalityResults.secondaryArchetype}
                        </div>
                      )}
                    </div>

                    {/* Archetype illustration */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/20 ml-3 flex-shrink-0 bg-purple-900/40">
                      {getArchetypeImage(personalityResults.primaryArchetype) ? (
                        <img
                          src={
                            getArchetypeImage(
                              personalityResults.primaryArchetype
                            )!
                          }
                          alt={personalityResults.primaryArchetype}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">
                          {archetypeEmojis[
                            personalityResults.primaryArchetype
                          ] || "🌟"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hint row */}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-purple-300/80 italic">
                      点击揭秘深度解析
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-purple-400 transition-transform duration-200 ${
                        socialDnaOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            {/* ── Expanded content: all existing DNA details ── */}
            <CollapsibleContent>
              <div className="mx-4 mb-4 bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-4 space-y-4">
                {/* Social Role Summary */}
                <SocialRoleCard
                  primaryArchetype={personalityResults.primaryArchetype}
                  secondaryArchetype={personalityResults.secondaryArchetype}
                  primaryArchetypeScore={personalityResults.primaryArchetypeScore}
                  secondaryArchetypeScore={
                    personalityResults.secondaryArchetypeScore
                  }
                />

                {/* Radar Chart */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-white">性格特质</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation("/personality-test")}
                      className="border-white/20 text-white/80 hover:bg-white/10 bg-transparent"
                      data-testid="button-retake-quiz"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      重新测试
                    </Button>
                  </div>
                  <PersonalityRadarChart
                    affinityScore={personalityResults.affinityScore}
                    opennessScore={personalityResults.opennessScore}
                    conscientiousnessScore={
                      personalityResults.conscientiousnessScore
                    }
                    emotionalStabilityScore={
                      personalityResults.emotionalStabilityScore
                    }
                    extraversionScore={personalityResults.extraversionScore}
                    positivityScore={personalityResults.positivityScore}
                  />
                </div>

                {/* Role deep-dive */}
                {archetypeDetails && (
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <h4 className="font-medium text-sm text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      角色深度解读
                    </h4>

                    {archetypeDetails.epicDescription && (
                      <p
                        className="text-sm leading-relaxed text-white/80"
                        data-testid="text-epic-description"
                      >
                        {archetypeDetails.epicDescription}
                      </p>
                    )}

                    {archetypeDetails.styleQuote && (
                      <div
                        className={`relative bg-gradient-to-br ${
                          archetypeGradients[
                            personalityResults.primaryArchetype
                          ] || "from-purple-500 to-pink-500"
                        } bg-opacity-10 rounded-lg p-4 border-l-4 border-purple-400/50`}
                      >
                        <Quote className="w-5 h-5 text-purple-400/40 absolute top-2 left-2" />
                        <p
                          className="text-sm font-medium italic text-white pl-7"
                          data-testid="text-style-quote"
                        >
                          {archetypeDetails.styleQuote}
                        </p>
                      </div>
                    )}

                    {archetypeDetails.coreContributions && (
                      <div className="flex items-start gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
                        <Target className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-purple-300">
                            核心贡献
                          </p>
                          <p
                            className="text-sm font-medium text-white"
                            data-testid="text-core-contributions"
                          >
                            {archetypeDetails.coreContributions}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Best matches */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <h4 className="font-medium text-sm text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    最佳搭档
                  </h4>
                  <p className="text-xs text-purple-300/80">
                    作为
                    <span className="font-semibold text-white">
                      {personalityResults.primaryArchetype}
                    </span>
                    ，你在活动中最有化学反应的角色：
                  </p>
                  <div className="space-y-3">
                    {getMatchesWithDescriptions(
                      personalityResults.primaryArchetype,
                      getTopCompatibleArchetypes(
                        personalityResults.primaryArchetype,
                        5
                      ).filter((m) => m.score >= 70)
                    )
                      .slice(0, 3)
                      .map((match) => (
                        <div
                          key={match.archetype}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getArchetypeImage(match.archetype) ? (
                                <img
                                  src={getArchetypeImage(match.archetype)!}
                                  alt={match.archetype}
                                  className="h-10 w-10 rounded-full object-contain bg-purple-900/30"
                                />
                              ) : (
                                <img
                                  src={archetypeAvatars[match.archetype]}
                                  alt={match.archetype}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              )}
                              <div>
                                <div className="font-semibold text-sm text-white">
                                  {match.archetype}
                                </div>
                                <span className="text-[10px] px-1.5 py-0 rounded bg-purple-400/20 text-purple-300">
                                  {match.highlight}
                                </span>
                              </div>
                            </div>
                            <div className="text-lg font-bold text-purple-300">
                              {match.score}%
                            </div>
                          </div>
                          <p className="text-xs text-white/50 leading-relaxed pl-13">
                            {match.description}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </motion.div>
      )}

      {/* Quiz prompt card shown when quiz is NOT completed */}
      {!hasCompletedQuiz && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mx-4 mb-4"
        >
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="mission-glass p-4 cursor-pointer"
            onClick={() => setShowQuizIntro(true)}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <p className="font-semibold text-sm text-white">
                    发现你的社交风格
                  </p>
                </div>
                <p className="text-xs text-purple-300/70">
                  完成5分钟语音测评，获得个性化的朋友匹配推荐
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shrink-0"
                data-testid="button-take-quiz"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowQuizIntro(true);
                }}
              >
                开始
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════════
          SECTION 5 · Bento Navigation (2 squares)
      ══════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-4 grid grid-cols-2 gap-3 mb-4"
      >
        {/* Join Community */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setLocation("/community/join")}
          className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[100px] relative overflow-hidden border border-white/20"
          data-testid="button-community-join"
        >
          {/* Decorative background icon */}
          <Users className="w-10 h-10 text-purple-300/20 absolute top-2 right-2" />
          <MessageCircle className="w-6 h-6 text-purple-300 relative z-10" />
          <span className="text-sm font-semibold text-white relative z-10">
            加入社群
          </span>
          <span className="text-xs text-purple-300/70 relative z-10">
            私域交流圈
          </span>
        </motion.button>

        {/* Activity History */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setLocation("/events")}
          className="glass rounded-2xl p-4 flex flex-col items-center justify-center gap-2 min-h-[100px] relative overflow-hidden border border-white/20"
          data-testid="button-activity-history"
        >
          {/* Decorative background icon */}
          <Star className="w-10 h-10 text-pink-300/20 absolute top-2 right-2" />
          <Calendar className="w-6 h-6 text-pink-300 relative z-10" />
          <span className="text-sm font-semibold text-white relative z-10">
            活动足迹
          </span>
          <span className="text-xs text-pink-300/70 relative z-10">
            查看历史
          </span>
        </motion.button>
      </motion.div>

      {/* ══════════════════════════════════════════════════
          SECTION 6 · Utilities List
      ══════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="px-4 space-y-2 mb-4"
      >
        {/* Wallet / Benefits */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setLocation("/profile/wallet")}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/15"
          data-testid="button-wallet"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-4 h-4 text-amber-400" />
          </div>
          <span className="flex-1 text-white text-sm font-medium text-left">
            专属福利柜
          </span>
          <span className="text-xs text-amber-400 font-semibold">待用福利</span>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </motion.button>

        {/* FAQ */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setLocation("/profile/faq")}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/15"
          data-testid="button-faq"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-blue-400" />
          </div>
          <span className="flex-1 text-white text-sm font-medium text-left">
            常见问题
          </span>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </motion.button>

        {/* Terms */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setLocation("/profile/terms")}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/15"
          data-testid="button-terms"
        >
          <div className="w-8 h-8 rounded-lg bg-green-400/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-green-400" />
          </div>
          <span className="flex-1 text-white text-sm font-medium text-left">
            服务条款
          </span>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </motion.button>

        {/* Logout */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full glass rounded-2xl px-4 py-3 flex items-center gap-3 border border-red-500/20 disabled:opacity-60"
          data-testid="button-logout"
        >
          <div className="w-8 h-8 rounded-lg bg-red-400/20 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-4 h-4 text-red-400" />
          </div>
          <span className="flex-1 text-red-400 text-sm font-medium text-left">
            {logoutMutation.isPending ? "退出中..." : "退出登录"}
          </span>
        </motion.button>
      </motion.div>

      {/* ── Bottom navigation ── */}
      <BottomNav />

      {/* ══════════════════════════════════════════════════
          OVERLAY · Quiz Intro (unchanged)
      ══════════════════════════════════════════════════ */}
      {showQuizIntro && (
        <div className="fixed inset-0 bg-background z-50 overflow-y-auto">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
            <div className="flex items-center h-14 px-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuizIntro(false)}
                data-testid="button-close-quiz-intro"
              >
                <span className="text-lg">←</span>
              </Button>
              <h1 className="ml-2 font-semibold">性格测评</h1>
            </div>
          </div>
          <div className="p-4">
            <QuizIntro
              onStart={handleStartQuiz}
              onSkip={() => setShowQuizIntro(false)}
            />
          </div>
        </div>
      )}

      {/* EditFullProfileDialog (kept exactly as before) */}
      <EditFullProfileDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={user}
        onSave={handleSaveProfile}
        isSaving={updateProfileMutation.isPending}
      />
    </div>
  );
}
