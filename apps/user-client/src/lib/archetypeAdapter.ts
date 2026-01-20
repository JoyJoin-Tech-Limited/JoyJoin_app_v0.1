/**
 * Archetype Adapter - Frontend-specific PNG mapping
 * Maps registry assetKey to actual Vite-bundled PNG imports
 * 
 * This adapter bridges the shared archetypeRegistry (which stores logical assetKeys)
 * with the frontend's bundled PNG assets (which require Vite imports).
 */

import corgiImg from "@/assets/开心柯基_transparent_1.png";
import roosterImg from "@/assets/太阳鸡_transparent_6.png";
import pigletImg from "@/assets/夸夸豚_transparent_5.png";
import foxImg from "@/assets/机智狐_transparent_2.png";
import dolphinImg from "@/assets/淡定海豚_transparent_7.png";
import spiderImg from "@/assets/织网蛛_transparent_4.png";
import bearImg from "@/assets/暖心熊_transparent_3.png";
import octopusImg from "@/assets/灵感章鱼_transparent_12.png";
import owlImg from "@/assets/沉思猫头鹰_transparent_8.png";
import elephantImg from "@/assets/定心大象_transparent_11.png";
import turtleImg from "@/assets/稳如龟_transparent_9.png";
import catImg from "@/assets/隐身猫_transparent_10.png";

import { archetypeRegistry, type ArchetypeRecord } from "@shared/personality/archetypeRegistry";

const assetKeyToPng: Record<string, string> = {
  'corgi': corgiImg,
  'rooster': roosterImg,
  'dolphin_praise': pigletImg,
  'fox': foxImg,
  'dolphin_calm': dolphinImg,
  'spider': spiderImg,
  'bear': bearImg,
  'octopus': octopusImg,
  'owl': owlImg,
  'elephant': elephantImg,
  'turtle': turtleImg,
  'cat': catImg,
};

/**
 * Get PNG avatar URL for an archetype name with optional expression variant
 */
export function getArchetypeAvatar(archetypeName: string, expression?: string): string {
  const record = archetypeRegistry[archetypeName];
  if (record) {
    const baseAsset = assetKeyToPng[record.assetKey] || '';
    
    // Try expression-specific asset first if expression is provided
    if (expression) {
      const expressionKey = `${record.assetKey}_${expression}`;
      const expressionAsset = assetKeyToPng[expressionKey];
      if (expressionAsset) {
        return expressionAsset;
      }
    }
    
    return baseAsset;
  }
  return '';
}

/**
 * Check if an expression-specific asset exists for an archetype
 */
export function hasExpressionAsset(archetypeName: string, expression?: string): boolean {
  if (!expression) return false;
  
  const record = archetypeRegistry[archetypeName];
  if (!record) return false;
  
  const expressionKey = `${record.assetKey}_${expression}`;
  return !!assetKeyToPng[expressionKey];
}

/**
 * Get all avatars as a Record<archetypeName, pngUrl>
 * For backward compatibility with existing code using archetypeAvatars
 * 
 * Note: Expression variants should be accessed via getArchetypeAvatar(name, expression)
 * If expression-specific assets exist in the future, add them to assetKeyToPng like:
 * 'corgi_starry': corgiStarryImg, 'corgi_hearts': corgiHeartsImg, etc.
 */
export const archetypeAvatars: Record<string, string> = Object.fromEntries(
  Object.keys(archetypeRegistry).map(name => [name, getArchetypeAvatar(name)])
);

/**
 * Get background color class for an archetype
 */
export function getArchetypeBgColor(archetypeName: string): string {
  const record = archetypeRegistry[archetypeName];
  return record?.displayTokens.bgColorClass || 'bg-gray-100';
}

/**
 * Get gradient class for an archetype
 */
export function getArchetypeGradient(archetypeName: string): string {
  const record = archetypeRegistry[archetypeName];
  return record?.displayTokens.gradientKey || 'from-gray-500 to-gray-600';
}

/**
 * Get color class for an archetype
 */
export function getArchetypeColorClass(archetypeName: string): string {
  const record = archetypeRegistry[archetypeName];
  return record?.displayTokens.colorClass || 'text-gray-600';
}

/**
 * Get full archetype record
 */
export function getArchetypeRecord(archetypeName: string): ArchetypeRecord | undefined {
  return archetypeRegistry[archetypeName];
}

/**
 * Get archetype narrative data
 */
export function getArchetypeNarrative(archetypeName: string) {
  const record = archetypeRegistry[archetypeName];
  return record?.narrative;
}

/**
 * Get archetype insights data
 */
export function getArchetypeInsights(archetypeName: string) {
  const record = archetypeRegistry[archetypeName];
  return record?.insights;
}

/**
 * Get all archetype names
 */
export function getAllArchetypeNames(): string[] {
  return Object.keys(archetypeRegistry);
}

/**
 * Get archetypes that are confusable with the given archetype
 */
export function getConfusableArchetypes(archetypeName: string): string[] {
  const record = archetypeRegistry[archetypeName];
  return record?.profile.confusableWith || [];
}

export { archetypeRegistry };
