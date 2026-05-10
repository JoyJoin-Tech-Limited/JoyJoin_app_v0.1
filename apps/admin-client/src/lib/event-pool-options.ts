import { INTENT_OPTIONS } from "@shared/constants";

// UI-specific extras for socialGoals cards (color for gradient backgrounds, description for card copy)
const SOCIAL_GOAL_EXTRAS: Record<string, { color: string; description: string }> = {
  friends:    { color: "from-blue-500/10",   description: "认识志同道合的新朋友" },
  networking: { color: "from-purple-500/10", description: "建立职业社交网络" },
  discussion: { color: "from-green-500/10",  description: "进行有意义的深度对话" },
  fun:        { color: "from-yellow-500/10", description: "享受轻松愉快的时光" },
  romance:    { color: "from-pink-500/10",   description: "寻找浪漫的可能" },
};

export const SHARED_OPTIONS = {
  socialGoals: INTENT_OPTIONS.map(o => ({
    value: o.value,
    label: o.label,
    emoji: o.emoji,
    color: SOCIAL_GOAL_EXTRAS[o.value]?.color ?? "from-gray-500/10",
    description: SOCIAL_GOAL_EXTRAS[o.value]?.description ?? o.subtitle,
  })),
  languages: [
    { value: "粤语", label: "粤语", flag: "🇭🇰" },
    { value: "普通话", label: "普通话", flag: "🇨🇳" },
    { value: "英语", label: "English", flag: "🇬🇧" }
  ]
};

export const DINNER_OPTIONS = {
  budget: [
    { 
      value: "150以下", 
      label: "150以下", 
      emoji: "💰",
      color: "border-green-500/30",
      bgColor: "bg-green-500/5",
      description: "经济实惠"
    },
    { 
      value: "150-200", 
      label: "150-200", 
      emoji: "💎",
      color: "border-blue-500/30",
      bgColor: "bg-blue-500/5",
      description: "性价比之选"
    },
    { 
      value: "200-300", 
      label: "200-300", 
      emoji: "✨",
      color: "border-purple-500/30",
      bgColor: "bg-purple-500/5",
      description: "精致体验"
    },
    { 
      value: "300-500", 
      label: "300-500", 
      emoji: "🌟",
      color: "border-amber-500/30",
      bgColor: "bg-amber-500/5",
      description: "高端享受"
    }
  ],
  dietary: [
    { value: "none", label: "无限制", emoji: "✅" },
    { value: "vegetarian", label: "素食", emoji: "🥗" },
    { value: "halal", label: "清真", emoji: "☪️" },
    { value: "seafood_allergy", label: "海鲜过敏", emoji: "🚫🦐" }
  ]
};

export const BAR_OPTIONS = {
  budget: [
    { 
      value: "80以下", 
      label: "80以下", 
      emoji: "🍺",
      color: "border-green-500/30",
      bgColor: "bg-green-500/5",
      description: "轻松畅饮 (人均单杯)"
    },
    { 
      value: "80-150", 
      label: "80-150", 
      emoji: "🍸",
      color: "border-purple-500/30",
      bgColor: "bg-purple-500/5",
      description: "精品调酒 (人均单杯)"
    }
  ],
  barThemes: [
    { 
      value: "精酿", 
      label: "精酿", 
      emoji: "🍻",
      description: "精酿啤酒吧"
    },
    { 
      value: "清吧", 
      label: "清吧", 
      emoji: "🕯️",
      description: "安静私密的清吧"
    },
    { 
      value: "私密调酒", 
      label: "私密调酒", 
      emoji: "🍹",
      description: "专业调酒师服务"
    }
  ],
  alcoholComfort: [
    { 
      value: "可以喝酒", 
      label: "可以喝酒", 
      emoji: "🍷",
      description: "享受小酌"
    },
    { 
      value: "微醺就好", 
      label: "微醺就好", 
      emoji: "😌",
      description: "浅尝即止"
    },
    { 
      value: "无酒精", 
      label: "无酒精", 
      emoji: "🥤",
      description: "只喝软饮"
    }
  ],
  musicPreference: [
    { value: "live", label: "现场Live", emoji: "🎸" },
    { value: "dj", label: "DJ打碟", emoji: "🎧" },
    { value: "quiet", label: "安静交流", emoji: "💬" }
  ]
};
