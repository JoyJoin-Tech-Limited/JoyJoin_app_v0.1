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
import { Edit, LogOut, Shield, HelpCircle, Sparkles, Heart, Quote, Target, RefreshCw, MessageCircle, Star, ChevronDown, Dna, Briefcase, Globe, Users, Coffee } from "lucide-react";
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
    const archetype = user?.primaryArchetype || "连接者";
    const config = archetypeConfig[archetype] || archetypeConfig["连接者"];
    return {
      icon: config.icon,
      bgColor: config.bgColor,
      color: config.color,
    };
  };

  const getArchetypeDetails = () => {
    const archetype = personalityResults?.primaryArchetype || user?.primaryArchetype;
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

        {/* Profile Completion Card */}
        {!userLoading && user && (() => {
          const completion = calculateProfileCompletion(user);
          // Only show if profile is less than 90% complete
          if (completion.percentage >= 90) return null;
          
          return (
            <Card className="border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">资料完善度</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starNum) => (
                      <Star 
                        key={starNum}
                        className={`w-3.5 h-3.5 ${
                          starNum <= completion.stars 
                            ? 'text-yellow-500 fill-yellow-500' 
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Progress value={completion.percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    已完成 {completion.percentage}%
                    {completion.missingFields.length > 0 && (
                      <span> · 缺少: {completion.missingFields.slice(0, 3).join('、')}{completion.missingFields.length > 3 ? '等' : ''}</span>
                    )}
                  </p>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setLocation('/registration/chat?mode=enrichment')}
                  data-testid="button-chat-with-xiaoyue"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  和小悦聊聊，补充资料
                </Button>
              </CardContent>
            </Card>
          );
        })()}

        {/* Career & Insights Card - 职业信息和小悦洞察 */}
        {!userLoading && user && (user.industry || user.occupation || user.companyName || (user.insightLedger && Array.isArray(user.insightLedger) && user.insightLedger.length > 0)) && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="w-5 h-5 text-blue-500" />
                职业画像
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 职业基本信息 */}
              {(user.industry || user.occupation || user.companyName) && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {user.industry && (
                      <span className="px-2.5 py-1 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                        {user.industrySegment || user.industry}
                      </span>
                    )}
                    {user.occupation && (
                      <span className="px-2.5 py-1 text-xs bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-full">
                        {user.structuredOccupation || user.occupation}
                      </span>
                    )}
                    {user.seniority && (
                      <span className="px-2.5 py-1 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">
                        {getSeniorityDisplay(user.seniority)}
                      </span>
                    )}
                  </div>
                  {user.companyName && (
                    <p className="text-sm text-muted-foreground">
                      {user.companyType && <span className="font-medium">{user.companyType} · </span>}
                      {user.companyName}
                    </p>
                  )}
                </div>
              )}

              {/* 小悦洞察 - 来自insightLedger */}
              {user.insightLedger && Array.isArray(user.insightLedger) && user.insightLedger.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    小悦的洞察
                  </p>
                  <div className="space-y-1.5">
                    {user.insightLedger
                      .filter((insight: any) => insight.confidence >= INSIGHT_CONFIDENCE_THRESHOLD)
                      .slice(0, INSIGHT_DISPLAY_LIMIT)
                      .map((insight: any, idx: number) => {
                        const config = getInsightCategoryConfig(insight.category);
                        const IconComponent = config.icon;
                        return (
                          <div
                            key={`insight-${idx}`}
                            className={`px-2.5 py-1.5 rounded-lg text-xs flex items-start gap-2 ${config.color} border border-current/10`}
                          >
                            <IconComponent className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{insight.insight}</span>
                          </div>
                        );
                      })}
                    {user.insightLedger.filter((insight: any) => insight.confidence >= INSIGHT_CONFIDENCE_THRESHOLD).length === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        暂无高置信度洞察，继续和小悦聊天可解锁更多发现
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                      <span className="text-sm text-muted-foreground">{personalityResults.primaryArchetype}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${socialDnaOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  {/* Social Role Summary */}
                  <SocialRoleCard
                    primaryRole={personalityResults.primaryArchetype}
                    secondaryRole={personalityResults.secondaryArchetype}
                    primaryRoleScore={personalityResults.primaryArchetypeScore}
                    secondaryRoleScore={personalityResults.secondaryArchetypeScore}
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
                    <PersonalityRadarChart archetype={personalityResults.primaryArchetype} />
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
                        <div className={`relative bg-gradient-to-br ${archetypeGradients[personalityResults.primaryArchetype] || 'from-purple-500 to-pink-500'} bg-opacity-10 rounded-lg p-4 border-l-4 border-primary/50`}>
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

                  {/* Best Matches */}
                  <div className="space-y-3 pt-2 border-t">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      最佳搭档
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      作为<span className="font-semibold text-foreground">{personalityResults.primaryArchetype}</span>，你在活动中最有化学反应的角色：
                    </p>
                    <div className="space-y-2">
                      {getTopCompatibleArchetypes(personalityResults.primaryArchetype, 3).map((match) => (
                        <div key={match.archetype} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
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
                              <div className="text-xs text-muted-foreground">{getCompatibilityCategory(match.score)}</div>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-primary">{match.score}%</div>
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
