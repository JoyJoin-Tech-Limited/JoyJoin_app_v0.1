/**
 * Pokemon TCG-Style Skill System for 12 Archetypes
 * 原型技能树系统 - Pokemon卡牌风格
 * 
 * This module defines the complete skill tree for all 12 archetypes,
 * including active and passive abilities with energy costs and effects.
 * 
 * Design Philosophy:
 * - Active Skills: Require energy cost, triggered by user action
 * - Passive Skills: Always active, no energy cost required
 * - Short Effects: Concise descriptions for Pokemon card display (≤15 chars)
 * - Full Effects: Detailed descriptions for reference/tooltips
 */

export interface ArchetypeSkill {
  /** 技能名称 (e.g., "摇尾热场波") */
  name: string;
  
  /** Skill type: active (requires energy) or passive (always on) */
  type: 'active' | 'passive';
  
  /** Energy consumption (0-3 for active skills, 0 for passive) */
  energyCost: number;
  
  /** Energy type emoji (🔥, 🗺️, 🧸, etc.) */
  energyType: string;
  
  /** Concise effect for Pokemon card display (max 15 Chinese characters) */
  shortEffect: string;
  
  /** Full description for reference/tooltips */
  fullEffect: string;
  
  /** Skill icon emoji */
  icon: string;
}

export interface ArchetypeSkillSet {
  /** Card attribute emoji + name (e.g., "🔥 热情") */
  attribute: string;
  
  /** Pokemon card title (e.g., "破冰点火官") */
  cardTitle: string;
  
  /** Active skill definition */
  activeSkill: ArchetypeSkill;
  
  /** Passive skill definition */
  passiveSkill: ArchetypeSkill;
}

/**
 * Complete skill tree definitions for all 12 archetypes
 * Keyed by archetype Chinese name
 */
export const archetypeSkills: Record<string, ArchetypeSkillSet> = {
  "开心柯基": {
    attribute: "🔥 热情",
    cardTitle: "破冰点火官",
    activeSkill: {
      name: "摇尾热场波",
      type: "active",
      energyCost: 2,
      energyType: "🔥",
      shortEffect: "破冰启动，参与度+50%",
      fullEffect: "立即打破沉默尴尬的氛围，使全员参与度提升50%，持续5分钟。特别适合活动开场或冷场时刻。",
      icon: "⚡"
    },
    passiveSkill: {
      name: "永动引擎",
      type: "passive",
      energyCost: 0,
      energyType: "🔥",
      shortEffect: "能量恢复速度+1/分钟",
      fullEffect: "始终保持高能量状态，社交能量自然恢复速度提升至每分钟+1点，不易感到疲惫。",
      icon: "🔋"
    }
  },

  "机智狐": {
    attribute: "🗺️ 探索",
    cardTitle: "秘境引路人",
    activeSkill: {
      name: "秘巷探照灯",
      type: "active",
      energyCost: 1,
      energyType: "🗺️",
      shortEffect: "发现隐藏地点或玩法",
      fullEffect: "运用敏锐洞察力发现周围环境中的隐藏地点、特殊玩法或有趣细节，为团队带来惊喜体验。",
      icon: "🔦"
    },
    passiveSkill: {
      name: "新奇雷达",
      type: "passive",
      energyCost: 0,
      energyType: "🗺️",
      shortEffect: "30%几率触发惊喜活动",
      fullEffect: "对新鲜事物保持高度敏感，在活动中有30%概率自动触发惊喜彩蛋或特殊事件。",
      icon: "📡"
    }
  },

  "暖心熊": {
    attribute: "🧸 共情",
    cardTitle: "故事编织师",
    activeSkill: {
      name: "故事编织术",
      type: "active",
      energyCost: 2,
      energyType: "🧸",
      shortEffect: "编织集体故事，连接++",
      fullEffect: "引导大家分享个人经历，编织成共同的集体记忆，大幅提升成员间的情感连接和归属感。",
      icon: "📖"
    },
    passiveSkill: {
      name: "安心拥抱领域",
      type: "passive",
      energyCost: 0,
      energyType: "🧸",
      shortEffect: "持续降低社交压力",
      fullEffect: "营造温暖包容的氛围，使周围成员的社交压力和焦虑感自然降低，更容易敞开心扉。",
      icon: "🤗"
    }
  },

  "沉思猫头鹰": {
    attribute: "💡 洞察",
    cardTitle: "本质透视者",
    activeSkill: {
      name: "本质透视",
      type: "active",
      energyCost: 2,
      energyType: "💡",
      shortEffect: "揭示本质议题",
      fullEffect: "通过深度思考和提问，引导讨论直达问题核心，揭示隐藏在表面现象下的本质议题。",
      icon: "🔍"
    },
    passiveSkill: {
      name: "思辨力场",
      type: "passive",
      energyCost: 0,
      energyType: "💡",
      shortEffect: "发言质量提升",
      fullEffect: "影响周围成员的思考深度，使团队讨论的质量和深度自然提升，减少肤浅闲聊。",
      icon: "🧠"
    }
  },

  "织网蛛": {
    attribute: "🕸️ 连接",
    cardTitle: "人脉架构师",
    activeSkill: {
      name: "人脉联结网",
      type: "active",
      energyCost: 1,
      energyType: "🕸️",
      shortEffect: "发现隐藏共同点",
      fullEffect: "快速识别团队成员间的隐藏共同点和潜在连接，促成意想不到的深度对话和合作关系。",
      icon: "🔗"
    },
    passiveSkill: {
      name: "社交网络",
      type: "passive",
      energyCost: 0,
      energyType: "🕸️",
      shortEffect: "弱连接自动增强",
      fullEffect: "自然维护和强化与他人的弱连接关系，使人脉网络持续扩大和巩固，不需刻意经营。",
      icon: "🌐"
    }
  },

  "淡定海豚": {
    attribute: "🌊 调和",
    cardTitle: "情绪冲浪手",
    activeSkill: {
      name: "情绪冲浪",
      type: "active",
      energyCost: 1,
      energyType: "🌊",
      shortEffect: "抵消尴尬与冲突",
      fullEffect: "巧妙化解紧张气氛和小型冲突，将负面情绪转化为平和状态，恢复团队和谐。",
      icon: "🏄"
    },
    passiveSkill: {
      name: "平滑波纹",
      type: "passive",
      energyCost: 0,
      energyType: "🌊",
      shortEffect: "情绪波动减少40%",
      fullEffect: "稳定周围的情绪波动，使团队氛围更加平和稳定，减少戏剧化的情绪起伏。",
      icon: "〰️"
    }
  },

  "夸夸豚": {
    attribute: "✨ 鼓舞",
    cardTitle: "闪光捕手",
    activeSkill: {
      name: "闪光捕捉术",
      type: "active",
      energyCost: 1,
      energyType: "✨",
      shortEffect: "优点放大，自信++",
      fullEffect: "精准捕捉他人的优点和闪光时刻，通过真诚赞美大幅提升对方的自信心和积极性。",
      icon: "✨"
    },
    passiveSkill: {
      name: "掌声回响",
      type: "passive",
      energyCost: 0,
      energyType: "✨",
      shortEffect: "自动鼓励机制",
      fullEffect: "为他人的努力和成就自动提供正向反馈，营造充满鼓励和认可的氛围。",
      icon: "👏"
    }
  },

  "太阳鸡": {
    attribute: "☀️ 暖意",
    cardTitle: "小太阳发光体",
    activeSkill: {
      name: "小太阳辐射",
      type: "active",
      energyCost: 2,
      energyType: "☀️",
      shortEffect: "持续幸福光环",
      fullEffect: "散发强大的正能量光环，持续提升周围所有人的心情和幸福感，效果可持续15分钟。",
      icon: "☀️"
    },
    passiveSkill: {
      name: "恒定发光体",
      type: "passive",
      energyCost: 0,
      energyType: "☀️",
      shortEffect: "免疫负面氛围",
      fullEffect: "保持稳定的阳光心态，不易受周围负面情绪影响，同时为他人提供情绪避难所。",
      icon: "🌞"
    }
  },

  "定心大象": {
    attribute: "🐘 安定",
    cardTitle: "定心锚点",
    activeSkill: {
      name: "象鼻定心锚",
      type: "active",
      energyCost: 1,
      energyType: "🐘",
      shortEffect: "提供绝对安心状态",
      fullEffect: "在不确定或混乱的情况下，提供稳如泰山的安全感和确定性，让所有人都能安心。",
      icon: "⚓"
    },
    passiveSkill: {
      name: "厚重守护",
      type: "passive",
      energyCost: 0,
      energyType: "🐘",
      shortEffect: "安全感阈值提升",
      fullEffect: "凭借稳重可靠的存在感，持续提升团队的整体安全感和信任度。",
      icon: "🛡️"
    }
  },

  "稳如龟": {
    attribute: "💎 真知",
    cardTitle: "真知炮台",
    activeSkill: {
      name: "真知慢放炮",
      type: "active",
      energyCost: 3,
      energyType: "💎",
      shortEffect: "蓄力后触发顿悟",
      fullEffect: "经过深思熟虑后给出的见解往往一针见血，需要较长蓄力时间，但命中时能引发团队顿悟。",
      icon: "💎"
    },
    passiveSkill: {
      name: "深度观察",
      type: "passive",
      energyCost: 0,
      energyType: "💎",
      shortEffect: "发现隐藏细节",
      fullEffect: "保持细致入微的观察力，能察觉到他人容易忽略的重要细节和模式。",
      icon: "👀"
    }
  },

  "灵感章鱼": {
    attribute: "🎨 灵感",
    cardTitle: "脑洞喷泉",
    activeSkill: {
      name: "脑洞喷墨术",
      type: "active",
      energyCost: 1,
      energyType: "🎨",
      shortEffect: "喷吐3个创意点子",
      fullEffect: "快速产生3个不同方向的创意想法，为讨论注入新鲜视角，激发团队脑暴灵感。",
      icon: "💡"
    },
    passiveSkill: {
      name: "多线程联想",
      type: "passive",
      energyCost: 0,
      energyType: "🎨",
      shortEffect: "脑暴灵感+50%",
      fullEffect: "保持多个思维线程并行运作，使脑暴会议的创意产出量提升50%。",
      icon: "🧵"
    }
  },

  "隐身猫": {
    attribute: "🌙 陪伴",
    cardTitle: "静默守护者",
    activeSkill: {
      name: "静默结界",
      type: "active",
      energyCost: 1,
      energyType: "🌙",
      shortEffect: "创造低压社交区",
      fullEffect: "营造一个没有表现压力的舒适空间，让内向者也能自在参与，不必强迫自己。",
      icon: "🔮"
    },
    passiveSkill: {
      name: "存在即安慰",
      type: "passive",
      energyCost: 0,
      energyType: "🌙",
      shortEffect: "降低表现压力",
      fullEffect: "通过安静而温和的存在，让他人感到被接纳和理解，减轻社交表现焦虑。",
      icon: "🌙"
    }
  }
};

/**
 * Get skill set for a specific archetype
 * @param archetype - The archetype Chinese name
 * @returns Skill set or undefined if archetype not found
 */
export function getArchetypeSkills(archetype: string): ArchetypeSkillSet | undefined {
  return archetypeSkills[archetype];
}

/**
 * Check if an archetype has skills defined
 * @param archetype - The archetype Chinese name
 * @returns True if skills exist for this archetype
 */
export function hasArchetypeSkills(archetype: string): boolean {
  return archetype in archetypeSkills;
}

/**
 * Get all available archetype names with skills
 * @returns Array of archetype Chinese names
 */
export function getAllSkillArchetypes(): string[] {
  return Object.keys(archetypeSkills);
}
