import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { motion, AnimatePresence } from "framer-motion";
import { archetypeConfig } from "@/lib/archetypes";
import { archetypeAvatars, archetypeBgColors } from "@/lib/archetypeAvatars";
import { 
  getGenderDisplay, 
  formatAge, 
  getEducationDisplay
} from "@/lib/userFieldMappings";
import type { DirectMessageThread, User as UserType } from "@shared/schema";

type DirectThreadWithUser = DirectMessageThread & {
  otherUser: UserType;
  lastMessage: {
    content: string;
    createdAt: Date;
  } | null;
  sourceEvent?: {
    title: string;
    eventType: string;
    district: string;
    dateTime: string | Date;
  };
};

export default function ChatsPage() {
  const [, setLocation] = useLocation();
  const markAsRead = useMarkNotificationsAsRead();
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);

  const { data: directThreads, isLoading: isLoadingThreads } = useQuery<Array<DirectThreadWithUser>>({
    queryKey: ["/api/direct-messages"],
  });

  // Mark chat notifications as read when the page mounts
  useEffect(() => {
    markAsRead.mutate('chat');
  }, []);

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

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const chars = name.trim().split('');
    return chars.length > 0 ? chars[0].toUpperCase() : "?";
  };

  if (isLoadingThreads) {
    return (
      <div className="min-h-screen bg-background pb-16 flex flex-col">
        <MobileHeader title="圈子" />
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

  const hasDirectChats = directThreads && directThreads.length > 0;

  return (
    <div className="min-h-screen bg-background pb-16">
      <MobileHeader title="圈子" />

      {!hasDirectChats ? (
        <div className="px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="font-semibold mb-2">暂无连接</h3>
          <p className="text-sm text-muted-foreground max-w-[260px]">
            参加活动后与其他参与者建立连接，就可以在这里找到他们
          </p>
        </div>
      ) : (
        <motion.div
          className="px-4 pb-4 pt-4 space-y-3"
        >
          {directThreads.map((thread, index) => {
            const otherUser = thread.otherUser;
            const lastMessage = thread.lastMessage;
            const sourceEvent = thread.sourceEvent;
            const isExpanded = expandedThreadId === thread.id;
            const archetypeData =
              otherUser.archetype && archetypeConfig[otherUser.archetype]
                ? archetypeConfig[otherUser.archetype]
                : null;

            return (
              <motion.a
                key={thread.id}
                href={`/direct-chat/${thread.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                className="block bg-white rounded-2xl shadow-sm border border-muted overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                onClick={(e) => { e.preventDefault(); setLocation(`/direct-chat/${thread.id}`); }}
                data-testid={`card-direct-${thread.id}`}
              >
                <div className="p-4">
                  {/* Source Event Badge */}
                  {sourceEvent && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                        <span aria-hidden="true">✨</span> {sourceEvent.title}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    {/* Avatar — tap to expand user info */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedThreadId(isExpanded ? null : thread.id);
                      }}
                      className="cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
                      aria-label={`查看 ${otherUser.displayName || '用户'} 的资料`}
                      aria-expanded={isExpanded}
                      data-testid={`avatar-expand-${thread.id}`}
                    >
                      {otherUser.archetype && archetypeAvatars[otherUser.archetype] ? (
                        <div
                          className={`h-16 w-16 rounded-full ${
                            archetypeBgColors[otherUser.archetype] || 'bg-muted'
                          } flex items-center justify-center overflow-hidden shadow-lg ring-2 ring-offset-2 ring-primary/30`}
                        >
                          <img
                            src={archetypeAvatars[otherUser.archetype]}
                            alt={otherUser.archetype}
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                      ) : (
                        <Avatar className="h-16 w-16 flex-shrink-0 shadow-lg ring-2 ring-offset-2 ring-primary/30">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(otherUser.displayName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>

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
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.a>
            );
          })}
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}

