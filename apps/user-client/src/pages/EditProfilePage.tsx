import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  User, 
  GraduationCap, 
  Briefcase, 
  Heart, 
  Star, 
  Target, 
  Users, 
  MapPin,
  MessageCircle,
  Sparkles,
  Settings2,
  Zap,
  Check,
  Crown
} from "lucide-react";
import {
  getGenderDisplay,
  calculateAge,
  formatAge,
  getEducationDisplay,
  getStudyLocaleDisplay,
  getSeniorityDisplay,
  getRelationshipDisplay,
  getChildrenDisplay,
  getIntentDisplay,
  getUserPrimaryInterests,
  getUserTopicAvoidances,
  getIcebreakerRoleDisplay,
  getSocialStyleDisplay,
} from "@/lib/userFieldMappings";
import { getOccupationDisplayLabel, getIndustryDisplayLabel, WORK_MODE_TO_LABEL, INDUSTRY_ID_TO_LABEL, type WorkMode } from "@shared/occupations";
import { getInterestLabel, getTopicLabel } from "@/data/interestsTopicsData";
import { calculateProfileCompletion } from "@/lib/profileCompletion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import xiaoyueAvatar from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyueThinking from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";

interface Field {
  label: string;
  value: string | null | undefined;
}

interface Section {
  id: string;
  title: string;
  icon: ReactNode;
  path: string;
  fields: Field[];
  hint?: string;
}

interface SectionGroup {
  id: string;
  title: string;
  sections: Section[];
  chatTopic?: string;
}

type MatchTier = "普通匹配" | "优先匹配" | "VIP匹配";

function getMatchTier(percentage: number): { tier: MatchTier; nextTier: MatchTier | null; nextThreshold: number; icon: ReactNode } {
  if (percentage >= 80) {
    return { tier: "VIP匹配", nextTier: null, nextThreshold: 100, icon: <Crown className="h-4 w-4 text-amber-500" /> };
  } else if (percentage >= 50) {
    return { tier: "优先匹配", nextTier: "VIP匹配", nextThreshold: 80, icon: <Zap className="h-4 w-4 text-primary" /> };
  } else {
    return { tier: "普通匹配", nextTier: "优先匹配", nextThreshold: 50, icon: <Star className="h-4 w-4 text-muted-foreground" /> };
  }
}

function getXiaoyueState(percentage: number): { avatar: string; message: string; mood: "thinking" | "normal" | "excited" } {
  if (percentage >= 80) {
    return {
      avatar: xiaoyueExcited,
      message: "太棒了！资料超完善，匹配精准度Max~",
      mood: "excited"
    };
  } else if (percentage >= 50) {
    return {
      avatar: xiaoyueAvatar,
      message: "不错哦！再补充几项就能解锁VIP匹配啦~",
      mood: "normal"
    };
  } else {
    return {
      avatar: xiaoyueThinking,
      message: "期待更了解你，聊几句就能提升匹配精准度~",
      mood: "thinking"
    };
  }
}

function StarProgress({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 transition-all ${
            i < filled
              ? "text-amber-400 fill-amber-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export default function EditProfilePage() {
  const [, setLocation] = useLocation();
  const [manualEditOpen, setManualEditOpen] = useState(false);
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  const age = user.birthdate ? calculateAge(user.birthdate) : null;
  const ageDisplay = age ? formatAge(age) : null;
  const { percentage } = calculateProfileCompletion(user);
  const matchTierInfo = getMatchTier(percentage);
  const xiaoyueState = getXiaoyueState(percentage);

  const getIncompleteCount = (fields: Field[]) => {
    return fields.filter(f => !f.value).length;
  };

  const sectionGroups: SectionGroup[] = [
    {
      id: "identity",
      title: "身份基础",
      chatTopic: "基本信息",
      sections: [
        {
          id: "basic",
          title: "基本信息",
          icon: <User className="h-4 w-4" />,
          path: "/profile/edit/basic",
          fields: [
            { label: "昵称", value: user.displayName },
            { label: "性别", value: user.gender ? getGenderDisplay(user.gender) : null },
            { label: "年龄", value: ageDisplay },
            { label: "常用语言", value: user.languagesComfort?.join(", ") },
          ],
        },
      ],
    },
    {
      id: "life",
      title: "生活快照",
      chatTopic: "生活状态",
      sections: [
        {
          id: "life-status",
          title: "生活状态",
          icon: <Heart className="h-4 w-4" />,
          path: "/profile/edit/personal",
          fields: [
            { label: "关系状态", value: user.relationshipStatus ? getRelationshipDisplay(user.relationshipStatus) : null },
            { label: "孩子状况", value: user.children ? getChildrenDisplay(user.children) : null },
            { label: "毛孩子", value: user.hasPets === true ? (user.petTypes?.length > 0 ? user.petTypes.join(", ") : "有") : user.hasPets === false ? "没有" : null },
            { label: "兄弟姐妹", value: user.hasSiblings === true ? "有" : user.hasSiblings === false ? "独生子女" : null },
          ],
          hint: "仅自己可见",
        },
        {
          id: "city-footprint",
          title: "城市足迹",
          icon: <MapPin className="h-4 w-4" />,
          path: "/profile/edit/personal",
          fields: [
            { label: "现居城市", value: user.currentCity || null },
            { label: "家乡", value: user.hometownRegionCity || null },
          ],
        },
      ],
    },
    {
      id: "growth",
      title: "成长与职业",
      chatTopic: "工作背景",
      sections: [
        {
          id: "education",
          title: "教育背景",
          icon: <GraduationCap className="h-4 w-4" />,
          path: "/profile/edit/education",
          fields: [
            { label: "教育水平", value: user.educationLevel ? getEducationDisplay(user.educationLevel) : null },
            { label: "专业领域", value: user.fieldOfStudy },
            { label: "学习地点", value: user.studyLocale ? getStudyLocaleDisplay(user.studyLocale) : null },
            ...(user.studyLocale === "Overseas" || user.studyLocale === "Both"
              ? [{ label: "海外地区", value: user.overseasRegions?.join(", ") }]
              : []),
          ],
        },
        {
          id: "work",
          title: "工作信息",
          icon: <Briefcase className="h-4 w-4" />,
          path: "/profile/edit/work",
          fields: [
            { label: "职业", value: getOccupationDisplayLabel(user.occupationId, user.workMode, { showWorkMode: true }) || (user.industry ? INDUSTRY_ID_TO_LABEL[user.industry] || user.industry : null) },
            { label: "行业", value: getIndustryDisplayLabel(user.occupationId) || (user.industry ? INDUSTRY_ID_TO_LABEL[user.industry] || user.industry : null) },
            { label: "工作身份", value: user.workMode ? WORK_MODE_TO_LABEL[user.workMode as WorkMode] : null },
            { label: "公司", value: user.companyName || null },
            { label: "资历", value: user.seniority ? getSeniorityDisplay(user.seniority) : null },
          ],
        },
      ],
    },
    {
      id: "social-prefs",
      title: "社交偏好",
      chatTopic: "兴趣爱好",
      sections: [
        {
          id: "interests",
          title: "兴趣偏好",
          icon: <Star className="h-4 w-4" />,
          path: "/profile/edit/interests",
          fields: [
            { 
              label: "主要兴趣", 
              value: getUserPrimaryInterests(user).length > 0 
                ? getUserPrimaryInterests(user).map(id => getInterestLabel(id)).join(", ") 
                : null 
            },
            { 
              label: "话题排斥", 
              value: getUserTopicAvoidances(user).length > 0 
                ? getUserTopicAvoidances(user).map(id => getTopicLabel(id)).join(", ") 
                : null 
            },
            {
              label: "美食偏好",
              value: user.cuisinePreference?.length > 0 ? user.cuisinePreference.join(", ") : null
            },
          ],
        },
        {
          id: "intent",
          title: "活动意图",
          icon: <Target className="h-4 w-4" />,
          path: "/profile/edit/intent",
          fields: [
            { label: "默认活动意图", value: user.intent ? getIntentDisplay(user.intent) : null },
          ],
          hint: "影响活动匹配，加入活动时可调整",
        },
        {
          id: "social-style",
          title: "社交风格",
          icon: <Users className="h-4 w-4" />,
          path: "/profile/edit/social",
          fields: [
            { label: "破冰角色", value: user.icebreakerRole ? getIcebreakerRoleDisplay(user.icebreakerRole) : null },
            { label: "社交风格", value: user.socialStyle ? getSocialStyleDisplay(user.socialStyle) : null },
          ],
        },
      ],
    },
  ];

  const groupsWithMissingFields = sectionGroups.filter(group => 
    group.sections.some(section => getIncompleteCount(section.fields) > 0)
  );

  const handleChatWithXiaoyue = (topic?: string) => {
    const url = topic 
      ? `/registration/chat?mode=enrichment&topic=${encodeURIComponent(topic)}`
      : '/registration/chat?mode=enrichment';
    setLocation(url);
  };

  const itemsToNextTier = matchTierInfo.nextTier 
    ? Math.ceil((matchTierInfo.nextThreshold - percentage) / 5)
    : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/profile")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 text-lg font-semibold">编辑资料</h1>
        </div>
      </div>

      <div className="px-4 py-3 space-y-4 max-w-2xl mx-auto">
        {/* Hero 助手卡片 - Gamified版 */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
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
                    data-testid="img-xiaoyue-avatar"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-lg">小悦</span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  AI助手
                </Badge>
              </div>
              <p className="text-base text-muted-foreground leading-snug max-w-[280px]" data-testid="text-xiaoyue-message">
                {xiaoyueState.message}
              </p>
            </div>

            {/* 里程碑提示 */}
            <div className="bg-muted/50 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {matchTierInfo.icon}
                  <span className="font-medium text-sm">{matchTierInfo.tier}</span>
                </div>
                <span className="text-sm text-muted-foreground font-semibold">{percentage}%</span>
              </div>
              
              {/* 进度条 */}
              <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full rounded-full transition-all ${
                    percentage >= 80 
                      ? "bg-gradient-to-r from-amber-400 to-amber-500" 
                      : percentage >= 50 
                        ? "bg-gradient-to-r from-primary to-primary/80"
                        : "bg-gradient-to-r from-slate-400 to-slate-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              
              {/* 升级提示 */}
              {matchTierInfo.nextTier && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" />
                  再补充 {itemsToNextTier} 项 → 解锁「{matchTierInfo.nextTier}」
                </p>
              )}
              {!matchTierInfo.nextTier && (
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
                onClick={() => handleChatWithXiaoyue()}
                size="lg"
                className="relative w-full gap-3 bg-gradient-to-r from-primary via-purple-500 to-pink-500 shadow-xl border-0 min-h-[56px] text-base font-semibold"
                data-testid="button-chat-xiaoyue-main"
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
                  <span>立即补齐，解锁VIP匹配</span>
                  <span className="text-xs opacity-80 font-normal">小悦陪你3分钟搞定</span>
                </div>
                {/* XP奖励气泡 */}
                <Badge className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 border-0 shadow-md">
                  +{Math.max(20, (100 - percentage))}XP
                </Badge>
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        {/* 快速补充区 - 带推荐标签和XP提示 */}
        {groupsWithMissingFields.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">快速补充</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupsWithMissingFields.slice(0, 3).map((group, index) => {
                const groupMissingCount = group.sections.reduce(
                  (acc, section) => acc + getIncompleteCount(section.fields), 0
                );
                const isRecommended = index === 0;
                return (
                  <button
                    key={group.id}
                    className={`relative inline-flex items-center gap-2 h-11 px-4 rounded-full border text-sm hover-elevate active-elevate-2 transition-colors ${
                      isRecommended 
                        ? "bg-primary/5 border-primary/30" 
                        : "bg-background"
                    }`}
                    onClick={() => handleChatWithXiaoyue(group.chatTopic)}
                    data-testid={`chip-chat-${group.id}`}
                  >
                    {isRecommended && (
                      <Badge className="absolute -top-2 -right-1 text-[10px] px-1.5 py-0 bg-primary">
                        推荐
                      </Badge>
                    )}
                    <MessageCircle className={`h-4 w-4 ${isRecommended ? "text-primary" : "text-muted-foreground"}`} />
                    <span>{group.chatTopic}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                      isRecommended 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted text-muted-foreground"
                    }`}>
                      +{groupMissingCount * 5}XP
                    </span>
                  </button>
                );
              })}
              {groupsWithMissingFields.length > 3 && (
                <button
                  className="inline-flex items-center h-11 px-4 rounded-full border bg-background text-sm text-muted-foreground hover-elevate"
                  onClick={() => setManualEditOpen(true)}
                  data-testid="chip-more"
                >
                  更多...
                </button>
              )}
            </div>
          </div>
        )}

        {/* 手动编辑区 - 带星星进度 */}
        <Collapsible open={manualEditOpen} onOpenChange={setManualEditOpen}>
          <CollapsibleTrigger asChild>
            <button 
              className="w-full flex items-center justify-between h-12 px-3 text-muted-foreground hover:text-foreground rounded-lg hover-elevate transition-colors"
              data-testid="button-toggle-manual-edit"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                <span className="text-base">精细调整</span>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${manualEditOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pt-2">
            <Card className="border">
              <CardContent className="p-0 divide-y divide-border/50">
                {sectionGroups.flatMap((group) => 
                  group.sections.map((section) => {
                    const incompleteCount = getIncompleteCount(section.fields);
                    const filledCount = section.fields.filter(f => f.value).length;
                    const totalCount = section.fields.length;
                    const isComplete = incompleteCount === 0;
                    // Normalize to 5 stars for visual consistency
                    // Use floor to avoid showing 5 stars when incomplete, only 5 when truly complete
                    const normalizedFilled = totalCount > 0 
                      ? (isComplete ? 5 : Math.min(4, Math.floor((filledCount / totalCount) * 5)))
                      : 0;
                    
                    return (
                      <div 
                        key={section.id}
                        className="flex items-center justify-between px-4 py-3.5 cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => setLocation(section.path)}
                        data-testid={`row-${section.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground [&>svg]:h-5 [&>svg]:w-5">{section.icon}</span>
                          <span className="text-base">{section.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isComplete ? (
                            <div className="flex items-center gap-1.5 text-green-600">
                              <Check className="h-4 w-4" />
                              <span className="text-xs font-medium">已完成</span>
                            </div>
                          ) : (
                            <>
                              <StarProgress filled={normalizedFilled} total={5} />
                              <div className="w-2 h-2 rounded-full bg-amber-400" />
                            </>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
