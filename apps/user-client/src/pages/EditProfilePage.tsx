import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Settings2
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
  const { percentage, stars, missingFields } = calculateProfileCompletion(user);

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

  const totalMissingCount = sectionGroups.reduce((acc, group) => 
    acc + group.sections.reduce((sAcc, section) => sAcc + getIncompleteCount(section.fields), 0), 0
  );

  const handleChatWithXiaoyue = (topic?: string) => {
    const url = topic 
      ? `/registration/chat?mode=enrichment&topic=${encodeURIComponent(topic)}`
      : '/registration/chat?mode=enrichment';
    setLocation(url);
  };

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
        {/* Hero 助手卡片 - 移动端友好版 */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary/30 shadow-md">
                  <img 
                    src={xiaoyueAvatar} 
                    alt="小悦" 
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full border-2 border-background" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-lg">小悦</span>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    AI助手
                  </Badge>
                </div>
                <p className="text-base text-muted-foreground leading-snug">
                  {totalMissingCount > 0 
                    ? `还有${totalMissingCount}项可补充，聊几句搞定~`
                    : "资料很完善啦！"
                  }
                </p>
              </div>
            </div>
            
            {/* 进度条 + CTA */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground font-semibold min-w-[40px] text-right">{percentage}%</span>
              </div>
              
              <Button 
                onClick={() => handleChatWithXiaoyue()}
                size="lg"
                className="w-full gap-2"
                data-testid="button-chat-xiaoyue-main"
              >
                <MessageCircle className="h-5 w-5" />
                和小悦聊聊，补齐资料
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 快速补充区 - 移动端友好版 */}
        {groupsWithMissingFields.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">快速补充</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {groupsWithMissingFields.slice(0, 3).map((group) => {
                const groupMissingCount = group.sections.reduce(
                  (acc, section) => acc + getIncompleteCount(section.fields), 0
                );
                return (
                  <button
                    key={group.id}
                    className="inline-flex items-center gap-2 h-11 px-4 rounded-full border bg-background text-sm hover-elevate active-elevate-2 transition-colors"
                    onClick={() => handleChatWithXiaoyue(group.chatTopic)}
                    data-testid={`chip-chat-${group.id}`}
                  >
                    <MessageCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{group.chatTopic}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md font-medium">
                      {groupMissingCount}
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

        {/* 手动编辑区 - 移动端友好版 */}
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
                          <span className="text-sm text-muted-foreground">
                            {filledCount}/{totalCount}
                          </span>
                          {incompleteCount > 0 && (
                            <div className="w-2 h-2 rounded-full bg-amber-400" />
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
