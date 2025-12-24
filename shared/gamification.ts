// JoyJoin 游戏化等级系统配置

// ============ 等级配置 ============

export interface LevelConfig {
  level: number;
  name: string;
  nameCn: string;
  xpRequired: number;
  icon: string;
  benefits: string[];
  benefitsCn: string[];
}

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: "Seedling",
    nameCn: "新芽",
    xpRequired: 0,
    icon: "sprout",
    benefits: ["Basic features"],
    benefitsCn: ["基础功能"],
  },
  {
    level: 2,
    name: "Explorer",
    nameCn: "探索者",
    xpRequired: 100,
    icon: "compass",
    benefits: ["View more match profiles"],
    benefitsCn: ["查看更多匹配档案"],
  },
  {
    level: 3,
    name: "Connector",
    nameCn: "连接者",
    xpRequired: 300,
    icon: "link",
    benefits: ["Priority matching boost"],
    benefitsCn: ["优先匹配权"],
  },
  {
    level: 4,
    name: "Social Star",
    nameCn: "社交达人",
    xpRequired: 600,
    icon: "star",
    benefits: ["Early event registration"],
    benefitsCn: ["专属活动优先报名"],
  },
  {
    level: 5,
    name: "Community Pillar",
    nameCn: "社区之星",
    xpRequired: 1000,
    icon: "trophy",
    benefits: ["5% discount on events"],
    benefitsCn: ["活动享5%折扣"],
  },
  {
    level: 6,
    name: "Trusted Friend",
    nameCn: "老友",
    xpRequired: 1500,
    icon: "handshake",
    benefits: ["10% discount on events", "Badge display"],
    benefitsCn: ["活动享10%折扣", "专属徽章展示"],
  },
  {
    level: 7,
    name: "Joy Maker",
    nameCn: "欢乐使者",
    xpRequired: 2200,
    icon: "party-popper",
    benefits: ["15% discount on events", "VIP customer support"],
    benefitsCn: ["活动享15%折扣", "VIP客服支持"],
  },
  {
    level: 8,
    name: "Legend",
    nameCn: "传奇",
    xpRequired: 3000,
    icon: "crown",
    benefits: ["20% discount on events", "Exclusive events access"],
    benefitsCn: ["活动享20%折扣", "专属活动邀请"],
  },
  {
    level: 9,
    name: "Ambassador",
    nameCn: "大使",
    xpRequired: 4000,
    icon: "sparkles",
    benefits: ["25% discount on events", "Invite friends to exclusive events"],
    benefitsCn: ["活动享25%折扣", "邀请好友参加专属活动"],
  },
  {
    level: 10,
    name: "Founding Member",
    nameCn: "创始成员",
    xpRequired: 5500,
    icon: "gem",
    benefits: ["30% discount on events", "Lifetime VIP status", "Priority everything"],
    benefitsCn: ["活动享30%折扣", "终身VIP身份", "全功能优先权"],
  },
];

// ============ XP 获取配置 ============

export interface XPReward {
  action: string;
  actionCn: string;
  xp: number;
  coins: number;
  description: string;
}

export const XP_REWARDS: Record<string, XPReward> = {
  // 注册相关
  registration_express: {
    action: "registration_express",
    actionCn: "快速模式注册",
    xp: 20,
    coins: 10,
    description: "完成快速模式注册",
  },
  registration_standard: {
    action: "registration_standard",
    actionCn: "标准模式注册",
    xp: 50,
    coins: 25,
    description: "完成标准模式注册",
  },
  registration_deep: {
    action: "registration_deep",
    actionCn: "深度模式注册",
    xp: 100,
    coins: 50,
    description: "完成深度模式注册",
  },
  
  // 活动相关
  event_register: {
    action: "event_register",
    actionCn: "报名活动",
    xp: 20,
    coins: 10,
    description: "成功报名一次活动",
  },
  event_checkin: {
    action: "event_checkin",
    actionCn: "活动签到",
    xp: 50,
    coins: 30,
    description: "完成活动签到",
  },
  event_complete: {
    action: "event_complete",
    actionCn: "完成活动",
    xp: 80,
    coins: 50,
    description: "全程参与活动",
  },
  
  // 反馈相关
  feedback_basic: {
    action: "feedback_basic",
    actionCn: "基础反馈",
    xp: 20,
    coins: 20,
    description: "提交基础活动反馈",
  },
  feedback_deep: {
    action: "feedback_deep",
    actionCn: "深度反馈",
    xp: 50,
    coins: 50,
    description: "提交深度活动反馈",
  },
  atmosphere_check: {
    action: "atmosphere_check",
    actionCn: "氛围检查",
    xp: 15,
    coins: 15,
    description: "完成活动中氛围反馈",
  },
  
  // 连击奖励
  streak_3_weeks: {
    action: "streak_3_weeks",
    actionCn: "3周连击",
    xp: 200,
    coins: 100,
    description: "连续3周参加活动",
  },
  streak_6_weeks: {
    action: "streak_6_weeks",
    actionCn: "6周连击",
    xp: 500,
    coins: 250,
    description: "连续6周参加活动",
  },
  streak_12_weeks: {
    action: "streak_12_weeks",
    actionCn: "12周连击",
    xp: 1000,
    coins: 500,
    description: "连续12周参加活动",
  },
  
  // 社交互动
  first_match: {
    action: "first_match",
    actionCn: "首次匹配",
    xp: 100,
    coins: 50,
    description: "首次成功匹配",
  },
  profile_complete: {
    action: "profile_complete",
    actionCn: "完善资料",
    xp: 50,
    coins: 25,
    description: "完成个人资料100%",
  },
};

// ============ 优惠券兑换配置 ============

export interface RedeemableItem {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  descriptionCn: string;
  costCoins: number;
  type: 'discount_coupon' | 'free_event' | 'priority_access';
  value: number; // 折扣百分比或金额
  validDays: number; // 有效期天数
}

export const REDEEMABLE_ITEMS: RedeemableItem[] = [
  {
    id: "coupon_10_off",
    name: "10% Off Coupon",
    nameCn: "9折优惠券",
    description: "10% off on next event",
    descriptionCn: "下次活动享9折优惠",
    costCoins: 100,
    type: 'discount_coupon',
    value: 10,
    validDays: 30,
  },
  {
    id: "coupon_20_off",
    name: "20% Off Coupon",
    nameCn: "8折优惠券",
    description: "20% off on next event",
    descriptionCn: "下次活动享8折优惠",
    costCoins: 200,
    type: 'discount_coupon',
    value: 20,
    validDays: 30,
  },
  {
    id: "coupon_30_off",
    name: "30% Off Coupon",
    nameCn: "7折优惠券",
    description: "30% off on next event",
    descriptionCn: "下次活动享7折优惠",
    costCoins: 350,
    type: 'discount_coupon',
    value: 30,
    validDays: 30,
  },
  {
    id: "coupon_50_off",
    name: "50% Off Coupon",
    nameCn: "5折优惠券",
    description: "50% off on next event",
    descriptionCn: "下次活动享5折优惠",
    costCoins: 600,
    type: 'discount_coupon',
    value: 50,
    validDays: 30,
  },
  {
    id: "free_event_ticket",
    name: "Free Event Ticket",
    nameCn: "免费活动名额",
    description: "One free event ticket",
    descriptionCn: "一次免费活动名额",
    costCoins: 1000,
    type: 'free_event',
    value: 100,
    validDays: 60,
  },
  {
    id: "priority_access",
    name: "Priority Access Pass",
    nameCn: "优先报名通行证",
    description: "Priority registration for one event",
    descriptionCn: "一次活动优先报名权",
    costCoins: 150,
    type: 'priority_access',
    value: 1,
    validDays: 14,
  },
];

// ============ 工具函数 ============

/**
 * 根据XP计算等级
 */
export function calculateLevel(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpRequired) {
      return LEVELS[i].level;
    }
  }
  return 1;
}

/**
 * 获取等级配置
 */
export function getLevelConfig(level: number): LevelConfig {
  return LEVELS.find(l => l.level === level) || LEVELS[0];
}

/**
 * 获取下一级所需XP
 */
export function getXPForNextLevel(currentXP: number): { nextLevel: number; xpNeeded: number; progress: number } | null {
  const currentLevel = calculateLevel(currentXP);
  if (currentLevel >= 10) {
    return null; // 已满级
  }
  
  const nextLevelConfig = LEVELS.find(l => l.level === currentLevel + 1);
  if (!nextLevelConfig) return null;
  
  const currentLevelConfig = getLevelConfig(currentLevel);
  const xpInCurrentLevel = currentXP - currentLevelConfig.xpRequired;
  const xpNeededForNext = nextLevelConfig.xpRequired - currentLevelConfig.xpRequired;
  const progress = Math.min(100, Math.round((xpInCurrentLevel / xpNeededForNext) * 100));
  
  return {
    nextLevel: currentLevel + 1,
    xpNeeded: nextLevelConfig.xpRequired - currentXP,
    progress,
  };
}

/**
 * 获取等级折扣百分比
 */
export function getLevelDiscount(level: number): number {
  const discountMap: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 5,
    6: 10,
    7: 15,
    8: 20,
    9: 25,
    10: 30,
  };
  return discountMap[level] || 0;
}

// XP Transaction Types
export const XP_TRANSACTION_TYPES = [
  'registration',
  'event_register',
  'event_checkin',
  'event_complete',
  'feedback',
  'streak_bonus',
  'first_match',
  'profile_complete',
  'redeem', // 消耗悦币
  'admin_adjust', // 管理员调整
] as const;

export type XPTransactionType = typeof XP_TRANSACTION_TYPES[number];
