import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Send, Sparkles, ArrowDown, CheckCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User, DirectMessage } from "@shared/schema";

type DirectThreadWithDetails = {
  id: string;
  user1Id: string;
  user2Id: string;
  eventId: string;
  connectionPointTypes: string[] | null;
  createdAt: Date;
  otherUser: {
    id: string;
    displayName: string | null;
    archetype: string | null;
  };
  event: {
    title: string;
    dateTime: Date;
  };
};

// Archetype configuration with full descriptions
const archetypeConfig: Record<string, { 
  icon: string; 
  color: string;
  bgColor: string;
  description: string;
}> = {
  "火花塞": { 
    icon: "🙌", 
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/20",
    description: "点燃话题的开场高手，能打破沉默，带动气氛"
  },
  "探索者": { 
    icon: "🧭", 
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/20",
    description: "好奇心驱动，喜欢发现新事物和深入讨论"
  },
  "故事家": { 
    icon: "📖", 
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/20",
    description: "善于分享经历，用故事连接人心"
  },
  "挑战者": { 
    icon: "⚡", 
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/20",
    description: "思维敏锐，喜欢辩论和挑战传统观点"
  },
  "连接者": { 
    icon: "🤝", 
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/20",
    description: "天生的社交桥梁，帮助他人建立联系"
  },
  "协调者": { 
    icon: "🎯", 
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
    description: "平衡各方意见，确保每个人都被听到"
  },
  "氛围组": { 
    icon: "🎭", 
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-100 dark:bg-pink-900/20",
    description: "活跃气氛，用幽默和活力感染他人"
  },
  "肯定者": { 
    icon: "🌟", 
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
    description: "给予鼓励和支持，让他人感到被认可"
  },
};

// Helper function to group messages by date
function groupMessagesByDate(messages: Array<DirectMessage & { user: User }>) {
  const groups: Array<{ date: string; label: string; messages: Array<DirectMessage & { user: User }> }> = [];
  
  messages.forEach(msg => {
    const msgDate = new Date(msg.createdAt!);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let label: string;
    const dateKey = msgDate.toDateString();
    
    if (msgDate.toDateString() === today.toDateString()) {
      label = "今天";
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
      label = "昨天";
    } else {
      label = msgDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
    }
    
    const existingGroup = groups.find(g => g.date === dateKey);
    if (existingGroup) {
      existingGroup.messages.push(msg);
    } else {
      groups.push({ date: dateKey, label, messages: [msg] });
    }
  });
  
  return groups;
}

export default function DirectChatPage() {
  const { threadId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [message, setMessage] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Fetch all threads and find the current one
  const { data: allThreads } = useQuery<Array<DirectThreadWithDetails>>({
    queryKey: ["/api/direct-messages"],
  });

  const thread = allThreads?.find(t => t.id === threadId);
  const threadLoading = !allThreads;

  // Fetch messages for this thread
  const { data: messages, isLoading: messagesLoading } = useQuery<Array<DirectMessage & { user: User }>>({
    queryKey: ["/api/direct-messages", threadId],
    select: (data: any) => {
      // The API returns messages directly, map sender to user for compatibility
      return data.map((msg: any) => ({ ...msg, user: msg.sender }));
    },
    refetchInterval: 3000,
    enabled: !!threadId,
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      return await apiRequest("POST", `/api/direct-messages/${threadId}`, { message: msg });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages", threadId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/direct-messages"] });
      setMessage("");
    },
    onError: (error) => {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom with animation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle scroll button visibility
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Simulate typing indicator
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (message.length > 0) {
      setIsTyping(true);
      timeout = setTimeout(() => setIsTyping(false), 1000);
    } else {
      setIsTyping(false);
    }
    return () => clearTimeout(timeout);
  }, [message]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getConnectionPointLabel = (type: string) => {
    const labels: Record<string, string> = {
      interests: "共同兴趣",
      topics_happy: "话题契合",
      archetype: "性格互补",
      debate_comfort: "交流风格",
      life_stage: "人生阶段",
      languages: "语言相通",
      communication_style: "沟通方式",
      gender: "性别相同",
      family_status: "家庭状况",
      overseas_region: "海外背景",
      hometown: "老乡",
    };
    return labels[type] || type;
  };

  if (threadLoading || !thread) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  const otherUserArchetype = thread.otherUser.archetype && archetypeConfig[thread.otherUser.archetype]
    ? archetypeConfig[thread.otherUser.archetype]
    : { icon: "✨", color: "text-muted-foreground", bgColor: "bg-muted", description: "独特个性" };

  const messageGroups = groupMessagesByDate(messages || []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/chats")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <TooltipProvider>
            <div className="flex items-center gap-3 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all">
                    <AvatarFallback className={`${otherUserArchetype.bgColor} text-2xl`}>
                      {otherUserArchetype.icon}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{otherUserArchetype.icon}</span>
                      <div>
                        <p className="font-semibold">{thread.otherUser.archetype}</p>
                        <p className="text-xs text-muted-foreground">
                          {thread.otherUser.displayName}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm">{otherUserArchetype.description}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold truncate">
                  {thread.otherUser.displayName || "用户"}
                </h1>
                {thread.otherUser.archetype && (
                  <Badge 
                    variant="secondary" 
                    className={`text-[10px] h-5 ${otherUserArchetype.color} animate-pulse-glow`}
                  >
                    {thread.otherUser.archetype}
                  </Badge>
                )}
              </div>
            </div>
          </TooltipProvider>
        </div>

        {/* Connection Points Banner */}
        {thread.connectionPointTypes && thread.connectionPointTypes.length > 0 && (
          <div className="px-4 pb-3">
            <Card className="bg-primary/5 border-primary/20 hover-elevate">
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-primary mb-1">
                      你们的契合点
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {thread.connectionPointTypes.map((type, index) => (
                        <Badge 
                          key={index}
                          variant="secondary" 
                          className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20"
                        >
                          {getConnectionPointLabel(type)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Event Context */}
        {thread.event && (
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground">
              来自活动：{thread.event.title}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-6 relative"
      >
        {messagesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">加载消息中...</p>
            </div>
          </div>
        ) : messages && messages.length > 0 ? (
          <TooltipProvider>
            {messageGroups.map((group) => (
              <div key={group.date} className="space-y-4">
                {/* Date divider */}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground font-medium px-3 py-1 bg-muted rounded-full">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Messages */}
                {group.messages.map((msg, idx) => {
                  const isOwnMessage = msg.senderId === currentUser?.id;
                  const userArchetype = msg.user.archetype && archetypeConfig[msg.user.archetype]
                    ? archetypeConfig[msg.user.archetype]
                    : { icon: "✨", color: "text-muted-foreground", bgColor: "bg-muted", description: "独特个性" };

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                        isOwnMessage ? "flex-row-reverse" : ""
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                      data-testid={`message-${msg.id}`}
                    >
                      {/* Avatar (only for other user) */}
                      {!isOwnMessage && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Avatar className="h-10 w-10 flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all">
                              <AvatarFallback className={`${userArchetype.bgColor} text-2xl`}>
                                {userArchetype.icon}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{userArchetype.icon}</span>
                                <div>
                                  <p className="font-semibold">{msg.user.archetype}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {msg.user.displayName || "用户"}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm">{userArchetype.description}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Message bubble */}
                      <div className={`flex-1 min-w-0 max-w-[75%] ${isOwnMessage ? "flex flex-col items-end" : ""}`}>
                        {/* Message content */}
                        <div 
                          className={`
                            group relative px-4 py-2.5 rounded-[18px] shadow-sm
                            transition-all duration-200 hover:shadow-md hover:scale-[1.02]
                            ${isOwnMessage 
                              ? "bg-primary text-primary-foreground rounded-br-[4px]" 
                              : "bg-muted text-foreground rounded-bl-[4px]"
                            }
                          `}
                        >
                          {isOwnMessage && (
                            <div className="text-xs opacity-90 mb-1">我</div>
                          )}
                          <p className="text-sm break-words leading-relaxed">{msg.message}</p>
                          
                          {/* Time */}
                          <div className={`text-[10px] mt-1 flex items-center gap-1 ${
                            isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}>
                            <span>
                              {msg.createdAt && new Date(msg.createdAt).toLocaleTimeString('zh-CN', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                            {isOwnMessage && (
                              <CheckCheck className="h-3 w-3" />
                            )}
                          </div>
                        </div>

                        {/* Message status (only for own messages) */}
                        {isOwnMessage && (
                          <div className="text-xs text-muted-foreground px-1 mt-0.5">
                            已送达
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="h-10 w-10" />
                <div className="bg-muted px-4 py-3 rounded-[18px] rounded-bl-[4px]">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </TooltipProvider>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              还没有消息，开始聊天吧！
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-20 right-6 z-10 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-4"
          onClick={scrollToBottom}
          data-testid="button-scroll-to-bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}

      {/* Message Input */}
      <div className="sticky bottom-0 bg-background border-t p-4">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            className="flex-1"
            disabled={sendMessageMutation.isPending}
            data-testid="input-message"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            size="icon"
            data-testid="button-send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 currentColor;
          }
          50% {
            box-shadow: 0 0 8px 2px currentColor;
          }
        }
        
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
