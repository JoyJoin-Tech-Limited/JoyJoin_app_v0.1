// apps/server/src/archetypeConfig.ts
export const ARCHETYPE_NAMES = [
  "开心柯基",
  "太阳鸡",
  "夸夸豚",
  "机智狐",
  "淡定海豚",
  "织网蛛",
  "暖心熊",
  "灵感章鱼",
  "沉思猫头鹰",
  "定心大象",
  "稳如龟",
  "隐身猫",
] as const;

export type ArchetypeName = (typeof ARCHETYPE_NAMES)[number];
