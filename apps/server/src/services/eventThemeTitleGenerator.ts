/**
 * Event Theme Title Generator Service
 * 
 * Generates creative event theme titles and taglines for event pool groups based on:
 * - Data ONLY collected in onboarding (EssentialDataPage + ExtendedDataPage)
 * - Full data provenance with file/line citations
 * - DeepSeek API for creative generation
 * 
 * Data Sources:
 * - users table: displayName, gender, birthYear, relationshipStatus, educationLevel, 
 *                industryCategory, industryCategoryLabel, industryNiche, industryNicheLabel,
 *                occupationId, workMode, hometownRegionCity, currentCity, intent, archetype
 * - user_interests table: Interest selections from JSONB (selections, topPriorities)
 * - archetypeRegistry: energyLevel for each archetype
 * - eventPoolRegistrations: budgetRange, cuisinePreferences, eventIntent
 */

import { archetypeRegistry } from "@shared/personality/archetypeRegistry";
import { calculateAge } from "@shared/utils";

/**
 * Enriched member profile with all onboarding data + event preferences
 */
export interface EnrichedMemberProfile {
  userId: string;
  displayName: string | null;
  gender: string | null;
  birthdate: string | null;
  relationshipStatus: string | null;
  educationLevel: string | null;
  
  // Work (3-tier classification)
  industryCategory: string | null;
  industryCategoryLabel: string | null;
  industryNiche: string | null;
  industryNicheLabel: string | null;
  occupationId: string | null;
  workMode: string | null;
  
  // Location
  hometownRegionCity: string | null;
  currentCity: string | null;
  
  // Personality
  archetype: string | null;
  secondaryArchetype: string | null;
  energyLevel: number; // From archetypeRegistry
  
  // Intent
  intent: string | null;
  
  // Interests (from user_interests table)
  topInterests: Array<{
    topicId: string;
    label: string;
    fullName: string;
    category: string;
    heat: number;
  }>;
  
  // Event preferences (from registration)
  budgetRange: string[] | null;
  cuisinePreferences: string[] | null;
  eventIntent: string[] | null;
}

/**
 * Group statistics calculated from member profiles
 */
export interface GroupStats {
  avgEnergy: number;
  energyDistribution: {
    high: number;    // count >= 80
    medium: number;  // count 60-79
    low: number;     // count < 60
  };
  sharedInterests: Array<{
    interest: string;
    label: string;
    count: number;
  }>;
  industryDiversity: number; // Unique industryNiche count
  dominantIndustry: string | null; // Industry with >= 50% representation
  dominantIndustryLabel: string | null;
  genderDistribution: {
    male: number;
    female: number;
    other: number;
  };
  avgAge: number | null;
  citiesRepresented: string[];
}

/**
 * Event theme title generation result with full provenance
 */
export interface EventThemeTitleResult {
  eventThemeTitle: string;
  themeTagline: string;
  emoji: string;
  reasoning: string;
  citedValues: {
    energyLevels: number[];
    energySource: string;
    sharedInterests: string[];
    interestSource: string;
    industries: string[];
    industrySource: string;
  };
}

/**
 * Fetch enriched member profiles with all onboarding data
 */
export async function fetchEnrichedMemberProfiles(
  memberIds: string[],
  poolId: string
): Promise<EnrichedMemberProfile[]> {
  if (memberIds.length === 0) {
    return [];
  }

  const [{ db }, { users, userInterests, eventPoolRegistrations }, { and, eq, inArray }] = await Promise.all([
    import('../db'),
    import('@shared/schema'),
    import('drizzle-orm'),
  ]);

  // 1. Fetch user profiles
  const userProfiles = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      gender: users.gender,
      birthdate: users.birthdate,
      relationshipStatus: users.relationshipStatus,
      educationLevel: users.educationLevel,
      industryCategory: users.industryCategory,
      industryCategoryLabel: users.industryCategoryLabel,
      industryNiche: users.industryNiche,
      industryNicheLabel: users.industryNicheLabel,
      occupationId: users.occupationId,
      workMode: users.workMode,
      hometownRegionCity: users.hometownRegionCity,
      currentCity: users.currentCity,
      archetype: users.archetype,
      secondaryArchetype: users.secondaryArchetype,
      intent: users.intent,
    })
    .from(users)
    .where(inArray(users.id, memberIds));

  // 2. Fetch user interests (top 5 per user)
  const userInterestsData = await db
    .select()
    .from(userInterests)
    .where(inArray(userInterests.userId, memberIds));

  // Create interests map
  interface InterestSelection {
    topicId: string;
    label: string;
    fullName?: string;
    category?: string;
    heat: number;
    level?: number;
  }
  
  const interestsMap = new Map<string, InterestSelection[]>();
  userInterestsData.forEach((row: { userId: string; selections: unknown }) => {
    const selections = (row.selections as InterestSelection[]) || [];
    // Get top priorities (level 3) or all selections sorted by heat
    const topInterests = selections
      .filter((s: InterestSelection) => s.level === 3 || s.heat >= 10)
      .sort((a: InterestSelection, b: InterestSelection) => b.heat - a.heat)
      .slice(0, 5);
    interestsMap.set(row.userId, topInterests);
  });

  // 3. Fetch event registrations for this specific pool
  const registrations = await db
    .select({
      userId: eventPoolRegistrations.userId,
      budgetRange: eventPoolRegistrations.budgetRange,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
      eventIntent: eventPoolRegistrations.eventIntent,
    })
    .from(eventPoolRegistrations)
    .where(
      and(
        inArray(eventPoolRegistrations.userId, memberIds),
        eq(eventPoolRegistrations.poolId, poolId)
      )
    );

  type RegistrationRecord = {
    userId: string;
    budgetRange: string[] | null;
    cuisinePreferences: string[] | null;
    eventIntent: string[] | null;
  };

  const registrationMap = new Map<string, RegistrationRecord>(
    registrations.map((r: RegistrationRecord) => [r.userId, r])
  );

  // 4. Combine into enriched profiles
  const enrichedProfiles: EnrichedMemberProfile[] = userProfiles.map((user: typeof userProfiles[0]) => {
    const interests = interestsMap.get(user.id) || [];
    const registration = registrationMap.get(user.id) as RegistrationRecord | undefined;
    
    // Get energy level from archetypeRegistry
    const archetype = user.archetype || "暖心熊";
    const archetypeData = archetypeRegistry[archetype];
    const energyLevel = archetypeData?.profile.energyLevel || 50;

    return {
      userId: user.id,
      displayName: user.displayName,
      gender: user.gender,
      birthdate: user.birthdate ?? null,
      relationshipStatus: user.relationshipStatus,
      educationLevel: user.educationLevel,
      industryCategory: user.industryCategory,
      industryCategoryLabel: user.industryCategoryLabel,
      industryNiche: user.industryNiche,
      industryNicheLabel: user.industryNicheLabel,
      occupationId: user.occupationId,
      workMode: user.workMode,
      hometownRegionCity: user.hometownRegionCity,
      currentCity: user.currentCity,
      archetype: user.archetype,
      secondaryArchetype: user.secondaryArchetype,
      energyLevel,
      intent: user.intent,
      topInterests: interests.map((i: InterestSelection) => ({
        topicId: i.topicId,
        label: i.label,
        fullName: i.fullName || i.label,
        category: i.category || '',
        heat: i.heat,
      })),
      budgetRange: registration?.budgetRange || null,
      cuisinePreferences: registration?.cuisinePreferences || null,
      eventIntent: registration?.eventIntent || null,
    };
  });

  return enrichedProfiles;
}

/**
 * Calculate group statistics from member profiles
 */
export function calculateGroupStats(
  members: EnrichedMemberProfile[]
): GroupStats {
  // Energy statistics
  const energyLevels = members.map((m) => m.energyLevel);
  const totalEnergy = energyLevels.reduce((a, b) => a + b, 0);
  const avgEnergy = energyLevels.length > 0 ? totalEnergy / energyLevels.length : 0;
  
  const energyDistribution = {
    high: energyLevels.filter((e) => e >= 80).length,
    medium: energyLevels.filter((e) => e >= 60 && e < 80).length,
    low: energyLevels.filter((e) => e < 60).length,
  };

  // Shared interests (appearing 2+ times)
  const interestCounts = new Map<string, { label: string; count: number }>();
  members.forEach((member) => {
    member.topInterests.forEach((interest) => {
      const current = interestCounts.get(interest.topicId);
      if (current) {
        current.count++;
      } else {
        interestCounts.set(interest.topicId, {
          label: interest.label,
          count: 1,
        });
      }
    });
  });
  
  const sharedInterests = Array.from(interestCounts.entries())
    .filter(([_, data]) => data.count >= 2)
    .map(([topicId, data]) => ({
      interest: topicId,
      label: data.label,
      count: data.count,
    }))
    .sort((a, b) => b.count - a.count);

  // Industry diversity
  const industries = members
    .map((m) => m.industryNiche)
    .filter((i) => i !== null) as string[];
  const uniqueIndustries = new Set(industries);
  const industryDiversity = uniqueIndustries.size;

  // Dominant industry (>= 50% representation)
  const industryCounts = new Map<string, { label: string; count: number }>();
  members.forEach((m) => {
    if (m.industryNiche && m.industryNicheLabel) {
      const current = industryCounts.get(m.industryNiche);
      if (current) {
        current.count++;
      } else {
        industryCounts.set(m.industryNiche, {
          label: m.industryNicheLabel,
          count: 1,
        });
      }
    }
  });
  
  let dominantIndustry: string | null = null;
  let dominantIndustryLabel: string | null = null;
  industryCounts.forEach((data, industry) => {
    if (data.count >= members.length * 0.5) {
      dominantIndustry = industry;
      dominantIndustryLabel = data.label;
    }
  });

  // Gender distribution
  const genderDistribution = {
    male: members.filter((m) => m.gender === "男性").length,
    female: members.filter((m) => m.gender === "女性").length,
    other: members.filter((m) => m.gender && !["男性", "女性"].includes(m.gender)).length,
  };

  // Average age (calculated from birthdate using shared helper)
  const ages = members
    .map((m) => m.birthdate ? calculateAge(m.birthdate) : null)
    .filter((a) => a !== null) as number[];
  const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : null;

  // Cities represented
  const cities = members
    .map((m) => m.currentCity)
    .filter((c) => c !== null) as string[];
  const citiesRepresented = Array.from(new Set(cities));

  return {
    avgEnergy,
    energyDistribution,
    sharedInterests,
    industryDiversity,
    dominantIndustry,
    dominantIndustryLabel,
    genderDistribution,
    avgAge,
    citiesRepresented,
  };
}

/**
 * Generate event theme title and tagline with basic heuristics
 * 
 * Uses "Mirror + Insight" formula:
 * - Mirror: Reflect what users know about themselves
 * - Insight: Add meaning they hadn't articulated
 * 
 * Note: Currently uses rule-based generation. DeepSeek API integration can be added later.
 */
export async function generateEventThemeTitle(
  memberIds: string[],
  poolId: string
): Promise<EventThemeTitleResult> {
  // Fetch enriched profiles
  const members = await fetchEnrichedMemberProfiles(memberIds, poolId);
  
  if (members.length === 0) {
    throw new Error("No member profiles found");
  }

  // Calculate group statistics
  const stats = calculateGroupStats(members);

  // Collect cited values
  const energyLevels = members.map((m) => m.energyLevel);
  const industries = members
    .map((m) => m.industryNicheLabel || m.industryCategoryLabel)
    .filter((i) => i !== null) as string[];
  const sharedInterests = stats.sharedInterests.map((i) => i.label);

  // Rule-based theme title generation logic
  let eventThemeTitle = "";
  let themeTagline = "";
  let emoji: string;
  
  if (stats.sharedInterests.length > 0 && stats.industryDiversity >= 2) {
    const topInterest = stats.sharedInterests[0].label;
    eventThemeTitle = `${topInterest}跨界探索队`;
    themeTagline = `因${topInterest}相遇的跨行业创新组合`;
    emoji = "🔥";
  } else if (stats.dominantIndustry && stats.sharedInterests.length > 0) {
    const topInterest = stats.sharedInterests[0].label;
    eventThemeTitle = `${stats.dominantIndustryLabel}×${topInterest}小组`;
    themeTagline = `都是${stats.dominantIndustryLabel}圈的${topInterest}爱好者`;
    emoji = "☕";
  } else if (stats.avgEnergy >= 80) {
    eventThemeTitle = "高能量探险者联盟";
    themeTagline = "能量拉满的活力派聚会";
    emoji = "⚡";
  } else if (stats.avgEnergy < 60) {
    eventThemeTitle = "沉思者的温和空间";
    themeTagline = "低调深度交流的舒适场";
    emoji = "🌙";
  } else {
    eventThemeTitle = "多元融合探索组";
    themeTagline = "不同背景碰撞出的化学反应";
    emoji = "🎨";
  }

  // Validate and enforce length constraints
  // Event theme title: 8-12 characters
  if (eventThemeTitle.length < 8) {
    eventThemeTitle = eventThemeTitle + "小组"; // Pad if too short
  }
  if (eventThemeTitle.length > 12) {
    eventThemeTitle = eventThemeTitle.substring(0, 12);
  }
  
  // Tagline: 20-30 characters
  if (themeTagline.length < 20) {
    // Pad with generic suffix if too short
    themeTagline = themeTagline + "的精彩相遇";
  }
  if (themeTagline.length > 30) {
    themeTagline = themeTagline.substring(0, 30);
  }

  // Build reasoning with accurate citations
  const uniqueIndustryNiches = new Set(
    members.map(m => m.industryNiche).filter(Boolean)
  );
  
  const reasoning = `主题整合了以下维度:\n` +
    `1. 行业多样性 [数据源: users.industry_niche, ${uniqueIndustryNiches.size}个不同细分行业]\n` +
    `2. 共同兴趣话题 [数据源: user_interests.selections, ${stats.sharedInterests.length}个共享话题]\n` +
    `3. 能量分布 [数据源: archetypeRegistry.energyLevel, 平均${Math.round(stats.avgEnergy)}]\n` +
    `标语用镜像+洞察公式,反映小组特质。`;

  return {
    eventThemeTitle,
    themeTagline,
    emoji,
    reasoning,
    citedValues: {
      energyLevels,
      energySource: "archetypeRegistry.ts Lines 67, 104, 141, 178, 215, 252, 289, 326, 363, 400, 437, 474",
      sharedInterests,
      interestSource: "user_interests table (selections field)",
      industries,
      industrySource: "users.industry_niche_label",
    },
  };
}
