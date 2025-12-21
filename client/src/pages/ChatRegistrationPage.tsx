import { useState, useRef, useEffect, useMemo, memo, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Users, Sparkles, ArrowRight, Smile, Heart, Briefcase, MapPin, Coffee, Music, Gamepad2, Camera, Book, Dumbbell, Sun, Moon, Star, Edit2, Check, X, Zap, Clock, Diamond, RotateCcw, MessageCircle, AlertCircle, Pencil, Calendar, CalendarDays, Laptop, Bot, Cpu, Car, Globe, TrendingUp, Megaphone, Palette, Video, Stethoscope, GraduationCap, Scale, Building, Plane, MoreHorizontal, Languages, Banknote, UtensilsCrossed, Landmark, LineChart, Wallet, PiggyBank, ShieldCheck, FileText, HardHat, Hammer } from "lucide-react";
import xiaoyueAvatar from "@assets/generated_images/final_fox_with_collar_sunglasses.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import MobileHeader from "@/components/MobileHeader";
import EvolvingAvatar, { calculateClarityLevel } from "@/components/EvolvingAvatar";
import { LottieInlineLoader } from "@/components/LottieWaveAnimation";
import type { User as UserType } from "@shared/schema";
import { INTERESTS_OPTIONS, getInterestIcon } from "@/data/interestsTopicsData";
import { INDUSTRIES, WORK_MODES } from "@shared/occupations";
import { 
  LANGUAGES_COMFORT_OPTIONS, 
  RELATIONSHIP_STATUS_OPTIONS, 
  EDUCATION_LEVEL_OPTIONS, 
  CHILDREN_OPTIONS,
  ACTIVITY_TIME_PREFERENCE_OPTIONS,
  SOCIAL_FREQUENCY_OPTIONS
} from "@shared/constants";
import { calculateProfileCompletion as calculateProfileCompletionUtil, getMatchingBoostEstimate } from "@/lib/profileCompletion";

// 注册模式配置
type RegistrationMode = "express" | "standard" | "deep" | "enrichment";

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

// 计算缺失字段（enrichment模式专用）
// 注意：排除报名偏好字段（budgetRange/preferredLanguages/cuisinePreferences/dietaryRestrictions/decorStylePreferences/socialGoals）
// 这些字段在EventPoolRegistrationPage收集，enrichment只关注匹配核心信息
function calculateMissingFields(user: UserType | null | undefined): { missingFields: string[]; existingProfile: EnrichmentContext['existingProfile'] } {
  if (!user) return { missingFields: [], existingProfile: {} };
  
  // 按优先级排序的字段（Tier 1 > Tier 2 > Tier 3）
  // 排除报名时已收集的偏好类字段
  const fieldsToCheck = [
    // Tier 1: 高影响匹配字段
    { key: 'activityTimePreferences', label: '活动时间偏好', isArray: true, tier: 1 },
    { key: 'socialFrequency', label: '社交频率', tier: 1 },
    { key: 'socialEnergyType', label: '社交能量类型', tier: 1 },
    { key: 'archetypeResult', label: '性格类型', tier: 1, isObject: true },
    // Tier 2: 中等影响字段
    { key: 'gender', label: '性别', tier: 2 },
    { key: 'birthdate', label: '年龄', tier: 2 },
    { key: 'occupation', label: '职业', tier: 2 },
    { key: 'industry', label: '行业', tier: 2 },
    { key: 'seniority', label: '资历', tier: 2 },
    { key: 'educationLevel', label: '学历', tier: 2 },
    // Tier 3: 辅助信息
    { key: 'topInterests', label: '兴趣爱好', isArray: true, tier: 3 },
    { key: 'relationshipStatus', label: '感情状态', tier: 3 },
    { key: 'currentCity', label: '城市', tier: 3 },
    { key: 'hometownCountry', label: '家乡', tier: 3 },
    { key: 'topicAvoidances', label: '话题避开', isArray: true, tier: 3 },
    { key: 'socialStyle', label: '社交风格', tier: 3 },
  ];
  
  const missingFields: string[] = [];
  const existingProfile: EnrichmentContext['existingProfile'] = {};
  
  fieldsToCheck.forEach(field => {
    const value = (user as any)[field.key];
    let isFilled = false;
    
    if (field.isArray) {
      isFilled = Array.isArray(value) && value.length > 0;
    } else if (field.isObject) {
      isFilled = value !== undefined && value !== null && typeof value === 'object';
    } else {
      isFilled = value !== undefined && value !== null && value !== '';
    }
    
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

// 行业图标映射 - 为每个行业分配贴切的lucide图标
const INDUSTRY_ICON_MAP: Record<string, any> = {
  "科技互联网": Laptop,
  "AI/大数据": Bot,
  "硬科技/芯片": Cpu,
  "新能源汽车": Car,
  "跨境电商": Globe,
  "金融投资": TrendingUp,
  "咨询服务": Briefcase,
  "市场营销": Megaphone,
  "创意设计": Palette,
  "传媒内容": Video,
  "医疗健康": Stethoscope,
  "教育培训": GraduationCap,
  "法律合规": Scale,
  "地产建筑": Building,
  "航空酒店旅游": Plane,
  "生活方式": Coffee,
  "其他行业": MoreHorizontal,
};

// 根据行业名称获取对应图标
function getIndustryIcon(industryLabel: string): any {
  return INDUSTRY_ICON_MAP[industryLabel] || Briefcase;
}

const registrationModes: ModeConfig[] = [
  {
    id: "express",
    icon: Zap,
    title: "极速体验",
    subtitle: "先玩再聊，我帮你打个底",
    time: "2分钟",
    stars: 3,
    maxStars: 5,
    description: "适合：想快速看看",
    gradient: "from-amber-500 to-orange-500"
  },
  {
    id: "standard",
    icon: Clock,
    title: "轻松聊聊",
    subtitle: "聊几句，匹配更靠谱",
    time: "3分钟",
    stars: 4,
    maxStars: 5,
    description: "适合：第一次尝试",
    gradient: "from-purple-500 to-pink-500",
    recommended: true
  },
  {
    id: "deep",
    icon: Diamond,
    title: "深度了解",
    subtitle: "多聊会儿，开局匹配更精准",
    time: "6-7分钟",
    stars: 5,
    maxStars: 5,
    description: "适合：认真交友",
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
          嘿，我是小悦
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-muted-foreground"
        >
          聊几句，帮你找到聊得来的伙伴
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
                    <span className="text-xs text-muted-foreground">匹配精准度</span>
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
        多参加几次活动，匹配会越来越准
      </motion.p>

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
  // 原有的
  { id: "pet_lover", title: "铲屎官认证", icon: "🐾", condition: (info) => info.hasPets === true },
  { id: "foodie", title: "美食家", icon: "🍜", condition: (info) => !!info.cuisinePreference && info.cuisinePreference.length > 0 },
  { id: "social_butterfly", title: "社交达人", icon: "🦋", condition: (info) => !!info.interestsTop && info.interestsTop.length >= 3 },
  { id: "local_expert", title: "本地通", icon: "📍", condition: (info) => !!info.currentCity && !!info.hometown },
  { id: "multi_lingual", title: "语言达人", icon: "🗣️", condition: (info) => !!info.languagesComfort && info.languagesComfort.length >= 2 },
  { id: "open_book", title: "坦诚相待", icon: "📖", condition: (info) => !!info.relationshipStatus },
  
  // 新增的
  { id: "world_citizen", title: "世界公民", icon: "🌏", condition: (info) => hasOverseasExperience(info) },
  { id: "parent", title: "神兽驯养师", icon: "👶", condition: (info) => hasChildren(info.children) },
  { id: "student_forever", title: "永远的学生", icon: "🎓", condition: (info) => !!info.educationLevel || !!info.fieldOfStudy },
  { id: "work_artist", title: "事业型选手", icon: "💼", condition: (info) => !!info.industry || !!info.roleTitleShort || !!info.occupationDescription },
  { id: "night_owl", title: "夜猫子", icon: "🦉", condition: (info) => getTimeOfDayFromTimestamp(info.registrationStartTime) === 'night' },
  { id: "early_bird", title: "早起鸟", icon: "🐔", condition: (info) => getTimeOfDayFromTimestamp(info.registrationStartTime) === 'morning' },
  { id: "speed_demon", title: "效率狂人", icon: "⚡", condition: () => false, modeCondition: (mode) => mode === 'express' },
  { id: "deep_diver", title: "慢工出细活", icon: "💎", condition: () => false, modeCondition: (mode) => mode === 'deep' },
  { id: "mic_master", title: "麦霸预定", icon: "🎤", condition: (info) => isIcebreakerInitiator(info.icebreakerRole) },
  { id: "rainbow_collector", title: "彩虹收集者", icon: "🌈", condition: (info) => !!info.interestsTop && info.interestsTop.length >= 5 },
];

// 成就弹出组件
function AchievementToast({ achievement, onComplete }: { achievement: Achievement; onComplete: () => void }) {
  // 使用 ref 存储 onComplete 回调，避免因函数引用变化导致无限循环
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  
  useEffect(() => {
    // 强制 2 秒后执行完成回调 (根据 UIUX 建议缩短停留时间)
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 2000);
    return () => clearTimeout(timer);
  }, [achievement.id]); // 只依赖 achievement.id，不依赖 onComplete

  return (
    <motion.div
      key={achievement.id}
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
      className="fixed top-16 right-4 z-[100] pointer-events-none"
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

// 小悦头像组件 - 使用品牌大使形象（已缓存，不会重新加载）
// 使用 memo 减少重复渲染导致的闪烁
const XiaoyueAvatar = memo(({ emotion, size = "md" }: { emotion: XiaoyueEmotion; size?: "sm" | "md" | "lg" | "xl" }) => {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8", 
    lg: "w-12 h-12",
    xl: "w-20 h-20"
  }[size];
  
  return (
    <motion.div 
      className={`${sizeClasses} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-primary/20 ring-offset-2 ring-offset-background bg-muted`}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <img 
        src={xiaoyueAvatar} 
        alt="小悦" 
        className="w-full h-full object-cover object-top"
        loading="eager"
        decoding="async"
      />
    </motion.div>
  );
});

XiaoyueAvatar.displayName = "XiaoyueAvatar";


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

// 结构化模式匹配配置 - 用于需要精准匹配的场景
interface PatternBasedQuickReplyConfig {
  id: string;
  pattern?: RegExp;
  requiredAny?: string[];
  requiredAll?: string[][];
  exclude?: string[];
  contextGuards?: {
    mustBeQuestion?: boolean;
    minLength?: number;
  };
  options: QuickReply[];
  priority?: number;
  multiSelect?: boolean;
  enforcePredefined?: boolean;
  fullDisplay?: boolean;
}

const quickReplyConfigs: QuickReplyConfig[] = [
  {
    keywords: ["城市", "住", "base", "base哪", "哪里人", "家乡", "深圳", "上海", "北京", "广州", "香港"],
    options: [
      { text: "深圳", icon: MapPin },
      { text: "上海", icon: MapPin },
      { text: "北京", icon: MapPin },
      { text: "香港", icon: MapPin },
      { text: "广州", icon: MapPin }
    ],
    priority: 10
  },
  {
    keywords: ["兴趣", "爱好", "喜欢做", "平时做", "业余"],
    options: INTERESTS_OPTIONS.slice(0, 12).map(opt => ({ text: opt.label, icon: getInterestIcon(opt.id) })),
    multiSelect: true,
    priority: 8
  },
  {
    keywords: ["行业", "职业", "做什么工作", "工作"],
    options: INDUSTRIES.map(ind => ({ text: ind.label, icon: getIndustryIcon(ind.label) })),
    priority: 7,
    fullDisplay: true
  }
];

const patternBasedConfigs: PatternBasedQuickReplyConfig[] = [
  // === Tier 1: 高影响匹配字段 ===
  {
    id: "activityTime",
    pattern: /(活动|局|聚会|社交|出来|参加).{0,8}(时间|时段|什么时候|平日|周末|有空|方便)/,
    requiredAny: ["工作日晚上", "周末白天", "周末晚上", "什么时候有空", "哪个时段"],
    exclude: ["喜欢做什么", "玩什么", "什么活动"],
    contextGuards: { mustBeQuestion: true },
    options: ACTIVITY_TIME_PREFERENCE_OPTIONS.map(opt => ({ 
      text: opt, 
      icon: opt.includes("晚上") ? Moon : opt.includes("白天") ? Sun : Sparkles 
    })),
    priority: 98,
    enforcePredefined: true
  },
  {
    id: "socialFrequency",
    pattern: /(社交|聚会|活动).{0,8}(频率|多久一次|节奏|多频繁)/,
    requiredAny: ["社交频率", "多久一次", "一个月聚几次", "多常出来"],
    exclude: ["回家多久", "工作多久"],
    contextGuards: { mustBeQuestion: true },
    options: SOCIAL_FREQUENCY_OPTIONS.map(opt => ({ 
      text: opt, 
      icon: opt.includes("每周") ? Zap : Calendar 
    })),
    priority: 97,
    enforcePredefined: true
  },
  // === Tier 2: 基础资料字段 ===
  {
    id: "gender",
    pattern: /性别|男生.*女生|女生.*男生|小哥哥.*小姐姐|是男是女/,
    requiredAny: ["男生还是女生", "性别"],
    options: [
      { text: "男生", icon: Smile },
      { text: "女生", icon: Heart }
    ],
    priority: 96,
    enforcePredefined: true
  },
  {
    id: "education",
    pattern: /学历|读到|什么学历|毕业|读书.*到/,
    requiredAny: ["学历", "读到哪", "毕业"],
    options: EDUCATION_LEVEL_OPTIONS.map(level => ({ text: level, icon: GraduationCap })),
    priority: 95,
    enforcePredefined: true
  },
  {
    id: "relationship",
    pattern: /感情状态|单身|恋爱|已婚|有对象/,
    requiredAny: ["感情状态", "单身", "有对象吗", "恋爱"],
    options: RELATIONSHIP_STATUS_OPTIONS.map(status => ({ text: status, icon: Heart })),
    priority: 94,
    enforcePredefined: true
  },
  {
    id: "industry",
    pattern: /什么行业|哪个行业|在.*行业|从事.*行业/,
    requiredAny: ["什么行业", "哪个行业", "行业"],
    exclude: ["行业经验多久"],
    options: INDUSTRIES.map(ind => ({ text: ind.label, icon: getIndustryIcon(ind.label) })),
    priority: 93,
    multiSelect: false,
    enforcePredefined: true,
    fullDisplay: true
  },
  {
    id: "interests",
    pattern: /兴趣|爱好|喜欢做|平时.*做|业余.*做/,
    requiredAny: ["兴趣", "爱好", "平时喜欢"],
    exclude: ["哪个最常做", "最喜欢哪个"],
    // 全量展示所有22个兴趣选项，每个使用专属图标
    options: INTERESTS_OPTIONS.map(opt => ({ text: opt.label, icon: getInterestIcon(opt.id) })),
    priority: 92,
    multiSelect: true,
    enforcePredefined: true,
    // 标记为全量展示模式，不显示换一批和自己输入
    fullDisplay: true
  },
  // === 其他常用结构化问题 ===
  {
    id: "intent",
    pattern: /想要|期待|目的|来悦聚.*干嘛|为什么来/,
    requiredAny: ["想要什么", "来悦聚想", "交朋友", "拓展人脉"],
    options: [
      { text: "交朋友", icon: Heart },
      { text: "拓展人脉", icon: Users },
      { text: "深度讨论", icon: MessageCircle },
      { text: "娱乐放松", icon: Coffee },
      { text: "浪漫社交", icon: Heart },
      { text: "灵活开放·都可以", icon: Sparkles }
    ],
    priority: 91,
    multiSelect: true,
    enforcePredefined: true
  },
  {
    id: "age",
    pattern: /年龄|几几年|多大|岁|哪年.*生|年代/,
    requiredAny: ["年龄", "多大", "几几年", "哪年"],
    options: [
      { text: "00后", icon: CalendarDays },
      { text: "95后", icon: CalendarDays },
      { text: "90后", icon: CalendarDays },
      { text: "85后", icon: CalendarDays },
      { text: "选择生日", icon: Calendar }
    ],
    priority: 90,
    enforcePredefined: true
  },
  // === 疲劳提醒快捷回复 ===
  {
    id: "fatigueReminder",
    pattern: /聊了一会儿|小歇一下|帮你记住/,
    requiredAny: [],
    options: [
      { text: "继续聊", icon: MessageCircle },
      { text: "先休息一下", icon: Coffee }
    ],
    priority: 99,
    enforcePredefined: true
  }
];

// 检测结果接口
interface QuickReplyResult {
  options: QuickReply[];
  multiSelect: boolean;
  fullDisplay?: boolean;
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
// 注意：时段/频率等宽泛词已移至 patternBasedConfigs 使用精准匹配
const predefinedOptionKeywords = [
  "想要", "期待", "目的", "意图", "拓展人脉", "交朋友", "为什么来", // intent
  "性别", "男生", "女生", "小哥哥", "小姐姐", // gender
  "语言", "方言", "普通话", "粤语", // language
  "不聊", "避免", "敏感话题", // topic avoidances
  "孩子", "小孩", "娃", // children
  "学历", "毕业", // education
  "感情", "单身", "恋爱", "已婚", // relationship
  "兄弟", "姐妹", "独生", "排行" // siblings
  // 时段/频率相关词已移至 patternBasedConfigs，使用精准模式匹配避免误触发
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

// 检测是否是问句（包含问号或疑问词）
function isQuestionMessage(message: string): boolean {
  // 检查是否包含问号
  if (/[？?]/.test(message)) return true;
  // 检查是否包含疑问词
  return /吗|呢|嘛|什么|哪|怎么|多久|多少|几|谁|何时/.test(message);
}

// 检测模式匹配配置 - 用于精准匹配活动时段、社交频率等
function matchPatternBasedConfig(message: string): QuickReplyResult | null {
  const lowerMsg = message.toLowerCase();
  
  for (const config of patternBasedConfigs) {
    // 1. 检查排除词
    if (config.exclude?.some(ex => lowerMsg.includes(ex.toLowerCase()))) {
      continue;
    }
    
    // 2. 检查上下文门控
    if (config.contextGuards?.mustBeQuestion && !isQuestionMessage(message)) {
      continue;
    }
    if (config.contextGuards?.minLength && message.length < config.contextGuards.minLength) {
      continue;
    }
    
    // 3. 优先使用正则模式匹配
    if (config.pattern && config.pattern.test(message)) {
      return {
        options: config.options.filter(o => o.text),
        multiSelect: config.multiSelect || false,
        fullDisplay: config.fullDisplay || false
      };
    }
    
    // 4. 使用 requiredAll 多条件组合匹配
    if (config.requiredAll && config.requiredAll.length > 0) {
      // 每个组内是OR关系，组间是AND关系
      const allGroupsMatch = config.requiredAll.every(group => 
        group.some(keyword => lowerMsg.includes(keyword.toLowerCase()))
      );
      
      if (allGroupsMatch) {
        return {
          options: config.options.filter(o => o.text),
          multiSelect: config.multiSelect || false,
          fullDisplay: config.fullDisplay || false
        };
      }
    }
    
    // 5. 使用 requiredAny 单条件匹配
    if (config.requiredAny && config.requiredAny.length > 0) {
      const hasAny = config.requiredAny.some(keyword => 
        lowerMsg.includes(keyword.toLowerCase())
      );
      if (hasAny) {
        return {
          options: config.options.filter(o => o.text),
          multiSelect: config.multiSelect || false,
          fullDisplay: config.fullDisplay || false
        };
      }
    }
  }
  
  return null;
}

// 提取消息的最后一个问句 - 用于精准匹配快捷回复
// 避免前文内容（如"96年，28岁"）干扰问题检测（如"现在base哪个城市？"）
function extractLastQuestion(message: string): string {
  // 按句号、感叹号、换行分割，保留问句
  const sentences = message.split(/[。！\n]+/).map(s => s.trim()).filter(Boolean);
  // 从后往前找第一个包含问号或疑问词的句子
  for (let i = sentences.length - 1; i >= 0; i--) {
    const s = sentences[i];
    if (/[？?]/.test(s) || /吗|呢|嘛|什么|哪|怎么|多久|多少|几|谁|何时/.test(s)) {
      return s;
    }
  }
  // 没找到问句，返回最后一句
  return sentences[sentences.length - 1] || message;
}

// 缓存排序的配置（避免每次都排序）
const sortedQuickReplyConfigs = quickReplyConfigs.sort((a, b) => (b.priority || 0) - (a.priority || 0));

// 快速回复检测缓存 - 避免重复处理相同的AI消息
const quickReplyCache = new Map<string, QuickReplyResult>();

// 关键词匹配 quickReplyConfigs - 作为 patternBasedConfigs 的后备
function matchKeywordBasedConfig(message: string): QuickReplyResult | null {
  const lowerMsg = message.toLowerCase();
  
  for (const config of sortedQuickReplyConfigs) {
    // 检查是否有关键词匹配
    const hasMatch = config.keywords.some(kw => lowerMsg.includes(kw.toLowerCase()));
    if (hasMatch && config.options.length > 0) {
      return {
        options: config.options.filter(o => o.text),
        multiSelect: config.multiSelect || false
      };
    }
  }
  
  return null;
}

// 检测最后一条消息是否匹配快捷回复
// 简化版：只对结构化问题显示静态预设选项，其他追问不显示快捷回复
function detectQuickReplies(lastMessage: string): QuickReplyResult {
  // 0. 检查缓存 - 大幅加速性别等热点问题
  const cached = quickReplyCache.get(lastMessage);
  if (cached) return cached;
  
  // 计算结果（最后统一缓存）
  let result: QuickReplyResult;
  
  // 1. 检查是否是开场白/介绍类消息（不显示快捷选项）
  if (isIntroductionMessage(lastMessage)) {
    result = { options: [], multiSelect: false };
  } else {
    // 2. 检查是否需要用户自由输入（如称呼问题）
    const lowerMessage = lastMessage.toLowerCase();
    let foundFreeInput = false;
    for (const kw of freeInputKeywords) {
      if (lowerMessage.includes(kw)) {
        result = { options: [], multiSelect: false };
        foundFreeInput = true;
        break;
      }
    }
    
    if (!foundFreeInput) {
      // 3. 检查是否是追问类问题（不显示快捷选项）
      let foundFollowUp = false;
      for (const pattern of followUpPatterns) {
        if (pattern.test(lastMessage)) {
          result = { options: [], multiSelect: false };
          foundFollowUp = true;
          break;
        }
      }
      
      if (!foundFollowUp) {
        // 4. 提取最后一个问句，避免前文内容干扰
        const lastQuestion = extractLastQuestion(lastMessage);
        
        // 5. 优先检查精准模式匹配（结构化问题：活动时段、社交频率、性别、学历等）
        const patternMatch = matchPatternBasedConfig(lastQuestion);
        if (patternMatch) {
          result = patternMatch;
        } else {
          // 6. 关键词匹配作为后备（城市、兴趣等）
          const keywordMatch = matchKeywordBasedConfig(lastQuestion);
          if (keywordMatch) {
            result = keywordMatch;
          } else if (isYesNoQuestion(lastMessage)) {
            // 7. 检查是否是简单的是非问句
            result = { 
              options: [
                { text: "是的", icon: Check },
                { text: "不是", icon: X }
              ], 
              multiSelect: false 
            };
          } else {
            // 8. 检查确认类问题
            const confirmKeywords = ["对吗", "确认一下", "核对一下", "信息对吗", "没问题吗"];
            if (confirmKeywords.some(kw => lowerMessage.includes(kw))) {
              result = {
                options: [
                  { text: "对的，确认", icon: Check },
                  { text: "需要修改", icon: Pencil }
                ],
                multiSelect: false
              };
            } else {
              // 9. 其他情况不显示快捷回复（智能追问让用户自由输入）
              result = { options: [], multiSelect: false };
            }
          }
        }
      }
    }
  }
  
  // 统一缓存所有结果
  quickReplyCache.set(lastMessage, result!);
  return result!;
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

// 用户头像组件 - 统一紫色渐变风格（更温暖、更中立）
function UserAvatar() {
  return (
    <motion.div 
      className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <span className="text-sm">😊</span>
    </motion.div>
  );
}

// 动态AI推理生成函数 - 根据已收集信息生成个性化洞察
function generateDynamicInference(info: CollectedInfo): string | null {
  const inferences: string[] = [];
  const isFemale = info.gender?.includes('女');
  
  // 根据收集的信息层次生成不同的推理
  // L1 基础信息推理
  if (info.displayName && info.gender && !info.birthdate && !info.currentCity) {
    return isFemale ? "很好听的名字哦，小姐姐～" : "名字很硬朗嘛，兄弟！";
  }
  
  // 年龄相关推理
  if (info.birthYear || info.birthdate) {
    const birthYear = info.birthYear ? parseInt(info.birthYear) : 
      (info.birthdate ? parseInt(info.birthdate.split('-')[0]) : null);
    if (birthYear) {
      if (birthYear >= 2000) {
        inferences.push(isFemale ? "00后职场新势力，冲劲十足～" : "00后职场新锐，干劲满满！");
      } else if (birthYear >= 1995) {
        inferences.push(isFemale ? "95后黄金期，事业正当时～" : "95后职场中坚，正是发力的年纪！");
      } else if (birthYear >= 1990) {
        inferences.push(isFemale ? "90后轻熟派，阅历与活力兼具～" : "90后老手，职场老鸟了！");
      }
    }
  }
  
  // 城市相关推理
  if (info.currentCity && info.hometown) {
    if (info.currentCity !== info.hometown) {
      inferences.push(isFemale ? `从${info.hometown}到${info.currentCity}打拼，独立又勇敢～` : 
        `从${info.hometown}到${info.currentCity}闯荡，是个有故事的人！`);
    } else {
      inferences.push(isFemale ? "本地人的主场优势，资源满满～" : "本地人，人脉扎实！");
    }
  }
  
  // 行业相关推理
  if (info.industry) {
    const industryInferences: Record<string, string[]> = {
      "科技互联网": [isFemale ? "互联网圈的姐姐，思维敏捷～" : "互联网老炮，节奏感拉满！"],
      "AI/大数据": [isFemale ? "AI领域的女性力量，很酷～" : "AI前沿玩家，眼光独到！"],
      "金融投资": [isFemale ? "金融圈精英，数字敏感度满分～" : "金融圈人士，资本嗅觉灵敏！"],
      "创意设计": [isFemale ? "创意人，审美在线～" : "设计圈的，艺术细胞爆棚！"],
      "传媒内容": [isFemale ? "内容创作者，故事感十足～" : "传媒人，讲故事的高手！"],
      "医疗健康": [isFemale ? "医疗行业，救死扶伤的天使～" : "医疗人士，专业靠谱！"],
      "教育培训": [isFemale ? "教育工作者，温暖有爱～" : "教育圈的，有耐心有情怀！"],
    };
    const match = industryInferences[info.industry];
    if (match) inferences.push(match[0]);
  }
  
  // 兴趣相关推理
  if (info.interestsTop && info.interestsTop.length > 0) {
    const interests = info.interestsTop;
    if (interests.includes("户外运动") || interests.includes("运动健身")) {
      inferences.push(isFemale ? "热爱运动，活力满满～" : "运动派，精力充沛！");
    }
    if (interests.includes("美食探店")) {
      inferences.push(isFemale ? "美食达人，舌尖品味～" : "吃货一枚，懂生活！");
    }
    if (interests.includes("读书学习") || interests.includes("知识分享")) {
      inferences.push(isFemale ? "爱学习的女孩，内涵满满～" : "爱看书，有深度！");
    }
    if (interests.includes("旅行探索")) {
      inferences.push(isFemale ? "热爱旅行，见识广博～" : "旅行爱好者，眼界开阔！");
    }
  }
  
  // 社交风格推理
  if (info.socialStyle) {
    if (info.socialStyle.includes("活跃") || info.socialStyle.includes("外向")) {
      inferences.push(isFemale ? "社交达人，氛围组担当～" : "社牛属性，聊什么都行！");
    } else if (info.socialStyle.includes("内敛") || info.socialStyle.includes("安静")) {
      inferences.push(isFemale ? "安静有力量，深度社交型～" : "内敛派，聊深了有料！");
    }
  }
  
  // 返回最新/最相关的推理（优先返回最后一条，即最新收集的信息）
  if (inferences.length > 0) {
    return inferences[inferences.length - 1];
  }
  
  return null;
}

// 消息气泡组件
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
  collectedInfo: CollectedInfo;
  onTypingComplete?: () => void;
  onSequentialDisplayComplete?: () => void;
}) {
  const isAssistant = message.role === "assistant";
  
  // 过滤掉消息中的 collected_info 和 registration_complete 代码块，避免显示“乱码”
  const displayContent = useMemo(() => {
    return message.content
      .replace(/```collected_info[\s\S]*?```/gi, '')
      .replace(/```registration_complete[\s\S]*?```/gi, '')
      .replace(/collected_info\s*\{[\s\S]*?\}/gi, '')
      .replace(/\{"displayName"[\s\S]*?\}/gi, '')
      .trim();
  }, [message.content]);

  // 仅在最新助理消息且需要动画时显示打字效果
  const shouldShowTyping = isAssistant && message.isTypingAnimation === true;
  const { displayedText, isComplete } = useTypingEffect(displayContent, shouldShowTyping);

  useEffect(() => {
    if (isComplete && onTypingComplete) {
      onTypingComplete();
    }
  }, [isComplete, onTypingComplete]);

  // 处理逐行显示的消息（仅在性格测试介绍时使用）
  const paragraphs = useMemo(() => displayContent.split('\n').filter(p => p.trim()), [displayContent]);
  const [visibleParagraphCount, setVisibleParagraphCount] = useState(0);

  useEffect(() => {
    if (displayContent.includes("性格测试") && displayContent.includes("12道题")) {
      setVisibleParagraphCount(0);
      let i = 0;
      const timer = setInterval(() => {
        if (i < paragraphs.length) {
          setVisibleParagraphCount(i + 1);
          i++;
        } else {
          clearInterval(timer);
          onSequentialDisplayComplete?.();
        }
      }, 350);
      return () => clearInterval(timer);
    } else {
      setVisibleParagraphCount(paragraphs.length);
    }
  }, [message.content, paragraphs.length, onSequentialDisplayComplete]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isAssistant ? -20 : 20, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      className={`flex gap-3 ${isAssistant ? "justify-start" : "justify-end"}`}
    >
      {isAssistant && <XiaoyueAvatar emotion={detectEmotion(message.content)} />}
      
      <div className={`max-w-[80%] space-y-1.5 ${isAssistant ? "" : "flex flex-col items-end"}`}>
        {/* 每行内容独立显示为单独的气泡，符合聊天App惯例 */}
        {shouldShowTyping ? (
          <Card className={`${
            isAssistant 
              ? "bg-card/90 backdrop-blur-sm border-violet-200/30" 
              : "bg-primary text-primary-foreground"
          } px-4 py-2.5 shadow-sm overflow-hidden`}>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {displayedText}
            </div>
          </Card>
        ) : (
          paragraphs.slice(0, visibleParagraphCount).map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className={`${
                isAssistant 
                  ? "bg-card/90 backdrop-blur-sm border-violet-200/30" 
                  : "bg-primary text-primary-foreground"
              } px-4 py-2.5 shadow-sm overflow-hidden`}>
                <p className="text-sm leading-relaxed">{p}</p>
              </Card>
            </motion.div>
          ))
        )}
        
        {/* 动态AI推理：根据已收集信息生成个性化洞察 */}
        {isAssistant && isLatest && !shouldShowTyping && (() => {
          const inference = generateDynamicInference(collectedInfo);
          if (!inference) return null;
          
          return (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="relative mt-1"
            >
              <div className="absolute -top-1 left-4 w-px h-1.5 bg-gradient-to-b from-violet-300/50 to-transparent" />
              
              <div className="relative group px-3 py-1.5 overflow-hidden rounded-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-primary/10 to-violet-500/5 rounded-lg" />
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                />
                
                <div className="relative flex items-center gap-1.5">
                  <Sparkles className="w-2.5 h-2.5 text-primary/50" />
                  <span className="text-[10px] text-muted-foreground/60 mr-1">小悦的推理</span>
                  <div className="w-px h-2.5 bg-violet-200/30" />
                  <span className="text-[11px] font-medium bg-gradient-to-r from-primary/80 to-violet-600/80 bg-clip-text text-transparent tracking-tight">
                    {inference}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </div>

      {!isAssistant && <UserAvatar />}
    </motion.div>
  );
}

// 资料完整度进度条
interface CollectedInfo {
  registrationStartTime?: string; // 注册开始时间戳
  displayName?: string;
  gender?: string;
  birthdate?: string;
  birthYear?: string;
  currentCity?: string;
  hometown?: string;
  occupation?: string;
  occupationDescription?: string;
  industry?: string;
  roleTitleShort?: string;
  seniority?: string;
  companyName?: string;
  fieldOfStudy?: string;
  educationLevel?: string;
  topInterests?: string[];
  interestsTop?: string[]; // 兴趣TOP3
  interestsDeep?: string[]; // 深度兴趣
  intent?: string;
  hasPets?: boolean;
  petTypes?: string[];
  relationshipStatus?: string;
  children?: string;
  overseasRegions?: string[];
  studyLocale?: string;
  languagesComfort?: string[];
  icebreakerRole?: string;
  socialStyle?: string;
  topicAvoidances?: string[];
  cuisinePreference?: string[];
}

function SocialProfileCard({ info, mode }: { info: CollectedInfo; mode?: RegistrationMode }) {
  const { percentage } = calculateProfileCompletionUtil(info as any);
  const matchingBoost = getMatchingBoostEstimate(percentage);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-transparent rounded-2xl border border-violet-200/20 shadow-xl"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40 flex items-center justify-center border border-violet-200/30">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            {info.displayName || "神秘嘉宾"}
            <Badge variant="outline" className="text-[10px] h-4 px-1">{mode === 'express' ? '极速' : mode === 'deep' ? '深度' : '标准'}</Badge>
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {info.gender} · {info.birthYear}后 · {info.currentCity}
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              匹配加成: +{matchingBoost}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {info.industry && (
          <div className="p-2.5 bg-background/50 rounded-xl border border-violet-100/20">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[10px] text-muted-foreground font-medium">行业</span>
            </div>
            <p className="text-xs font-semibold truncate">{info.industry}</p>
          </div>
        )}
        {info.interestsTop && info.interestsTop.length > 0 && (
          <div className="p-2.5 bg-background/50 rounded-xl border border-violet-100/20">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-3.5 h-3.5 text-pink-500" />
              <span className="text-[10px] text-muted-foreground font-medium">最爱</span>
            </div>
            <p className="text-xs font-semibold truncate">{info.interestsTop[0]}</p>
          </div>
        )}
      </div>
      
      {/* 成就墙预览 */}
      <div className="mt-4 pt-4 border-t border-violet-200/20">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">解锁成就</p>
        {(() => {
          const unlocked = achievements.filter(a => a.condition(info));
          if (unlocked.length === 0) return (
            <div className="bg-muted/30 rounded-lg p-2 text-center">
              <p className="text-[10px] text-muted-foreground italic">暂无勋章，多聊聊能解锁更多哦</p>
            </div>
          );
          return (
            <div className="overflow-x-auto pb-1 scrollbar-hide">
              <div className="flex gap-2 min-w-max">
                {unlocked.map((badge, idx) => (
                  <motion.div
                    key={badge.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col items-center gap-1 p-2 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg min-w-[60px]"
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
  const scrollRef = useRef<HTMLDivElement>(null);
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
  
  // 记录enrichment开始时的baseline（用于结尾展示提升）
  const [enrichmentBaseline, setEnrichmentBaseline] = useState<{ percentage: number; stars: number } | null>(null);
  
  // 当enrichment模式加载用户数据后，记录baseline
  useEffect(() => {
    if (isEnrichmentMode && userData && !enrichmentBaseline) {
      const baseline = calculateProfileCompletionUtil(userData);
      setEnrichmentBaseline({ percentage: baseline.percentage, stars: baseline.stars });
    }
  }, [isEnrichmentMode, userData, enrichmentBaseline]);
  
  // 模式选择状态 - enrichment模式直接跳过选择
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
  
  // 轻量版疲劳提醒状态 (对话超7分钟且L2未完成时触发一次)
  const [hasFatigueReminderShown, setHasFatigueReminderShown] = useState(false);
  
  // Session telemetry state
  const [telemetrySessionId, setTelemetrySessionId] = useState<string | null>(null);
  const [l1CompletedEmitted, setL1CompletedEmitted] = useState(false);
  const [l2EnrichedEmitted, setL2EnrichedEmitted] = useState(false);
  
  // 检查是否需要显示疲劳提醒
  useEffect(() => {
    if (hasFatigueReminderShown || !chatStartTime || !selectedMode) return;
    
    // 计算L2完成度（检查是否有可选字段被填写）
    const l2Fields = ['interestsTop', 'occupation', 'intent', 'socialStyle'];
    const hasL2Data = l2Fields.some(field => {
      const value = (collectedInfo as any)[field];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    });
    
    // 如果L2已有数据，不需要提醒
    if (hasL2Data) return;
    
    // 设置7分钟定时器
    const FATIGUE_THRESHOLD_MS = 7 * 60 * 1000; // 7分钟
    const elapsed = Date.now() - new Date(chatStartTime).getTime();
    const remainingTime = Math.max(0, FATIGUE_THRESHOLD_MS - elapsed);
    
    const timer = setTimeout(() => {
      // 再次检查L2完成度
      const stillMissingL2 = !l2Fields.some(field => {
        const value = (collectedInfo as any)[field];
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && value !== '';
      });
      
      if (stillMissingL2 && !hasFatigueReminderShown) {
        // 添加小悦的温馨提醒消息（不使用emoji，保持简洁温暖）
        setMessages(prev => [...prev, {
          id: `msg-fatigue-${Date.now()}`,
          role: 'assistant' as const,
          content: '聊了一会儿啦，要不要小歇一下？你随时可以继续，我会帮你记住刚才聊的内容哦～',
          timestamp: new Date(),
        }]);
        setHasFatigueReminderShown(true);
      }
    }, remainingTime);
    
    return () => clearTimeout(timer);
  }, [chatStartTime, selectedMode, hasFatigueReminderShown, collectedInfo]);
  
  // Telemetry: Emit L1 completion when core fields are collected
  useEffect(() => {
    if (!telemetrySessionId || l1CompletedEmitted) return;
    
    // L1 required fields: displayName, gender
    const hasL1 = collectedInfo.displayName && collectedInfo.gender;
    if (hasL1) {
      setL1CompletedEmitted(true);
      apiRequest("PATCH", `/api/registration/sessions/${telemetrySessionId}`, {
        l1CompletedAt: new Date().toISOString(),
        lastTouchAt: new Date().toISOString(),
      }).catch(e => console.warn('[Telemetry] Failed to emit L1 completion:', e));
    }
  }, [telemetrySessionId, l1CompletedEmitted, collectedInfo.displayName, collectedInfo.gender]);
  
  // Telemetry: Emit L2 enrichment when optional fields are collected
  useEffect(() => {
    if (!telemetrySessionId || l2EnrichedEmitted || !l1CompletedEmitted) return;
    
    // L2 optional fields: interests, occupation, intent, socialStyle
    const l2Fields = ['interestsTop', 'occupation', 'intent', 'socialStyle'];
    const filledL2Count = l2Fields.filter(field => {
      const value = (collectedInfo as any)[field];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== '';
    }).length;
    
    // Consider L2 enriched if at least 1 optional field is filled
    if (filledL2Count >= 1) {
      setL2EnrichedEmitted(true);
      apiRequest("PATCH", `/api/registration/sessions/${telemetrySessionId}`, {
        l2EnrichedAt: new Date().toISOString(),
        l2FieldsFilledCount: filledL2Count,
        lastTouchAt: new Date().toISOString(),
      }).catch(e => console.warn('[Telemetry] Failed to emit L2 enrichment:', e));
    }
  }, [telemetrySessionId, l1CompletedEmitted, l2EnrichedEmitted, collectedInfo]);
  
  // Telemetry: Emit fatigue reminder trigger
  useEffect(() => {
    if (!telemetrySessionId || !hasFatigueReminderShown) return;
    
    apiRequest("PATCH", `/api/registration/sessions/${telemetrySessionId}`, {
      fatigueReminderTriggered: true,
      lastTouchAt: new Date().toISOString(),
    }).catch(e => console.warn('[Telemetry] Failed to emit fatigue reminder:', e));
  }, [telemetrySessionId, hasFatigueReminderShown]);
  
  // Telemetry: Emit completion when registration is finished
  const [completionEmitted, setCompletionEmitted] = useState(false);
  useEffect(() => {
    if (!telemetrySessionId || !isComplete || completionEmitted) return;
    
    setCompletionEmitted(true);
    apiRequest("PATCH", `/api/registration/sessions/${telemetrySessionId}`, {
      completedAt: new Date().toISOString(),
      messageCount: messages.length,
      lastTouchAt: new Date().toISOString(),
    }).catch(e => console.warn('[Telemetry] Failed to emit completion:', e));
  }, [telemetrySessionId, isComplete, completionEmitted, messages.length]);
  
  // 处理模式选择
  const handleModeSelect = (mode: RegistrationMode) => {
    setSelectedMode(mode);
    setShowModeSelection(false);
    // 开始对话，传入模式
    startChatMutation.mutate({ mode, enrichmentContext: null });
  };

  // 使用ref来追踪滚动，避免频繁state更新导致的无限循环
  const lastScrollTimeRef = useRef<number>(0);
  
  const scrollToBottom = useCallback((force = false) => {
    if (!scrollRef.current) return;
    
    // 如果不是强制滚动，且用户正在向上滚动查看历史，则不自动滚动
    if (!force) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      if (!isNearBottom) return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
    onSuccess: async (data) => {
      // 记录注册开始时间（用于时间徽章判断）
      setCollectedInfo(prev => ({
        ...prev,
        registrationStartTime: new Date().toISOString()
      }));
      
      // Create telemetry session
      try {
        const sessionRes = await apiRequest("POST", "/api/registration/sessions", {
          sessionMode: selectedMode || 'ai_chat',
          deviceChannel: /mobile|android|iphone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        });
        const sessionData = await sessionRes.json();
        if (sessionData.sessionId) {
          setTelemetrySessionId(sessionData.sessionId);
        }
      } catch (e) {
        console.warn('[Telemetry] Failed to create session:', e);
      }
      
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
                
                if (data.type === 'content') {
                  streamedContent += data.content;
                  // 实时过滤代码块（包括不完整的），避免闪烁
                  let filteredContent = streamedContent
                    .replace(/```collected_info[\s\S]*?(?:```|$)/gi, '')
                    .replace(/```registration_complete[\s\S]*?(?:```|$)/gi, '')
                    .replace(/```json[\s\S]*?(?:```|$)/gi, '')
                    .replace(/```[\s\S]*?(?:```|$)/gi, '')
                    .replace(/collected_info\s*\{[\s\S]*/gi, '')
                    .replace(/\{"displayName"[\s\S]*/gi, '')
                    .trim();
                  
                  if (filteredContent) {
                    lastValidContent = filteredContent; // 记录最新有效内容
                  }
                  // 通过streamId找到消息并更新其内容
                  setMessages(prev => prev.map(m => {
                    if (m.streamId === streamMessageId) {
                      return { ...m, content: filteredContent || lastValidContent };
                    }
                    return m;
                  }));
                  // 节流滚动：每300ms触发一次，避免频繁滚动导致卡顿
                  const now = Date.now();
                  if (now - lastScrollTimeRef.current > 300) {
                    lastScrollTimeRef.current = now;
                    scrollToBottom();
                  }
                } else if (data.type === 'done') {
                  console.log('[STREAM DEBUG] Stream message marked as done');
                  finalConversationHistory = data.conversationHistory;
                  setConversationHistory(data.conversationHistory);
                  if (data.collectedInfo) {
                    setCollectedInfo(prev => ({ ...prev, ...data.collectedInfo }));
                  }
                  if (data.isComplete) setIsComplete(true);
                }
              } catch (e) {
                console.warn('[STREAM DEBUG] Parse error for line:', line, e);
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
        title: "注册成功！",
        description: "接下来做个2分钟的性格测试，帮你找到更合拍的活动伙伴~"
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
    // 任何用户输入都退出休息模式
    if (isRestMode) setIsRestMode(false);
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
    if (isSequentialDisplaying && assistantMsgCount < 4) return { options: [], multiSelect: false };
    // 已确认后不再显示快捷选项
    if (isComplete && infoConfirmed) return { options: [], multiSelect: false };
    const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
    // 只有当消息有实际内容时才显示快捷选项
    if (!lastAssistantMessage || !lastAssistantMessage.content.trim()) return { options: [], multiSelect: false };
    
    // 性别选项需要即时显示（messages.length比较小的时候）
    const isEarlyStage = messages.length < 10;
    if (isEarlyStage) {
      return detectQuickReplies(lastAssistantMessage.content);
    }

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
      return `妥了，基础信息收好啦～\n\n接下来是性格测试——12道题，2分钟搞定。\n\n这个能测出你的社交原型，帮我把你配到chemistry对的人旁边。放心，值得花这点时间。`;
    } else if (isMale) {
      return `稳了。基础信息到手。\n\n接下来是性格测试——12道题，2分钟搞定。\n\n这玩意能测出你的社交原型，帮我把你配到chemistry对的桌子上。值得花这两分钟。`;
    } else {
      return `好，基础信息收到。\n\n接下来是性格测试——12道题，2分钟搞定。\n\n这个能测出你的社交原型，帮我把你配到chemistry对的桌子上。值得花这两分钟。`;
    }
  }, [collectedInfo.gender]);

  // 休息模式状态 - 用户选择休息后显示继续按钮
  const [isRestMode, setIsRestMode] = useState(false);
  
  // 生日选择器状态
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [birthdayYear, setBirthdayYear] = useState<string>("");
  const [birthdayMonth, setBirthdayMonth] = useState<string>("");
  const [birthdayDay, setBirthdayDay] = useState<string>("");
  
  // 生日滚轮选择器refs
  const yearScrollRef = useRef<HTMLDivElement>(null);
  const monthScrollRef = useRef<HTMLDivElement>(null);
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 初始化生日滚轮位置
  useEffect(() => {
    if (!showBirthdayPicker) return;
    
    // 清除之前的timeout
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    
    scrollTimeoutRef.current = setTimeout(() => {
        const ITEM_HEIGHT = 48; // 使用固定的项目高度以保证计算稳定性
        // 增加延时确保布局渲染完成，并使用精确计算
        if (yearScrollRef.current && birthdayYear) {
          const years = Array.from({ length: 50 }, (_, i) => 2025 - 18 - i);
          const yearIndex = years.indexOf(parseInt(birthdayYear));
          if (yearIndex >= 0) {
            yearScrollRef.current.scrollTop = yearIndex * ITEM_HEIGHT;
          }
        }
        if (monthScrollRef.current && birthdayMonth) {
          const monthIndex = parseInt(birthdayMonth) - 1;
          monthScrollRef.current.scrollTop = monthIndex * ITEM_HEIGHT;
        }
        if (dayScrollRef.current && birthdayDay) {
          const dayIndex = parseInt(birthdayDay) - 1;
          dayScrollRef.current.scrollTop = dayIndex * ITEM_HEIGHT;
        }
      }, 150);
    
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [showBirthdayPicker, birthdayYear, birthdayMonth, birthdayDay]);
  
  // 快捷回复点击处理
  const handleQuickReply = (text: string) => {
    if (isTyping) return;
    
    if (text === "选择生日") {
      setShowBirthdayPicker(true);
      return;
    }
    
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
    
    if (text === "先休息一下" || text.includes("休息")) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date()
      }]);
      
      const nextField = collectedInfo.currentCity ? "下一个问题" : "城市问题";
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: `msg-rest-${Date.now()}`,
          role: "assistant",
          content: `好的，进度已存好～\n想继续的时候点下方按钮就行，我们从${nextField}接着聊`,
          timestamp: new Date()
        }]);
        setIsRestMode(true);
      }, 300);
      return;
    }
    
    if (text === "确认无误" && isComplete && !infoConfirmed) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date()
      }]);
      
      setTimeout(() => {
        const introMsgId = `msg-intro-${Date.now()}`;
        setMessages(prev => [...prev, {
          id: introMsgId,
          role: "assistant",
          content: personalityTestIntro,
          timestamp: new Date()
        }]);
        setIsSequentialDisplaying(true);
        setSequentialDisplayMessageId(introMsgId);
        setInfoConfirmed(true);
      }, 500);
      return;
    }
    
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date()
    }]);
    setIsTyping(true);
    if (isRestMode) setIsRestMode(false);
    sendMessageMutation.mutate(text);
  };

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
    if (isRestMode) setIsRestMode(false);
    sendMessageMutation.mutate(selectedText);
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>, type: 'year' | 'month' | 'day') => {
    const scrollTop = e.currentTarget.scrollTop;
    const ITEM_HEIGHT = 48;
    const index = Math.round(scrollTop / ITEM_HEIGHT);
    
    if (type === 'year') {
      const years = Array.from({ length: 50 }, (_, i) => 2025 - 18 - i);
      if (years[index]) setBirthdayYear(years[index].toString());
    } else if (type === 'month') {
      setBirthdayMonth((index + 1).toString());
    } else if (type === 'day') {
      setBirthdayDay((index + 1).toString());
    }
  };

  const WheelScrollPicker = memo(({ 
    items, 
    value, 
    onScroll, 
    scrollRef 
  }: { 
    items: (string | number)[], 
    value: string, 
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void,
    scrollRef: React.RefObject<HTMLDivElement | null>
  }) => {
    return (
      <div 
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        className="h-[200px] overflow-y-auto snap-y snap-mandatory scrollbar-hide py-[76px] relative z-20 pointer-events-auto"
        onScroll={onScroll}
      >
        {items.map((item, i) => (
          <div 
            key={i}
            className={`h-12 flex items-center justify-center snap-center transition-all ${
              value === item.toString() ? "text-primary font-bold text-lg" : "text-muted-foreground opacity-40 text-sm"
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    );
  });
  WheelScrollPicker.displayName = "WheelScrollPicker";

  const TimeIcon = themeConfig.icon;

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

  if (showModeSelection) {
    return (
      <div className="min-h-screen bg-background">
        <ModeSelectionScreen onSelectMode={handleModeSelect} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col relative overflow-hidden`}>
      <motion.div 
        className={`absolute inset-0 bg-gradient-to-b ${warmthGradient} pointer-events-none z-0`}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        key={warmthGradient}
      />
      <div className={`absolute inset-0 bg-gradient-to-b ${themeConfig.gradient} pointer-events-none z-0 opacity-50`} />
      
      <div className="relative z-10 flex flex-col min-h-screen">
      <MobileHeader title="和小悦聊聊" action={
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TimeIcon className="w-3.5 h-3.5" />
          <span>{themeConfig.greeting}</span>
        </div>
      } />
      
      {infoCount >= 3 && !isComplete && (
        <TagCloud info={collectedInfo} />
      )}

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
        <AnimatePresence>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatest={msg === messages[messages.length - 1]}
              userGender={collectedInfo.gender}
              collectedInfo={collectedInfo}
              onTypingComplete={() => {
                setMessages(prev => prev.map((m) => 
                  m.id === msg.id ? { ...m, isTypingAnimation: false } : m
                ));
                if (typingCompleteResolverRef.current) {
                  typingCompleteResolverRef.current();
                  typingCompleteResolverRef.current = null;
                }
              }}
              onSequentialDisplayComplete={() => {
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
            className="flex gap-3 items-center"
          >
            <XiaoyueAvatar emotion="thinking" />
            <Card className="bg-muted/50 p-3 backdrop-blur-sm border-violet-200/20">
              <LottieInlineLoader 
                message="小悦正在思考..." 
              />
            </Card>
          </motion.div>
        )}

        {isComplete && collectedInfo.displayName && (
          <SocialProfileCard info={collectedInfo} mode={selectedMode || undefined} />
        )}

        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {isRestMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 py-4 border-t bg-muted/30"
          >
            <Button
              onClick={() => {
                setIsRestMode(false);
                setMessages(prev => [...prev, {
                  id: `msg-continue-${Date.now()}`,
                  role: "user",
                  content: "继续聊",
                  timestamp: new Date()
                }]);
                setIsTyping(true);
                sendMessageMutation.mutate("继续聊");
              }}
              className="w-full"
              data-testid="button-continue-registration"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              继续注册
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quickReplyResult.options.length > 0 && !isTyping && !isRestMode && (() => {
          const allOptions = quickReplyResult.options;
          const isFullDisplay = quickReplyResult.fullDisplay === true;
          const needsPagination = !isFullDisplay && quickReplyResult.multiSelect && allOptions.length > QUICK_REPLY_PAGE_SIZE;
          const totalPages = needsPagination ? Math.ceil(allOptions.length / QUICK_REPLY_PAGE_SIZE) : 1;
          const currentPage = Math.min(quickReplyPage, totalPages - 1);
          const displayOptions = needsPagination 
            ? allOptions.slice(currentPage * QUICK_REPLY_PAGE_SIZE, (currentPage + 1) * QUICK_REPLY_PAGE_SIZE)
            : allOptions;
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="px-4 py-3 border-t bg-muted/30"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs text-muted-foreground">
                    {quickReplyResult.multiSelect ? "可多选（点击选择后发送）：" : "快捷回复："}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 italic">
                    嫌麻烦？直接打字聊也行，我又不挑～
                  </p>
                </div>
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
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.12, delay: index * 0.02 }}
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
                
                {needsPagination && !quickReplyResult.fullDisplay && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.12, delay: displayOptions.length * 0.02 }}
                    onClick={() => setQuickReplyPage((prev) => (prev + 1) % totalPages)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-primary/40 bg-primary/5 text-primary text-sm hover:bg-primary/10 transition-all"
                    data-testid="button-next-replies"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>换一批</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <div className="p-4 border-t bg-background/80 backdrop-blur-sm relative z-20">
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            placeholder={isTyping ? "小悦正在思考..." : "和小悦聊聊..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isTyping || isComplete}
            className="flex-1 bg-muted/50 border-violet-200/20"
            data-testid="input-chat-message"
          />
          <Button 
            size="icon" 
            onClick={handleSend} 
            disabled={isTyping || !inputValue.trim() || isComplete}
            className="rounded-full shadow-lg shadow-primary/20"
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
      </div>

      <Drawer open={showBirthdayPicker} onOpenChange={setShowBirthdayPicker}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="text-center">选择你的生日</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 py-8">
            {/* 使用三个下拉选择器替代wheel picker，确保移动端触摸兼容性 */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground text-center block">年份</Label>
                <Select value={birthdayYear} onValueChange={setBirthdayYear}>
                  <SelectTrigger className="h-14 text-lg font-medium" data-testid="select-birthday-year">
                    <SelectValue placeholder="年" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 50 }, (_, i) => 2025 - 18 - i).map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground text-center block">月份</Label>
                <Select value={birthdayMonth} onValueChange={setBirthdayMonth}>
                  <SelectTrigger className="h-14 text-lg font-medium" data-testid="select-birthday-month">
                    <SelectValue placeholder="月" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <SelectItem key={month} value={month.toString()}>{month}月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground text-center block">日期</Label>
                <Select value={birthdayDay} onValueChange={setBirthdayDay}>
                  <SelectTrigger className="h-14 text-lg font-medium" data-testid="select-birthday-day">
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <SelectItem key={day} value={day.toString()}>{day}日</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* 已选日期预览 */}
            {birthdayYear && birthdayMonth && birthdayDay && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-6 p-3 bg-primary/5 rounded-xl border border-primary/20"
              >
                <span className="text-sm text-muted-foreground">已选择：</span>
                <span className="text-lg font-bold text-primary ml-2">
                  {birthdayYear}年{birthdayMonth}月{birthdayDay}日
                </span>
              </motion.div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowBirthdayPicker(false)} 
                className="rounded-xl h-12"
                data-testid="button-cancel-birthday"
              >
                取消
              </Button>
              <Button 
                onClick={() => {
                  const birthDate = `${birthdayYear}-${birthdayMonth.padStart(2, '0')}-${birthdayDay.padStart(2, '0')}`;
                  setShowBirthdayPicker(false);
                  setMessages(prev => [...prev, {
                    id: `msg-${Date.now()}`,
                    role: "user",
                    content: `我的生日是 ${birthDate}`,
                    timestamp: new Date()
                  }]);
                  setIsTyping(true);
                  sendMessageMutation.mutate(`我的生日是 ${birthDate}`);
                }}
                disabled={!birthdayYear || !birthdayMonth || !birthdayDay}
                className="rounded-xl h-12 shadow-lg shadow-primary/20"
                data-testid="button-confirm-birthday"
              >
                确定
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <AnimatePresence mode="wait">
        {currentAchievement && (
          <AchievementToast 
            key={currentAchievement.id}
            achievement={currentAchievement} 
            onComplete={() => setCurrentAchievement(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
