/**
 * Team Name Generator Service
 * 
 * Generates creative team names and taglines for event pool groups based on:
 * - Data ONLY collected in onboarding (EssentialDataPage + ExtendedDataPage)
 * - Full data provenance with file/line citations
 * - DeepSeek API for creative generation
 * 
 * Data Sources:
 * - users table: displayName, gender, birthYear, relationshipStatus, educationLevel, 
 *                industryCategory, industryCategoryLabel, industryNiche, industryNicheLabel,
 *                occupationId, workMode, hometownRegionCity, currentCity, intent, archetype
 * - user_interests table: Top interests (selections with is_top flag)
 * - archetypeRegistry: energyLevel for each archetype
 * - eventPoolRegistrations: budgetRange, cuisinePreferences, eventIntent
 */

import { db } from "../db";
import { users, userInterests, eventPoolRegistrations } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { archetypeRegistry } from "@shared/personality/archetypeRegistry";

/**
 * Enriched member profile with all onboarding data + event preferences
 */
export interface EnrichedMemberProfile {
  userId: string;
  displayName: string | null;
  gender: string | null;
  birthYear: number | null;
  age: number | null;
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
 * Team name generation result with full provenance
 */
export interface TeamNameResult {
  teamName: string;
  teamTagline: string;
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

  // 1. Fetch user profiles
  const userProfiles = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      gender: users.gender,
      birthYear: users.birthYear,
      age: users.age,
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
  const interestsMap = new Map<string, any[]>();
  userInterestsData.forEach((row) => {
    const selections = (row.selections as any[]) || [];
    // Get top priorities (level 3) or all selections sorted by heat
    const topInterests = selections
      .filter((s: any) => s.level === 3 || s.heat >= 10)
      .sort((a: any, b: any) => b.heat - a.heat)
      .slice(0, 5);
    interestsMap.set(row.userId, topInterests);
  });

  // 3. Fetch event registrations
  const registrations = await db
    .select({
      userId: eventPoolRegistrations.userId,
      budgetRange: eventPoolRegistrations.budgetRange,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
      eventIntent: eventPoolRegistrations.eventIntent,
    })
    .from(eventPoolRegistrations)
    .where(
      inArray(eventPoolRegistrations.userId, memberIds)
    );

  const registrationMap = new Map(
    registrations.map((r) => [r.userId, r])
  );

  // 4. Combine into enriched profiles
  const enrichedProfiles: EnrichedMemberProfile[] = userProfiles.map((user) => {
    const interests = interestsMap.get(user.id) || [];
    const registration = registrationMap.get(user.id);
    
    // Get energy level from archetypeRegistry
    const archetype = user.archetype || "暖心熊";
    const archetypeData = archetypeRegistry[archetype];
    const energyLevel = archetypeData?.profile.energyLevel || 50;

    return {
      userId: user.id,
      displayName: user.displayName,
      gender: user.gender,
      birthYear: user.birthYear,
      age: user.age,
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
      topInterests: interests.map((i: any) => ({
        topicId: i.topicId,
        label: i.label,
        fullName: i.fullName,
        category: i.category,
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
  const avgEnergy = energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length;
  
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

  // Average age
  const ages = members.map((m) => m.age).filter((a) => a !== null) as number[];
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
 * Generate team name and tagline using DeepSeek API
 * 
 * Uses "Mirror + Insight" formula:
 * - Mirror: Reflect what users know about themselves
 * - Insight: Add meaning they hadn't articulated
 */
export async function generateTeamName(
  memberIds: string[],
  poolId: string
): Promise<TeamNameResult> {
  // Fetch enriched profiles
  const members = await fetchEnrichedMemberProfiles(memberIds, poolId);
  
  if (members.length === 0) {
    throw new Error("No member profiles found");
  }

  // Calculate group statistics
  const stats = calculateGroupStats(members);

  // Build context for AI
  const memberSummaries = members.map((m, idx) => ({
    index: idx + 1,
    archetype: m.archetype,
    energy: m.energyLevel,
    industry: m.industryNicheLabel || m.industryCategoryLabel,
    interests: m.topInterests.map((i) => i.label).slice(0, 3),
    city: m.currentCity,
  }));

  // Collect cited values
  const energyLevels = members.map((m) => m.energyLevel);
  const industries = members
    .map((m) => m.industryNicheLabel || m.industryCategoryLabel)
    .filter((i) => i !== null) as string[];
  const sharedInterests = stats.sharedInterests.map((i) => i.label);

  // TODO: Integrate with DeepSeek API
  // For now, return a structured result with basic logic
  
  // Simple name generation logic
  let teamName = "";
  let teamTagline = "";
  let emoji = "✨";
  
  if (stats.sharedInterests.length > 0 && stats.industryDiversity >= 2) {
    const topInterest = stats.sharedInterests[0].label;
    teamName = `${topInterest}跨界探索队`;
    teamTagline = `因${topInterest}相遇的跨行业创新组合`;
    emoji = "🔥";
  } else if (stats.dominantIndustry && stats.sharedInterests.length > 0) {
    const topInterest = stats.sharedInterests[0].label;
    teamName = `${stats.dominantIndustryLabel}×${topInterest}小组`;
    teamTagline = `都是${stats.dominantIndustryLabel}圈的${topInterest}爱好者`;
    emoji = "☕";
  } else if (stats.avgEnergy >= 80) {
    teamName = "高能量探险者联盟";
    teamTagline = "能量拉满的活力派聚会";
    emoji = "⚡";
  } else if (stats.avgEnergy < 60) {
    teamName = "沉思者的温和空间";
    teamTagline = "低调深度交流的舒适场";
    emoji = "🌙";
  } else {
    teamName = "多元融合探索组";
    teamTagline = "不同背景碰撞出的化学反应";
    emoji = "🎨";
  }

  // Trim to character limits
  if (teamName.length > 12) {
    teamName = teamName.substring(0, 12);
  }
  if (teamTagline.length > 30) {
    teamTagline = teamTagline.substring(0, 30);
  }

  const reasoning = `名字整合了以下维度:\n` +
    `1. 行业分布 [数据源: users.industry_niche_label, ${stats.industryDiversity}个不同行业]\n` +
    `2. 共同兴趣 [数据源: user_interests表交集, ${stats.sharedInterests.length}个共同兴趣]\n` +
    `3. 能量平衡 [数据源: archetypeRegistry.energyLevel, 平均${Math.round(stats.avgEnergy)}]\n` +
    `标语用镜像+洞察公式,反映小组特质。`;

  return {
    teamName,
    teamTagline,
    emoji,
    reasoning,
    citedValues: {
      energyLevels,
      energySource: "archetypeRegistry.ts Lines 67, 104, 141, 215, 252, 289, 326, 363, 400, 437, 474",
      sharedInterests,
      interestSource: "user_interests table (selections field)",
      industries,
      industrySource: "users.industry_niche_label",
    },
  };
}
