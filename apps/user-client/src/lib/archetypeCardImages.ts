/**
 * Archetype Card Image Mapping
 * Maps archetypes and emotions to the personality test result card images
 */

// Map simplified Chinese (used in code) to traditional Chinese (used in file names)
const archetypeNameMap: Record<string, string> = {
  "机智狐": "機智狐",
  "开心柯基": "開心柯基",
  "暖心熊": "暖心熊",
  "织网蛛": "織網蛛",
  "夸夸豚": "誇誇豚",
  "太阳鸡": "太陽雞",
  "淡定海豚": "淡定海豚",
  "沉思猫头鹰": "沉思貓頭鷹",
  "稳如龟": "穩如龜",
  "隐身猫": "隱身貓",
  "定心大象": "定心大象",
  "灵感章鱼": "靈感章魚"
};

// Map expression IDs to file name suffixes
const expressionFileMap: Record<string, string> = {
  "starry": "starry eyes",
  "hearts": "hearts",
  "shy": "shy cute",
  "shocked": "shocked cute"
};

/**
 * Get the card image path for a given archetype and expression
 * @param archetype - Archetype name in simplified Chinese (e.g., "机智狐")
 * @param expression - Expression ID (e.g., "starry", "hearts", "shy", "shocked")
 * @returns Full path to the card image
 */
export function getCardImagePath(archetype: string, expression: string): string {
  const traditionalName = archetypeNameMap[archetype];
  const emotionSuffix = expressionFileMap[expression];
  
  if (!traditionalName) {
    console.warn(`No traditional Chinese mapping found for archetype: ${archetype}`);
    return "";
  }
  
  if (!emotionSuffix) {
    console.warn(`No file suffix found for expression: ${expression}`);
    return "";
  }
  
  // Use public folder path for Vite compatibility
  return `/personality test result card/${traditionalName} ${emotionSuffix}.png`;
}

/**
 * Get all available card images for an archetype
 * @param archetype - Archetype name in simplified Chinese
 * @returns Object with all 4 emotion variants
 */
export function getArchetypeCardImages(archetype: string): Record<string, string> {
  const traditionalName = archetypeNameMap[archetype];
  
  if (!traditionalName) {
    console.warn(`No traditional Chinese mapping found for archetype: ${archetype}`);
    return {};
  }
  
  // Use public folder path for Vite compatibility
  return {
    starry: `/personality test result card/${traditionalName} starry eyes.png`,
    hearts: `/personality test result card/${traditionalName} hearts.png`,
    shy: `/personality test result card/${traditionalName} shy cute.png`,
    shocked: `/personality test result card/${traditionalName} shocked cute.png`,
  };
}

/**
 * Check if a card image exists for the given archetype and expression
 */
export function hasCardImage(archetype: string, expression: string): boolean {
  return !!archetypeNameMap[archetype] && !!expressionFileMap[expression];
}