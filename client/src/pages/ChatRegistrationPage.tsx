import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Sparkles, ArrowRight, Smile, Heart, Briefcase, MapPin, Coffee, Music, Gamepad2, Camera, Book, Dumbbell, Sun, Moon, Star } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";

// 时间氛围主题
type TimeTheme = "morning" | "afternoon" | "evening" | "night";

function getTimeTheme(): TimeTheme {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const timeThemeConfig: Record<TimeTheme, { gradient: string; icon: any; greeting: string }> = {
  morning: {
    gradient: "from-amber-50/50 via-orange-50/30 to-background",
    icon: Sun,
    greeting: "早安"
  },
  afternoon: {
    gradient: "from-sky-50/50 via-blue-50/30 to-background",
    icon: Sun,
    greeting: "午安"
  },
  evening: {
    gradient: "from-orange-100/40 via-pink-50/30 to-background",
    icon: Moon,
    greeting: "傍晚好"
  },
  night: {
    gradient: "from-indigo-100/40 via-purple-50/30 to-background",
    icon: Star,
    greeting: "晚安"
  }
};

// 小悦表情类型
type XiaoyueEmotion = "happy" | "thinking" | "excited" | "wink" | "neutral";

function detectEmotion(message: string): XiaoyueEmotion {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes("太棒了") || lowerMsg.includes("很高兴") || lowerMsg.includes("欢迎") || lowerMsg.includes("开心")) return "happy";
  if (lowerMsg.includes("嗯") || lowerMsg.includes("让我想想") || lowerMsg.includes("那么") || lowerMsg.includes("?") || lowerMsg.includes("？")) return "thinking";
  if (lowerMsg.includes("哇") || lowerMsg.includes("厉害") || lowerMsg.includes("有趣") || lowerMsg.includes("！")) return "excited";
  if (lowerMsg.includes("嘻") || lowerMsg.includes("哈哈") || lowerMsg.includes("~")) return "wink";
  return "neutral";
}

const emotionEmojis: Record<XiaoyueEmotion, string> = {
  happy: "😊",
  thinking: "🤔",
  excited: "🤩",
  wink: "😉",
  neutral: "🙂"
};

// 小悦头像组件
function XiaoyueAvatar({ emotion, size = "md" }: { emotion: XiaoyueEmotion; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  
  return (
    <motion.div 
      className={`${sizeClasses} rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20`}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3 }}
      key={emotion}
    >
      <span>{emotionEmojis[emotion]}</span>
    </motion.div>
  );
}

// 渐进式进度环组件
function ProgressRing({ progress, total, showStar }: { progress: number; total: number; showStar: boolean }) {
  const percentage = Math.min((progress / total) * 100, 100);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="w-12 h-12 transform -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-muted/30"
        />
        <motion.circle
          cx="24"
          cy="24"
          r={radius}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          className="text-primary"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {showStar ? (
            <motion.div
              key="star"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
          ) : (
            <motion.span 
              key="count"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xs font-medium text-primary"
            >
              {progress}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// 个性卡片实时预览组件
function ProfilePreviewCard({ info, isExpanded, onToggle }: { 
  info: CollectedInfo; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasInfo = Object.keys(info).some(k => info[k as keyof CollectedInfo] !== undefined);
  if (!hasInfo) return null;

  return (
    <motion.div 
      className="fixed bottom-24 right-4 z-50"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
    >
      <motion.button
        onClick={onToggle}
        className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-toggle-preview"
      >
        <User className="w-5 h-5 text-primary" />
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className="absolute bottom-14 right-0 w-56 bg-background border rounded-lg shadow-xl p-3 space-y-2"
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">个人档案预览</p>
            
            {info.displayName && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <span className="text-xs text-muted-foreground">昵称:</span>
                <span className="text-sm font-medium">{info.displayName}</span>
              </motion.div>
            )}
            
            {info.gender && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center gap-2"
              >
                <span className="text-xs text-muted-foreground">性别:</span>
                <span className="text-sm">{info.gender}</span>
              </motion.div>
            )}
            
            {info.birthYear && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2"
              >
                <span className="text-xs text-muted-foreground">年龄段:</span>
                <span className="text-sm">{info.birthYear}后</span>
              </motion.div>
            )}
            
            {info.currentCity && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-2"
              >
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm">{info.currentCity}</span>
              </motion.div>
            )}
            
            {info.interestsTop && info.interestsTop.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-1 mt-1"
              >
                {info.interestsTop.slice(0, 3).map((interest, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {interest}
                  </span>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 快捷回复配置
interface QuickReply {
  text: string;
  icon?: any;
}

interface QuickReplyConfig {
  keywords: string[];
  options: QuickReply[];
}

const quickReplyConfigs: QuickReplyConfig[] = [
  {
    keywords: ["称呼", "昵称", "名字", "怎么叫"],
    options: [] // 昵称需要用户输入，不提供快捷选项
  },
  {
    keywords: ["性别", "男生", "女生", "小哥哥", "小姐姐"],
    options: [
      { text: "女生", icon: Heart },
      { text: "男生", icon: Smile },
      { text: "保密", icon: Sparkles }
    ]
  },
  {
    keywords: ["年龄", "年代", "几几年", "多大", "岁", "后"],
    options: [
      { text: "00后" },
      { text: "95后" },
      { text: "90后" },
      { text: "85后" }
    ]
  },
  {
    keywords: ["城市", "哪里", "在哪", "深圳", "香港", "广州"],
    options: [
      { text: "深圳", icon: MapPin },
      { text: "香港", icon: MapPin },
      { text: "广州", icon: MapPin },
      { text: "其他城市", icon: MapPin }
    ]
  },
  {
    keywords: ["兴趣", "爱好", "喜欢", "平时", "活动"],
    options: [
      { text: "美食探店", icon: Coffee },
      { text: "户外运动", icon: Dumbbell },
      { text: "看书电影", icon: Book },
      { text: "桌游剧本杀", icon: Gamepad2 },
      { text: "摄影", icon: Camera },
      { text: "音乐", icon: Music }
    ]
  },
  {
    keywords: ["工作", "职业", "做什么", "行业", "从事"],
    options: [
      { text: "互联网/科技", icon: Briefcase },
      { text: "金融", icon: Briefcase },
      { text: "学生", icon: Book },
      { text: "自由职业", icon: Sparkles },
      { text: "其他行业", icon: Briefcase }
    ]
  },
  {
    keywords: ["想要", "期待", "目的", "意图", "来这里", "JoyJoin"],
    options: [
      { text: "交朋友", icon: Heart },
      { text: "拓展人脉", icon: Briefcase },
      { text: "吃喝玩乐", icon: Coffee },
      { text: "随缘都可以", icon: Sparkles }
    ]
  },
  {
    keywords: ["宠物", "毛孩子", "猫", "狗", "养"],
    options: [
      { text: "有猫咪🐱" },
      { text: "有狗狗🐕" },
      { text: "都有！" },
      { text: "没有养" }
    ]
  },
  {
    keywords: ["感情", "单身", "恋爱", "对象", "另一半"],
    options: [
      { text: "单身" },
      { text: "恋爱中" },
      { text: "已婚" },
      { text: "保密" }
    ]
  },
  {
    keywords: ["确认", "对吗", "没问题", "有要改"],
    options: [
      { text: "没问题！" },
      { text: "对的~" },
      { text: "需要改一下" }
    ]
  }
];

// 检测最后一条消息是否匹配快捷回复
function detectQuickReplies(lastMessage: string): QuickReply[] {
  const lowerMsg = lastMessage.toLowerCase();
  for (const config of quickReplyConfigs) {
    if (config.keywords.some(kw => lowerMsg.includes(kw))) {
      return config.options;
    }
  }
  return [];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTypingAnimation?: boolean; // 是否正在逐字显示
}

// 逐字打字效果Hook
function useTypingEffect(text: string, isActive: boolean, speed: number = 30) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    setDisplayedText("");
    setIsComplete(false);
    let index = 0;

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, isActive, speed]);

  return { displayedText, isComplete };
}

// 单条消息组件（支持打字效果和小悦表情）
function MessageBubble({ 
  message, 
  isLatest,
  onTypingComplete 
}: { 
  message: ChatMessage; 
  isLatest: boolean;
  onTypingComplete?: () => void;
}) {
  // 短消息（≤20字）跳过打字动画
  const isShortMessage = message.content.length <= 20;
  const shouldAnimate = message.role === "assistant" && isLatest && message.isTypingAnimation && !isShortMessage;
  const { displayedText, isComplete } = useTypingEffect(
    message.content, 
    shouldAnimate || false,
    12 // 每个字12ms（加快一倍）
  );

  useEffect(() => {
    if (isComplete && shouldAnimate && onTypingComplete) {
      onTypingComplete();
    }
  }, [isComplete, shouldAnimate, onTypingComplete]);

  const content = shouldAnimate ? displayedText : message.content;
  const emotion = message.role === "assistant" ? detectEmotion(message.content) : "neutral";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
    >
      {message.role === "assistant" ? (
        <XiaoyueAvatar emotion={emotion} />
      ) : (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4" />
        </div>
      )}
      <Card className={`max-w-[80%] p-3 ${
        message.role === "user" 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      }`}>
        <p className="text-sm whitespace-pre-wrap">
          {content}
          {shouldAnimate && !isComplete && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </p>
      </Card>
    </motion.div>
  );
}

interface CollectedInfo {
  displayName?: string;
  gender?: string;
  birthYear?: number;
  currentCity?: string;
  occupationDescription?: string;
  interestsTop?: string[];
  primaryInterests?: string[];
  venueStylePreference?: string;
  topicAvoidances?: string[];
  socialStyle?: string;
}

export default function ChatRegistrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 新功能状态
  const [showProgressStar, setShowProgressStar] = useState(false);
  const [prevInfoCount, setPrevInfoCount] = useState(0);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const timeTheme = useMemo(() => getTimeTheme(), []);
  const themeConfig = timeThemeConfig[timeTheme];
  const starTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 信息收集进度变化时显示星星动画
  const infoCount = Object.keys(collectedInfo).filter(k => 
    collectedInfo[k as keyof CollectedInfo] !== undefined
  ).length;
  
  useEffect(() => {
    if (infoCount > prevInfoCount) {
      // 清除之前的timeout
      if (starTimeoutRef.current) {
        clearTimeout(starTimeoutRef.current);
      }
      setShowProgressStar(true);
      setPrevInfoCount(infoCount);
      starTimeoutRef.current = setTimeout(() => {
        setShowProgressStar(false);
      }, 1500);
    }
  }, [infoCount, prevInfoCount]);

  // 清理timeout在组件卸载时
  useEffect(() => {
    return () => {
      if (starTimeoutRef.current) {
        clearTimeout(starTimeoutRef.current);
      }
    };
  }, []);

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/registration/chat/start");
      return res.json();
    },
    onSuccess: (data) => {
      setMessages([{
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        isTypingAnimation: true
      }]);
      setConversationHistory(data.conversationHistory);
    },
    onError: () => {
      toast({
        title: "连接失败",
        description: "无法连接小悦，请稍后再试",
        variant: "destructive"
      });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/registration/chat/message", {
        message,
        conversationHistory
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
        isTypingAnimation: true
      }]);
      setConversationHistory(data.conversationHistory);
      if (data.collectedInfo) {
        setCollectedInfo(prev => ({ ...prev, ...data.collectedInfo }));
      }
      if (data.isComplete) {
        setIsComplete(true);
      }
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast({
        title: "发送失败",
        description: "小悦暂时走神了，请重试",
        variant: "destructive"
      });
    }
  });

  const submitRegistrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/registration/chat/complete", {
        conversationHistory,
        collectedInfo
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "注册成功",
        description: "欢迎加入 JoyJoin！"
      });
      setLocation("/interests-topics");
    },
    onError: () => {
      toast({
        title: "提交失败",
        description: "请稍后再试",
        variant: "destructive"
      });
    }
  });

  useEffect(() => {
    startChatMutation.mutate();
  }, []);

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, {
      role: "user",
      content: userMessage,
      timestamp: new Date()
    }]);
    setInputValue("");
    setIsTyping(true);
    sendMessageMutation.mutate(userMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleComplete = () => {
    submitRegistrationMutation.mutate();
  };

  // 检测快捷回复选项
  const quickReplies = useMemo(() => {
    if (isTyping || isComplete || messages.length === 0) return [];
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMessage) return [];
    return detectQuickReplies(lastAssistantMessage.content);
  }, [messages, isTyping, isComplete]);

  // 快捷回复点击处理
  const handleQuickReply = (text: string) => {
    if (isTyping) return;
    setMessages(prev => [...prev, {
      role: "user",
      content: text,
      timestamp: new Date()
    }]);
    setIsTyping(true);
    sendMessageMutation.mutate(text);
  };

  const TimeIcon = themeConfig.icon;

  return (
    <div className={`min-h-screen bg-gradient-to-b ${themeConfig.gradient} flex flex-col`}>
      <MobileHeader title="和小悦聊聊" action={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TimeIcon className="w-3.5 h-3.5" />
            <span>{themeConfig.greeting}</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/registration/form")}
            data-testid="button-switch-to-form"
          >
            切换到表单
          </Button>
        </div>
      } />

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, index) => (
            <MessageBubble
              key={index}
              message={msg}
              isLatest={index === messages.length - 1}
              onTypingComplete={() => {
                setMessages(prev => prev.map((m, i) => 
                  i === index ? { ...m, isTypingAnimation: false } : m
                ));
              }}
            />
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <XiaoyueAvatar emotion="thinking" />
            <Card className="bg-muted p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </Card>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 进度环和个性卡片预览 */}
      <ProfilePreviewCard 
        info={collectedInfo} 
        isExpanded={profileExpanded}
        onToggle={() => setProfileExpanded(!profileExpanded)}
      />

      {infoCount > 0 && (
        <div className="px-4 py-2 bg-background/80 backdrop-blur-sm border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ProgressRing progress={infoCount} total={8} showStar={showProgressStar} />
              <div className="flex flex-col">
                <span className="text-xs font-medium">档案完善中</span>
                <span className="text-xs text-muted-foreground">
                  {infoCount}/8 项信息
                </span>
              </div>
            </div>
            {showProgressStar && (
              <motion.div
                initial={{ opacity: 0, scale: 0, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0 }}
                className="flex items-center gap-1 text-primary"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">+1</span>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* 快捷回复气泡 */}
      <AnimatePresence>
        {quickReplies.length > 0 && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 border-t bg-muted/30"
          >
            <p className="text-xs text-muted-foreground mb-2">快捷回复：</p>
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply, index) => {
                const IconComponent = reply.icon;
                return (
                  <motion.button
                    key={reply.text}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleQuickReply(reply.text)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-background border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm"
                    data-testid={`quick-reply-${reply.text}`}
                  >
                    {IconComponent && <IconComponent className="w-3.5 h-3.5 text-primary" />}
                    <span>{reply.text}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isComplete ? (
        <div className="p-4 border-t bg-background">
          <Button 
            className="w-full" 
            onClick={handleComplete}
            disabled={submitRegistrationMutation.isPending}
            data-testid="button-complete-registration"
          >
            {submitRegistrationMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            继续下一步
          </Button>
        </div>
      ) : (
        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              disabled={isTyping || startChatMutation.isPending}
              className="flex-1"
              data-testid="input-chat-message"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              data-testid="button-send-message"
            >
              {isTyping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
