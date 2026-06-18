/**
 * Canonical interest category colors — keep in sync with
 * apps/mini-program/src/styles/_variables.scss
 */
export const CATEGORY_COLORS = {
  food: '#E8A87C',
  play: '#F4A6B5',
  sports: '#7FB3A3',
  culture: '#B8A8D8',
  life: '#A8C8E8',
  growth: '#E8A8A8',
} as const

export type CategoryColorKey = keyof typeof CATEGORY_COLORS
