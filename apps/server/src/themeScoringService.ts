/**
 * Theme Scoring Service
 * 主题评分服务
 * 
 * Implements dual scoring system (mystery + grounding) for event theme components
 */

import type { 
  DimensionData, 
  ThemeComponent, 
  MemberProfile 
} from '@shared/types/eventTheme';
import { archetypeRegistry } from '@shared/personality/archetypeRegistry';

/**
 * Event Theme Weights (Archetype-Led, Mystery-First)
 */
export const EVENT_THEME_WEIGHTS = {
  archetype: 0.30,     // #1: JoyJoin's unique IP, mystery factor
  interests: 0.25,     // #2: Activity hook (MUST be heat >= 2)
  intent: 0.20,        // #3: Experience framing
  hometown: 0.15,      // #4: Grounding element (for subtitle)
  industry: 0.10,      // #5: Context flavor
  age: 0.00,           // #6: Rarely useful (only for special cases)
};

/**
 * Mystery Value Scores (0-100)
 * How intriguing/novel is this dimension?
 */
const MYSTERY_VALUES = {
  archetype: 95,    // Most mysterious - JoyJoin exclusive
  interests: 70,    // Moderately intriguing
  intent: 50,       // Somewhat mysterious
  industry: 40,     // Professional = less mysterious
  hometown: 30,     // Factual = not mysterious
  age: 20,          // Boring
};

/**
 * Grounding Value Scores (0-100)
 * How concrete/relatable is this dimension?
 */
const GROUNDING_VALUES = {
  hometown: 100,    // Most concrete
  interests: 90,    // Tangible
  intent: 80,       // Clear purpose
  industry: 70,     // Professional context
  age: 60,          // Demographic fact
  archetype: 40,    // Abstract
};

/**
 * Extract dimension data from member profiles
 */
export function extractDimensions(members: MemberProfile[]): DimensionData {
  const dimensions: DimensionData = {};
  
  // 1. Archetype dimension
  const archetypes = members
    .map(m => m.archetype)
    .filter((a): a is string => a !== null);
  
  const secondaryArchetypes = members
    .map(m => m.secondaryArchetype)
    .filter((a): a is string => a !== null);
  
  if (archetypes.length > 0) {
    const archetypeSet = new Set(archetypes);
    const pattern = archetypeSet.size === 1 
      ? 'homogeneous' 
      : archetypeSet.size <= 3 
        ? 'complementary' 
        : 'diverse';
    
    // Calculate average energy
    const energies = archetypes
      .map(a => archetypeRegistry[a]?.profile.energyLevel || 50)
      .filter(e => e > 0);
    const avgEnergy = energies.length > 0 
      ? Math.round(energies.reduce((a, b) => a + b, 0) / energies.length)
      : 50;
    
    // Energy distribution
    const high = energies.filter(e => e >= 80).length;
    const medium = energies.filter(e => e >= 60 && e < 80).length;
    const low = energies.filter(e => e < 60).length;
    
    // Create dynamics string
    let dynamics = '';
    if (pattern === 'homogeneous') {
      dynamics = `${archetypes[0]}的快乐派对`;
    } else if (pattern === 'complementary') {
      const uniqueArchetypes = Array.from(archetypeSet).slice(0, 3);
      dynamics = uniqueArchetypes.join('×');
    } else {
      dynamics = '原型大聚会';
    }
    
    dimensions.archetype = {
      pattern,
      primaryArchetypes: Array.from(archetypeSet),
      secondaryArchetypes: Array.from(new Set(secondaryArchetypes)),
      avgEnergy,
      energyDistribution: { high, medium, low },
      dynamics,
    };
  }
  
  // 2. Interests dimension (only heat >= 2)
  const allInterests: Map<string, { count: number; totalHeat: number }> = new Map();
  
  for (const member of members) {
    if (!member.interests) continue;
    
    for (const interest of member.interests) {
      // CRITICAL: Only use interests with heat >= 2 (passion signal)
      if (interest.heat < 10) continue; // heat < 2 (heat is stored as 5, 10, 25)
      
      const existing = allInterests.get(interest.label) || { count: 0, totalHeat: 0 };
      allInterests.set(interest.label, {
        count: existing.count + 1,
        totalHeat: existing.totalHeat + interest.heat,
      });
    }
  }
  
  if (allInterests.size > 0) {
    const commonInterests = Array.from(allInterests.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgHeat: Math.round(data.totalHeat / data.count),
      }))
      .sort((a, b) => b.count - a.count || b.avgHeat - a.avgHeat);
    
    dimensions.interests = {
      commonInterests,
      topInterest: commonInterests[0],
    };
  }
  
  // 3. Intent dimension
  const intentCounts: Map<string, number> = new Map();
  
  for (const member of members) {
    if (!member.intent) continue;
    
    for (const i of member.intent) {
      intentCounts.set(i, (intentCounts.get(i) || 0) + 1);
    }
  }
  
  if (intentCounts.size > 0) {
    const sorted = Array.from(intentCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    dimensions.intent = {
      dominantIntent: sorted[0][0],
      count: sorted[0][1],
      mixed: intentCounts.size > 1,
    };
  }
  
  // 4. Hometown dimension
  const hometownCounts: Map<string, number> = new Map();
  
  for (const member of members) {
    if (!member.hometownRegionCity) continue;
    
    hometownCounts.set(
      member.hometownRegionCity,
      (hometownCounts.get(member.hometownRegionCity) || 0) + 1
    );
  }
  
  if (hometownCounts.size > 0) {
    const sorted = Array.from(hometownCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Only include if at least 2 people from same city
    if (sorted[0][1] >= 2) {
      dimensions.hometown = {
        commonCity: sorted[0][0],
        count: sorted[0][1],
      };
    }
  }
  
  // 5. Industry dimension
  const industryCounts: Map<string, number> = new Map();
  
  for (const member of members) {
    if (!member.industryNicheLabel) continue;
    
    industryCounts.set(
      member.industryNicheLabel,
      (industryCounts.get(member.industryNicheLabel) || 0) + 1
    );
  }
  
  if (industryCounts.size > 0) {
    const sorted = Array.from(industryCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Only include if at least 2 people from same industry
    if (sorted[0][1] >= 2) {
      dimensions.industry = {
        commonIndustry: sorted[0][0],
        count: sorted[0][1],
      };
    }
  }
  
  // 6. Age dimension (optional, rarely used)
  const birthYears = members
    .map(m => m.birthYear)
    .filter((y): y is string => y !== null);
  
  if (birthYears.length > 0) {
    const ages = birthYears.map(y => new Date().getFullYear() - parseInt(y));
    const avgAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    
    dimensions.age = {
      avgAge,
      range: `${minAge}-${maxAge}岁`,
    };
  }
  
  return dimensions;
}

/**
 * Determine usage type based on mystery and grounding values
 */
function determineUsageType(
  mysteryValue: number,
  groundingValue: number
): 'theme-lead' | 'subtitle-ground' | 'bonus' {
  // High mystery + low grounding → theme lead
  if (mysteryValue > 70 && groundingValue < 60) {
    return 'theme-lead';
  }
  
  // Low mystery + high grounding → subtitle
  if (mysteryValue < 50 && groundingValue > 80) {
    return 'subtitle-ground';
  }
  
  // Medium → bonus
  return 'bonus';
}

/**
 * Score dimensions for theme generation
 * Returns sorted components by finalScore (descending)
 */
export function scoreDimensionsForTheme(
  dimensions: DimensionData
): ThemeComponent[] {
  const components: ThemeComponent[] = [];
  
  // Score each dimension
  const dimensionKeys = Object.keys(dimensions) as Array<keyof DimensionData>;
  
  for (const key of dimensionKeys) {
    const data = dimensions[key];
    if (!data) continue;
    
    const mysteryValue = MYSTERY_VALUES[key] || 0;
    const groundingValue = GROUNDING_VALUES[key] || 0;
    const weight = EVENT_THEME_WEIGHTS[key] || 0;
    
    // Final Score = weight × (mysteryValue × 0.6 + groundingValue × 0.4)
    const finalScore = weight * (mysteryValue * 0.6 + groundingValue * 0.4);
    
    const usageType = determineUsageType(mysteryValue, groundingValue);
    
    // Determine data source
    let dataSource = '';
    if (key === 'archetype') {
      dataSource = 'archetypeRegistry.ts';
    } else if (key === 'interests') {
      dataSource = 'user_interests table (heat >= 2)';
    } else if (key === 'intent') {
      dataSource = 'users.intent';
    } else if (key === 'hometown') {
      dataSource = 'users.hometown_region_city';
    } else if (key === 'industry') {
      dataSource = 'users.industry_niche_label';
    } else if (key === 'age') {
      dataSource = 'users.birth_year';
    }
    
    components.push({
      dimension: key as any,
      usageType,
      mysteryValue,
      groundingValue,
      finalScore,
      data,
      dataSource,
    });
  }
  
  // Sort by finalScore descending
  components.sort((a, b) => b.finalScore - a.finalScore);
  
  return components;
}

/**
 * Select components for theme generation
 * Returns top components for LLM prompt
 */
export function selectThemeComponents(
  components: ThemeComponent[]
): {
  themeLeads: ThemeComponent[];
  subtitleGrounds: ThemeComponent[];
  bonus: ThemeComponent[];
} {
  const themeLeads = components.filter(c => c.usageType === 'theme-lead');
  const subtitleGrounds = components.filter(c => c.usageType === 'subtitle-ground');
  const bonus = components.filter(c => c.usageType === 'bonus');
  
  return {
    themeLeads,
    subtitleGrounds,
    bonus,
  };
}

/**
 * Get energy label based on avgEnergy score
 */
export function getEnergyLabel(avgEnergy: number): string {
  if (avgEnergy >= 80) return '超高能';
  if (avgEnergy >= 70) return '高能';
  if (avgEnergy >= 60) return '温暖';
  if (avgEnergy >= 50) return '平衡';
  if (avgEnergy >= 40) return '沉静';
  return '深度';
}

/**
 * Get energy emoji based on avgEnergy score
 */
export function getEnergyEmoji(avgEnergy: number): string {
  if (avgEnergy >= 85) return '🔥';
  if (avgEnergy >= 70) return '🌡️';
  if (avgEnergy >= 55) return '🌤️';
  if (avgEnergy >= 40) return '🌙';
  return '❄️';
}
