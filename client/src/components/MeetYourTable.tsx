import { useRef } from "react";
import GroupSummaryCard from "./GroupSummaryCard";
import UserConnectionCard from "./UserConnectionCard";
import { generateSparkPredictions, normalizeInterestName, type AttendeeData } from "@/lib/attendeeAnalytics";

interface MeetYourTableProps {
  attendees: AttendeeData[];
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
  userLanguages?: string[];
  userHometownCountry?: string;
  userHometownRegionCity?: string;
  userHometownAffinityOptin?: boolean;
  userArchetype?: string;
}

export default function MeetYourTable({
  attendees,
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
  userLanguages,
  userHometownCountry,
  userHometownRegionCity,
  userHometownAffinityOptin,
  userArchetype,
}: MeetYourTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (!attendees || attendees.length === 0) {
    return null;
  }

  const userContext = {
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
    userLanguages,
    userHometownCountry,
    userHometownRegionCity,
    userHometownAffinityOptin,
    userArchetype,
  };

  const interestIcons: Record<string, string> = {
    "电影娱乐": "🎬",
    "旅行探索": "✈️",
    "美食餐饮": "🍜",
    "音乐演出": "🎵",
    "阅读书籍": "📚",
    "艺术文化": "🎨",
    "运动健身": "⚽",
    "健身健康": "💪",
    "摄影": "📷",
    "游戏": "🎮",
    "科技": "💻",
  };

  return (
    <div className="space-y-4" data-testid="section-meet-your-table">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">认识你的桌友</h3>
        <p className="text-sm text-muted-foreground">
          提前了解一起聚会的朋友，减少冷场尴尬
        </p>
      </div>

      <GroupSummaryCard attendees={attendees} />

      {/* Title for attendee cards */}
      <div className="mt-6 mb-4">
        <h2 className="text-xl font-medium">👥 即将见面的新朋友</h2>
      </div>

      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {attendees.map((attendee) => {
            const sparkPredictions = generateSparkPredictions(userContext, attendee);
            
            const connectionTags = sparkPredictions.map((prediction) => {
              let icon = "✨";
              let type: "interest" | "background" | "experience" = "experience";
              const predictionText = prediction.text;
              
              // Determine icon based on prediction type
              if (predictionText.includes("共同影迷") || predictionText.includes("Movie") || predictionText.includes("电影")) {
                icon = "🎬";
                type = "interest";
              } else if (predictionText.includes("旅行") || predictionText.includes("Travel")) {
                icon = "✈️";
                type = "interest";
              } else if (predictionText.includes("美食") || predictionText.includes("Food") || predictionText.includes("Foodie")) {
                icon = "🍜";
                type = "interest";
              } else if (predictionText.includes("音乐") || predictionText.includes("Music")) {
                icon = "🎵";
                type = "interest";
              } else if (predictionText.includes("书友") || predictionText.includes("阅读") || predictionText.includes("Book")) {
                icon = "📚";
                type = "interest";
              } else if (predictionText.includes("摄影") || predictionText.includes("Photo")) {
                icon = "📷";
                type = "interest";
              } else if (predictionText.includes("健身") || predictionText.includes("运动") || predictionText.includes("Fitness") || predictionText.includes("Gym")) {
                icon = "💪";
                type = "interest";
              } else if (predictionText.includes("户外") || predictionText.includes("Outdoor")) {
                icon = "🏕️";
                type = "interest";
              } else if (predictionText.includes("咖啡") || predictionText.includes("Coffee") || predictionText.includes("茶")) {
                icon = "☕";
                type = "interest";
              } else if (predictionText.includes("海外") || predictionText.includes("留学") || predictionText.includes("国际化")) {
                icon = "🌍";
                type = "background";
              } else if (predictionText.includes("学历") || predictionText.includes("博士") || predictionText.includes("硕士")) {
                icon = "🎓";
                type = "background";
              } else if (predictionText.includes("创业") || predictionText.includes("Founder")) {
                icon = "🚀";
                type = "experience";
              } else if (predictionText.includes("职场") || predictionText.includes("Senior") || predictionText.includes("资深")) {
                icon = "💼";
                type = "experience";
              } else if (predictionText.includes("单身") || predictionText.includes("Single") || predictionText.includes("有伴")) {
                icon = "💑";
                type = "background";
              } else if (predictionText.includes("年龄段") || predictionText.includes("同龄")) {
                icon = "🎂";
                type = "background";
              } else if (predictionText.includes("香港") || predictionText.includes("深圳") || predictionText.includes("北京") || predictionText.includes("上海") || predictionText.includes("老乡") || predictionText.includes("同乡")) {
                icon = "📍";
                type = "background";
              } else if (predictionText.includes("探索") || predictionText.includes("发光") || predictionText.includes("智者") || predictionText.includes("讲故事") || predictionText.includes("稳定")) {
                icon = "🎭";
                type = "experience";
              } else if (predictionText.includes("分享") || predictionText.includes("倾听")) {
                icon = "💬";
                type = "experience";
              } else if (predictionText.includes("深度对话")) {
                icon = "🧠";
                type = "experience";
              } else if (predictionText.includes("活力")) {
                icon = "⚡";
                type = "experience";
              } else if (predictionText.includes("可靠")) {
                icon = "🤝";
                type = "experience";
              } else if (predictionText.includes("科技圈") || predictionText.includes("金融圈") || predictionText.includes("艺术领域") || predictionText.includes("医疗行业") || predictionText.includes("教育行业")) {
                icon = "🏢";
                type = "experience";
              } else if (predictionText.includes("硕士海归") || predictionText.includes("博士海归")) {
                icon = "💎";
                type = "background";
              } else {
                icon = "✨";
                type = "experience";
              }
              
              return { icon, label: predictionText, type, rarity: prediction.rarity };
            });

            return (
              <UserConnectionCard
                key={attendee.userId}
                attendee={attendee}
                connectionTags={connectionTags}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
