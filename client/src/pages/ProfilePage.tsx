import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import SocialRoleCard from "@/components/SocialRoleCard";
import PersonalityRadarChart from "@/components/PersonalityRadarChart";
import QuizIntro from "@/components/QuizIntro";
import EditFullProfileDialog from "@/components/EditFullProfileDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, LogOut, Shield, HelpCircle, Sparkles, Heart, Quote, Target, RefreshCw, MessageCircle, Star } from "lucide-react";
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
                <div className={`h-16 w-16 rounded-full ${avatarConfig.bgColor} flex items-center justify-center text-3xl`}>
                  {avatarConfig.icon}
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
                  onClick={() => setLocation('/chat-registration?mode=enrichment')}
                  data-testid="button-chat-with-xiaoyue"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  和小悦聊聊，补充资料
                </Button>
              </CardContent>
            </Card>
          );
        })()}

        {/* Social Role Card - Show if test completed */}
        {hasCompletedQuiz && personalityResults && (
          <SocialRoleCard
            primaryRole={personalityResults.primaryRole}
            secondaryRole={personalityResults.secondaryRole}
            primaryRoleScore={personalityResults.primaryRoleScore}
            secondaryRoleScore={personalityResults.secondaryRoleScore}
          />
        )}

        {/* Personality Traits Card - Radar Chart + 6-Dimension Scores */}
        {hasCompletedQuiz && personalityResults && (
          <Card className="border shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">性格特质</h3>
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
                archetype={personalityResults.primaryRole}
              />
            </CardContent>
          </Card>
        )}

        {/* Role Details Card - Show rich archetype content */}
        {hasCompletedQuiz && personalityResults && archetypeDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                角色深度解读
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Epic Description */}
              {archetypeDetails.epicDescription && (
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed text-foreground/90" data-testid="text-epic-description">
                    {archetypeDetails.epicDescription}
                  </p>
                </div>
              )}

              {/* Style Quote */}
              {archetypeDetails.styleQuote && (
                <div className={`relative bg-gradient-to-br ${archetypeGradients[personalityResults.primaryRole] || 'from-purple-500 to-pink-500'} bg-opacity-10 rounded-lg p-4 border-l-4 border-primary/50`}>
                  <Quote className="w-6 h-6 text-primary/40 absolute top-2 left-2" />
                  <p className="text-sm font-medium italic text-foreground pl-8" data-testid="text-style-quote">
                    {archetypeDetails.styleQuote}
                  </p>
                </div>
              )}

              {/* Core Contributions */}
              {archetypeDetails.coreContributions && (
                <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-3">
                  <Target className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">核心贡献</p>
                    <p className="text-sm font-medium text-foreground" data-testid="text-core-contributions">
                      {archetypeDetails.coreContributions}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Archetype Compatibility Preview Card */}
        {hasCompletedQuiz && personalityResults && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                最佳搭档
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                作为<span className="font-semibold text-foreground">{personalityResults.primaryRole}</span>，你在活动中最有化学反应的角色：
              </p>
              <div className="space-y-2">
                {getTopCompatibleArchetypes(personalityResults.primaryRole, 3).map((match) => (
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
            </CardContent>
          </Card>
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
