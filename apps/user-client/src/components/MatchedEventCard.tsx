import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MapPin, Clock, DollarSign, Users, Navigation, CheckCircle2, Sparkles, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { BlindBoxEvent } from "@shared/schema";
import { getCurrencySymbol } from "@/lib/currency";
import { useLocation } from "wouter";
import { formatDateInHongKong, getHongKongDateForComparison } from "@/lib/hongKongTime";
import { useState } from "react";
import InvitePreviewSheet from "./InvitePreviewSheet";
import JoyRadar from "./JoyRadar";

interface MatchedEventCardProps {
  event: BlindBoxEvent;
}

interface SessionData {
  sessionId: string;
  checkedInCount: number;
  expectedAttendees: number;
  currentPhase: string;
}

export default function MatchedEventCard({ event }: MatchedEventCardProps) {
  const [, setLocation] = useLocation();
  const [showInvite, setShowInvite] = useState(false);
  const currencySymbol = getCurrencySymbol(event.city as "香港" | "深圳");

  // Check if event is in progress
  const isEventInProgress = () => {
    const now = new Date();
    const eventDate = new Date(event.dateTime);
    return now.getTime() >= eventDate.getTime();
  };

  const eventInProgress = isEventInProgress();

  // Fetch session and check-in data when event is in progress
  const { data: sessionData } = useQuery<SessionData | null>({
    queryKey: ["/api/events", event.id, "session"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${event.id}/session`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: eventInProgress,
    refetchInterval: eventInProgress ? 30000 : false, // Refresh every 30s when in progress
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${event.id}/session`);
      return res.json();
    },
    onSuccess: (data: { sessionId: string }) => {
      setLocation(`/icebreaker/${data.sessionId}`);
    },
  });

  const handleCheckin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessionData?.sessionId) {
      setLocation(`/icebreaker/${sessionData.sessionId}`);
    } else {
      createSessionMutation.mutate();
    }
  };

  const formatDate = (dateTime: Date | string) => {
    return formatDateInHongKong(dateTime, 'weekday-time');
  };

  const getCountdown = (dateTime: Date | string) => {
    const now = new Date();
    const eventDate = getHongKongDateForComparison(dateTime);
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

  const getParticipantInfo = () => {
    if (event.isGirlsNight) {
      return `${event.totalParticipants}人 Girls Night`;
    }
    if (event.maleCount && event.femaleCount) {
      return `${event.totalParticipants}人（${event.maleCount}男${event.femaleCount}女）`;
    }
    return `${event.totalParticipants}人`;
  };

  const handleNavigation = () => {
    if (event.restaurantLat && event.restaurantLng) {
      const restaurantName = encodeURIComponent(event.restaurantName || '目的地');
      
      // 深圳使用高德地图，香港使用Google Maps
      if (event.city === '深圳') {
        window.open(`https://uri.amap.com/navigation?to=${event.restaurantLng},${event.restaurantLat},${restaurantName}&mode=car&coordinate=gaode`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${event.restaurantLat},${event.restaurantLng}`, '_blank');
      }
    }
  };

  return (
    <Card 
      className="border shadow-sm hover-elevate active-elevate-2 cursor-pointer" 
      onClick={() => setLocation(`/blind-box-events/${event.id}`)}
      data-testid={`card-matched-${event.id}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* 标题和倒计时 */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold flex-1">{formatDate(event.dateTime)} · {event.eventType}</h3>
            {event.isGirlsNight && (
              <Badge className="text-xs bg-pink-500 hover:bg-pink-600">
                👭 Girls Night
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">{getCountdown(event.dateTime)}</span>
          </div>
        </div>

        {/* 人数与性别 + Joy Radar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{getParticipantInfo()}</span>
          </div>
          {event.currentParticipants != null && event.totalParticipants != null && (
            <JoyRadar 
              currentParticipants={event.currentParticipants} 
              maxParticipants={event.totalParticipants} 
            />
          )}
        </div>

        {/* 地点 */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{event.restaurantName}</span>
          </div>
          <div className="text-xs text-muted-foreground pl-6">
            {event.city}•{event.district}
          </div>
        </div>

        {/* 预算档 */}
        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span>{currencySymbol}{event.budgetTier}</span>
        </div>

        {/* 菜式标签 */}
        {event.cuisineTags && event.cuisineTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.cuisineTags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* 签到进度 - 仅在活动进行中时显示 */}
        {eventInProgress && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30 rounded-lg p-3 space-y-2"
            data-testid={`checkin-progress-${event.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <Sparkles className="h-4 w-4 text-purple-500" />
                </motion.div>
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                  {sessionData?.checkedInCount ?? 0}/{event.totalParticipants} 已签到
                </span>
              </div>
              {sessionData && sessionData.checkedInCount < (event.totalParticipants || 0) && (
                <span className="text-xs text-purple-600 dark:text-purple-400">
                  小伙伴们在等你！
                </span>
              )}
            </div>
            <Progress 
              value={((sessionData?.checkedInCount ?? 0) / (event.totalParticipants || 1)) * 100} 
              className="h-2 bg-purple-100 dark:bg-purple-900/50"
            />
          </motion.div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-2">
          {eventInProgress ? (
            <>
              <motion.div 
                className="flex-1"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Button 
                  size="sm" 
                  className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-500 hover:from-purple-700 hover:to-fuchsia-600"
                  onClick={handleCheckin}
                  disabled={createSessionMutation.isPending}
                  data-testid={`button-checkin-${event.id}`}
                >
                  {createSessionMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        className="h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      加载中
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      立即签到
                    </span>
                  )}
                </Button>
              </motion.div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation();
                }}
                data-testid={`button-navigation-${event.id}`}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button 
                size="sm" 
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setLocation(`/blind-box-events/${event.id}`);
                }}
                data-testid={`button-view-details-${event.id}`}
              >
                查看详情
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:from-amber-100 hover:to-orange-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInvite(true);
                }}
                data-testid={`button-view-invite-${event.id}`}
              >
                <Ticket className="h-4 w-4" />
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigation();
                }}
                data-testid={`button-navigation-${event.id}`}
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>

      <InvitePreviewSheet
        open={showInvite}
        onOpenChange={setShowInvite}
        event={event}
      />
    </Card>
  );
}
