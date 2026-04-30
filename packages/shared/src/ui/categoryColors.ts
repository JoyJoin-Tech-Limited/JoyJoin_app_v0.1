/**
 * Canonical interest category colors — keep in sync with
 * apps/mini-program/src/styles/_variables.scss
 */
export const CATEGORY_COLORS = {
  food: '#E8A87C',
  entertainment: '#8FB8E8',
  lifestyle: '#8FBFA3',
  culture: '#B8A8D8',
  social: '#E8A8A8',
} as const

export type CategoryColorKey = keyof typeof CATEGORY_COLORS
