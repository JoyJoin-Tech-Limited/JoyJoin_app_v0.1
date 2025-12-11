import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, User, GraduationCap, Briefcase, Heart, Star, Target } from "lucide-react";
import {
  getGenderDisplay,
  calculateAge,
  formatAge,
  getEducationDisplay,
  getStudyLocaleDisplay,
  getRelationshipDisplay,
  getChildrenDisplay,
  getIntentDisplay,
} from "@/lib/userFieldMappings";
import { getOccupationDisplayLabel, getIndustryDisplayLabel, WORK_MODE_TO_LABEL, type WorkMode } from "@shared/occupations";

export default function EditProfilePage() {
  const [, setLocation] = useLocation();
  
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

  // Section cards configuration
  const sections = [
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
    {
      id: "personal",
      title: "个人背景",
      icon: <Heart className="h-4 w-4" />,
      path: "/profile/edit/personal",
      fields: [
        { label: "关系状态", value: user.relationshipStatus ? getRelationshipDisplay(user.relationshipStatus) : null },
        { label: "孩子状况", value: user.children ? getChildrenDisplay(user.children) : null },
        { label: "毛孩子", value: user.hasPets === true ? "有" : user.hasPets === false ? "没有" : null },
        { label: "兄弟姐妹", value: user.hasSiblings === true ? "有" : user.hasSiblings === false ? "独生子女" : null },
        { label: "现居城市", value: user.currentCity || null },
      ],
      hint: "提示：此信息仅自己可见",
    },
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
        { label: "职业", value: getOccupationDisplayLabel(user.occupationId, user.workMode, { showWorkMode: true }) || user.industry },
        { label: "行业", value: getIndustryDisplayLabel(user.occupationId) || (user.industry && !user.occupationId ? user.industry : null) },
        { label: "工作身份", value: user.workMode ? WORK_MODE_TO_LABEL[user.workMode as WorkMode] : null },
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
      hint: "💡 提示：这是默认设置，加入活动时可以调整",
    },
    {
      id: "interests",
      title: "兴趣偏好",
      icon: <Star className="h-4 w-4" />,
      path: "/profile/edit/interests",
      fields: [
        { label: "兴趣爱好", value: user.interestsTop?.join(", ") },
        { label: "喜欢聊的话题", value: user.topicsHappy?.join(", ") },
        { label: "避免的话题", value: user.topicsAvoid?.join(", ") },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
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

      {/* Content */}
      <div className="p-4 space-y-3 max-w-2xl mx-auto">
        {sections.map((section) => (
          <Card 
            key={section.id} 
            className="border shadow-sm cursor-pointer hover-elevate active-elevate-2 transition-all"
            onClick={() => setLocation(section.path)}
            data-testid={`card-${section.id}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {section.icon}
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {section.fields.map((field, idx) => (
                <div key={idx} className="flex justify-between items-start gap-2">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="text-right flex-1 font-medium">
                    {field.value || <span className="text-muted-foreground font-normal">未填写</span>}
                  </span>
                </div>
              ))}
              {section.hint && (
                <div className="text-xs text-muted-foreground pt-2">
                  {section.hint}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
