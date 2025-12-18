import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Users, Sparkles, ArrowRight, Smile, Heart, Briefcase, MapPin, Coffee, Music, Gamepad2, Camera, Book, Dumbbell, Sun, Moon, Star, Edit2, Check, X, Zap, Clock, Diamond, RotateCcw, MessageCircle, AlertCircle, Pencil, Calendar } from "lucide-react";
import xiaoyueAvatar from "@assets/generated_images/final_fox_with_collar_sunglasses.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import MobileHeader from "@/components/MobileHeader";
import EvolvingAvatar, { calculateClarityLevel } from "@/components/EvolvingAvatar";
import type { User as UserType } from "@shared/schema";
import { INTERESTS_OPTIONS } from "@/data/interestsTopicsData";
import { INDUSTRIES, WORK_MODES } from "@shared/occupations";
import { 
  LANGUAGES_COMFORT_OPTIONS, 
  RELATIONSHIP_STATUS_OPTIONS, 
  EDUCATION_LEVEL_OPTIONS, 
  CHILDREN_OPTIONS 
} from "@shared/constants";

// 注册模式配置
type RegistrationMode = "express" | "standard" | "deep" | "all_in_one" | "enrichment";

// 资料补充模式的上下文
interface EnrichmentContext {
  existingProfile: {
    displayName?: string;
    gender?: string;
    birthdate?: string;
    currentCity?: string;
    occupation?: string;
    topInterests?: string[];
    educationLevel?: string;
    relationshipStatus?: string;
    intent?: string;
    hometownCountry?: string;
    languagesComfort?: string[];
    socialStyle?: string;
  };
  missingFields: string[];
}

// 计算缺失字段
function calculateMissingFields(user: UserType | null | undefined): { missingFields: string[]; existingProfile: EnrichmentContext['existingProfile'] } {
  if (!user) return { missingFields: [], existingProfile: {} };
  
  const fieldsToCheck = [
    { key: 'displayName', label: '昵称' },
    { key: 'gender', label: '性别' },
    { key: 'birthdate', label: '出生日期' },
    { key: 'currentCity', label: '城市' },
    { key: 'occupation', label: '职业' },
    { key: 'topInterests', label: '兴趣爱好', isArray: true },
    { key: 'educationLevel', label: '学历' },
    { key: 'relationshipStatus', label: '感情状态' },
    { key: 'intent', label: '社交意向' },
    { key: 'hometownCountry', label: '家乡' },
    { key: 'languagesComfort', label: '语言', isArray: true },
    { key: 'socialStyle', label: '社交风格' },
  ];
  
  const missingFields: string[] = [];
  const existingProfile: EnrichmentContext['existingProfile'] = {};
  
  fieldsToCheck.forEach(field => {
    const value = (user as any)[field.key];
    const isFilled = field.isArray 
      ? Array.isArray(value) && value.length > 0
      : value !== undefined && value !== null && value !== '';
    
    if (isFilled) {
      (existingProfile as any)[field.key] = value;
    } else {
      missingFields.push(field.label);
    }
  });
  
  return { missingFields, existingProfile };
}

interface ModeConfig {
  id: RegistrationMode;
  icon: any;
  title: string;
  subtitle: string;
  time: string;
  stars: number;
  maxStars: number;
  description: string;
  gradient: string;
  recommended?: boolean;
}

const registrationModes: ModeConfig[] = [
  {
    id: "express",
    icon: Zap,
    title: "极速体验",
    subtitle: "先看看有啥活动",
    time: "2分钟",
    stars: 3,
    maxStars: 5,
    description: "收集基础信息（昵称、性别、年龄、城市、职业、兴趣）",
    gradient: "from-amber-500 to-orange-500"
  },
  {
    id: "standard",
    icon: Clock,
    title: "轻松聊聊",
    subtitle: "大多数人选这个",
    time: "3分钟",
    stars: 4,
    maxStars: 5,
    description: "推荐起点（+意图、感情、破冰角色、能量恢复）",
    gradient: "from-purple-500 to-pink-500",
    recommended: true
  },
  {
    id: "deep",
    icon: Diamond,
    title: "深度了解",
    subtitle: "起步就更懂你",
    time: "6-7分钟",
    stars: 5,
    maxStars: 5,
    description: "详细画像+社交能量，匹配最精准",
    gradient: "from-blue-500 to-cyan-500"
  }
];

// 星级显示组件
function StarRating({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: total }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < filled 
              ? "fill-yellow-400 text-yellow-400" 
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

// 模式选择界面组件
function ModeSelectionScreen({ 
  onSelectMode 
}: { 
  onSelectMode: (mode: RegistrationMode) => void 
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        {/* 小悦品牌大使形象 - Impactful展示 */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative mx-auto mb-6"
        >
          {/* 背景光晕效果 */}
          <div className="absolute inset-0 w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-primary/30 via-purple-400/20 to-pink-400/20 blur-xl" />
          
          {/* 小悦头像 */}
          <div className="relative w-28 h-28 mx-auto rounded-full overflow-hidden ring-4 ring-primary/20 ring-offset-4 ring-offset-background shadow-2xl">
            <img 
              src={xiaoyueAvatar} 
              alt="小悦 - 悦聚AI社交助手" 
              className="w-full h-full object-cover object-top"
              data-testid="img-xiaoyue-avatar"
            />
          </div>
          
          {/* AI闪烁标识 */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-2xl font-bold mb-2"
        >
          嗨，我是小悦
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground"
        >
          让我们聊聊，帮你找到合拍的活动伙伴
        </motion.p>
      </motion.div>

      <motion.div 
        className="w-full max-w-sm space-y-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {registrationModes.map((mode, index) => (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Card
              className={`p-4 cursor-pointer hover-elevate active-elevate-2 transition-all ${
                mode.recommended ? "ring-2 ring-primary ring-offset-2" : ""
              }`}
              onClick={() => onSelectMode(mode.id)}
              data-testid={`mode-card-${mode.id}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.gradient} flex items-center justify-center flex-shrink-0`}>
                  <mode.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{mode.title}</span>
                    <span className="text-xs text-muted-foreground">({mode.time})</span>
                    {mode.recommended && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        推荐
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-1.5">{mode.subtitle}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">初始画像</span>
                    <StarRating filled={mode.stars} total={mode.maxStars} />
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.p 
        className="text-xs text-muted-foreground text-center mt-6 max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        匹配会随着你参加活动越来越精准哦
      </motion.p>

      <motion.button
        className="mt-4 text-sm text-primary hover:underline flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={() => onSelectMode("all_in_one")}
        data-testid="button-all-in-one"
      >
        <Zap className="w-3.5 h-3.5" />
        赶时间？一键搞定（注册+性格测试，约6分钟）
      </motion.button>
    </div>
  );
}

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

// 小悦表情类型 - 简化版，保持友好一致
type XiaoyueEmotion = "happy" | "thinking" | "neutral";

// 简化的表情检测 - 不再随进度变化（用户研究反馈该功能评分较低4.55/10）
function detectEmotion(message: string): XiaoyueEmotion {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes("？") || lowerMsg.includes("?") || lowerMsg.includes("呢") || lowerMsg.includes("吗")) {
    return "thinking"; // 提问时
  }
  return "happy"; // 默认友好表情
}

const emotionEmojis: Record<XiaoyueEmotion, string> = {
  happy: "😊",
  thinking: "🤔",
  neutral: "🙂"
};

// 成就系统配置
interface Achievement {
  id: string;
  title: string;
  icon: string;
  condition: (info: CollectedInfo) => boolean;
}

// 根据注册时间戳获取时间段（如果没有时间戳则返回null，不发放时间徽章）
function getTimeOfDayFromTimestamp(timestamp?: string): 'night' | 'morning' | 'day' | null {
  if (!timestamp) return null; // 没有时间戳时不判断时间徽章
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return null; // 无效时间戳
  const hour = date.getHours();
  if (hour >= 22 || hour < 6) return 'night';
  if (hour >= 6 && hour < 9) return 'morning';
  return 'day';
}

// 扩展成就接口以支持模式条件
interface AchievementWithMode extends Achievement {
  modeCondition?: (mode?: RegistrationMode) => boolean;
}

// 检查children字段是否表示有孩子（使用CHILDREN_OPTIONS精确匹配）
// 有孩子的值：期待中、0-5岁、6-12岁、13-18岁、成年
// 无孩子的值：无孩子、不透露（或空）
function hasChildren(children?: string): boolean {
  if (!children) return false;
  const normalized = children.trim();
  // 明确表示有孩子的选项（来自CHILDREN_OPTIONS）
  const hasChildrenValues = ['期待中', '0-5岁', '6-12岁', '13-18岁', '成年'];
  return hasChildrenValues.includes(normalized);
}

// 检查破冰角色是否为主动型（使用规范化的enum值）
// 规范化值来自validateAndNormalizeInfo: initiator/follower/observer
function isIcebreakerInitiator(role?: string): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  // 规范化的主动型值
  return normalized === 'initiator' || normalized === '先开口';
}

// 检查是否有海外经历（使用规范化值）
// studyLocale规范化值：本地、海外、都有
function hasOverseasExperience(info: CollectedInfo): boolean {
  if (info.studyLocale) {
    const normalized = info.studyLocale.trim();
    if (normalized === '海外' || normalized === '都有') {
      return true;
    }
  }
  return !!info.overseasRegions && info.overseasRegions.length > 0;
}

const achievements: AchievementWithMode[] = [
  // 原有6个
  { id: "pet_lover", title: "铲屎官认证", icon: "🐾", condition: (info) => info.hasPets === true },
  { id: "foodie", title: "美食家", icon: "🍜", condition: (info) => !!info.cuisinePreference && info.cuisinePreference.length > 0 },
  { id: "social_butterfly", title: "社交达人", icon: "🦋", condition: (info) => !!info.interestsTop && info.interestsTop.length >= 3 },
  { id: "local_expert", title: "本地通", icon: "📍", condition: (info) => !!info.currentCity && !!info.hometown },
  { id: "multi_lingual", title: "语言达人", icon: "🗣️", condition: (info) => !!info.languagesComfort && info.languagesComfort.length >= 2 },
  { id: "open_book", title: "坦诚相待", icon: "📖", condition: (info) => !!info.relationshipStatus },
  
  // 新增10个
  { id: "world_citizen", title: "世界公民", icon: "🌏", condition: (info) => hasOverseasExperience(info) },
  { id: "parent", title: "神兽驯养师", icon: "👶", condition: (info) => hasChildren(info.children) },
  { id: "student_forever", title: "永远的学生", icon: "🎓", condition: (info) => !!info.educationLevel || !!info.fieldOfStudy },
  { id: "work_artist", title: "搬砖艺术家", icon: "💼", condition: (info) => !!info.industry || !!info.roleTitleShort || !!info.occupationDescription },
  { id: "night_owl", title: "夜猫子", icon: "🦉", condition: (info) => getTimeOfDayFromTimestamp(info.registrationStartTime) === 'night' },
  { id: "early_bird", title: "早起鸟", icon: "🐔", condition: (info) => getTimeOfDayFromTimestamp(info.registrationStartTime) === 'morning' },
  { id: "speed_demon", title: "效率狂人", icon: "⚡", condition: () => false, modeCondition: (mode) => mode === 'express' },
  { id: "deep_diver", title: "慢工出细活", icon: "💎", condition: () => false, modeCondition: (mode) => mode === 'deep' },
  { id: "mic_master", title: "麦霸预定", icon: "🎤", condition: (info) => isIcebreakerInitiator(info.icebreakerRole) },
  { id: "rainbow_collector", title: "彩虹收集者", icon: "🌈", condition: (info) => !!info.interestsTop && info.interestsTop.length >= 5 },
];

// 成就弹出组件
function AchievementToast({ achievement, onComplete }: { achievement: Achievement; onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="bg-gradient-to-r from-primary/90 to-purple-600/90 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3">
        <motion.span 
          className="text-2xl"
          animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 0.5 }}
        >
          {achievement.icon}
        </motion.span>
        <div>
          <p className="text-xs opacity-80">成就解锁</p>
          <p className="font-medium">{achievement.title}</p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 0.3, repeat: 2 }}
        >
          <Sparkles className="w-4 h-4" />
        </motion.div>
      </div>
    </motion.div>
  );
}

// 实时标签云组件
function TagCloud({ info }: { info: CollectedInfo }) {
  const tags: { text: string; type: "primary" | "secondary" | "accent" }[] = [];
  
  if (info.currentCity) tags.push({ text: info.currentCity, type: "primary" });
  if (info.gender) tags.push({ text: info.gender, type: "secondary" });
  if (info.birthYear) tags.push({ text: `${info.birthYear}后`, type: "secondary" });
  if (info.occupationDescription) tags.push({ text: info.occupationDescription, type: "accent" });
  if (info.interestsTop) {
    info.interestsTop.slice(0, 2).forEach(i => tags.push({ text: i, type: "primary" }));
  }
  if (info.hasPets) tags.push({ text: "有毛孩子", type: "accent" });
  
  if (tags.length === 0) return null;
  
  return (
    <motion.div 
      className="flex flex-wrap gap-1.5 justify-center py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <AnimatePresence mode="popLayout">
        {tags.slice(0, 6).map((tag, i) => (
          <motion.span
            key={tag.text}
            initial={{ opacity: 0, scale: 0, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 300 }}
            className={`text-xs px-2 py-1 rounded-full ${
              tag.type === "primary" 
                ? "bg-primary/15 text-primary" 
                : tag.type === "accent"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {tag.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// 聊天氛围背景渐变（随进度变暖）
function getWarmthGradient(infoCount: number): string {
  // 从冷色调逐渐变暖
  if (infoCount >= 15) return "from-pink-50/40 via-purple-50/30 to-background"; // 很熟悉
  if (infoCount >= 10) return "from-purple-50/35 via-pink-50/25 to-background"; // 熟悉
  if (infoCount >= 5) return "from-violet-50/30 via-purple-50/20 to-background"; // 渐熟
  return "from-slate-50/20 via-gray-50/10 to-background"; // 初识
}

// 小悦头像组件 - 使用品牌大使形象
function XiaoyueAvatar({ emotion, size = "md" }: { emotion: XiaoyueEmotion; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-20 h-20"
  }[size];
  
  return (
    <motion.div 
      className={`${sizeClasses} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20 ring-offset-2 ring-offset-background`}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      key={emotion}
    >
      <img 
        src={xiaoyueAvatar} 
        alt="小悦" 
        className="w-full h-full object-cover object-top"
      />
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
    // 确认模式 - 最高优先级，当AI收尾确认时触发
    keywords: ["对吗", "确认一下", "核对一下", "信息对吗", "没问题吗", "有错吗", "需要改吗"],
    options: [
      { text: "对的，确认", icon: Check },
      { text: "需要修改", icon: Pencil }
    ],
    priority: 100 // 最高优先级，不被其他关键词覆盖
  },
  {
    keywords: ["称呼", "昵称", "名字", "怎么叫"],
    options: [],
    priority: 95 // 昵称需要用户输入，不提供快捷选项
  },
  {
    keywords: ["想要", "期待", "目的", "意图", "来这里", "悦聚", "拓展人脉", "交朋友", "想来", "为什么来", "什么目的"],
    options: [
      { text: "交朋友", icon: Heart },
      { text: "拓展人脉", icon: Briefcase },
      { text: "聊天交流", icon: Book },
      { text: "吃喝玩乐", icon: Coffee },
      { text: "脱单恋爱", icon: Heart },
      { text: "随缘都可以", icon: Sparkles }
    ],
    multiSelect: true,
    priority: 92
  },
  {
    keywords: ["语言", "方言", "会说", "普通话", "粤语", "英语", "母语", "口音"],
    options: LANGUAGES_COMFORT_OPTIONS.slice(0, 12).map(lang => ({ text: lang, icon: Book })),
    multiSelect: true,
    priority: 78
  },
  {
    keywords: ["不聊", "避免", "不太想聊", "敏感", "尴尬", "话题"],
    options: [
      { text: "政治时事", icon: Sparkles },
      { text: "催婚催恋", icon: Heart },
      { text: "职场八卦", icon: Briefcase },
      { text: "金钱财务", icon: Briefcase },
      { text: "都OK没禁忌", icon: Sparkles }
    ],
    multiSelect: true,
    priority: 76
  },
  {
    keywords: ["海外", "留学", "国外", "出国", "留过学", "在哪读的"],
    options: [
      { text: "北美", icon: MapPin },
      { text: "欧洲", icon: MapPin },
      { text: "英国", icon: MapPin },
      { text: "澳洲/新西兰", icon: MapPin },
      { text: "东亚（日韩）", icon: MapPin },
      { text: "东南亚", icon: MapPin },
      { text: "没有海外经历", icon: MapPin }
    ],
    multiSelect: true,
    priority: 74
  },
  {
    keywords: ["学历", "读到", "什么学历", "毕业", "读书", "上学"],
    options: EDUCATION_LEVEL_OPTIONS.map(level => ({ text: level, icon: Book })),
    priority: 73
  },
  {
    keywords: ["孩子", "小孩", "娃", "宝宝", "生娃"],
    options: CHILDREN_OPTIONS.map(opt => ({ text: opt, icon: Heart })),
    priority: 72
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
      { text: "火锅", icon: Coffee },
      { text: "川湘菜", icon: Coffee },
      { text: "西餐", icon: Coffee },
      { text: "东南亚菜", icon: Coffee },
      { text: "韩餐", icon: Coffee },
      { text: "各种都爱", icon: Sparkles }
    ],
    multiSelect: true,
    priority: 89  // 比通用兴趣高，确保问菜系时显示菜系选项
  },
  {
    keywords: ["兴趣", "爱好", "喜欢做", "平时做", "活动", "最常做", "工作之外", "业余", "闲暇"],
    options: INTERESTS_OPTIONS.map(opt => {
      const iconMap: Record<string, any> = {
        "food_dining": Coffee, "travel": MapPin, "city_walk": MapPin,
        "drinks_bar": Coffee, "music_live": Music, "photography": Camera,
        "sports_fitness": Dumbbell, "movies": Camera, "exhibitions": Camera, "tv_shows": Camera,
        "games_video": Gamepad2, "pets_animals": Heart, "reading_books": Book, 
        "tech_gadgets": Sparkles, "outdoor_adventure": MapPin, "games_board": Gamepad2, 
        "entrepreneurship": Briefcase, "investing": Briefcase, "diy_crafts": Heart, 
        "volunteering": Heart, "meditation": Sparkles, "languages": Book
      };
      return { text: opt.label, icon: iconMap[opt.id] || Sparkles };
    }),
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
    priority: 86
  },
  {
    keywords: ["对外", "显示", "年龄显示", "怎么显示", "隐藏", "年代", "区间"],
    options: [
      { text: "只显示年代（如95后）" },
      { text: "显示年龄区间（如25-30岁）" },
      { text: "完全隐藏" }
    ],
    priority: 87
  },
  {
    keywords: ["性别", "男生", "女生", "小哥哥", "小姐姐"],
    options: [
      { text: "女生", icon: Heart },
      { text: "男生", icon: Smile }
    ],
    priority: 85
  },
  {
    keywords: ["金融", "银行", "证券", "基金", "投资", "PE", "VC", "创投", "资管", "保险"],
    options: [
      { text: "银行", icon: Briefcase },
      { text: "证券/投行", icon: Briefcase },
      { text: "公募/私募基金", icon: Briefcase },
      { text: "PE/VC创投", icon: Briefcase },
      { text: "保险", icon: Briefcase },
      { text: "资产管理", icon: Briefcase },
      { text: "财富管理", icon: Briefcase },
      { text: "金融科技", icon: Briefcase }
    ],
    priority: 94
  },
  {
    keywords: ["互联网", "科技", "技术", "开发", "产品", "运营", "技术开发"],
    options: [
      { text: "产品经理", icon: Briefcase },
      { text: "技术开发", icon: Briefcase },
      { text: "运营", icon: Briefcase },
      { text: "设计", icon: Briefcase },
      { text: "数据分析", icon: Briefcase },
      { text: "项目管理", icon: Briefcase },
      { text: "市场营销", icon: Briefcase },
      { text: "HR/行政", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["咨询", "四大", "MBB", "战略", "管理咨询"],
    options: [
      { text: "战略咨询", icon: Briefcase },
      { text: "管理咨询", icon: Briefcase },
      { text: "财务咨询", icon: Briefcase },
      { text: "IT咨询", icon: Briefcase },
      { text: "人力咨询", icon: Briefcase },
      { text: "法律咨询", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["医疗", "医药", "健康", "医生", "护士", "药"],
    options: [
      { text: "临床医生", icon: Briefcase },
      { text: "医药研发", icon: Briefcase },
      { text: "医药销售", icon: Briefcase },
      { text: "医疗器械", icon: Briefcase },
      { text: "医院管理", icon: Briefcase },
      { text: "健康管理", icon: Briefcase },
      { text: "生物科技", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["教育", "老师", "培训", "教学", "学校"],
    options: [
      { text: "K12教育", icon: Book },
      { text: "高等教育", icon: Book },
      { text: "职业培训", icon: Book },
      { text: "在线教育", icon: Book },
      { text: "教育科技", icon: Book },
      { text: "留学咨询", icon: Book }
    ],
    priority: 93
  },
  {
    keywords: ["设计", "创意", "UI", "UX", "平面", "视觉"],
    options: [
      { text: "UI/UX设计", icon: Briefcase },
      { text: "平面设计", icon: Briefcase },
      { text: "品牌设计", icon: Briefcase },
      { text: "室内设计", icon: Briefcase },
      { text: "工业设计", icon: Briefcase },
      { text: "动画/影视", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["传媒", "媒体", "内容", "记者", "编辑", "自媒体"],
    options: [
      { text: "新闻媒体", icon: Briefcase },
      { text: "自媒体/KOL", icon: Briefcase },
      { text: "影视制作", icon: Briefcase },
      { text: "广告公关", icon: Briefcase },
      { text: "内容运营", icon: Briefcase },
      { text: "MCN机构", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["法律", "律师", "法务", "合规"],
    options: [
      { text: "律所律师", icon: Briefcase },
      { text: "企业法务", icon: Briefcase },
      { text: "合规风控", icon: Briefcase },
      { text: "知识产权", icon: Briefcase },
      { text: "公证/仲裁", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["地产", "建筑", "房产", "工程", "装修"],
    options: [
      { text: "房地产开发", icon: Briefcase },
      { text: "建筑设计", icon: Briefcase },
      { text: "工程施工", icon: Briefcase },
      { text: "物业管理", icon: Briefcase },
      { text: "房产经纪", icon: Briefcase },
      { text: "装修设计", icon: Briefcase }
    ],
    priority: 93
  },
  {
    keywords: ["身份", "职业状态", "工作状态", "创业", "在职", "学生", "自由", "gap", "过渡", "待业"],
    options: WORK_MODES.map(m => ({ text: m.label, icon: m.value === "student" ? Book : Sparkles })),
    priority: 84
  },
  {
    keywords: ["方向", "领域", "细分", "ai", "web3", "具体做什么", "哪个方向"],
    options: [
      { text: "科技互联网", icon: Briefcase },
      { text: "AI/大数据", icon: Briefcase },
      { text: "金融投资", icon: Briefcase },
      { text: "咨询服务", icon: Briefcase },
      { text: "市场营销", icon: Briefcase },
      { text: "创意设计", icon: Briefcase },
      { text: "传媒内容", icon: Briefcase },
      { text: "医疗健康", icon: Briefcase },
      { text: "教育培训", icon: Book }
    ],
    priority: 83
  },
  {
    keywords: ["工作", "职业", "做什么", "行业", "从事", "干什么", "什么工作", "忙什么", "哪行", "上班"],
    options: INDUSTRIES.map(ind => ({ text: ind.label, icon: Briefcase })),
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
      { text: "猫咪", icon: Heart },
      { text: "狗狗", icon: Heart },
      { text: "兔子", icon: Heart },
      { text: "仓鼠/小宠", icon: Heart },
      { text: "猫狗都有", icon: Heart },
      { text: "没有养", icon: Sparkles }
    ],
    multiSelect: true,
    priority: 70
  },
  {
    keywords: ["感情状态", "感情", "单身", "恋爱", "对象", "另一半", "婚姻"],
    options: RELATIONSHIP_STATUS_OPTIONS.map(status => ({ text: status, icon: Heart })),
    priority: 85
  },
  {
    keywords: ["兄弟", "姐妹", "独生", "一个人", "老大", "老二", "老幺", "排行"],
    options: [
      { text: "独生子女", icon: Users },
      { text: "有兄弟姐妹", icon: Users },
      { text: "不方便说", icon: Sparkles }
    ],
    priority: 68
  },
  {
    keywords: ["确认", "对吗", "没问题", "对不对", "有问题吗"],
    options: [
      { text: "确认无误", icon: Check },
      { text: "有问题", icon: AlertCircle }
    ],
    priority: 92
  },
  {
    keywords: ["破冰", "开口", "先说话", "先听", "新局", "社交场合", "聊天"],
    options: [
      { text: "我先起个头", icon: MessageCircle },
      { text: "看气氛再说", icon: Users },
      { text: "先观察观察", icon: Sparkles }
    ],
    priority: 90
  },
  {
    keywords: ["充电", "恢复", "能量", "社交完", "累了", "放松", "休息"],
    options: [
      { text: "一个人待着", icon: User },
      { text: "找一两个朋友聊聊", icon: Users },
      { text: "运动健身", icon: Dumbbell },
      { text: "睡一觉", icon: Moon }
    ],
    priority: 89
  },
  {
    keywords: ["人生阶段", "阶段", "状态", "职场", "学生党", "创业", "自由职业"],
    options: [
      { text: "学生党", icon: Book },
      { text: "职场新人", icon: Briefcase },
      { text: "职场老手", icon: Briefcase },
      { text: "创业中", icon: Star },
      { text: "自由职业", icon: Sparkles }
    ],
    priority: 88
  },
  {
    keywords: ["时间", "时段", "什么时候", "周末", "工作日", "晚上", "白天", "有空", "方便"],
    options: [
      { text: "工作日晚上", icon: Moon },
      { text: "周末白天", icon: Sun },
      { text: "周末晚上", icon: Moon },
      { text: "都可以", icon: Sparkles }
    ],
    priority: 85
  },
  {
    keywords: ["频率", "多久", "多频繁", "经常", "社交频率", "聚会频率", "每周", "每月"],
    options: [
      { text: "每周社交", icon: Zap },
      { text: "每两周一次", icon: Calendar },
      { text: "每月一两次", icon: Calendar },
      { text: "看心情", icon: Sparkles }
    ],
    priority: 84
  }
];

// 检测结果接口
interface QuickReplyResult {
  options: QuickReply[];
  multiSelect: boolean;
}

// 智能提取AI消息中的选项列表
function extractOptionsFromMessage(message: string): QuickReply[] {
  const options: QuickReply[] = [];
  
  // 连词分隔符正则（包括顿号、逗号和中文连词）
  const conjunctionSplitRegex = /[、，,]|还是|或者|或/g;
  
  // 模式0: 处理"先X还是先Y"/"是X还是Y"格式的问题
  // 这类问题需要特殊处理，避免把问题主干也提取进来
  const binaryChoicePatterns = [
    /(?:先|是|要|想|喜欢|倾向|偏向)([^还是，。！？\n]{1,8})还是(?:先|是)?([^，。！？\n]{1,8})[？?]/g,
    /([^还是，。！？\n]{2,8})还是([^，。！？\n]{2,8})[？?]/g,
  ];
  
  for (const pattern of binaryChoicePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(message)) !== null) {
      const option1 = match[1].trim().replace(/[。！？,.!?]$/, '').trim();
      const option2 = match[2].trim().replace(/[。！？,.!?]$/, '').trim();
      
      // 验证选项有效性（长度合适，不是问题词）
      const isValidOption = (opt: string) => {
        const questionWords = ['你', '一般', '通常', '平时', '是不是', '有没有', '会不会'];
        return opt.length >= 1 && opt.length <= 10 && !questionWords.some(w => opt.startsWith(w));
      };
      
      if (isValidOption(option1) && !options.find(o => o.text === option1)) {
        options.push({ text: option1 });
      }
      if (isValidOption(option2) && !options.find(o => o.text === option2)) {
        options.push({ text: option2 });
      }
      
      // 如果已经提取到2个选项，直接返回（二选一问题）
      if (options.length >= 2) {
        return options.slice(0, 4);
      }
    }
  }
  
  // 模式1: 顿号/连词分隔的选项 "90后、95后、00后" -> ["90后", "95后", "00后"]
  // 只匹配明确的列举格式，避免提取问题主干
  const listPattern = /(?:有|包括|比如|选择)?[：:]?\s*([^。！？\n]*?[、，][^。！？\n]*)/g;
  let match;
  while ((match = listPattern.exec(message)) !== null) {
    const segment = match[1];
    // 如果包含"还是"，用模式0处理更合适
    if (segment.includes('还是')) continue;
    
    // 提取分隔的选项
    const items = segment.split(/[、，,]/).map(s => s.trim()).filter(s => {
      const isInstruction = /说\d|关键词|就行|比如$|你|一般|通常/.test(s);
      return s.length >= 2 && s.length <= 12 && !s.includes('？') && !s.includes('?') && !isInstruction;
    });
    if (items.length >= 2) {
      items.forEach(item => {
        let cleanItem = item.replace(/^(或者|或|以及|和|跟|比如)/, '').trim();
        cleanItem = cleanItem.replace(/[。！？,.!?]$/, '').trim();
        if (cleanItem.length >= 2 && cleanItem.length <= 12 && !options.find(o => o.text === cleanItem)) {
          options.push({ text: cleanItem });
        }
      });
    }
  }
  
  // 模式2: 字母/数字序号格式 "a. xxx b. xxx" 或 "1. xxx 2. xxx"
  const numberedPattern = /(?:^|\n|[。！？])\s*(?:[a-eA-E1-5][.、)）]\s*)([^\n。！？]+)/g;
  while ((match = numberedPattern.exec(message)) !== null) {
    const item = match[1].trim().replace(/[。！？,.!?]$/, '').trim();
    if (item.length >= 2 && item.length <= 15 && !options.find(o => o.text === item)) {
      options.push({ text: item });
    }
  }
  
  // 去重并限制数量
  return options.slice(0, 8);
}

// 根据选项内容判断是否应该多选
function shouldBeMultiSelect(options: QuickReply[], message: string): boolean {
  const multiSelectKeywords = ["兴趣", "爱好", "喜欢", "活动", "菜系", "想要", "期待", "目的"];
  const lowerMsg = message.toLowerCase();
  
  for (const kw of multiSelectKeywords) {
    if (lowerMsg.includes(kw)) {
      return true;
    }
  }
  
  // 如果选项数量多（>=4），可能是多选
  if (options.length >= 4) {
    // 检查是否是典型的单选问题
    const singleSelectKeywords = ["性别", "年龄", "城市", "单身", "确认"];
    for (const kw of singleSelectKeywords) {
      if (lowerMsg.includes(kw)) {
        return false;
      }
    }
    return true;
  }
  
  return false;
}

// 需要用户自由输入的关键词（不应显示快捷选项）
const freeInputKeywords = ["称呼", "昵称", "名字", "怎么叫", "叫什么"];

// 追问类问题的模式（这类问题不应显示通用快捷选项，除非能智能分析出对应选项）
// 例如："哪个最常做？"、"最喜欢哪个？"、"哪个更X？"
const followUpPatterns = [
  /哪个[最更]?常/,        // 哪个最常做？哪个更常做？
  /哪个[最更]?喜欢/,       // 哪个最喜欢？
  /哪个[最更]?爱/,        // 哪个最爱？
  /[最更]常做/,          // 最常做的是？
  /[最更]喜欢哪/,         // 更喜欢哪个？
  /这几个.*哪/,          // 这几个里哪个？
  /涉猎.*哪/,           // 涉猎挺广，哪个？
  /都不错.*哪/,          // 都不错，哪个？
  /具体.*怎么/,          // 具体怎么xxx？
  /多久.*一次/,          // 多久去一次？
  /最近一次/,           // 最近一次是？
];

// 开场白/介绍类消息的关键词组合（这类消息不应显示快捷选项）
const introductionPatterns = [
  { required: ["欢迎来悦聚"], any: [] }, // 新开场白
  { required: ["欢迎", "流程"], any: [] },
  { required: ["你好", "小悦"], any: ["介绍", "开始", "帮你"] },
  { required: ["悦聚"], any: ["欢迎", "流程", "步骤", "开始", "小悦", "负责", "配局"] },
  { required: ["精品小局"], any: [] }, // 开场白片段
  { required: ["算法挑过"], any: [] }, // 开场白片段
  { required: ["陌生人组合"], any: [] }, // 开场白片段
  { required: ["分钟"], any: ["左右", "聊聊", "大概"] }, // 3分钟左右、6-7分钟
  { required: ["原型动物"], any: [] }, // 12原型动物匹配系统
  { required: ["怎么称呼"], any: [] }, // 昵称问题
  { required: ["极速模式"], any: [] }, // express模式开场
  { required: ["深度模式"], any: [] }, // deep模式开场
  { required: ["一键搞定"], any: [] }, // all_in_one模式开场
  { required: ["负责帮你配局"], any: [] }, // standard模式片段
  { required: ["值得投资"], any: [] } // deep模式片段
];

function isIntroductionMessage(message: string): boolean {
  const lowerMsg = message.toLowerCase();
  for (const pattern of introductionPatterns) {
    const allRequired = pattern.required.every(kw => lowerMsg.includes(kw.toLowerCase()));
    const hasAny = pattern.any.length === 0 || pattern.any.some(kw => lowerMsg.includes(kw.toLowerCase()));
    if (allRequired && hasAny) {
      return true;
    }
  }
  return false;
}

// 需要优先使用预定义选项的高优先级字段（不从AI文本提取）
const predefinedOptionKeywords = [
  "想要", "期待", "目的", "意图", "拓展人脉", "交朋友", "为什么来", // intent
  "性别", "男生", "女生", "小哥哥", "小姐姐", // gender
  "语言", "方言", "普通话", "粤语", // language
  "不聊", "避免", "敏感话题", // topic avoidances
  "孩子", "小孩", "娃", // children
  "学历", "毕业", // education
  "感情", "单身", "恋爱", "已婚", // relationship
  "兄弟", "姐妹", "独生", "排行", // siblings
  "时段", "工作日", "周末", "有空", "方便", // activity time preference
  "频率", "多久", "多频繁", "每周", "每月" // social frequency
];

// 检测是否是简单的是非问句（只匹配明确的二元选择问题）
function isYesNoQuestion(message: string): boolean {
  // 检查消息的最后一个问句
  const lastQuestion = message.split(/[。！\n]/).filter(s => s.includes('？') || s.includes('?')).pop();
  if (!lastQuestion) return false;
  
  const trimmed = lastQuestion.trim();
  
  // 排除过长的问句（复杂问题不适合简单是/否回答）
  if (trimmed.length > 30) return false;
  
  // 排除包含选项列举的问句（这些应该用其他方式处理）
  if (/[、，,]/.test(trimmed) || /还是/.test(trimmed)) return false;
  
  // 排除开放式问题（什么、哪里、怎么、为什么等疑问词）
  if (/什么|哪里|哪个|怎么|为什么|多少|几个|谁|何时|如何/.test(trimmed)) return false;
  
  // 匹配常见的是非问句模式
  const yesNoPatterns = [
    // 二元对比形式（允许中间有内容）
    /是不是.{0,15}[？?]$/,             // "是不是...？"
    /有没有.{0,15}[？?]$/,             // "有没有...？"
    /要不要.{0,15}[？?]$/,             // "要不要...？"
    /会不会.{0,15}[？?]$/,             // "会不会...？"
    /能不能.{0,15}[？?]$/,             // "能不能...？"
    /可不可以.{0,12}[？?]$/,           // "可不可以...？"
    // 简单"吗"结尾形式
    /对不对[？?]$/,                    // "对不对？"
    /好不好[？?]$/,                    // "好不好？"
    /可以吗[？?]$/,                    // "可以吗？"
    /方便吗[？?]$/,                    // "方便吗？"
    /介意吗[？?]$/,                    // "介意吗？"
    /行吗[？?]$/,                      // "行吗？"
    /好吗[？?]$/,                      // "好吗？"
    // 通用短句"吗"结尾（动词+宾语+吗，如"你会来吗"、"你能参加吗"）
    /[会能想要愿].*吗[？?]$/,          // "会...吗？"、"能...吗？"
    /[喜欢爱].{0,10}吗[？?]$/,         // "喜欢...吗？"
  ];
  
  return yesNoPatterns.some(pattern => pattern.test(trimmed));
}

// 检测最后一条消息是否匹配快捷回复
// 改进：对于有预定义选项的字段，优先使用预定义选项而不是从AI文本提取
function detectQuickReplies(lastMessage: string): QuickReplyResult {
  // 第负一步：检查是否是开场白/介绍类消息（不显示快捷选项）
  if (isIntroductionMessage(lastMessage)) {
    return { options: [], multiSelect: false };
  }
  
  // 第零步：检查是否需要用户自由输入（如称呼问题）
  const lowerMessage = lastMessage.toLowerCase();
  for (const kw of freeInputKeywords) {
    if (lowerMessage.includes(kw)) {
      // 这类问题需要用户自由输入，不显示快捷选项
      return { options: [], multiSelect: false };
    }
  }
  
  // 第0.5步：检查是否是追问类问题（不显示通用快捷选项）
  for (const pattern of followUpPatterns) {
    if (pattern.test(lastMessage)) {
      // 追问问题需要用户根据上下文回答，不显示通用选项
      return { options: [], multiSelect: false };
    }
  }
  
  // 第0.75步：检查是否是简单的是非问句
  if (isYesNoQuestion(lastMessage)) {
    return { 
      options: [
        { text: "是的", icon: Check },
        { text: "不是", icon: X }
      ], 
      multiSelect: false 
    };
  }
  
  // 第一步：检查是否匹配需要预定义选项的字段
  // 对于intent、gender等重要字段，必须使用预定义选项，不从AI文本提取
  const hasPredefinedKeyword = predefinedOptionKeywords.some(kw => lowerMessage.includes(kw));
  
  // 如果没有匹配预定义关键词，才尝试从消息中智能提取选项
  if (!hasPredefinedKeyword) {
    const extractedOptions = extractOptionsFromMessage(lastMessage);
    if (extractedOptions.length >= 2) {
      const multiSelect = shouldBeMultiSelect(extractedOptions, lastMessage);
      return { options: extractedOptions, multiSelect };
    }
  }
  
  // 第二步：使用关键词匹配预定义选项
  // 提取最后一个问句（以？结尾的句子）
  const questionMatches = lastMessage.match(/[^。！？\n]*[？?][^。！？\n]*/g);
  let textToAnalyze: string;
  
  if (questionMatches && questionMatches.length > 0) {
    // 取最后一个问句
    textToAnalyze = questionMatches[questionMatches.length - 1].trim();
  } else {
    // 没有问句时，取最后一段
    const segments = lastMessage.split(/\n/).filter(s => s.trim());
    textToAnalyze = segments.length > 0 ? segments[segments.length - 1] : lastMessage;
  }
  
  const lowerMsg = textToAnalyze.toLowerCase();
  
  const matches: Array<{ config: QuickReplyConfig; score: number }> = [];
  
  for (const config of quickReplyConfigs) {
    let maxPosition = -1;
    let foundCount = 0;
    
    // 找到该配置中所有关键词在消息中最后出现的位置
    // 注意：将关键词也转为小写以进行不区分大小写的匹配
    for (const kw of config.keywords) {
      const pos = lowerMsg.lastIndexOf(kw.toLowerCase());
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
  id: string; // 稳定的消息ID
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isTypingAnimation?: boolean; // 是否正在逐字显示
  streamId?: string; // 流式消息的唯一标识
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

// 单行气泡组件
function SingleBubble({ 
  content, 
  role, 
  showAvatar, 
  emotion, 
  userGender, 
  collectedInfo,
  isTyping
}: { 
  content: string;
  role: "user" | "assistant";
  showAvatar: boolean;
  emotion: XiaoyueEmotion;
  userGender?: string;
  collectedInfo?: CollectedInfo;
  isTyping?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 ${role === "user" ? "flex-row-reverse" : ""}`}
    >
      {role === "assistant" ? (
        showAvatar ? (
          <XiaoyueAvatar emotion={emotion} />
        ) : (
          <div className="w-8 flex-shrink-0" />
        )
      ) : (
        <EvolvingAvatar 
          clarityLevel={calculateClarityLevel(collectedInfo || {})}
          gender={userGender === '女性' || userGender === '女生' ? 'female' : userGender === '男性' || userGender === '男生' ? 'male' : 'unknown'}
          size={36}
        />
      )}
      <Card className={`max-w-[80%] p-3 ${
        role === "user" 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      }`}>
        <p className="text-sm whitespace-pre-wrap">
          {content}
          {isTyping && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </p>
      </Card>
    </motion.div>
  );
}

// 单条消息组件（支持打字效果和小悦表情）
// 对于AI消息，每行成为单独的气泡
function MessageBubble({ 
  message, 
  isLatest,
  userGender,
  collectedInfo,
  onTypingComplete,
  onSequentialDisplayComplete
}: { 
  message: ChatMessage; 
  isLatest: boolean;
  userGender?: string;
  collectedInfo?: CollectedInfo;
  onTypingComplete?: () => void;
  onSequentialDisplayComplete?: () => void;
}) {
  // 空消息或短消息（≤15字）跳过打字动画
  const isEmptyMessage = !message.content.trim();
  const isShortMessage = message.content.length <= 15;
  const shouldAnimate = message.role === "assistant" && isLatest && message.isTypingAnimation && !isShortMessage && !isEmptyMessage;
  const { displayedText, isComplete } = useTypingEffect(
    message.content, 
    shouldAnimate || false,
    30 // 每个字30ms - 增加呼吸感
  );

  // Ref guard to ensure onTypingComplete is called exactly once per message
  const hasCalledCompleteRef = useRef(false);
  
  // Reset the guard when message content changes
  useEffect(() => {
    hasCalledCompleteRef.current = false;
  }, [message.content]);
  
  // Call onTypingComplete when:
  // 1. Typing animation completes naturally (isComplete && shouldAnimate)
  // 2. OR message had isTypingAnimation=true but it became false (interrupted or short message)
  useEffect(() => {
    if (hasCalledCompleteRef.current) return;
    
    // Natural completion: typing finished while still animating
    if (isComplete && shouldAnimate && onTypingComplete) {
      hasCalledCompleteRef.current = true;
      onTypingComplete();
    }
  }, [isComplete, shouldAnimate, onTypingComplete]);
  
  // Handle case where message.isTypingAnimation becomes false (marked as completed externally)
  useEffect(() => {
    if (hasCalledCompleteRef.current) return;
    
    // If this was an assistant message that was supposed to animate but isTypingAnimation is now false
    // (either short message or interrupted), call completion
    if (message.role === "assistant" && !message.isTypingAnimation && onTypingComplete) {
      hasCalledCompleteRef.current = true;
      onTypingComplete();
    }
  }, [message.role, message.isTypingAnimation, onTypingComplete]);

  const content = shouldAnimate ? displayedText : message.content;
  const emotion = message.role === "assistant" ? detectEmotion(message.content) : "neutral";

  // 用户消息：单个气泡
  if (message.role === "user") {
    return (
      <SingleBubble
        content={content}
        role="user"
        showAvatar={true}
        emotion={emotion}
        userGender={userGender}
        collectedInfo={collectedInfo}
      />
    );
  }

  // AI消息：当打字完成后，将多行内容分割成独立气泡
  // 打字期间保持单气泡，完成后展开成多气泡提升可读性
  const hasCalledSequentialCompleteRef = useRef(false);
  
  // 重置：当消息内容变化时重置回调标记
  useEffect(() => {
    hasCalledSequentialCompleteRef.current = false;
  }, [message.content]);
  
  // 打字完成后触发回调
  useEffect(() => {
    if (!hasCalledSequentialCompleteRef.current && (!shouldAnimate || isComplete)) {
      hasCalledSequentialCompleteRef.current = true;
      onSequentialDisplayComplete?.();
    }
  }, [shouldAnimate, isComplete, onSequentialDisplayComplete]);
  
  // 打字完成后分割成多行气泡
  const isTypingComplete = !shouldAnimate || isComplete;
  const lines = isTypingComplete 
    ? message.content.split('\n').filter(line => line.trim() !== '')
    : [content];
  
  // 如果只有一行或者还在打字中，显示单气泡
  if (lines.length <= 1 || !isTypingComplete) {
    return (
      <SingleBubble
        content={content}
        role="assistant"
        showAvatar={true}
        emotion={emotion}
        userGender={userGender}
        collectedInfo={collectedInfo}
        isTyping={shouldAnimate && !isComplete}
      />
    );
  }
  
  // 多行内容：分割成独立气泡，只有第一个显示头像
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.2 }}
        >
          <SingleBubble
            content={line}
            role="assistant"
            showAvatar={index === 0}
            emotion={emotion}
            userGender={userGender}
            collectedInfo={collectedInfo}
          />
        </motion.div>
      ))}
    </div>
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
  intent?: string[];
  hasPets?: boolean;
  petTypes?: string[];
  hasSiblings?: boolean;
  relationshipStatus?: string;
  hometown?: string;
  languagesComfort?: string[];
  cuisinePreference?: string[];
  favoriteRestaurant?: string;
  favoriteRestaurantReason?: string;
  children?: string;
  educationLevel?: string;
  fieldOfStudy?: string;
  lifeStage?: string;
  ageMatchPreference?: string;
  ageDisplayPreference?: string;
  studyLocale?: string;
  overseasRegions?: string[];
  icebreakerRole?: string;
  energyRecovery?: string;
  industry?: string;
  roleTitleShort?: string;
  registrationStartTime?: string;
  activityTimePreference?: string;
  socialFrequency?: string;
}

// 可选兴趣标签 - 直接使用问卷数据源
const interestOptions = INTERESTS_OPTIONS.map(opt => opt.label);

// 模式标签配置
const MODE_LABELS: Record<RegistrationMode, { icon: any; label: string; color: string }> = {
  express: { icon: Zap, label: "极速模式", color: "bg-yellow-400/20 text-yellow-200 border-yellow-400/30" },
  standard: { icon: Sun, label: "标准模式", color: "bg-blue-400/20 text-blue-200 border-blue-400/30" },
  deep: { icon: Diamond, label: "深度模式", color: "bg-purple-300/20 text-purple-200 border-purple-300/30" },
  all_in_one: { icon: Star, label: "一站式", color: "bg-pink-400/20 text-pink-200 border-pink-400/30" },
  enrichment: { icon: Edit2, label: "资料补充", color: "bg-green-400/20 text-green-200 border-green-400/30" }
};

// 社交名片卡片组件 - 紫色渐变商务卡片风格
function SocialProfileCard({ info, mode }: { info: CollectedInfo; mode?: RegistrationMode }) {
  const getYearLabel = (year?: number) => {
    if (!year) return "";
    if (year >= 2000) return "00后";
    if (year >= 1995) return "95后";
    if (year >= 1990) return "90后";
    if (year >= 1985) return "85后";
    return `${year}年`;
  };

  const getGenderIcon = () => {
    if (info.gender === "女性" || info.gender === "女生") return "♀";
    if (info.gender === "男性" || info.gender === "男生") return "♂";
    return "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="relative w-full max-w-[85%] mx-auto my-2"
      data-testid="social-profile-card"
    >
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-4 shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        
        <motion.div 
          className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-8 -left-8 w-24 h-24 bg-pink-400/20 rounded-full blur-xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        <div className="relative z-10 flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
              <span className="text-2xl font-bold text-white">
                {info.displayName?.charAt(0) || "?"}
              </span>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-white truncate">
                {info.displayName || "神秘访客"}
              </h3>
              {getGenderIcon() && (
                <span className="text-white/80 text-sm">{getGenderIcon()}</span>
              )}
              {info.birthYear && (
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                  {getYearLabel(info.birthYear)}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1 text-white/80 text-sm">
              {info.currentCity && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {info.currentCity}
                </span>
              )}
              {info.occupationDescription && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {info.occupationDescription}
                  </span>
                </>
              )}
            </div>

            {info.interestsTop && info.interestsTop.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {info.interestsTop.map((interest, i) => {
                  const isPrimary = info.primaryInterests?.includes(interest);
                  return (
                    <motion.span 
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={`text-xs px-2 py-0.5 rounded-full backdrop-blur-sm border flex items-center gap-1 ${
                        isPrimary 
                          ? "bg-yellow-400/25 text-yellow-100 border-yellow-400/40" 
                          : "bg-white/15 text-white/90 border-white/10"
                      }`}
                    >
                      {isPrimary && <Star className="w-2.5 h-2.5 fill-yellow-300 text-yellow-300" />}
                      {interest}
                    </motion.span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 模式水印 */}
        <div className="absolute top-2 right-2">
          {mode && MODE_LABELS[mode] ? (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-sm ${MODE_LABELS[mode].color}`}
            >
              {(() => {
                const IconComp = MODE_LABELS[mode].icon;
                return <IconComp className="w-3 h-3" />;
              })()}
              <span>{MODE_LABELS[mode].label}</span>
            </motion.div>
          ) : (
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sparkles className="w-4 h-4 text-yellow-300/70" />
            </motion.div>
          )}
        </div>

        {/* 已解锁的成就徽章 */}
        {(() => {
          const earnedBadges = achievements.filter(a => 
            a.condition(info) || 
            (a.modeCondition && a.modeCondition(mode))
          );
          
          if (earnedBadges.length === 0) return null;
          
          return (
            <div className="relative z-10 mt-3 pt-3 border-t border-white/20">
              <div className="flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3 text-yellow-300/80" />
                <span className="text-[10px] text-white/70">已解锁徽章</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {earnedBadges.map((badge, i) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 400 }}
                    className="inline-flex items-center gap-0.5 bg-white/15 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/20"
                    title={badge.title}
                  >
                    <span className="text-xs leading-none">{badge.icon}</span>
                    <span className="text-[9px] text-white/90 leading-none">{badge.title}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}

// localStorage key for conversation persistence
const CHAT_STORAGE_KEY = 'joyjoin_chat_registration_state';

interface SavedChatState {
  messages: ChatMessage[];
  conversationHistory: any[];
  collectedInfo: CollectedInfo;
  selectedMode: RegistrationMode;
  savedAt: string;
}

// Helper to save chat state to localStorage
function saveChatState(state: Omit<SavedChatState, 'savedAt'>) {
  try {
    const saveData: SavedChatState = {
      ...state,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(saveData));
  } catch (e) {
    console.warn('Failed to save chat state:', e);
  }
}

// Helper to load saved chat state
function loadSavedChatState(): SavedChatState | null {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!saved) return null;
    
    const state = JSON.parse(saved) as SavedChatState;
    
    // Check if saved state is less than 24 hours old
    const savedAt = new Date(state.savedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      return null;
    }
    
    // Restore Date objects in messages
    state.messages = state.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
    
    // 为遗留会话补充registrationStartTime（使用savedAt作为近似值）
    if (!state.collectedInfo.registrationStartTime) {
      state.collectedInfo.registrationStartTime = state.savedAt;
    }
    
    return state;
  } catch (e) {
    console.warn('Failed to load saved chat state:', e);
    return null;
  }
}

// Helper to clear saved chat state
function clearSavedChatState() {
  try {
    localStorage.removeItem(CHAT_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear chat state:', e);
  }
}

export default function ChatRegistrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSequentialDisplaying, setIsSequentialDisplaying] = useState(false); // 正在逐行显示中
  const [sequentialDisplayMessageId, setSequentialDisplayMessageId] = useState<string | null>(null); // 正在逐行显示的消息ID
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  
  // 防护性超时：确保 isSequentialDisplaying 不会永远卡住
  // 根据消息行数动态计算超时时间：每行350ms + 3秒缓冲
  useEffect(() => {
    if (isSequentialDisplaying && sequentialDisplayMessageId) {
      // 找到目标消息并计算所需时间
      const targetMessage = messages.find(m => m.id === sequentialDisplayMessageId);
      if (!targetMessage) {
        // 消息不存在，立即重置
        setIsSequentialDisplaying(false);
        setSequentialDisplayMessageId(null);
        return;
      }
      
      // 计算消息行数和所需显示时间
      const lines = targetMessage.content.split('\n').filter(line => line.trim() !== '');
      const lineCount = lines.length;
      // 使用 (lineCount + 2) * 350 + 6秒大缓冲，确保覆盖极端情况
      // 例如：30行消息需要 (30+2)*350 + 6000 = 17200ms
      const dynamicTimeout = Math.max((lineCount + 2) * 350 + 6000, 8000);
      
      const timeout = setTimeout(() => {
        console.log('[SEQUENTIAL DEBUG] Safety timeout triggered after', dynamicTimeout, 'ms, resetting isSequentialDisplaying');
        setIsSequentialDisplaying(false);
        setSequentialDisplayMessageId(null);
        setSelectedQuickReplies(new Set());
      }, dynamicTimeout);
      return () => clearTimeout(timeout);
    }
  }, [isSequentialDisplaying, sequentialDisplayMessageId, messages]);
  
  // Debug: Log messages state changes
  useEffect(() => {
    console.log('[DEBUG] Messages state changed:', messages.length, 'messages');
    messages.forEach((m, i) => {
      console.log(`[DEBUG] Message ${i}: role=${m.role}, content="${m.content?.substring(0, 30)}...", streamId=${m.streamId || 'none'}`);
    });
  }, [messages]);
  const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});
  const [isComplete, setIsComplete] = useState(false);
  const [infoConfirmed, setInfoConfirmed] = useState(false); // 用户确认信息无误
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 断点续聊状态
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedState, setSavedState] = useState<SavedChatState | null>(null);
  
  // 检查URL参数是否有预设模式（从其他页面跳转时使用）
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const presetMode = urlParams.get('mode') as RegistrationMode | null;
  const isEnrichmentMode = presetMode === 'enrichment';
  
  // 获取用户数据（仅在enrichment模式下需要）
  const { data: userData, isLoading: isUserDataLoading } = useQuery<UserType>({
    queryKey: ['/api/auth/user'],
    enabled: isEnrichmentMode,
  });
  
  // Enrichment模式加载状态
  const isEnrichmentLoading = isEnrichmentMode && (isUserDataLoading || !userData);
  
  // 计算enrichment上下文（基于用户数据）
  const enrichmentContext = useMemo(() => {
    if (!isEnrichmentMode || !userData) return null;
    return calculateMissingFields(userData);
  }, [isEnrichmentMode, userData]);
  
  // 模式选择状态
  const [showModeSelection, setShowModeSelection] = useState(!presetMode);
  const [selectedMode, setSelectedMode] = useState<RegistrationMode | null>(presetMode);
  
  // 时间主题
  const timeTheme = useMemo(() => getTimeTheme(), []);
  const themeConfig = timeThemeConfig[timeTheme];
  
  // 多选快捷回复状态
  const [selectedQuickReplies, setSelectedQuickReplies] = useState<Set<string>>(new Set());
  // 快捷回复分页状态
  const [quickReplyPage, setQuickReplyPage] = useState(0);
  const QUICK_REPLY_PAGE_SIZE = 4; // 每页最多显示4个选项
  
  // 成就系统状态
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  
  
  // 对话开始时间（用于计算completionSpeed）
  const [chatStartTime] = useState<string>(() => new Date().toISOString());
  
  // 处理模式选择
  const handleModeSelect = (mode: RegistrationMode) => {
    setSelectedMode(mode);
    setShowModeSelection(false);
    // 开始对话，传入模式
    startChatMutation.mutate({ mode, enrichmentContext: null });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 信息收集进度
  const infoCount = Object.keys(collectedInfo).filter(k => 
    collectedInfo[k as keyof CollectedInfo] !== undefined
  ).length;
  
  // 动态背景渐变（随聊天进度变暖）
  const warmthGradient = useMemo(() => getWarmthGradient(infoCount), [infoCount]);

  // 成就检测
  useEffect(() => {
    for (const achievement of achievements) {
      if (!unlockedAchievements.has(achievement.id) && achievement.condition(collectedInfo)) {
        setUnlockedAchievements(prev => {
          const newSet = new Set(Array.from(prev));
          newSet.add(achievement.id);
          return newSet;
        });
        setCurrentAchievement(achievement);
        break; // 一次只显示一个成就
      }
    }
  }, [collectedInfo, unlockedAchievements]);

  // AbortController for opening message sequence
  const openingAbortRef = useRef<AbortController | null>(null);
  
  // Typing completion promise resolver for sequential message display
  const typingCompleteResolverRef = useRef<(() => void) | null>(null);
  
  // 清理资源在组件卸载时
  useEffect(() => {
    return () => {
      // 取消开场白序列
      openingAbortRef.current?.abort();
    };
  }, []);
  
  // 检查是否有保存的对话状态（断点续聊）
  useEffect(() => {
    // 如果有预设模式（从其他页面跳转），不检查保存状态
    if (presetMode) return;
    
    const saved = loadSavedChatState();
    if (saved && saved.messages.length > 0) {
      setSavedState(saved);
      setShowResumePrompt(true);
      setShowModeSelection(false); // 隐藏模式选择，显示续聊提示
    }
  }, [presetMode]);
  
  // 恢复保存的对话状态
  const handleResumeChat = () => {
    if (!savedState) return;
    
    setMessages(savedState.messages);
    setConversationHistory(savedState.conversationHistory);
    setCollectedInfo(savedState.collectedInfo);
    setSelectedMode(savedState.selectedMode);
    setShowResumePrompt(false);
    setShowModeSelection(false);
    
    toast({
      title: "对话已恢复",
      description: "继续和小悦聊天吧",
    });
  };
  
  // 开始新对话（清除保存状态）
  const handleStartFresh = () => {
    clearSavedChatState();
    setSavedState(null);
    setShowResumePrompt(false);
    setShowModeSelection(true);
  };
  
  // 保存对话状态（每次消息更新时调用）
  useEffect(() => {
    // 只有当对话已开始且有消息时才保存
    // 不在续聊提示显示时保存，避免覆盖
    if (selectedMode && messages.length > 0 && !isComplete && !showResumePrompt) {
      saveChatState({
        messages,
        conversationHistory,
        collectedInfo,
        selectedMode,
      });
    }
  }, [messages, conversationHistory, collectedInfo, selectedMode, isComplete, showResumePrompt]);
  
  // 如果有预设模式（从URL参数），自动开始对话
  const hasStartedFromPreset = useRef(false);
  useEffect(() => {
    if (presetMode && !hasStartedFromPreset.current) {
      // 对于enrichment模式，等待用户数据加载完成
      if (isEnrichmentMode && !enrichmentContext) return;
      
      hasStartedFromPreset.current = true;
      startChatMutation.mutate({ mode: presetMode, enrichmentContext });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetMode, isEnrichmentMode, enrichmentContext]);

  const startChatMutation = useMutation({
    mutationFn: async ({ mode, enrichmentContext: ctx }: { mode: RegistrationMode; enrichmentContext?: EnrichmentContext | null }) => {
      // 防护：enrichment模式必须有context
      if (mode === 'enrichment' && !ctx) {
        throw new Error('Enrichment mode requires context');
      }
      
      const payload: any = { mode };
      if (mode === 'enrichment' && ctx) {
        payload.enrichmentContext = ctx;
      }
      const res = await apiRequest("POST", "/api/registration/chat/start", payload);
      return res.json();
    },
    onSuccess: (data) => {
      // 记录注册开始时间（用于时间徽章判断）
      setCollectedInfo(prev => ({
        ...prev,
        registrationStartTime: new Date().toISOString()
      }));
      
      // 取消之前正在进行的开场白序列
      openingAbortRef.current?.abort();
      const abortController = new AbortController();
      openingAbortRef.current = abortController;
      
      // 将开场白按行分割，每行作为独立气泡，每个气泡带逐字打印动画
      const fullMessage = data.message as string;
      const paragraphs = fullMessage.split('\n').filter(p => p.trim());
      
      // 逐条显示开场白，每条带打字动画
      // 使用回调+安全超时的混合策略
      const showParagraphsSequentially = async () => {
        for (let i = 0; i < paragraphs.length; i++) {
          // 检查是否被取消
          if (abortController.signal.aborted) return;
          
          // 添加当前段落消息（带打字动画）
          const messageId = `msg-${Date.now()}-${i}`;
          setMessages(prev => [...prev, {
            id: messageId,
            role: "assistant",
            content: paragraphs[i],
            timestamp: new Date(),
            isTypingAnimation: true
          }]);
          
          // 等待打字动画完成（通过回调或安全超时）
          // 安全超时 = 内容长度 * 30ms + 2000ms 缓冲（考虑渲染延迟）
          const safetyTimeout = paragraphs[i].length * 30 + 2000;
          
          await new Promise<void>((resolve, reject) => {
            // 设置回调resolver，会被onTypingComplete调用
            typingCompleteResolverRef.current = () => {
              typingCompleteResolverRef.current = null;
              resolve();
            };
            
            // 安全超时作为fallback
            const timeoutId = setTimeout(() => {
              if (typingCompleteResolverRef.current) {
                typingCompleteResolverRef.current = null;
                resolve();
              }
            }, safetyTimeout);
            
            // 处理取消
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              typingCompleteResolverRef.current = null;
              reject(new Error('Aborted'));
            }, { once: true });
          }).catch(() => {});
          
          if (abortController.signal.aborted) return;
          
          // 添加300ms间隔让用户有阅读缓冲
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, 300);
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('Aborted'));
            }, { once: true });
          }).catch(() => {});
        }
      };
      
      showParagraphsSequentially();
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
    let streamedContent = '';
    let lastValidContent = ''; // 追踪最后一次有效的非空内容
    // 使用唯一ID来标识这条流式消息
    const streamMessageId = `stream-${Date.now()}`;
    
    // 防护：检查conversationHistory是否已初始化
    if (!conversationHistory || conversationHistory.length === 0) {
      toast({
        title: "准备中",
        description: "小悦还在准备回复，请稍候...",
        variant: "destructive"
      });
      setIsTyping(false);
      return;
    }
    
    // 添加一个带唯一ID的空消息
    console.log('[STREAM DEBUG] Creating empty message with streamId:', streamMessageId);
    setMessages(prev => {
      console.log('[STREAM DEBUG] Current messages count:', prev.length);
      return [...prev, {
        id: streamMessageId,
        role: "assistant",
        content: '',
        timestamp: new Date(),
        isTypingAnimation: false,
        streamId: streamMessageId
      }];
    });

    try {
      console.log('[STREAM DEBUG] Starting fetch with conversationHistory length:', conversationHistory?.length);
      const res = await fetch("/api/registration/chat/message/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationHistory }),
        credentials: "include"
      });

      console.log('[STREAM DEBUG] Fetch response received, status:', res.status);
      if (!res.ok) throw new Error('Stream request failed');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader available');
      console.log('[STREAM DEBUG] Got reader, starting to read stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let finalConversationHistory: any[] | null = null;
      
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
                  // 实时过滤代码块
                  let cleanContent = streamedContent
                    .replace(/```collected_info[\s\S]*?```/g, '')
                    .replace(/```registration_complete[\s\S]*?```/g, '')
                    .replace(/```collected_info[\s\S]*$/g, '')
                    .replace(/```registration_complete[\s\S]*$/g, '')
                    .replace(/```[a-z_]*\s*$/g, '')
                    .trim();
                  
                  if (cleanContent) {
                    lastValidContent = cleanContent;
                    // 实时更新消息内容（每次有新内容就更新）
                    const contentToUse = cleanContent;
                    setMessages(prev => prev.map(m => 
                      m.streamId === streamMessageId 
                        ? { ...m, content: contentToUse } 
                        : m
                    ));
                  }
                } else if (data.type === 'done') {
                  console.log('[STREAM DEBUG] Done event received');
                  // 保存conversationHistory
                  if (data.conversationHistory) {
                    finalConversationHistory = data.conversationHistory;
                    setConversationHistory(data.conversationHistory);
                  }
                  // 使用后端返回的cleanMessage作为最终内容
                  const finalContent = data.cleanMessage || lastValidContent;
                  if (finalContent) {
                    lastValidContent = finalContent;
                    // 流式完成：清除 streamId 触发逐行显示，同时设置 isSequentialDisplaying
                    // 保存触发逐行显示的消息 ID，确保回调匹配
                    setIsSequentialDisplaying(true);
                    setSequentialDisplayMessageId(streamMessageId);
                    setMessages(prev => prev.map(m => 
                      m.streamId === streamMessageId 
                        ? { ...m, content: finalContent, streamId: undefined } 
                        : m
                    ));
                  }
                  if (data.collectedInfo) {
                    setCollectedInfo(prev => ({ ...prev, ...data.collectedInfo }));
                  }
                  if (data.isComplete) {
                    setIsComplete(true);
                    clearSavedChatState(); // 完成后清除保存的对话状态
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.content || '请求失败');
                }
              } catch (parseError) {
                console.log('[STREAM DEBUG] Parse error for line:', line, parseError);
              }
            }
          }
        }
      }
      
      console.log('[STREAM DEBUG] Stream ended. lastValidContent:', lastValidContent?.substring(0, 50));
      // 流结束后，如果消息内容仍为空，从conversationHistory中提取AI的最新回复
      if (!lastValidContent && finalConversationHistory && finalConversationHistory.length > 0) {
        // 找到最后一条assistant消息
        const lastAssistantMsg = [...finalConversationHistory].reverse().find(
          (msg: any) => msg.role === 'assistant'
        );
        if (lastAssistantMsg && lastAssistantMsg.content) {
          // 过滤代码块后提取可见内容
          let fallbackContent = lastAssistantMsg.content
            .replace(/```collected_info[\s\S]*?```/g, '')
            .replace(/```registration_complete[\s\S]*?```/g, '')
            .trim();
          
          if (fallbackContent) {
            setMessages(prev => prev.map(m => {
              if (m.streamId === streamMessageId) {
                return { ...m, content: fallbackContent };
              }
              return m;
            }));
          } else {
            // 如果过滤后仍为空，移除这条空消息
            setMessages(prev => prev.filter(m => m.streamId !== streamMessageId));
          }
        }
      }
    } catch (error) {
      // 根据streamId移除失败的消息
      setMessages(prev => prev.filter(m => m.streamId !== streamMessageId));
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
      console.log('[MUTATION DEBUG] Starting sendStreamingMessage for:', message);
      await sendStreamingMessage(message);
      console.log('[MUTATION DEBUG] Completed sendStreamingMessage');
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
      // 导航到性格测试页面
      setLocation("/personality-test");
    },
    onError: () => {
      toast({
        title: "提交失败",
        description: "请稍后再试",
        variant: "destructive"
      });
    }
  });

  // 不再自动开始对话，由模式选择触发

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
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
  // 只有当不在API请求中、且消息有内容时才检测
  // 开场白序列（前4条消息）需等待逐行显示完成，后续消息不等待打字动画
  // 特殊情况：isComplete但未确认时仍需显示确认选项
  const quickReplyResult = useMemo(() => {
    if (isTyping || messages.length === 0) return { options: [], multiSelect: false };
    // 用户第一条消息发送前不显示快捷选项（开场白期间）
    const userMsgCount = messages.filter(m => m.role === 'user').length;
    if (userMsgCount === 0) return { options: [], multiSelect: false };
    // 开场白期间（前4条助手消息）需要等待逐行显示完成，避免过早显示选项
    const assistantMsgCount = messages.filter(m => m.role === 'assistant').length;
    if (isSequentialDisplaying && assistantMsgCount <= 4) return { options: [], multiSelect: false };
    // 已确认后不再显示快捷选项
    if (isComplete && infoConfirmed) return { options: [], multiSelect: false };
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    // 只有当消息有实际内容时才显示快捷选项
    if (!lastAssistantMessage || !lastAssistantMessage.content.trim()) return { options: [], multiSelect: false };
    return detectQuickReplies(lastAssistantMessage.content);
  }, [messages, isTyping, isComplete, infoConfirmed, isSequentialDisplaying]);

  // 当问题变化时清空已选并重置分页
  useEffect(() => {
    setSelectedQuickReplies(new Set());
    setQuickReplyPage(0);
  }, [quickReplyResult.options]);

  // 性格测试介绍消息（根据性别差异化语气）
  const personalityTestIntro = useMemo(() => {
    const gender = collectedInfo.gender?.toLowerCase() || '';
    const isFemale = gender.includes('女') || gender === 'female';
    const isMale = gender.includes('男') || gender === 'male';
    
    if (isFemale) {
      // Nick对Judy风格：温柔可靠的大哥哥感
      return `妥了，基础信息收好啦～

接下来是性格测试——12道题，2分钟搞定。

这个能测出你的社交原型，帮我把你配到chemistry对的人旁边。放心，值得花这点时间。`;
    } else if (isMale) {
      // 兄弟模式：街头老狐狸风格
      return `稳了。基础信息到手。

接下来是性格测试——12道题，2分钟搞定。

这玩意能测出你的社交原型，帮我把你配到chemistry对的桌子上。值得花这两分钟。`;
    } else {
      // 性别未知时使用中性风格
      return `好，基础信息收到。

接下来是性格测试——12道题，2分钟搞定。

这个能测出你的社交原型，帮我把你配到chemistry对的桌子上。值得花这两分钟。`;
    }
  }, [collectedInfo.gender]);

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
    
    // 特殊处理：用户确认信息无误
    if (text === "确认无误" && isComplete && !infoConfirmed) {
      // 添加用户确认消息
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date()
      }]);
      
      // 添加小悦的性格测试介绍（延迟显示以模拟思考）
      setTimeout(() => {
        const introMsgId = `msg-intro-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: introMsgId,
          role: "assistant",
          content: personalityTestIntro,
          timestamp: new Date()
        }]);
        // 启用逐行显示
        setIsSequentialDisplaying(true);
        setSequentialDisplayMessageId(introMsgId);
        // 确认完成后设置状态
        setInfoConfirmed(true);
      }, 500);
      return;
    }
    
    // 单选模式，立即发送
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
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
      id: `msg-${Date.now()}`,
      role: "user",
      content: selectedText,
      timestamp: new Date()
    }]);
    setSelectedQuickReplies(new Set());
    setIsTyping(true);
    sendMessageMutation.mutate(selectedText);
  };

  const TimeIcon = themeConfig.icon;

  // 显示断点续聊提示
  if (showResumePrompt && savedState) {
    const savedMessageCount = savedState.messages.length;
    const savedInfoCount = Object.keys(savedState.collectedInfo).filter(k => 
      savedState.collectedInfo[k as keyof CollectedInfo] !== undefined
    ).length;
    const savedTime = new Date(savedState.savedAt);
    const timeAgo = Math.floor((new Date().getTime() - savedTime.getTime()) / (1000 * 60));
    const timeAgoText = timeAgo < 60 
      ? `${timeAgo}分钟前` 
      : timeAgo < 1440 
        ? `${Math.floor(timeAgo / 60)}小时前` 
        : '昨天';

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full"
        >
          <Card className="border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-muted mx-auto flex items-center justify-center">
                  <RotateCcw className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">发现未完成的对话</h2>
                <p className="text-sm text-muted-foreground">
                  {timeAgoText}你和小悦聊了{savedMessageCount}条消息，已收集{savedInfoCount}项信息
                </p>
              </div>
              
              <div className="space-y-2">
                <Button 
                  className="w-full" 
                  onClick={handleResumeChat}
                  data-testid="button-resume-chat"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  继续聊天
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={handleStartFresh}
                  data-testid="button-start-fresh"
                >
                  重新开始
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // 显示enrichment模式加载界面
  if (isEnrichmentLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">正在加载你的资料...</h2>
            <p className="text-sm text-muted-foreground">马上就好～</p>
          </div>
        </motion.div>
      </div>
    );
  }

  // 显示模式选择界面
  if (showModeSelection) {
    return (
      <div className="min-h-screen bg-background">
        <ModeSelectionScreen onSelectMode={handleModeSelect} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden`}>
      {/* 动态背景渐变层 - 随聊天进度变暖 */}
      <motion.div 
        className={`absolute inset-0 bg-gradient-to-b ${warmthGradient} pointer-events-none z-0`}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        key={warmthGradient}
      />
      {/* 时间主题背景层 */}
      <div className={`absolute inset-0 bg-gradient-to-b ${themeConfig.gradient} pointer-events-none z-0 opacity-50`} />
      
      <div className="relative z-10 flex flex-col min-h-screen">
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
      
      {/* 实时标签云 */}
      {infoCount >= 3 && !isComplete && (
        <TagCloud info={collectedInfo} />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatest={msg === messages[messages.length - 1]}
              userGender={collectedInfo.gender}
              collectedInfo={collectedInfo}
              onTypingComplete={() => {
                // 标记该消息的打字动画已完成
                setMessages(prev => prev.map((m) => 
                  m.id === msg.id ? { ...m, isTypingAnimation: false } : m
                ));
                // 通知等待中的开场白序列可以继续
                if (typingCompleteResolverRef.current) {
                  typingCompleteResolverRef.current();
                  typingCompleteResolverRef.current = null;
                }
              }}
              onSequentialDisplayComplete={() => {
                // 只有当这条消息是触发逐行显示的那条消息时，才结束逐行显示状态
                if (sequentialDisplayMessageId && sequentialDisplayMessageId === msg.id) {
                  setIsSequentialDisplaying(false);
                  setSequentialDisplayMessageId(null);
                }
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

        {isComplete && collectedInfo.displayName && (
          <SocialProfileCard info={collectedInfo} mode={selectedMode || undefined} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快捷回复气泡 */}
      <AnimatePresence>
        {quickReplyResult.options.length > 0 && !isTyping && (() => {
          // 计算分页后的选项
          const allOptions = quickReplyResult.options;
          const needsPagination = quickReplyResult.multiSelect && allOptions.length > QUICK_REPLY_PAGE_SIZE;
          const totalPages = needsPagination ? Math.ceil(allOptions.length / QUICK_REPLY_PAGE_SIZE) : 1;
          const currentPage = Math.min(quickReplyPage, totalPages - 1);
          const displayOptions = needsPagination 
            ? allOptions.slice(currentPage * QUICK_REPLY_PAGE_SIZE, (currentPage + 1) * QUICK_REPLY_PAGE_SIZE)
            : allOptions;
          
          return (
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
                {displayOptions.map((reply, index) => {
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
                
                {/* 换一批按钮 - 多选且有多页时显示 */}
                {needsPagination && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: displayOptions.length * 0.05 }}
                    onClick={() => setQuickReplyPage((currentPage + 1) % totalPages)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-all text-sm"
                    data-testid="button-more-options"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>换一批</span>
                  </motion.button>
                )}
                
                {/* 自己输入按钮 - 多选时显示 */}
                {quickReplyResult.multiSelect && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (displayOptions.length + (needsPagination ? 1 : 0)) * 0.05 }}
                    onClick={() => {
                      // 聚焦到输入框
                      const inputEl = document.querySelector('input[data-testid="input-message"]') as HTMLInputElement;
                      if (inputEl) inputEl.focus();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-all text-sm"
                    data-testid="button-custom-input"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>自己输入</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {isComplete && infoConfirmed ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-t bg-muted/50"
        >
          <div className="text-center mb-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span>基础信息已收集完成</span>
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
          </div>
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
            开始性格测试
          </Button>
        </motion.div>
      ) : isComplete && !infoConfirmed ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-t bg-background"
        >
          <p className="text-xs text-center text-muted-foreground mb-3">
            请确认以上信息是否正确
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => {
                // 发送需要修改的消息，重新进入对话模式
                setIsComplete(false);
                sendMessageMutation.mutate("需要修改一些信息");
              }}
              data-testid="button-need-modify"
            >
              <Pencil className="w-4 h-4 mr-2" />
              需要修改
            </Button>
            <Button
              className="flex-1 h-11 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-lg"
              onClick={() => {
                setInfoConfirmed(true);
              }}
              data-testid="button-confirm-info"
            >
              <Check className="w-4 h-4 mr-2" />
              确认正确
            </Button>
          </div>
        </motion.div>
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
      
      {/* 成就弹窗 */}
      <AnimatePresence>
        {currentAchievement && (
          <AchievementToast 
            achievement={currentAchievement} 
            onComplete={() => setCurrentAchievement(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
