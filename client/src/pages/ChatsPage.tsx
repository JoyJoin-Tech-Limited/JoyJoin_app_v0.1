import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar, MapPin, MessageSquare, Users, User, Lock, Clock } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import ParticipantAvatars from "@/components/ParticipantAvatars";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { archetypeConfig } from "@/lib/archetypes";
import { 
  getGenderDisplay, 
  formatAge, 
  getEducationDisplay
} from "@/lib/userFieldMappings";
import type { Event, DirectMessageThread, User as UserType } from "@shared/schema";

type EventWithParticipants = Event & { 
  attendanceStatus: string; 
  attendeeCount: number;
  participants: Array<{ id: string; displayName: string | null; vibes: string[] | null }>;
};

type DirectThreadWithUser = DirectMessageThread & {
  otherUser: UserType;
  lastMessage: {
    content: string;
    createdAt: Date;
  } | null;
};

export default function ChatsPage() {
  const [, setLocation] = useLocation();
  const markAsRead = useMarkNotificationsAsRead();
  const { toast } = useToast();
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  const { data: joinedEvents, isLoading: isLoadingEvents, refetch: refetchEvents } = useQuery<Array<EventWithParticipants>>({
    queryKey: ["/api/events/joined"],
  });

  const { data: directThreads, isLoading: isLoadingThreads, refetch: refetchThreads } = useQuery<Array<DirectThreadWithUser>>({
    queryKey: ["/api/direct-messages"],
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
      
      toast({
        title: "演示数据创建成功",
        description: "已创建3个演示聊天窗口",
      });
      
      await refetchEvents();
      await refetchThreads();
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

  const formatMessageTime = (date: Date | null) => {
    if (!date) return "";
    const messageDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    const month = messageDate.getMonth() + 1;
    const day = messageDate.getDate();
    return `${month}月${day}日`;
  };

  const isEventPast = (dateTime: Date | null) => {
    if (!dateTime) return false;
    return new Date(dateTime) < new Date();
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const chars = name.trim().split('');
    return chars.length > 0 ? chars[0].toUpperCase() : "?";
  };

  const isLoading = isLoadingEvents || isLoadingThreads;

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
  const hasDirectChats = directThreads && directThreads.length > 0;
  const groupCount = joinedEvents?.length || 0;
  const directCount = directThreads?.length || 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader title="聊天" />
      
      {!hasGroupChats && !hasDirectChats ? (
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
        <Tabs defaultValue="group" className="w-full">
          <div className="sticky top-14 z-30 bg-background border-b">
            <TabsList className="w-full justify-start rounded-none h-12 px-4 bg-transparent">
              <TabsTrigger 
                value="group" 
                className="flex items-center gap-2 data-[state=active]:bg-muted"
                data-testid="tab-group-chats"
              >
                <Users className="h-4 w-4" />
                <span>群聊</span>
                {groupCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                    {groupCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="direct" 
                className="flex items-center gap-2 data-[state=active]:bg-muted"
                data-testid="tab-direct-chats"
              >
                <User className="h-4 w-4" />
                <span>私聊</span>
                {directCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                    {directCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="group" className="m-0 mt-4">
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
          </TabsContent>

          <TabsContent value="direct" className="m-0 mt-4">
            {hasDirectChats ? (
              <div className="px-4 pb-4 space-y-3">
                {directThreads.map((thread) => {
                  const otherUser = thread.otherUser;
                  const lastMessage = thread.lastMessage;
                  const isExpanded = expandedThreadId === thread.id;
                  const archetypeData = otherUser.archetype && archetypeConfig[otherUser.archetype]
                    ? archetypeConfig[otherUser.archetype]
                    : null;
                  
                  return (
                    <Card 
                      key={thread.id} 
                      className="hover-elevate active-elevate-2 transition-all cursor-pointer overflow-hidden"
                      onClick={() => setLocation(`/direct-chat/${thread.id}`)}
                      data-testid={`card-direct-${thread.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Avatar - clickable to expand */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedThreadId(isExpanded ? null : thread.id);
                            }}
                            className="cursor-pointer"
                            data-testid={`avatar-expand-${thread.id}`}
                          >
                            {archetypeData ? (
                              <div className={`h-12 w-12 flex-shrink-0 rounded-full ${archetypeData.bgColor} flex items-center justify-center text-2xl`}>
                                {archetypeData.icon}
                              </div>
                            ) : (
                              <Avatar className="h-12 w-12 flex-shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                  {getInitials(otherUser.displayName)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className="font-semibold truncate">
                                {otherUser.displayName || "匿名用户"}
                              </h3>
                              {lastMessage && (
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  {formatMessageTime(lastMessage.createdAt)}
                                </span>
                              )}
                            </div>
                            
                            {otherUser.archetype && (
                              <Badge variant="secondary" className="text-[10px] h-5 mb-2">
                                {otherUser.archetype}
                              </Badge>
                            )}
                            
                            {lastMessage ? (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {lastMessage.content}
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">
                                暂无消息
                              </p>
                            )}
                            
                            {/* Expandable User Info */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="pt-3 mt-3 border-t space-y-2">
                                    {/* Archetype Description */}
                                    {archetypeData && (
                                      <div className="bg-muted/30 rounded-lg p-2.5">
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                          {archetypeData.description}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {/* Info Chips */}
                                    <div className="flex flex-wrap gap-1.5">
                                      {otherUser.gender && otherUser.age && (
                                        <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">
                                          {getGenderDisplay(otherUser.gender)} · {formatAge(otherUser.age)}
                                        </span>
                                      )}
                                      {otherUser.educationLevel && (
                                        <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">
                                          {getEducationDisplay(otherUser.educationLevel)}
                                        </span>
                                      )}
                                      {otherUser.industry && (
                                        <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">
                                          {otherUser.industry}
                                        </span>
                                      )}
                                    </div>
                                    
                                    {/* Languages */}
                                    {otherUser.languagesComfort && otherUser.languagesComfort.length > 0 && (
                                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <span>🗣</span>
                                        <span>{otherUser.languagesComfort.join(' · ')}</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          
                          <MessageSquare className="h-5 w-5 text-primary flex-shrink-0" />
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
                    <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">暂无私聊</h3>
                    <p className="text-sm text-muted-foreground">
                      在活动中与其他参与者建立连接后，可以开始私聊
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <BottomNav />
    </div>
  );
}
