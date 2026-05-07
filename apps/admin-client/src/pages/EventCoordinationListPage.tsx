import MobileHeader from "@/components/navigation/MobileHeader";
import BottomNav from "@/components/navigation/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, MessageSquare, Users, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useMarkNotificationsAsRead } from "@/hooks/notifications/useNotificationCounts";
import ParticipantAvatars from "@/components/discover/ParticipantAvatars";
import type { Event } from "@shared/schema";

type EventWithParticipants = Event & {
  attendanceStatus: string;
  attendeeCount: number;
  participants: Array<{ id: string; displayName: string | null; vibes: string[] | null }>;
};

/**
 * 活动连接 — Event coordination list.
 *
 * In-app private/direct messaging has been removed. This page shows event
 * coordination threads only. Connections are made via post-event mutual selection
 * with WeChat contact reveal (connection-first model).
 */
export default function EventCoordinationListPage() {
  const [, setLocation] = useLocation();
  const markAsRead = useMarkNotificationsAsRead();

  const { data: joinedEvents, isLoading: isLoadingEvents } = useQuery<Array<EventWithParticipants>>({
    queryKey: ["/api/events/joined"],
  });

  useEffect(() => {
    markAsRead.mutate('chat');
  }, []);

  const isChatUnlocked = (eventDateTime: Date | null) => {
    if (!eventDateTime) return false;
    const now = new Date();
    const eventDate = new Date(eventDateTime);
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilEvent <= 24 || now > eventDate;
  };

  const isEventPast = (eventDateTime: Date | null) => {
    if (!eventDateTime) return false;
    return new Date() > new Date(eventDateTime);
  };

  const getUnlockCountdown = (eventDateTime: Date | null) => {
    if (!eventDateTime) return "";
    const now = new Date();
    const eventDate = new Date(eventDateTime);
    const unlockTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    if (now >= unlockTime) return "";
    const diff = unlockTime.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}天${hours}小时后`;
    if (hours > 0) return `${hours}小时${mins}分钟后`;
    return `${mins}分钟后`;
  };

  const formatDate = (dateTime: Date | null | string) => {
    if (!dateTime) return "";
    const d = new Date(dateTime);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (isLoadingEvents) {
    return (
      <div className="min-h-[100dvh] bg-background pb-16 flex flex-col">
        <MobileHeader title="活动连接" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const hasGroupChats = joinedEvents && joinedEvents.length > 0;

  return (
    <div className="min-h-[100dvh] bg-background pb-16">
      <MobileHeader title="活动连接" />

      {!hasGroupChats ? (
        <div className="px-4 py-4">
          <Card className="border shadow-sm">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">暂无活动连接</h3>
              <p className="text-sm text-muted-foreground">
                参加活动后，连接将在活动开始前24小时开放
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="px-4 pb-4 pt-4 space-y-3">
          {joinedEvents.map((event) => {
            const isPast = isEventPast(event.dateTime);
            const chatUnlocked = isChatUnlocked(event.dateTime);
            const countdown = getUnlockCountdown(event.dateTime);
            const isLocked = !chatUnlocked && !isPast;

            return (
              <Card
                key={event.id}
                className={`hover-elevate active-elevate-2 transition-all cursor-pointer overflow-hidden ${
                  isLocked ? 'bg-muted/30 border-muted' : ''
                }`}
                onClick={() => setLocation(`/chats/${event.id}`)}
                data-testid={`card-event-${event.id}`}
              >
                {isLocked ? (
                  <div className="bg-muted text-muted-foreground px-4 py-2.5 flex items-center gap-2">
                    <Lock className="h-4 w-4 flex-shrink-0" />
                    <span className="text-base font-bold">连接 {countdown} 开放</span>
                  </div>
                ) : (
                  <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="font-semibold text-sm">连接已开放</span>
                    {isPast && (
                      <Badge variant="secondary" className="ml-auto text-[10px] h-5 bg-primary-foreground/20 border-0">
                        已结束
                      </Badge>
                    )}
                  </div>
                )}

                <CardContent className="p-4">
                  <div className="space-y-3">
                    <h3 className={`font-semibold ${isLocked ? 'text-[#8E8E93]' : ''}`}>
                      {event.title}
                    </h3>
                    <div className={`space-y-2 text-xs ${isLocked ? 'text-[#8E8E93]' : 'text-muted-foreground'}`}>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(event.dateTime)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{event.location}</span>
                      </div>
                      {!isLocked && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">参与者</span>
                          <ParticipantAvatars
                            participants={event.participants || []}
                            maxDisplay={8}
                            size="sm"
                          />
                          {event.attendeeCount > 8 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              共{event.attendeeCount}人
                            </span>
                          )}
                        </div>
                      )}
                      {isLocked && (
                        <div className="flex items-center gap-2 pt-1">
                          <Users className="h-3.5 w-3.5 opacity-50" />
                          <span className="text-xs opacity-50">开放后可见参与者</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
