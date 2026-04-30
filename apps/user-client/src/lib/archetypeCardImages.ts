/**
 * Archetype Card Image Mapping
 * Maps archetypes and emotions to the personality test result card images
 */

// Map simplified Chinese (used in code) to traditional Chinese (used in file names)
const archetypeNameMap: Record<string, string> = {
  "fox": "機智狐",
  "corgi": "開心柯基",
  "koala": "koala",
  "spider": "織網蛛",
  "hamster_praise": "捧场王仓鼠",
  "rooster": "太陽雞",
  "dolphin_calm": "dolphin_calm",
  "owl": "沉思貓頭鷹",
  "turtle": "穩如龜",
  "cat": "隱身貓",
  "elephant": "elephant",
  "octopus": "靈感章魚"
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
 * @param archetype - Archetype name in simplified Chinese (e.g., "fox")
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