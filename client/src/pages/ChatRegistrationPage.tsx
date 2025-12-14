import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Sparkles, ArrowRight, Smile, Heart, Briefcase, MapPin, Coffee, Music, Gamepad2, Camera, Book, Dumbbell, Sun, Moon, Star, Edit2, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import MobileHeader from "@/components/MobileHeader";
import EvolvingAvatar, { calculateClarityLevel } from "@/components/EvolvingAvatar";

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
  multiSelect?: boolean;
  priority?: number;
}

const quickReplyConfigs: QuickReplyConfig[] = [
  {
    keywords: ["称呼", "昵称", "名字", "怎么叫"],
    options: [],
    priority: 95 // 昵称需要用户输入，不提供快捷选项
  },
  {
    keywords: ["想要", "期待", "目的", "意图", "来这里", "JoyJoin", "拓展人脉", "交朋友", "想来"],
    options: [
      { text: "交朋友", icon: Heart },
      { text: "拓展人脉", icon: Briefcase },
      { text: "深度讨论", icon: Book },
      { text: "吃喝玩乐", icon: Coffee },
      { text: "浪漫邂逅", icon: Heart },
      { text: "随缘都可以", icon: Sparkles }
    ],
    multiSelect: true,
    priority: 92  // 社交意图最高优先级
  },
  {
    keywords: ["经常去", "到处探索", "深圳玩", "香港工作", "两边跑", "常跑", "常去"],
    options: [
      { text: "是的，经常去", icon: MapPin },
      { text: "偶尔去", icon: MapPin },
      { text: "很少去", icon: MapPin }
    ],
    priority: 91  // 城市follow-up高优先级
  },
  {
    keywords: ["菜系", "日料", "粤菜", "火锅", "西餐", "川菜", "湘菜", "东南亚", "韩餐", "偏好", "口味"],
    options: [
      { text: "日料", icon: Coffee },
      { text: "粤菜/港式", icon: Coffee },
      { text: "火锅/川湘菜", icon: Coffee },
      { text: "西餐", icon: Coffee },
      { text: "东南亚菜", icon: Coffee },
      { text: "韩餐", icon: Coffee },
      { text: "各种都爱", icon: Sparkles }
    ],
    multiSelect: true,
    priority: 89  // 比通用兴趣高，确保问菜系时显示菜系选项
  },
  {
    keywords: ["兴趣", "爱好", "喜欢", "平时", "活动"],
    options: [
      { text: "美食探店", icon: Coffee },
      { text: "说走就走", icon: MapPin },
      { text: "City Walk", icon: MapPin },
      { text: "喝酒小酌", icon: Coffee },
      { text: "音乐Live", icon: Music },
      { text: "拍拍拍", icon: Camera },
      { text: "撸铁运动", icon: Dumbbell },
      { text: "看展看剧", icon: Camera },
      { text: "吸猫撸狗", icon: Heart },
      { text: "桌游卡牌", icon: Gamepad2 }
    ],
    multiSelect: true,
    priority: 88
  },
  {
    keywords: ["年龄", "年代", "几几年", "多大", "岁", "后", "哪年"],
    options: [
      { text: "00后" },
      { text: "95后" },
      { text: "90后" },
      { text: "85后" }
    ],
    priority: 86  // 年龄优先级提高
  },
  {
    keywords: ["性别", "男生", "女生", "小哥哥", "小姐姐"],
    options: [
      { text: "女生", icon: Heart },
      { text: "男生", icon: Smile },
      { text: "保密", icon: Sparkles }
    ],
    priority: 85
  },
  {
    keywords: ["方向", "领域", "细分", "ai", "web3", "产品", "技术", "运营", "设计", "开发"],
    options: [
      { text: "互联网/科技", icon: Briefcase },
      { text: "金融", icon: Briefcase },
      { text: "学生", icon: Book },
      { text: "自由职业", icon: Sparkles },
      { text: "其他行业", icon: Briefcase }
    ],
    priority: 83  // 比基础职业问题优先级高，确保follow-up也显示职业选项
  },
  {
    keywords: ["工作", "职业", "做什么", "行业", "从事"],
    options: [
      { text: "互联网/科技", icon: Briefcase },
      { text: "金融", icon: Briefcase },
      { text: "学生", icon: Book },
      { text: "自由职业", icon: Sparkles },
      { text: "其他行业", icon: Briefcase }
    ],
    priority: 82
  },
  {
    keywords: ["城市", "哪里", "在哪", "深圳", "香港", "广州"],
    options: [
      { text: "深圳", icon: MapPin },
      { text: "香港", icon: MapPin },
      { text: "广州", icon: MapPin },
      { text: "其他城市", icon: MapPin }
    ],
    priority: 75
  },
  {
    keywords: ["宠物", "毛孩子", "猫", "狗", "养"],
    options: [
      { text: "有猫咪🐱" },
      { text: "有狗狗🐕" },
      { text: "都有！" },
      { text: "没有养" }
    ],
    priority: 70
  },
  {
    keywords: ["感情", "单身", "恋爱", "对象", "另一半"],
    options: [
      { text: "单身" },
      { text: "恋爱中" },
      { text: "已婚" },
      { text: "保密" }
    ],
    priority: 70
  },
  {
    keywords: ["确认", "对吗", "没问题", "有要改"],
    options: [
      { text: "没问题！" },
      { text: "对的~" },
      { text: "需要改一下" }
    ],
    priority: 50
  }
];

// 检测结果接口
interface QuickReplyResult {
  options: QuickReply[];
  multiSelect: boolean;
}

// 检测最后一条消息是否匹配快捷回复
// 关键改进：只按换行符分割，取最后一段落进行检测（避免问号/句号把问句拆开）
function detectQuickReplies(lastMessage: string): QuickReplyResult {
  // 只按换行符分割，取最后一段进行检测
  const segments = lastMessage.split(/\n/).filter(s => s.trim());
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : lastMessage;
  const lowerMsg = lastSegment.toLowerCase();
  
  const matches: Array<{ config: QuickReplyConfig; score: number }> = [];
  
  for (const config of quickReplyConfigs) {
    let maxPosition = -1;
    let foundCount = 0;
    
    // 找到该配置中所有关键词在消息中最后出现的位置
    for (const kw of config.keywords) {
      const pos = lowerMsg.lastIndexOf(kw);
      if (pos >= 0) {
        foundCount++;
        if (pos > maxPosition) {
          maxPosition = pos;
        }
      }
    }
    
    // 如果找到关键词，计算分数
    if (maxPosition >= 0) {
      const positionScore = maxPosition; // 后出现的位置更高
      const priority = config.priority || 0;
      const matchScore = priority * 1000 + positionScore;
      matches.push({ config, score: matchScore });
    }
  }
  
  // 按分数排序，取分数最高的配置
  matches.sort((a, b) => b.score - a.score);
  
  const bestMatch = matches[0];
  return bestMatch 
    ? { 
        options: bestMatch.config.options.filter(o => o.text), 
        multiSelect: bestMatch.config.multiSelect || false 
      }
    : { options: [], multiSelect: false };
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

// 用户头像组件 - 根据性别动态切换
function UserAvatar({ gender }: { gender?: string }) {
  const getAvatarStyle = () => {
    if (gender === "女生" || gender === "女性") {
      return { bg: "bg-pink-100 dark:bg-pink-900/30", iconColor: "text-pink-500", border: "border-pink-200 dark:border-pink-800", icon: Heart };
    }
    if (gender === "男生" || gender === "男性") {
      return { bg: "bg-blue-100 dark:bg-blue-900/30", iconColor: "text-blue-500", border: "border-blue-200 dark:border-blue-800", icon: Smile };
    }
    return { bg: "bg-muted", iconColor: "", border: "border-muted-foreground/20", icon: User };
  };
  
  const style = getAvatarStyle();
  const IconComponent = style.icon;
  
  return (
    <motion.div 
      className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center flex-shrink-0 border ${style.border}`}
      key={gender || "default"}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <IconComponent className={`w-4 h-4 ${style.iconColor}`} />
    </motion.div>
  );
}

// 单条消息组件（支持打字效果和小悦表情）
function MessageBubble({ 
  message, 
  isLatest,
  userGender,
  collectedInfo,
  onTypingComplete 
}: { 
  message: ChatMessage; 
  isLatest: boolean;
  userGender?: string;
  collectedInfo?: CollectedInfo;
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
        <EvolvingAvatar 
          clarityLevel={calculateClarityLevel(collectedInfo || {})}
          gender={userGender === '女性' || userGender === '女生' ? 'female' : userGender === '男性' || userGender === '男生' ? 'male' : 'unknown'}
          size={32}
        />
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

// 可选兴趣标签 - 与InterestsTopicsPage对齐
const interestOptions = [
  "美食探店", "说走就走", "City Walk", "喝酒小酌", "音乐Live", "拍拍拍",
  "撸铁运动", "看展看剧", "打游戏", "吸猫撸狗", "看书充电", "桌游卡牌"
];

// 信息确认卡片组件
function InfoConfirmationCard({ 
  info, 
  onUpdate, 
  onConfirm, 
  onCancel,
  isPending 
}: { 
  info: CollectedInfo; 
  onUpdate: (info: CollectedInfo) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");

  const startEdit = (field: string, value: string) => {
    setEditingField(field);
    setTempValue(value);
  };

  const saveEdit = (field: keyof CollectedInfo) => {
    if (tempValue.trim()) {
      onUpdate({ ...info, [field]: field === "birthYear" ? parseInt(tempValue) : tempValue });
    }
    setEditingField(null);
    setTempValue("");
  };

  const cancelEdit = () => {
    setEditingField(null);
    setTempValue("");
  };

  const toggleInterest = (interest: string) => {
    const current = info.interestsTop || [];
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    onUpdate({ ...info, interestsTop: updated });
  };

  const getYearLabel = (year?: number) => {
    if (!year) return "未填写";
    if (year >= 2000) return `00后 (${year}年)`;
    if (year >= 1995) return `95后 (${year}年)`;
    if (year >= 1990) return `90后 (${year}年)`;
    if (year >= 1985) return `85后 (${year}年)`;
    return `${year}年`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto"
    >
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">确认你的信息</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} data-testid="button-cancel-confirmation">
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">检查一下小悦收集的信息是否正确，点击可修改</p>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* 昵称 */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">昵称</Label>
                {editingField === "displayName" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      className="h-8"
                      autoFocus
                      data-testid="input-edit-displayName"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => saveEdit("displayName")} data-testid="button-save-displayName">
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={cancelEdit} data-testid="button-cancel-displayName">
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-2 mt-1 cursor-pointer group"
                    onClick={() => startEdit("displayName", info.displayName || "")}
                    data-testid="field-displayName"
                  >
                    <span className="text-base font-medium">{info.displayName || "未填写"}</span>
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>

          {/* 性别和年龄 */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <Label className="text-xs text-muted-foreground">性别</Label>
              <Select 
                value={info.gender || ""} 
                onValueChange={(v) => onUpdate({ ...info, gender: v })}
              >
                <SelectTrigger className="mt-1 h-9" data-testid="select-gender">
                  <SelectValue placeholder="选择性别" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="女性">女性</SelectItem>
                  <SelectItem value="男性">男性</SelectItem>
                  <SelectItem value="不透露">不透露</SelectItem>
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-4">
              <Label className="text-xs text-muted-foreground">年龄段</Label>
              <Select 
                value={info.birthYear?.toString() || ""} 
                onValueChange={(v) => onUpdate({ ...info, birthYear: parseInt(v) })}
              >
                <SelectTrigger className="mt-1 h-9" data-testid="select-birthYear">
                  <SelectValue placeholder="选择年代">{info.birthYear ? getYearLabel(info.birthYear) : "选择年代"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2002">00后</SelectItem>
                  <SelectItem value="1997">95后</SelectItem>
                  <SelectItem value="1992">90后</SelectItem>
                  <SelectItem value="1987">85后</SelectItem>
                </SelectContent>
              </Select>
            </Card>
          </div>

          {/* 城市和职业 */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <Label className="text-xs text-muted-foreground">城市</Label>
              <Select 
                value={info.currentCity || ""} 
                onValueChange={(v) => onUpdate({ ...info, currentCity: v })}
              >
                <SelectTrigger className="mt-1 h-9" data-testid="select-city">
                  <SelectValue placeholder="选择城市" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="深圳">深圳</SelectItem>
                  <SelectItem value="香港">香港</SelectItem>
                  <SelectItem value="广州">广州</SelectItem>
                  <SelectItem value="其他">其他城市</SelectItem>
                </SelectContent>
              </Select>
            </Card>

            <Card className="p-4">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">职业</Label>
                {editingField === "occupationDescription" ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                      data-testid="input-edit-occupation"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit("occupationDescription")} data-testid="button-save-occupation">
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit} data-testid="button-cancel-occupation">
                      <X className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-1.5 mt-1 cursor-pointer group"
                    onClick={() => startEdit("occupationDescription", info.occupationDescription || "")}
                    data-testid="field-occupation"
                  >
                    <span className="text-sm truncate">{info.occupationDescription || "未填写"}</span>
                    <Edit2 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 兴趣爱好 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">兴趣爱好（点击添加/移除）</Label>
              <span className="text-xs text-muted-foreground">{info.interestsTop?.length || 0} 个已选</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {interestOptions.map(interest => {
                const isSelected = info.interestsTop?.includes(interest);
                return (
                  <Badge
                    key={interest}
                    variant={isSelected ? "default" : "outline"}
                    className={`cursor-pointer transition-all ${isSelected ? "" : "hover:bg-primary/10"}`}
                    onClick={() => toggleInterest(interest)}
                    data-testid={`interest-${interest}`}
                  >
                    {interest}
                  </Badge>
                );
              })}
            </div>
            {/* 显示自定义兴趣 */}
            {info.interestsTop?.filter(i => !interestOptions.includes(i)).map(custom => (
              <Badge
                key={custom}
                variant="default"
                className="mt-2 cursor-pointer"
                onClick={() => toggleInterest(custom)}
                data-testid={`interest-custom-${custom}`}
              >
                {custom} <X className="w-3 h-3 ml-1" />
              </Badge>
            ))}
          </Card>
        </div>

        {/* 底部确认按钮 */}
        <div className="sticky bottom-0 p-4 border-t bg-background">
          <Button 
            className="w-full" 
            onClick={() => {
              const trimmedName = info.displayName?.trim();
              const trimmedCity = info.currentCity?.trim();
              const validInterests = info.interestsTop?.filter(i => i.trim());
              
              if (!trimmedName || !trimmedCity || !validInterests?.length) {
                return;
              }
              onUpdate({
                ...info,
                displayName: trimmedName,
                currentCity: trimmedCity,
                interestsTop: validInterests
              });
              onConfirm();
            }}
            disabled={isPending || !info.displayName?.trim() || !info.currentCity?.trim() || !info.interestsTop?.filter(i => i.trim()).length}
            data-testid="button-confirm-and-submit"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            确认无误，继续下一步
          </Button>
          {(!info.displayName?.trim() || !info.currentCity?.trim() || !info.interestsTop?.filter(i => i.trim()).length) && (
            <p className="text-xs text-destructive text-center mt-2">
              请确保昵称、城市和兴趣都已填写
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
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
  
  // 多选快捷回复状态
  const [selectedQuickReplies, setSelectedQuickReplies] = useState<Set<string>>(new Set());
  
  // 信息确认弹窗状态
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // 对话开始时间（用于计算completionSpeed）
  const [chatStartTime] = useState<string>(() => new Date().toISOString());

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

  const sendStreamingMessage = async (message: string) => {
    const messageIndex = messages.length;
    let streamedContent = '';
    
    setMessages(prev => [...prev, {
      role: "assistant",
      content: '',
      timestamp: new Date(),
      isTypingAnimation: false
    }]);

    try {
      const res = await fetch("/api/registration/chat/message/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationHistory }),
        credentials: "include"
      });

      if (!res.ok) throw new Error('Stream request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'content' && data.content) {
                  streamedContent += data.content;
                  const cleanContent = streamedContent
                    .replace(/```collected_info[\s\S]*?```/g, '')
                    .replace(/```registration_complete[\s\S]*?```/g, '')
                    .trim();
                  
                  setMessages(prev => prev.map((m, i) => 
                    i === messageIndex ? { ...m, content: cleanContent } : m
                  ));
                } else if (data.type === 'done') {
                  if (data.conversationHistory) {
                    setConversationHistory(data.conversationHistory);
                  }
                  if (data.collectedInfo) {
                    setCollectedInfo(prev => ({ ...prev, ...data.collectedInfo }));
                  }
                  if (data.isComplete) {
                    setIsComplete(true);
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.content || '请求失败');
                }
              } catch (parseError) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter((_, i) => i !== messageIndex));
      toast({
        title: "发送失败",
        description: "小悦暂时走神了，请重试",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      await sendStreamingMessage(message);
      return { success: true };
    }
  });

  const submitRegistrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/registration/chat/complete", {
        conversationHistory,
        collectedInfo,
        startTime: chatStartTime
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
    setShowConfirmation(true);
  };

  const handleConfirmAndSubmit = () => {
    submitRegistrationMutation.mutate();
  };

  // 检测快捷回复选项
  const quickReplyResult = useMemo(() => {
    if (isTyping || isComplete || messages.length === 0) return { options: [], multiSelect: false };
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    if (!lastAssistantMessage) return { options: [], multiSelect: false };
    return detectQuickReplies(lastAssistantMessage.content);
  }, [messages, isTyping, isComplete]);

  // 当问题变化时清空已选
  useEffect(() => {
    setSelectedQuickReplies(new Set());
  }, [quickReplyResult.options]);

  // 快捷回复点击处理
  const handleQuickReply = (text: string) => {
    if (isTyping) return;
    
    // 如果是多选模式，切换选中状态而不是立即发送
    if (quickReplyResult.multiSelect) {
      setSelectedQuickReplies(prev => {
        const newSet = new Set(prev);
        if (newSet.has(text)) {
          newSet.delete(text);
        } else {
          newSet.add(text);
        }
        return newSet;
      });
      return;
    }
    
    // 单选模式，立即发送
    setMessages(prev => [...prev, {
      role: "user",
      content: text,
      timestamp: new Date()
    }]);
    setIsTyping(true);
    sendMessageMutation.mutate(text);
  };

  // 多选确认发送
  const handleMultiSelectSend = () => {
    if (isTyping || selectedQuickReplies.size === 0) return;
    const selectedText = Array.from(selectedQuickReplies).join("、");
    setMessages(prev => [...prev, {
      role: "user",
      content: selectedText,
      timestamp: new Date()
    }]);
    setSelectedQuickReplies(new Set());
    setIsTyping(true);
    sendMessageMutation.mutate(selectedText);
  };

  const TimeIcon = themeConfig.icon;

  return (
    <div className={`min-h-screen bg-gradient-to-b ${themeConfig.gradient} flex flex-col`}>
      {/* 信息确认卡片 */}
      <AnimatePresence>
        {showConfirmation && (
          <InfoConfirmationCard
            info={collectedInfo}
            onUpdate={setCollectedInfo}
            onConfirm={handleConfirmAndSubmit}
            onCancel={() => setShowConfirmation(false)}
            isPending={submitRegistrationMutation.isPending}
          />
        )}
      </AnimatePresence>
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
              userGender={collectedInfo.gender}
              collectedInfo={collectedInfo}
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
        {quickReplyResult.options.length > 0 && !isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-3 border-t bg-muted/30"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">
                {quickReplyResult.multiSelect ? "可多选（点击选择后发送）：" : "快捷回复："}
              </p>
              {quickReplyResult.multiSelect && selectedQuickReplies.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleMultiSelectSend}
                  className="h-7 text-xs"
                  data-testid="button-send-multi-select"
                >
                  <Send className="w-3 h-3 mr-1" />
                  发送 ({selectedQuickReplies.size})
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {quickReplyResult.options.map((reply, index) => {
                const IconComponent = reply.icon;
                const isSelected = selectedQuickReplies.has(reply.text);
                return (
                  <motion.button
                    key={reply.text}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleQuickReply(reply.text)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all text-sm ${
                      isSelected 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "bg-background border-border hover:border-primary hover:bg-primary/5"
                    }`}
                    data-testid={`quick-reply-${reply.text}`}
                  >
                    {IconComponent && <IconComponent className={`w-3.5 h-3.5 ${isSelected ? "" : "text-primary"}`} />}
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
