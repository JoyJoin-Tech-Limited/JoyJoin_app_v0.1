import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, MapPin, Users, Navigation, AlertCircle, Sparkles, ChevronRight } from "lucide-react";
import PostMatchEventCard from "@/components/PostMatchEventCard";
import IcebreakerTool from "@/components/IcebreakerTool";
import ArchetypeOrbit from "@/components/ArchetypeOrbit";
import { useAuth } from "@/hooks/useAuth";
import { useGroupAnalysis } from "@/hooks/useGroupAnalysis";
import { calculateAge } from "@shared/utils";
import type { AttendeeData } from "@/lib/attendeeAnalytics";

interface PoolGroupResponse {
  group: {
    id: string;
    groupNumber: number;
    memberCount: number;
    matchScore: number | null;
    matchExplanation: string | null;
    venueName: string | null;
    venueAddress: string | null;
    finalDateTime: string | null;
    status: string;
  };
  pool: {
    id: string;
    title: string;
    description: string | null;
    eventType: string;
    city: string;
    district: string | null;
    dateTime: string;
  };
  members: AttendeeData[];
}

export default function PoolGroupDetailPage() {
  const { groupId } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery<PoolGroupResponse>({
    queryKey: ["/api/pool-groups", groupId],
  });

  const { data: groupAnalysis, isLoading: isLoadingAnalysis } = useGroupAnalysis(data?.group?.id ?? null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="text-center py-12">
          <p className="text-muted-foreground">小组不存在</p>
        </div>
      </div>
    );
  }

  const { group, pool, members } = data;

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
  };

  const getCountdown = (dateTime: string) => {
    const now = new Date();
    const eventDate = new Date(dateTime);
    const diff = eventDate.getTime() - now.getTime();
    
    if (diff <= 0) return "活动进行中";
    
    // Convert to total hours (including days converted to hours)
    const totalMinutes = Math.floor(diff / (1000 * 60));
    
    if (totalMinutes >= 60) {
      const totalHours = Math.ceil(diff / (1000 * 60 * 60));
      return `报名截止 · ${totalHours}小时`;
    } else {
      return `报名截止 · ${totalMinutes}分钟`;
    }
  };

  const handleNavigation = () => {
    const locationHint = [group.venueName, group.venueAddress, pool.city, pool.district].filter(Boolean).join(' ');

    if (group.venueName && group.venueAddress) {
      const venueName = encodeURIComponent(group.venueName);
      window.open(
        `https://uri.amap.com/marker?name=${venueName}&address=${encodeURIComponent(group.venueAddress)}`,
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }

    if (locationHint) {
      window.open(
        `https://uri.amap.com/search?query=${encodeURIComponent(locationHint)}&city=${encodeURIComponent(pool.city)}`,
        '_blank',
        'noopener,noreferrer',
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 safe-area-bottom">
      {/* Bottom nav gradient transition */}
      <div className="fixed bottom-16 left-0 right-0 h-20 pointer-events-none z-40 bg-gradient-to-t from-background via-background/50 to-transparent" />
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation("/events")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 font-semibold">活动详情</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Archetype Orbit Reveal Section */}
        <Card className="overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 mb-4">
                <Sparkles className="h-3 w-3 mr-1" />
                #{group.groupNumber}组
              </Badge>
            </div>
            
            <ArchetypeOrbit
              archetypes={members.map(m => m.archetype || '')}
              size="medium"
              animated={false}
            />
            
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">{pool.title}</h2>
              <p className="text-sm text-muted-foreground">
                {formatDateTime(group.finalDateTime || pool.dateTime)}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span className="font-medium text-primary">
                  {getCountdown(group.finalDateTime || pool.dateTime)}
                </span>
              </div>
            </div>
            
            {group.matchScore != null && (
              <div className="text-center">
                <Badge variant="secondary" className="text-base px-4 py-2">
                  匹配度 {group.matchScore}分
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 顶部摘要 - Simplified */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{group.memberCount}人小组</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{pool.eventType}</span>
            </div>
          </CardContent>
        </Card>

        {/* 地点信息 */}
        {group.venueName && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">地点信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">{group.venueName}</p>
                    <p className="text-sm text-muted-foreground">{group.venueAddress}</p>
                    <p className="text-xs text-muted-foreground">
                      {pool.city}{pool.district ? `•${pool.district}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleNavigation}
                data-testid="button-navigate"
              >
                <Navigation className="h-4 w-4 mr-2" />
                到这去
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 活动池描述 */}
        {pool.description && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">活动介绍</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{pool.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Post-Match Event Card: Member Insights & Match Explanation */}
        {members && members.length > 0 && (
          <PostMatchEventCard 
            matchedAttendees={members.map(m => ({
              userId: m.userId,
              displayName: m.displayName,
              archetype: m.archetype,
              topInterests: m.topInterests,
              industry: m.industry,
              ageVisible: m.ageVisible,
              industryVisible: m.industryVisible,
            }))}
            matchExplanation={group.matchExplanation || undefined}
            currentUser={{
              interests: (user?.interestsRankedTop3 as string[] | undefined) || [],
              educationLevel: user?.educationLevel || undefined,
              age: user?.birthdate ? calculateAge(user.birthdate) : undefined,
              gender: user?.gender || undefined,
              relationshipStatus: user?.relationshipStatus || undefined,
              hometownRegionCity: user?.hometownRegionCity || undefined,
              hometownAffinityOptin: user?.hometownAffinityOptin ?? undefined,
            }}
            groupAnalysis={groupAnalysis}
            isLoadingAnalysis={isLoadingAnalysis}
          />
        )}

        {/* 破冰工具 */}
        <IcebreakerTool />

        {/* 破冰卡牌游戏入口 (仅活动开始后显示) */}
        {groupId && data?.pool?.dateTime && (() => {
          // Client-side time check: event has started
          const now = new Date();
          const eventTime = new Date(data.pool.dateTime);
          const hasEventStarted = now >= eventTime;
          
          return hasEventStarted ? (
            <button
              onClick={() => {
                setLocation(`/icebreaker-game?groupId=${groupId}`);
              }}
              className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-600 rounded-xl p-4 transition-all active:scale-[0.98] shadow-lg"
              data-testid="button-open-card-game"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-semibold text-sm">开始破冰卡牌游戏</p>
                  <p className="text-white/70 text-xs">AI 为你们定制的互动卡牌</p>
                </div>
                <div className="flex items-center gap-1 text-white/80">
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                    新
                  </Badge>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </button>
          ) : null;
        })()}

        {/* 规则与到场指南 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">规则与到场指南</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p>请提前10分钟到场</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p>开局前24小时内不可退</p>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p>迟到/缺席将影响信用分</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
