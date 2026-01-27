import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, User, GraduationCap, Briefcase, Heart, Star, Target, Users, MapPin } from "lucide-react";
import {
  getGenderDisplay,
  calculateAge,
  formatAge,
  getEducationDisplay,
  getStudyLocaleDisplay,
  getRelationshipDisplay,
  getChildrenDisplay,
  getIntentDisplay,
  getUserPrimaryInterests,
  getUserTopicAvoidances,
} from "@/lib/userFieldMappings";
import { getOccupationDisplayLabel, getIndustryDisplayLabel, WORK_MODE_TO_LABEL, INDUSTRY_ID_TO_LABEL, type WorkMode } from "@shared/occupations";
import { getInterestLabel } from "@shared/interests";

// Topic label helper (topics are free-form strings, so we just return them as-is)
const getTopicLabel = (topic: string) => topic;

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
}

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

  // Calculate incomplete fields count for a section
  const getIncompleteCount = (fields: Field[]) => {
    return fields.filter(f => !f.value).length;
  };

  // 4 Theme Groups (per UIUX expert recommendation)
  const sectionGroups: SectionGroup[] = [
    {
      id: "identity",
      title: "身份基础",
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
          ],
        },
      ],
    },
    {
      id: "life",
      title: "生活快照",
      sections: [
        {
          id: "life-status",
          title: "生活状态",
          icon: <Heart className="h-4 w-4" />,
          path: "/profile/edit/personal",
          fields: [
            { label: "关系状态", value: user.relationshipStatus ? getRelationshipDisplay(user.relationshipStatus) : null },
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
      sections: [
        {
          id: "education",
          title: "教育背景",
          icon: <GraduationCap className="h-4 w-4" />,
          path: "/profile/edit/education",
          fields: [
            { label: "教育水平", value: user.educationLevel ? getEducationDisplay(user.educationLevel) : null },
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
          ],
        },
      ],
    },
    {
      id: "social-prefs",
      title: "社交偏好",
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

      {/* Content - 4 Theme Groups */}
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {sectionGroups.map((group) => (
          <div key={group.id} className="space-y-3">
            {/* Group Title */}
            <h2 className="text-sm font-medium text-muted-foreground px-1">{group.title}</h2>
            
            {/* Sections in Group */}
            <div className="space-y-2">
              {group.sections.map((section) => {
                const incompleteCount = getIncompleteCount(section.fields);
                
                return (
                  <Card 
                    key={section.id} 
                    className="border shadow-sm cursor-pointer hover-elevate active-elevate-2 transition-all"
                    onClick={() => setLocation(section.path)}
                    data-testid={`card-${section.id}`}
                  >
                    <CardHeader className="pb-2 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {section.icon}
                          <CardTitle className="text-base">{section.title}</CardTitle>
                          {incompleteCount > 0 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                              {incompleteCount}项待填
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 pt-0">
                      {/* Compact chip-style display for filled values */}
                      <div className="flex flex-wrap gap-1.5">
                        {section.fields.filter(f => f.value).map((field, idx) => (
                          <span 
                            key={idx} 
                            className="inline-flex items-center text-xs bg-muted/50 px-2 py-1 rounded-md"
                          >
                            <span className="text-muted-foreground mr-1">{field.label}:</span>
                            <span className="font-medium truncate max-w-[120px]">{field.value}</span>
                          </span>
                        ))}
                        {section.fields.filter(f => !f.value).length === section.fields.length && (
                          <span className="text-xs text-muted-foreground">点击填写</span>
                        )}
                      </div>
                      {section.hint && (
                        <div className="text-xs text-muted-foreground mt-2 opacity-70">
                          {section.hint}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
