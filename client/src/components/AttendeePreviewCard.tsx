import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Briefcase, RotateCw, GraduationCap, MapPin, Globe, Sparkles,
  Zap, Sun, Search, Waves, Users, Heart, Lightbulb, Brain, Anchor, Shield, Eye,
  Film, Plane, Utensils, Music, Palette, Activity, BookOpen, Gamepad2, Camera, Dumbbell, Monitor,
  Compass, MessageSquare, Target, Scale, type LucideIcon
} from "lucide-react";
import {
  calculateCommonInterestsWithUser,
  archetypeDescriptions,
  generateSparkPredictions,
  normalizeInterestName,
  type AttendeeData,
} from "@/lib/attendeeAnalytics";
import { getOccupationDisplayLabel, getIndustryDisplayLabel } from "@shared/occupations";

const ARCHETYPE_ICONS: Record<string, LucideIcon> = {
  "火花塞": Zap,
  "探索者": Compass,
  "故事家": MessageSquare,
  "挑战者": Target,
  "连接者": Heart,
  "协调者": Scale,
  "氛围组": Sparkles,
  "肯定者": Users,
  "开心柯基": Zap,
  "太阳鸡": Sun,
  "夸夸豚": Sparkles,
  "机智狐": Search,
  "淡定海豚": Waves,
  "织网蛛": Users,
  "暖心熊": Heart,
  "灵感章鱼": Lightbulb,
  "沉思猫头鹰": Brain,
  "定心大象": Anchor,
  "稳如龟": Shield,
  "隐身猫": Eye,
};

const INTEREST_ICONS: Record<string, LucideIcon> = {
  "Film": Film,
  "Travel": Plane,
  "Food": Utensils,
  "Music": Music,
  "Art": Palette,
  "Sports": Activity,
  "Reading": BookOpen,
  "Gaming": Gamepad2,
  "Photography": Camera,
  "Fitness": Dumbbell,
  "电影": Film,
  "旅行": Plane,
  "美食": Utensils,
  "音乐": Music,
  "艺术": Palette,
  "运动": Activity,
  "阅读": BookOpen,
  "游戏": Gamepad2,
  "摄影": Camera,
  "健身": Dumbbell,
  "科技": Monitor,
};

interface AttendeePreviewCardProps {
  attendee: AttendeeData;
  userInterests?: string[];
  userTopicsHappy?: string[];
  userTopicsAvoid?: string[];
  userDebateComfort?: number;
  userEducationLevel?: string;
  userIndustry?: string;
  userAge?: number;
  userGender?: string;
  userRelationshipStatus?: string;
  userChildren?: string;
  userStudyLocale?: string;
  userOverseasRegions?: string[];
  userSeniority?: string;
  userFieldOfStudy?: string;
  userHometownCountry?: string;
  userHometownRegionCity?: string;
  userHometownAffinityOptin?: boolean;
  userArchetype?: string;
  userLanguages?: string[];
}

export default function AttendeePreviewCard({
  attendee,
  userInterests = [],
  userTopicsHappy,
  userTopicsAvoid,
  userDebateComfort,
  userEducationLevel,
  userIndustry,
  userAge,
  userGender,
  userRelationshipStatus,
  userChildren,
  userStudyLocale,
  userOverseasRegions,
  userSeniority,
  userFieldOfStudy,
  userHometownCountry,
  userHometownRegionCity,
  userHometownAffinityOptin,
  userArchetype,
  userLanguages,
}: AttendeePreviewCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const ArchetypeIconComponent = attendee.archetype
    ? ARCHETYPE_ICONS[attendee.archetype] || Sparkles
    : Sparkles;

  const topInterests = (attendee.topInterests || []).slice(0, 3);
  const archetypeDescription = attendee.archetype 
    ? archetypeDescriptions[attendee.archetype] || ""
    : "";

  const sparkPredictions = generateSparkPredictions(
    {
      userInterests,
      userTopicsHappy,
      userTopicsAvoid,
      userDebateComfort,
      userEducationLevel,
      userIndustry,
      userAge,
      userGender,
      userRelationshipStatus,
      userChildren,
      userStudyLocale,
      userOverseasRegions,
      userSeniority,
      userFieldOfStudy,
      userHometownCountry,
      userHometownRegionCity,
      userHometownAffinityOptin,
      userArchetype,
      userLanguages,
    },
    attendee
  );

  const connectionPointsCount = sparkPredictions.length;

  const genderDisplay = attendee.gender === "Woman" ? "女" : 
                       attendee.gender === "Man" ? "男" : 
                       attendee.gender || "";
  
  const educationDisplay = attendee.educationLevel === "Bachelor's" ? "本科" :
                          attendee.educationLevel === "Master's" ? "硕士" :
                          attendee.educationLevel === "Doctorate" ? "博士" :
                          attendee.educationLevel || "";

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      className="min-w-[180px] w-[180px] h-[320px] flex-shrink-0"
      style={{ perspective: "1000px" }}
      data-testid={`card-attendee-${attendee.userId}`}
    >
      <div
        className="relative w-full h-[320px]"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 0.5s",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <Card
          className="w-full cursor-pointer hover-elevate transition-all backface-hidden bg-gradient-to-br from-background via-background to-primary/5"
          onClick={handleFlip}
          style={{
            position: "absolute",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <CardContent className="p-3 space-y-2 h-[320px] flex flex-col items-center justify-center text-center">
            <div className="absolute top-2 right-2">
              <RotateCw className="h-4 w-4 text-muted-foreground" />
            </div>

            {attendee.archetype && (
              <div className="flex items-center justify-center mb-1">
                <ArchetypeIconComponent className="h-16 w-16 text-primary" />
              </div>
            )}

            <div className="space-y-1.5">
              <div
                className="font-semibold text-xl"
                data-testid={`text-attendee-name-${attendee.userId}`}
              >
                {attendee.displayName}
              </div>
              
              {attendee.archetype && (
                <div className="space-y-1">
                  <div
                    className="text-base font-medium text-primary"
                    data-testid={`text-attendee-archetype-${attendee.userId}`}
                  >
                    {attendee.archetype}
                  </div>
                  {archetypeDescription && (
                    <div className="text-sm text-muted-foreground px-1">
                      {archetypeDescription}
                    </div>
                  )}
                </div>
              )}
            </div>

            {connectionPointsCount > 0 && (
              <div
                className="flex items-center gap-1 text-sm text-muted-foreground mt-auto"
                data-testid={`text-common-interests-${attendee.userId}`}
              >
                <span>与你有{connectionPointsCount}个契合点</span>
                <div className="flex gap-0.5 ml-1">
                  {[...Array(3)].map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full ${
                        idx < connectionPointsCount
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className="absolute inset-0 w-full cursor-pointer hover-elevate transition-all backface-hidden bg-gradient-to-br from-background via-accent/10 to-accent/20"
          onClick={handleFlip}
          style={{
            position: "absolute",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <CardContent className="p-3 space-y-3 h-[320px] flex flex-col">
            <div className="flex items-start justify-between">
              <div className="font-semibold text-lg">
                {attendee.displayName}
              </div>
              <RotateCw className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>

            <div className="space-y-2.5 text-sm flex-shrink-0">
              {(genderDisplay || attendee.age) && (
                <div className="flex items-center gap-2 text-foreground">
                  {genderDisplay && (
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{genderDisplay}</span>
                    </div>
                  )}
                  {attendee.age && (
                    <span className="text-muted-foreground">{attendee.age}岁</span>
                  )}
                </div>
              )}

              {(educationDisplay || attendee.fieldOfStudy) && (
                <div className="flex items-start gap-1.5 text-foreground">
                  <GraduationCap className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    {educationDisplay && <span>{educationDisplay}</span>}
                    {attendee.fieldOfStudy && (
                      <span className="text-xs text-muted-foreground">{attendee.fieldOfStudy}</span>
                    )}
                  </div>
                </div>
              )}

              {(attendee.occupationId || attendee.industry || attendee.seniority) && (
                <div className="flex items-start gap-1.5 text-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    {attendee.occupationId ? (
                      <>
                        <span>{getOccupationDisplayLabel(attendee.occupationId, attendee.workMode, { showWorkMode: true })}</span>
                        <span className="text-xs text-muted-foreground">{getIndustryDisplayLabel(attendee.occupationId)}</span>
                      </>
                    ) : (
                      <>
                        {attendee.industry && <span>{attendee.industry}</span>}
                        {attendee.seniority && (
                          <span className="text-xs text-muted-foreground">
                            {attendee.seniority === "Junior" ? "初级" : 
                             attendee.seniority === "Mid" ? "中级" : 
                             attendee.seniority === "Senior" ? "高级" :
                             attendee.seniority === "Founder" ? "创始人" : attendee.seniority}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {attendee.hometownRegionCity && (
                <div className="flex items-center gap-1.5 text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span>{attendee.hometownRegionCity}</span>
                </div>
              )}

              {attendee.languagesComfort && attendee.languagesComfort.length > 0 && (
                <div className="flex items-start gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {attendee.languagesComfort.join(" · ")}
                  </span>
                </div>
              )}
            </div>

            {topInterests.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  个人兴趣
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topInterests.map((interest, idx) => {
                    const normalizedInterest = normalizeInterestName(interest);
                    const InterestIcon = INTEREST_ICONS[normalizedInterest] || INTEREST_ICONS[interest] || Sparkles;
                    return (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="text-xs gap-1 no-default-active-elevate bg-accent/30"
                        data-testid={`badge-interest-${attendee.userId}-${idx}`}
                      >
                        <InterestIcon className="h-3 w-3" />
                        <span>{normalizedInterest}</span>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {sparkPredictions.length > 0 && (
              <div className="space-y-1.5 mt-auto">
                <div className="text-xs font-medium text-muted-foreground">
                  我们之间的契合点
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sparkPredictions.map((prediction, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="text-xs gap-1 no-default-active-elevate bg-primary/10 text-primary border-primary/30"
                      data-testid={`badge-spark-back-${attendee.userId}-${idx}`}
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>{prediction.text}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
