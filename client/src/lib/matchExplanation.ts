interface AttendeeData {
  userId: string;
  displayName: string;
  archetype?: string;
  topInterests?: string[];
  ageBand?: string;
  industry?: string;
}

const explanationTemplates = {
  sharedInterests: [
    "这桌聚集了对{interests}充满热情的朋友。我们平衡了{archetype1}的{quality1}与{archetype2}的{quality2}，确保对话既热烈又有深度。",
    "基于你们对{interests}的共同兴趣，我们为你们搭建了这个圈子。{archetype1}和{archetype2}的组合会让聚会既活跃又有意义。",
    "这桌汇聚了{interests}爱好者。{archetype1}带来{quality1}，{archetype2}提供{quality2}，这个组合将创造难忘的交流体验。"
  ],
  complementaryVibes: [
    "我们为哲学探讨和个人故事创造了一个空间，通过混合{archetype1}和{archetype2}。你对深度对话的舒适度与其他同样享受超越表面聊天的朋友完美匹配。",
    "这桌平衡了{archetype1}的{quality1}和{archetype2}的{quality2}。这样的组合能激发既有深度又轻松的对话氛围。",
    "我们将{archetype1}和{archetype2}配对，创造一个思维碰撞的空间。你会发现这桌的化学反应特别好。"
  ],
  diverseBackgrounds: [
    "这个小组融合了{industries}领域的朋友，都对{interests}充满兴趣。不同背景的组合将带来独特的视角交流。",
    "我们混合了来自{industries}的朋友，统一于对{interests}的热爱。这样的多元背景组合会创造特别的对话火花。",
    "跨界组合：{industries}汇聚一堂，通过{interests}这个共同语言相连。期待意想不到的思维碰撞。"
  ]
};

const archetypeQualities: Record<string, { zh: string, en: string }> = {
  // 12-Archetype Animal Social Vibe System
  "开心柯基": { zh: "活力破冰", en: "energetic icebreaking" },
  "太阳鸡": { zh: "温暖正能量", en: "warm positivity" },
  "夸夸豚": { zh: "积极鼓励", en: "uplifting encouragement" },
  "机智狐": { zh: "探索新鲜", en: "curious exploration" },
  "淡定海豚": { zh: "平衡氛围", en: "balanced vibes" },
  "织网蛛": { zh: "社交连接", en: "social networking" },
  "暖心熊": { zh: "深度倾听", en: "empathetic listening" },
  "灵感章鱼": { zh: "创意发散", en: "creative inspiration" },
  "沉思猫头鹰": { zh: "深刻洞察", en: "thoughtful insight" },
  "定心大象": { zh: "稳定支持", en: "grounding presence" },
  "稳如龟": { zh: "深度观察", en: "keen observation" },
  "隐身猫": { zh: "安静陪伴", en: "gentle presence" },
};

function getRandomTemplate(templates: string[]): string {
  return templates[Math.floor(Math.random() * templates.length)];
}

function findCommonInterests(attendees: AttendeeData[]): string[] {
  const interestCounts = new Map<string, number>();
  
  attendees.forEach(attendee => {
    (attendee.topInterests || []).forEach(interest => {
      interestCounts.set(interest, (interestCounts.get(interest) || 0) + 1);
    });
  });
  
  return Array.from(interestCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([interest, _]) => interest);
}

function findTopArchetypes(attendees: AttendeeData[]): string[] {
  const archetypeCounts = new Map<string, number>();
  
  attendees.forEach(attendee => {
    if (attendee.archetype) {
      archetypeCounts.set(attendee.archetype, (archetypeCounts.get(attendee.archetype) || 0) + 1);
    }
  });
  
  return Array.from(archetypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([archetype, _]) => archetype);
}

function findIndustries(attendees: AttendeeData[]): string[] {
  const industries = attendees
    .map(a => a.industry)
    .filter((industry): industry is string => !!industry && industry !== "");
  
  const uniqueIndustries = Array.from(new Set(industries));
  return uniqueIndustries.slice(0, 3);
}

export function generateMatchExplanation(attendees: AttendeeData[]): string {
  if (!attendees || attendees.length === 0) {
    return "我们为你精心匹配了一桌志同道合的朋友，期待你们的精彩聚会！";
  }
  
  const commonInterests = findCommonInterests(attendees);
  const topArchetypes = findTopArchetypes(attendees);
  const industries = findIndustries(attendees);
  
  // Decide which template category to use
  let template: string;
  let explanation: string;
  
  if (commonInterests.length >= 2) {
    // Use shared interests template
    template = getRandomTemplate(explanationTemplates.sharedInterests);
    const interestsStr = commonInterests.join("、");
    const archetype1 = topArchetypes[0] || "暖心熊";
    const archetype2 = topArchetypes[1] || "开心柯基";
    const quality1 = archetypeQualities[archetype1]?.zh || "独特视角";
    const quality2 = archetypeQualities[archetype2]?.zh || "活力氛围";
    
    explanation = template
      .replace("{interests}", interestsStr)
      .replace("{archetype1}", archetype1)
      .replace("{archetype2}", archetype2)
      .replace("{quality1}", quality1)
      .replace("{quality2}", quality2);
      
  } else if (topArchetypes.length >= 2) {
    // Use complementary vibes template
    template = getRandomTemplate(explanationTemplates.complementaryVibes);
    const archetype1 = topArchetypes[0];
    const archetype2 = topArchetypes[1];
    const quality1 = archetypeQualities[archetype1]?.zh || "独特视角";
    const quality2 = archetypeQualities[archetype2]?.zh || "生动表达";
    
    explanation = template
      .replace("{archetype1}", archetype1)
      .replace("{archetype2}", archetype2)
      .replace("{quality1}", quality1)
      .replace("{quality2}", quality2);
      
  } else if (industries.length >= 2) {
    // Use diverse backgrounds template
    template = getRandomTemplate(explanationTemplates.diverseBackgrounds);
    const industriesStr = industries.join("、");
    const interestsStr = commonInterests.length > 0 
      ? commonInterests.join("、")
      : (attendees[0]?.topInterests?.[0] || "共同话题");
    
    explanation = template
      .replace("{industries}", industriesStr)
      .replace("{interests}", interestsStr);
      
  } else {
    // Default template
    explanation = "我们为你精心匹配了一桌有趣的朋友，每个人都有独特的故事和视角。这将是一场充满惊喜的聚会！";
  }
  
  return explanation;
}
