import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import SocialRoleCard from "@/components/SocialRoleCard";
import PersonalityRadarChart from "@/components/PersonalityRadarChart";
import QuizIntro from "@/components/QuizIntro";
import EditFullProfileDialog from "@/components/EditFullProfileDialog";
import GamificationCard from "@/components/GamificationCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Edit, LogOut, Shield, HelpCircle, Sparkles, Heart, Quote, Target, RefreshCw, MessageCircle, Star, ChevronDown, Dna, Globe, Users, Coffee, Zap, Crown, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { getInsightCategoryConfig, INSIGHT_CONFIDENCE_THRESHOLD, INSIGHT_DISPLAY_LIMIT } from "@/lib/insightCategoryConfig";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { archetypeConfig } from "@/lib/archetypes";
import { archetypeGradients, archetypeAvatars, archetypeEmojis } from "@/lib/archetypeAvatars";
import { getArchetypeImage } from "@/lib/archetypeImages";
import { getTopCompatibleArchetypes, getCompatibilityCategory } from "@/lib/archetypeCompatibility";
import { getMatchesWithDescriptions } from "@/lib/archetypeCompatibilityDescriptions";
import xiaoyueAvatar from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyueThinking from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import {
  getGenderDisplay,
  calculateAge,
  formatAge,
  getEducationDisplay,
  getStudyLocaleDisplay,
  getSeniorityDisplay,
  getRelationshipDisplay,
  getChildrenDisplay,
  formatArray,
} from "@/lib/userFieldMappings";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import { INDUSTRY_ID_TO_LABEL, getIndustryDisplayLabel } from "@shared/occupations";

type SectionType = "basic" | "education" | "work" | "personal" | "interests";

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const [showQuizIntro, setShowQuizIntro] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [socialDnaOpen, setSocialDnaOpen] = useState(true);
  const { toast } = useToast();
  
  const { data: user, isLoading: userLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });
  const { data: personalityResults } = useQuery<any>({
    queryKey: ["/api/personality-test/results"],
    enabled: !!user?.hasCompletedPersonalityTest,
  });
  const { data: stats, isLoading: statsLoading } = useQuery<{ eventsCompleted: number; connectionsMade: number }>({
    queryKey: ["/api/profile/stats"],
    enabled: !!user,
  });
  
  const { data: gamification } = useQuery<{ currentLevel: number; levelConfig: { level: number; nameCn: string } }>({
    queryKey: ["/api/user/gamification"],
    enabled: !!user,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
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

  const handleEditClick = () => {
    setEditDialogOpen(true);
  };

  const handleSaveProfile = (data: any) => {
    updateProfileMutation.mutate(data);
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      toast({
        title: "已退出登录",
        description: "您已成功退出登录",
      });
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

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const hasCompletedQuiz = !!user?.hasCompletedPersonalityTest;

  const handleStartQuiz = () => {
    setLocation("/personality-test");
  };

  const getUserName = () => {
    if (user?.displayName) return user.displayName;
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    return "用户";
  };

  const getArchetypeAvatar = () => {
    const archetype = user?.primaryRole || "连接者";
    const config = archetypeConfig[archetype] || archetypeConfig["连接者"];
    return {
      icon: config.icon,
      bgColor: config.bgColor,
      color: config.color,
    };
  };

  const getArchetypeDetails = () => {
    const archetype = personalityResults?.primaryRole || user?.primaryRole;
    if (!archetype) return null;
    
    const config = archetypeConfig[archetype];
    if (!config) return null;
    
    return {
      epicDescription: config.epicDescription,
      styleQuote: config.styleQuote,
      coreContributions: config.coreContributions,
    };
  };

  const handleEditProfile = () => {
    setLocation("/profile/edit");
  };

  const avatarConfig = getArchetypeAvatar();
  const archetypeDetails = getArchetypeDetails();

  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader 
        title="我的" 
        showSettings={true}
      />
      
      <div className="px-4 py-4 space-y-4">
        {/* Profile Header Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-6">
            {userLoading || statsLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={`h-16 w-16 rounded-full ${avatarConfig.bgColor} flex items-center justify-center text-3xl`}>
                    {avatarConfig.icon}
                  </div>
                  {gamification && (
                    <div 
                      className="absolute -bottom-1 -right-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full border-2 border-background"
                      data-testid="badge-level"
                    >
                      Lv.{gamification.levelConfig.level}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{getUserName()}</h2>
                  <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                    <span data-testid="text-events-completed">{stats?.eventsCompleted || 0} 次活动</span>
                    <span data-testid="text-connections-made">{stats?.connectionsMade || 0} 个连接</span>
                  </div>
                </div>
                <Button 
                  variant="default"
                  onClick={handleEditProfile}
                  data-testid="button-edit-profile"
                  className="shrink-0"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  编辑资料
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Profile Completion Card - Redesigned with Big Xiaoyue */}
        {!userLoading && user && (() => {
          const completion = calculateProfileCompletion(user);
          if (completion.percentage >= 90) return null;
          
          const getXiaoyueState = () => {
            if (completion.percentage >= 70) {
              return { avatar: xiaoyueExcited, message: "快完成了！再补几项就能解锁VIP匹配~" };
            } else if (completion.percentage >= 40) {
              return { avatar: xiaoyueAvatar, message: "不错哦！再补充几项就能解锁VIP匹配啦" };
            } else {
              return { avatar: xiaoyueThinking, message: "期待认识你！聊几句就能提升匹配精准度~" };
            }
          };

          const getMatchTier = () => {
            if (completion.percentage >= 80) return { tier: "VIP匹配", icon: <Crown className="h-3.5 w-3.5 text-amber-500" />, color: "text-amber-500" };
            if (completion.percentage >= 50) return { tier: "优先匹配", icon: <Zap className="h-3.5 w-3.5 text-primary" />, color: "text-primary" };
            return { tier: "普通匹配", icon: <Star className="h-3.5 w-3.5 text-muted-foreground" />, color: "text-muted-foreground" };
          };

          const matchTier = getMatchTier();
          const xiaoyueState = getXiaoyueState();
          const itemsToNextTier = Math.ceil((80 - completion.percentage) / 5);
          
          return (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden shadow-sm">
              <CardContent className="p-5">
                {/* 小悦头像 + 呼吸动画 */}
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="relative mb-3">
                    <div 
                      className="absolute inset-0 rounded-full bg-primary/20 animate-pulse"
                      style={{ transform: "scale(1.15)" }}
                    />
                    <div className="relative w-20 h-20 rounded-full overflow-hidden border-3 border-primary/40 shadow-lg">
                      <img 
                        src={xiaoyueState.avatar} 
                        alt="小悦" 
                        className="w-full h-full object-cover object-top"
                        data-testid="img-xiaoyue-completion"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-lg">小悦</span>
                    <Badge variant="secondary" className="text-xs px-2 py-0.5">
                      AI助手
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug max-w-[280px]" data-testid="text-xiaoyue-prompt">
                    {xiaoyueState.message}
                  </p>
                </div>
                
                {/* 里程碑提示 */}
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {matchTier.icon}
                      <span className="font-medium text-sm">{matchTier.tier}</span>
                    </div>
                    <span className="text-sm text-muted-foreground font-semibold">{completion.percentage}%</span>
                  </div>
                  
                  {/* 进度条 */}
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        completion.percentage >= 80 
                          ? "bg-gradient-to-r from-amber-400 to-amber-500" 
                          : completion.percentage >= 50 
                            ? "bg-gradient-to-r from-primary to-primary/80"
                            : "bg-gradient-to-r from-slate-400 to-slate-500"
                      }`}
                      style={{ width: `${completion.percentage}%` }}
                    />
                  </div>
                  
                  {/* 升级提示 */}
                  {completion.percentage < 80 ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" />
                      再补充 {itemsToNextTier > 0 ? itemsToNextTier : 1} 项 → 解锁「VIP匹配」
                    </p>
                  ) : (
                    <p className="text-xs text-primary flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      已解锁最高匹配等级！
                    </p>
                  )}
                </div>
                
                {/* CTA按钮 - 升级版 */}
                <motion.div
                  className="relative"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {/* 呼吸光环 */}
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/40 via-purple-400/40 to-pink-400/40 blur-lg"
                    animate={{
                      opacity: [0.5, 0.8, 0.5],
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <Button 
                    onClick={() => setLocation('/registration/chat?mode=enrichment')}
                    size="lg"
                    className="relative w-full gap-3 bg-gradient-to-r from-primary via-purple-500 to-pink-500 shadow-xl border-0 min-h-[56px] text-base font-semibold"
                    data-testid="button-chat-with-xiaoyue"
                  >
                    {/* 小悦头像 */}
                    <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/30 flex-shrink-0">
                      <img 
                        src={xiaoyueExcited} 
                        alt="小悦" 
                        className="w-full h-full object-cover object-top"
                      />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="leading-tight">立即补齐，解锁VIP匹配</span>
                      <span className="text-[10px] opacity-80 font-normal">小悦陪你3分钟搞定</span>
                    </div>
                    
                    {/* XP奖励气泡 */}
                    <div className="ml-auto bg-amber-400 text-amber-950 text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-sm animate-bounce">
                      +200XP
                    </div>
                  </Button>
                </motion.div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Gamification Card - Level, XP, Coins, Streak */}
        <GamificationCard />

        {/* Social DNA Section - Collapsible */}
        {hasCompletedQuiz && personalityResults && (
          <Collapsible open={socialDnaOpen} onOpenChange={setSocialDnaOpen}>
            <Card className="border shadow-sm">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover-elevate pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Dna className="w-5 h-5 text-primary" />
                      你的社交DNA
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{personalityResults.primaryRole}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${socialDnaOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {/* Social Role Summary */}
                  <SocialRoleCard
                    primaryRole={personalityResults.primaryRole}
                    secondaryRole={personalityResults.secondaryRole}
                    primaryRoleScore={personalityResults.primaryRoleScore}
                    secondaryRoleScore={personalityResults.secondaryRoleScore}
                  />

                  {/* Radar Chart */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">性格特质</h4>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setLocation("/personality-test")}
                        data-testid="button-retake-quiz"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        重新测试
                      </Button>
                    </div>
                    <PersonalityRadarChart 
                      affinityScore={personalityResults.affinityScore}
                      opennessScore={personalityResults.opennessScore}
                      conscientiousnessScore={personalityResults.conscientiousnessScore}
                      emotionalStabilityScore={personalityResults.emotionalStabilityScore}
                      extraversionScore={personalityResults.extraversionScore}
                      positivityScore={personalityResults.positivityScore}
                    />
                  </div>

                  {/* Role Details */}
                  {archetypeDetails && (
                    <div className="space-y-3 pt-2 border-t">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        角色深度解读
                      </h4>
                      
                      {archetypeDetails.epicDescription && (
                        <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-epic-description">
                          {archetypeDetails.epicDescription}
                        </p>
                      )}

                      {archetypeDetails.styleQuote && (
                        <div className={`relative bg-gradient-to-br ${archetypeGradients[personalityResults.primaryRole] || 'from-purple-500 to-pink-500'} bg-opacity-10 rounded-lg p-4 border-l-4 border-primary/50`}>
                          <Quote className="w-5 h-5 text-primary/40 absolute top-2 left-2" />
                          <p className="text-sm font-medium italic text-foreground pl-7" data-testid="text-style-quote">
                            {archetypeDetails.styleQuote}
                          </p>
                        </div>
                      )}

                      {archetypeDetails.coreContributions && (
                        <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3">
                          <Target className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground">核心贡献</p>
                            <p className="text-sm font-medium text-foreground" data-testid="text-core-contributions">
                              {archetypeDetails.coreContributions}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Best Matches - With Compatibility Descriptions */}
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      最佳搭档
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      作为<span className="font-semibold text-foreground">{personalityResults.primaryRole}</span>，你在活动中最有化学反应的角色：
                    </p>
                    <div className="space-y-3">
                      {getMatchesWithDescriptions(
                        personalityResults.primaryRole, 
                        getTopCompatibleArchetypes(personalityResults.primaryRole, 5).filter(m => m.score >= 70)
                      ).slice(0, 3).map((match) => (
                        <div key={match.archetype} className="p-3 rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getArchetypeImage(match.archetype) ? (
                                <img 
                                  src={getArchetypeImage(match.archetype)!} 
                                  alt={match.archetype}
                                  className="h-10 w-10 rounded-full object-contain"
                                />
                              ) : (
                                <img 
                                  src={archetypeAvatars[match.archetype]} 
                                  alt={match.archetype}
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              )}
                              <div>
                                <div className="font-semibold text-sm">{match.archetype}</div>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {match.highlight}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-lg font-bold text-primary">{match.score}%</div>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed pl-13">
                            {match.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {!hasCompletedQuiz && (
          <Card className="border shadow-sm bg-gradient-to-br from-primary/10 to-transparent cursor-pointer hover-elevate active-elevate-2" onClick={() => setShowQuizIntro(true)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-sm">发现你的社交风格</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    完成5分钟语音测评，获得个性化的朋友匹配推荐
                  </p>
                </div>
                <Button size="sm" data-testid="button-take-quiz">
                  开始
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">账户</CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              variant="default" 
              className="w-full text-white" 
              data-testid="button-logout"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="h-4 w-4 mr-2" />
              {logoutMutation.isPending ? "退出中..." : "退出登录"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <BottomNav />

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

    </div>
  );
}
