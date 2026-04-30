/**
 * Event Theme Generator Service
 * 活动主题生成服务
 * 
 * Main orchestration service for mystery box (盲盒主题) event theme generation
 * Integrates scoring, LLM, and validation layers
 */

import { db } from './db';
import { users, userInterests, eventPoolGroups, eventPools } from '@shared/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import type { 
  EventTheme, 
  MemberProfile, 
  DimensionData, 
  ThemeComponent,
  ThemeLLMInput 
} from '@shared/types/eventTheme';
import { 
  extractDimensions, 
  scoreDimensionsForTheme
} from './themeScoringService';
import { generateThemeWithLLM } from './themeLLMService';

/**
 * Fetch enriched member profiles for theme generation
 */
async function fetchEnrichedMemberProfiles(
  memberIds: string[]
): Promise<MemberProfile[]> {
  // Fetch user data
  const usersData = await db
    .select({
      id: users.id,
      archetype: sql<string>`coalesce(${users.primaryArchetype}, ${users.archetype}, 'koala')`,
      secondaryArchetype: users.secondaryArchetype,
      gender: users.gender,
      birthdate: users.birthdate,
      industryNicheLabel: users.industryNicheLabel,
      hometownRegionCity: users.hometownRegionCity,
      currentCity: users.currentCity,
      intent: users.intent,
    })
    .from(users)
    .where(inArray(users.id, memberIds));
  
  // Fetch interests data
  const interestsData = await db
    .select()
    .from(userInterests)
    .where(inArray(userInterests.userId, memberIds));
  
  // Build member profiles
  const profiles: MemberProfile[] = [];
  
  interface InterestSelection {
    topicId: string;
    label: string;
    heat: number;
    level: number;
  }

  for (const user of usersData) {
    const userInterest = interestsData.find((i: { userId: string }) => i.userId === user.id);
    const selections = (userInterest?.selections as InterestSelection[]) || [];
    
    // Filter for heat >= 2 (stored as 10 or 25)
    const relevantInterests = selections
      .filter((s: InterestSelection) => s.heat >= 10)
      .map((s: InterestSelection) => ({
        topicId: s.topicId,
        label: s.label,
        heat: s.heat,
        level: s.level,
      }));
    
    // Extract birth year from birthdate
    let birthYear: string | null = null;
    if (user.birthdate) {
      const dateStr = typeof user.birthdate === 'string' 
        ? user.birthdate 
        : user.birthdate.toISOString();
      birthYear = dateStr.split('-')[0];
    }
    
    profiles.push({
      userId: user.id,
      archetype: user.archetype,
      secondaryArchetype: user.secondaryArchetype,
      gender: user.gender,
      birthYear,
      industryNicheLabel: user.industryNicheLabel,
      hometownRegionCity: user.hometownRegionCity,
      currentCity: user.currentCity,
      intent: user.intent,
      interests: relevantInterests.length > 0 ? relevantInterests : undefined,
    });
  }
  
  return profiles;
}

/**
 * Build LLM input from components and member data
 */
function buildLLMInput(
  components: ThemeComponent[],
  dimensions: DimensionData,
  city: string,
  eventType: string,
  memberCount: number
): ThemeLLMInput {
  const input: ThemeLLMInput = {
    energyProfile: {
      avgEnergy: dimensions.archetype?.avgEnergy || 50,
      highCount: dimensions.archetype?.energyDistribution.high || 0,
      mediumCount: dimensions.archetype?.energyDistribution.medium || 0,
      lowCount: dimensions.archetype?.energyDistribution.low || 0,
      pattern: dimensions.archetype?.pattern || 'complementary',
    },
    eventType,
    city,
    memberCount,
  };
  
  // Add archetype dynamics (theme lead)
  if (dimensions.archetype) {
    input.archetypeDynamics = dimensions.archetype.dynamics;
    input.avgEnergy = dimensions.archetype.avgEnergy;
    input.pattern = dimensions.archetype.pattern;
  }
  
  // Add grounding elements (subtitle)
  if (dimensions.hometown) {
    input.hometown = {
      city: dimensions.hometown.commonCity!,
      count: dimensions.hometown.count,
    };
  }
  
  if (dimensions.intent) {
    input.intent = {
      intent: dimensions.intent.dominantIntent!,
      count: dimensions.intent.count,
    };
  }
  
  if (dimensions.interests && dimensions.interests.topInterest) {
    input.interest = {
      name: dimensions.interests.topInterest.name,
      count: dimensions.interests.topInterest.count,
      avgHeat: dimensions.interests.topInterest.avgHeat,
    };
  }
  
  return input;
}

/**
 * Enrich theme with metadata
 */
function enrichThemeWithMetadata(
  theme: EventTheme,
  components: ThemeComponent[],
  dimensions: DimensionData
): EventTheme {
  // Build comprehensive reasoning
  const reasoningParts: string[] = ['主题整合:'];
  
  if (dimensions.archetype) {
    const { dynamics, avgEnergy, pattern } = dimensions.archetype;
    const patternLabel = 
      pattern === 'homogeneous' ? '同质型' :
      pattern === 'complementary' ? '互补型' : '多样型';
    reasoningParts.push(
      `1. 原型化学反应: ${dynamics} (${patternLabel}, 能量${avgEnergy}分) - archetypeRegistry.ts`
    );
  }
  
  if (dimensions.hometown) {
    reasoningParts.push(
      `2. 同乡: ${dimensions.hometown.count}人来自${dimensions.hometown.commonCity} - users.hometown_region_city`
    );
  }
  
  if (dimensions.interests && dimensions.interests.topInterest) {
    const { name, count, avgHeat } = dimensions.interests.topInterest;
    reasoningParts.push(
      `3. 强兴趣: ${count}人对${name}很上头 (热度${avgHeat}/25) - user_interests table (heat >= 2)`
    );
  }
  
  if (dimensions.intent) {
    reasoningParts.push(
      `4. 目的: ${dimensions.intent.count}人来${dimensions.intent.dominantIntent} - users.intent`
    );
  }
  
  reasoningParts.push(
    `\n体验设计理念: 用原型营造神秘感和性格认同，用具体元素(兴趣/老乡/目的)建立信任和话题。`
  );
  
  return {
    ...theme,
    reasoning: reasoningParts.join('\n'),
  };
}

/**
 * Main entry point: Generate event theme for a group
 */
export async function generateEventTheme(
  memberIds: string[],
  poolId: string
): Promise<EventTheme> {
  console.log(`[EventThemeGenerator] Generating theme for group with ${memberIds.length} members`);
  
  // Get pool info for context
  const pool = await db.select()
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1)
    .then((rows: any[]) => rows[0] || null);
  
  const city = pool?.city || '广州';
  const eventType = pool?.eventType || '饭局';
  
  // PHASE 1: Data Collection (deterministic)
  const members = await fetchEnrichedMemberProfiles(memberIds);
  
  console.log(`[EventThemeGenerator] Fetched ${members.length} member profiles`);
  
  // PHASE 2: Dimension Processing (deterministic)
  const dimensions = extractDimensions(members);
  
  console.log(`[EventThemeGenerator] Extracted dimensions:`, {
    hasArchetypes: !!dimensions.archetype,
    hasInterests: !!dimensions.interests,
    hasIntent: !!dimensions.intent,
    hasHometown: !!dimensions.hometown,
  });
  
  // PHASE 3: Scoring (deterministic)
  const components = scoreDimensionsForTheme(dimensions);
  
  console.log(`[EventThemeGenerator] Scored ${components.length} components`);
  
  // PHASE 4: LLM Input Preparation (deterministic)
  const llmInput = buildLLMInput(components, dimensions, city, eventType, memberIds.length);
  
  console.log(`[EventThemeGenerator] Built LLM input:`, {
    avgEnergy: llmInput.avgEnergy,
    hasHometown: !!llmInput.hometown,
    hasInterest: !!llmInput.interest,
  });
  
  // PHASE 5: LLM Generation (non-deterministic)
  const { theme, usedFallback, attempt, validationErrors } = await generateThemeWithLLM(llmInput);
  
  console.log(`[EventThemeGenerator] LLM generation complete:`, {
    usedFallback,
    attempt,
    validationErrors: validationErrors.length,
  });
  
  // PHASE 6: Post-processing
  const enrichedTheme = enrichThemeWithMetadata(theme, components, dimensions);
  
  console.log(`[EventThemeGenerator] Theme generated:`, {
    theme: enrichedTheme.theme,
    subtitle: enrichedTheme.subtitle,
    vibe: enrichedTheme.vibe,
  });
  
  return enrichedTheme;
}

/**
 * Save generated theme to database
 */
export async function saveEventTheme(
  groupId: string,
  theme: EventTheme
): Promise<void> {
  await db
    .update(eventPoolGroups)
    .set({
      theme: theme.theme,
      subtitle: theme.subtitle,
      vibe: theme.vibe,
      themeEmoji: theme.emoji,
      themeReasoning: theme.reasoning,
      themeGeneratedAt: new Date(),
    })
    .where(eq(eventPoolGroups.id, groupId));
  
  console.log(`[EventThemeGenerator] Theme saved to database for group ${groupId}`);
}

/**
 * Generate and save theme in one operation
 */
export async function generateAndSaveEventTheme(
  groupId: string,
  memberIds: string[],
  poolId: string
): Promise<EventTheme> {
  const theme = await generateEventTheme(memberIds, poolId);
  await saveEventTheme(groupId, theme);
  return theme;
}

/**
 * Batch generate themes for multiple groups
 */
export async function batchGenerateEventThemes(
  groups: Array<{ groupId: string; memberIds: string[]; poolId: string }>
): Promise<EventTheme[]> {
  const themes: EventTheme[] = [];
  
  for (const group of groups) {
    try {
      const theme = await generateAndSaveEventTheme(
        group.groupId,
        group.memberIds,
        group.poolId
      );
      themes.push(theme);
    } catch (error) {
      console.error(`[EventThemeGenerator] Error generating theme for group ${group.groupId}:`, error);
      // Continue with next group
    }
  }
  
  return themes;
}
