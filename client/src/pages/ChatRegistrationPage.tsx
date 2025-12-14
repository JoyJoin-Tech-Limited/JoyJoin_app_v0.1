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
    keywords: ["方向", "领域", "细分", "ai", "web3", "哪个", "具体"],
    options: [
      { text: "科技互联网", icon: Briefcase },
      { text: "AI/大数据", icon: Briefcase },
      { text: "金融投资", icon: Briefcase },
      { text: "咨询服务", icon: Briefcase },
      { text: "市场营销", icon: Briefcase },
      { text: "创意设计", icon: Briefcase },
      { text: "传媒内容", icon: Briefcase },
      { text: "医疗健康", icon: Briefcase },
      { text: "教育培训", icon: Book },
      { text: "学生", icon: Book },
      { text: "自由职业", icon: Sparkles },
      { text: "其他行业", icon: Briefcase }
    ],
    priority: 83
  },
  {
    keywords: ["工作", "职业", "做什么", "行业", "从事", "干什么", "什么工作", "忙什么", "哪行", "上班"],
    options: [
      { text: "科技互联网", icon: Briefcase },
      { text: "AI/大数据", icon: Briefcase },
      { text: "硬科技/芯片", icon: Briefcase },
      { text: "新能源汽车", icon: Briefcase },
      { text: "跨境电商", icon: Briefcase },
      { text: "金融投资", icon: Briefcase },
      { text: "咨询服务", icon: Briefcase },
      { text: "市场营销", icon: Briefcase },
      { text: "创意设计", icon: Briefcase },
      { text: "传媒内容", icon: Briefcase },
      { text: "医疗健康", icon: Briefcase },
      { text: "教育培训", icon: Book },
      { text: "法律合规", icon: Briefcase },
      { text: "地产建筑", icon: Briefcase },
      { text: "航空酒店旅游", icon: Briefcase },
      { text: "生活方式", icon: Briefcase },
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

// 智能提取AI消息中的选项列表
function extractOptionsFromMessage(message: string): QuickReply[] {
  const options: QuickReply[] = [];
  
  // 模式1: 顿号分隔的选项 "交朋友、拓展人脉、深度讨论"
  // 查找包含多个顿号分隔项的句子
  const dunhaoPattern = /(?:想要|选择|可以|比如|包括|有)?[：:]?\s*([^。！？\n]+[、][^。！？\n]+)/g;
  let match;
  while ((match = dunhaoPattern.exec(message)) !== null) {
    const segment = match[1];
    // 提取顿号分隔的选项
    const items = segment.split(/[、，,]/).map(s => s.trim()).filter(s => {
      // 过滤掉太长或太短的项，以及包含问号的项
      return s.length >= 2 && s.length <= 15 && !s.includes('？') && !s.includes('?');
    });
    if (items.length >= 2) {
      items.forEach(item => {
        // 清理选项文本，去掉开头的"还是"等连接词
        let cleanItem = item.replace(/^(还是|或者|或|以及|和|跟)/, '').trim();
        // 去掉末尾的标点
        cleanItem = cleanItem.replace(/[。！？,.!?]$/, '').trim();
        if (cleanItem.length >= 2 && cleanItem.length <= 12 && !options.find(o => o.text === cleanItem)) {
          options.push({ text: cleanItem });
        }
      });
    }
  }
  
  // 模式2: "还是xxx"格式的最后选项
  const haishiPattern = /还是([^？?。！\n]+)[？?]/g;
  while ((match = haishiPattern.exec(message)) !== null) {
    const item = match[1].trim().replace(/[。！？,.!?]$/, '').trim();
    if (item.length >= 2 && item.length <= 12 && !options.find(o => o.text === item)) {
      options.push({ text: item });
    }
  }
  
  // 模式3: 字母/数字序号格式 "a. xxx b. xxx" 或 "1. xxx 2. xxx"
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

// 检测最后一条消息是否匹配快捷回复
// 改进：优先从消息中智能提取选项，关键词匹配作为后备
function detectQuickReplies(lastMessage: string): QuickReplyResult {
  // 第一步：尝试从消息中智能提取选项
  const extractedOptions = extractOptionsFromMessage(lastMessage);
  
  if (extractedOptions.length >= 2) {
    // 成功提取到选项，判断是否多选
    const multiSelect = shouldBeMultiSelect(extractedOptions, lastMessage);
    return { options: extractedOptions, multiSelect };
  }
  
  // 第二步：后备方案 - 使用关键词匹配
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
  onTypingComplete 
}: { 
  message: ChatMessage; 
  isLatest: boolean;
  userGender?: string;
  collectedInfo?: CollectedInfo;
  onTypingComplete?: () => void;
}) {
  // 短消息（≤15字）跳过打字动画
  const isShortMessage = message.content.length <= 15;
  const shouldAnimate = message.role === "assistant" && isLatest && message.isTypingAnimation && !isShortMessage;
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

  // AI消息：动画完成后，每行成为单独的气泡
  // 但包含流程标签（【】）的消息不分割，保持为一个气泡
  const containsFlowTags = message.content.includes('【');
  const originalLines = useMemo(() => {
    if (containsFlowTags) return [message.content]; // 不分割含有【】的消息
    return message.content.split('\n').filter(line => line.trim() !== '');
  }, [message.content, containsFlowTags]);
  
  // 逐行显示状态 - 用于多行消息逐条出现效果
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  
  // 是否应该显示逐行效果：打字完成且有多行且不含流程标签
  const shouldShowMultiLine = originalLines.length > 1 && (!shouldAnimate || isComplete) && !containsFlowTags;
  
  // 逐行显示效果：打字动画完成后，每350ms显示下一行
  useEffect(() => {
    if (shouldShowMultiLine) {
      if (visibleLineCount === 0) {
        // 初始显示第一行
        setVisibleLineCount(1);
      } else if (visibleLineCount < originalLines.length) {
        const timer = setTimeout(() => {
          setVisibleLineCount(prev => prev + 1);
        }, 350); // 350ms 间隔
        return () => clearTimeout(timer);
      }
    }
  }, [shouldShowMultiLine, originalLines.length, visibleLineCount]);
  
  // 重置：当消息内容变化时重置计数
  useEffect(() => {
    setVisibleLineCount(0);
  }, [message.content]);
  
  // 正在打字动画中或只有一行或包含流程标签时，显示单个气泡
  if ((shouldAnimate && !isComplete) || originalLines.length <= 1 || containsFlowTags) {
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

  // 动画完成后，多行逐条显示为独立气泡
  const visibleLines = originalLines.slice(0, visibleLineCount);
  
  return (
    <div>
      <AnimatePresence>
        {visibleLines.map((line, idx) => (
          <motion.div
            key={`${message.content}-line-${idx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mb-2"
          >
            <SingleBubble
              content={line}
              role="assistant"
              showAvatar={idx === 0}
              emotion={emotion}
              userGender={userGender}
              collectedInfo={collectedInfo}
            />
          </motion.div>
        ))}
      </AnimatePresence>
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
  children?: string;
  educationLevel?: string;
  fieldOfStudy?: string;
}

const TOTAL_PROFILE_ITEMS = 22;

// 可选兴趣标签 - 与InterestsTopicsPage对齐
const interestOptions = [
  "美食探店", "说走就走", "City Walk", "喝酒小酌", "音乐Live", "拍拍拍",
  "撸铁运动", "看展看剧", "打游戏", "吸猫撸狗", "看书充电", "桌游卡牌"
];

// 社交名片卡片组件 - 紫色渐变商务卡片风格
function SocialProfileCard({ info }: { info: CollectedInfo }) {
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
                {info.interestsTop.slice(0, 4).map((interest, i) => (
                  <motion.span 
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="text-xs bg-white/15 text-white/90 px-2 py-0.5 rounded-full backdrop-blur-sm border border-white/10"
                  >
                    {interest}
                  </motion.span>
                ))}
                {info.interestsTop.length > 4 && (
                  <span className="text-xs text-white/60 px-1">+{info.interestsTop.length - 4}</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-2 right-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-4 h-4 text-yellow-300/70" />
          </motion.div>
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

  // AbortController for opening message sequence
  const openingAbortRef = useRef<AbortController | null>(null);
  
  // Typing completion promise resolver for sequential message display
  const typingCompleteResolverRef = useRef<(() => void) | null>(null);
  
  // 清理timeout在组件卸载时
  useEffect(() => {
    return () => {
      if (starTimeoutRef.current) {
        clearTimeout(starTimeoutRef.current);
      }
      // 取消开场白序列
      openingAbortRef.current?.abort();
    };
  }, []);

  const startChatMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/registration/chat/start");
      return res.json();
    },
    onSuccess: (data) => {
      // 取消之前正在进行的开场白序列
      openingAbortRef.current?.abort();
      const abortController = new AbortController();
      openingAbortRef.current = abortController;
      
      // 将开场白分割成多条消息逐条显示
      const fullMessage = data.message as string;
      
      // 按双换行分割成多个段落
      let rawParagraphs = fullMessage.split('\n\n').filter(p => p.trim());
      
      // 合并流程信息块：把【标签】格式的连续段落合并为一个
      const paragraphs: string[] = [];
      let currentBlock: string[] = [];
      
      for (const para of rawParagraphs) {
        // 检查是否是【标签】格式的流程信息行
        const isProcessInfo = para.trim().startsWith('【');
        
        if (isProcessInfo) {
          // 这是一个【标签】段落，加入当前块
          currentBlock.push(para);
        } else {
          // 这不是【标签】段落
          if (currentBlock.length > 0) {
            // 先把之前的块（【标签】们）添加为一个段落，用换行连接
            paragraphs.push(currentBlock.join('\n\n'));
            currentBlock = [];
          }
          // 添加这个非【标签】段落
          paragraphs.push(para);
        }
      }
      
      // 处理剩余的块
      if (currentBlock.length > 0) {
        paragraphs.push(currentBlock.join('\n\n'));
      }
      
      // 总是分段显示开场白，每段都带打字动画
      const showParagraphsSequentially = async () => {
        // 第一段立即显示（带打字动画）
        setMessages([{
          role: "assistant",
          content: paragraphs[0],
          timestamp: new Date(),
          isTypingAnimation: true
        }]);
        
        // 后续段落依次添加，等待真正的typing完成
        for (let i = 1; i < paragraphs.length; i++) {
          // 检查是否被取消
          if (abortController.signal.aborted) return;
          
          // 等待前一条消息的打字动画真正完成
          await new Promise<void>((resolve, reject) => {
            // 存储resolve函数，会在onTypingComplete回调时被调用
            typingCompleteResolverRef.current = resolve;
            
            // 安全超时：最多等10秒（防止意外情况）
            const timeoutId = setTimeout(() => {
              typingCompleteResolverRef.current = null;
              resolve();
            }, 10000);
            
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              typingCompleteResolverRef.current = null;
              reject(new Error('Aborted'));
            }, { once: true });
          }).catch(() => {});
          
          // 再次检查是否被取消
          if (abortController.signal.aborted) return;
          
          // 添加600ms间隔让用户有时间阅读前一条消息
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, 600);
            abortController.signal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('Aborted'));
            }, { once: true });
          }).catch(() => {});
          
          if (abortController.signal.aborted) return;
          
          // 添加下一条消息（带打字动画）
          setMessages(prev => [...prev, {
            role: "assistant",
            content: paragraphs[i],
            timestamp: new Date(),
            isTypingAnimation: true
          }]);
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
                  // 实时过滤代码块（包括不完整的代码块）
                  let cleanContent = streamedContent
                    .replace(/```collected_info[\s\S]*?```/g, '')
                    .replace(/```registration_complete[\s\S]*?```/g, '')
                    .replace(/```collected_info[\s\S]*$/g, '') // 过滤不完整的代码块
                    .replace(/```registration_complete[\s\S]*$/g, '')
                    .replace(/```[a-z_]*\s*$/g, '') // 过滤刚开始的代码块标记
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
                // 标记该消息的打字动画已完成
                setMessages(prev => prev.map((m, i) => 
                  i === index ? { ...m, isTypingAnimation: false } : m
                ));
                // 通知等待中的开场白序列可以继续
                if (typingCompleteResolverRef.current) {
                  typingCompleteResolverRef.current();
                  typingCompleteResolverRef.current = null;
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
          <SocialProfileCard info={collectedInfo} />
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
              <ProgressRing progress={infoCount} total={TOTAL_PROFILE_ITEMS} showStar={showProgressStar} />
              <div className="flex flex-col">
                <span className="text-xs font-medium">档案完善中</span>
                <span className="text-xs text-muted-foreground">
                  {infoCount}/{TOTAL_PROFILE_ITEMS} 项信息
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
