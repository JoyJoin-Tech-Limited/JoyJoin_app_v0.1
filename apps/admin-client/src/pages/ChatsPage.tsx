import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, MessageSquare, Users, Lock, Clock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import ParticipantAvatars from "@/components/ParticipantAvatars";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import type { Event } from "@shared/schema";

type EventWithParticipants = Event & { 
  attendanceStatus: string; 
  attendeeCount: number;
  participants: Array<{ id: string; displayName: string | null; vibes: string[] | null }>;
};

export default function ChatsPage() {
  const [, setLocation] = useLocation();
  const markAsRead = useMarkNotificationsAsRead();
  const { toast } = useToast();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  const { data: joinedEvents, isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery<Array<EventWithParticipants>>({
    queryKey: ["/api/events/joined"],
  });

  const createNotificationMutation = useMutation({
    mutationFn: async (data: {
      category: string;
      type: string;
      title: string;
      message: string;
      relatedResourceId?: string;
    }) => {
      return await apiRequest("POST", "/api/notifications", data);
    },
  });

  const createDemoChats = async () => {
    try {
      setIsCreatingDemo(true);
      const response: any = await apiRequest("POST", "/api/chats/seed-demo", {});
      
      await refetchEvents();
    } catch (error) {
      console.error("Error creating demo chats:", error);
      toast({
        title: "创建失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const isChatUnlocked = (eventDateTime: Date | null) => {
    if (!eventDateTime) return false;
    const now = new Date();
    const eventDate = new Date(eventDateTime);
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilEvent <= 24 || now > eventDate;
  };

  const getUnlockCountdown = (eventDateTime: Date | null) => {
    if (!eventDateTime) return "";
    const now = new Date();
    const eventDate = new Date(eventDateTime);
    const unlockTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
    
    if (now >= unlockTime) return "";
    
    const msUntilUnlock = unlockTime.getTime() - now.getTime();
    const days = Math.floor(msUntilUnlock / (1000 * 60 * 60 * 24));
    const hours = Math.floor((msUntilUnlock % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((msUntilUnlock % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}天${hours}小时后开放`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟后开放`;
    } else {
      return `${minutes}分钟后开放`;
    }
  };

  useEffect(() => {
    markAsRead.mutate('chat');
  }, []);

  useEffect(() => {
    if (!joinedEvents || joinedEvents.length === 0) return;

    const notifiedChats = JSON.parse(localStorage.getItem('chat_unlock_notified') || '[]');
    
    joinedEvents.forEach((event) => {
      const isUnlocked = isChatUnlocked(event.dateTime);
      const alreadyNotified = notifiedChats.includes(event.id);
      
      if (isUnlocked && !alreadyNotified) {
        createNotificationMutation.mutate({
          category: 'chat',
          type: 'chat_unlocked',
          title: '群聊已开放',
          message: `「${event.title}」的群聊已开放，快来认识新朋友吧！`,
          relatedResourceId: event.id,
        });
        
        const updated = [...notifiedChats, event.id];
        localStorage.setItem('chat_unlock_notified', JSON.stringify(updated));
      }
    });
  }, [joinedEvents]);

  const formatDate = (dateTime: Date | null) => {
    if (!dateTime) return "";
    const date = new Date(dateTime);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}月${day}日 ${hours}:${minutes}`;
  };

  const isEventPast = (dateTime: Date | null) => {
    if (!dateTime) return false;
    return new Date(dateTime) < new Date();
  };

  const isLoading = isLoadingEvents;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-16">
        <MobileHeader title="聊天" />
        <div className="flex items-center justify-center py-12">
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
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader title="聊天" />
      
      {!hasGroupChats ? (
        <div className="px-4 py-4">
          <Card className="border shadow-sm">
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">暂无聊天</h3>
              <p className="text-sm text-muted-foreground mb-4">
                参加活动并与其他参与者匹配后，就可以在这里聊天了
              </p>
              <Button 
                onClick={createDemoChats}
                disabled={isCreatingDemo}
                variant="outline"
                size="sm"
                data-testid="button-create-demo"
              >
                {isCreatingDemo ? "创建中..." : "创建演示聊天（测试用）"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="w-full">
          <div className="mt-4">
            {hasGroupChats ? (
              <div className="px-4 pb-4 space-y-3">
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
                      {/* 状态栏：锁定状态（灰色）或解锁状态（紫色） */}
                      {isLocked ? (
                        <div className="bg-muted text-muted-foreground px-4 py-2.5 flex items-center gap-2">
                          <Lock className="h-4 w-4 flex-shrink-0" />
                          <span className="text-base font-bold">
                            聊天 {countdown} 开放
                          </span>
                        </div>
                      ) : (
                        <div className="bg-primary text-primary-foreground px-4 py-2 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />
                          <span className="font-semibold text-sm">聊天已开放</span>
                          {isPast && (
                            <Badge variant="secondary" className="ml-auto text-[10px] h-5 bg-primary-foreground/20 border-0">
                              已结束
                            </Badge>
                          )}
                        </div>
                      )}

                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h3 className={`font-semibold ${isLocked ? 'text-[#8E8E93]' : ''}`}>
                                {event.title}
                              </h3>
                            </div>
                          </div>
                          
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
            ) : (
              <div className="px-4 py-8">
                <Card className="border shadow-sm">
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">暂无群聊</h3>
                    <p className="text-sm text-muted-foreground">
                      参加活动后，群聊将在活动开始前24小时开放
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
