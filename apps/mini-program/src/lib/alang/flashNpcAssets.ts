export type FlashNpcTheme = {
  slug: string
  name: string
  animal: string
  fallbackGlyph: string
  accent: string
  tint: string
  ink: string
}

export const FLASH_UNIVERSAL_ART = '/pages/alang/assets/flash-city-encounter.webp'
export const FLASH_STREET_BOX_ICON = '/assets/illustrations/street-blind-box-entry.png'

const npcThemes: FlashNpcTheme[] = [
  {
    slug: 'alang',
    name: '阿浪',
    animal: '灰狼',
    fallbackGlyph: '浪',
    accent: '#64748B',
    tint: '#F0F2F7',
    ink: '#3E4658',
  },
  {
    slug: 'lizi',
    name: '栗子',
    animal: '水獭',
    fallbackGlyph: '栗',
    accent: '#F97360',
    tint: '#FFF2E9',
    ink: '#70402B',
  },
  {
    slug: 'momo',
    name: '默默',
    animal: '兔狲',
    fallbackGlyph: '默',
    accent: '#829AB1',
    tint: '#F3F0EC',
    ink: '#48433F',
  },
  {
    slug: 'shiqi',
    name: '拾柒',
    animal: '乌鸦',
    fallbackGlyph: '柒',
    accent: '#5B5266',
    tint: '#F1EFF8',
    ink: '#37324D',
  },
  {
    slug: 'atuan',
    name: '阿团',
    animal: '水豚',
    fallbackGlyph: '团',
    accent: '#8DA399',
    tint: '#F0F5EC',
    ink: '#43543A',
  },
]

export const flashNpcAssets = Object.fromEntries(
  npcThemes.map((theme) => [theme.slug, theme]),
) as Record<string, FlashNpcTheme>

const DEFAULT_THEME: FlashNpcTheme = {
  slug: 'unknown',
  name: '城市朋友',
  animal: '数字动物',
  fallbackGlyph: '友',
  accent: '#8B5CF6',
  tint: '#F5F0FF',
  ink: '#5B34A8',
}

const SLUG_ALIASES: Record<string, string> = {
  'a-lang': 'alang',
  wolf: 'alang',
  otter: 'lizi',
  pallas: 'momo',
  crow: 'shiqi',
  capybara: 'atuan',
}

export function resolveFlashNpcTheme(slug?: string, name?: string): FlashNpcTheme {
  const normalizedSlug = (slug ?? '').trim().toLowerCase()
  const aliasedSlug = SLUG_ALIASES[normalizedSlug] ?? normalizedSlug
  const bySlug = flashNpcAssets[aliasedSlug]
  if (bySlug) return bySlug

  const byName = npcThemes.find((theme) => theme.name === name)
  if (byName) return byName

  const fallbackName = name?.trim() || DEFAULT_THEME.name
  return {
    ...DEFAULT_THEME,
    name: fallbackName,
    fallbackGlyph: fallbackName.slice(0, 1),
  }
}

export const flashTaskCategories = {
  city_departure: { label: '城市出发', accent: '#5B8DB8', text: '#315F87', tint: '#EEF4FA' },
  culture_entertainment: { label: '文化娱乐', accent: '#6E5BA6', text: '#5A478F', tint: '#F3F0FA' },
  body_movement: { label: '身体动起来', accent: '#6B9E75', text: '#3F7049', tint: '#EDF6F2' },
  long_delayed_wish: { label: '一直想做', accent: '#C77D58', text: '#7A3D21', tint: '#FFF2E9' },
  relationship_connection: { label: '关系连接', accent: '#C26A8C', text: '#84405D', tint: '#F9EEF2' },
  npc_message: { label: 'NPC传话', accent: '#C99A3C', text: '#76520F', tint: '#FAF4E4' },
  shop_exploration: { label: '探店', accent: '#C77D58', text: '#7A3D21', tint: '#FFF2E9' },
  city_observation: { label: '城市观察', accent: '#5B8DB8', text: '#315F87', tint: '#EEF4FA' },
  social_courage: { label: '轻社交勇气', accent: '#C26A8C', text: '#84405D', tint: '#F9EEF2' },
  solo_relaxation: { label: '独处放松', accent: '#6B9E75', text: '#3F7049', tint: '#EDF6F2' },
  culture_discovery: { label: '文化发现', accent: '#6E5BA6', text: '#5A478F', tint: '#F3F0FA' },
  small_kindness: { label: '微小善意', accent: '#C99A3C', text: '#76520F', tint: '#FAF4E4' },
} as const

export function resolveFlashTaskCategory(category: string) {
  const normalized = category.trim().toLowerCase()
  const aliases: Record<string, keyof typeof flashTaskCategories> = {
    '城市出发': 'city_departure',
    '文化娱乐': 'culture_entertainment',
    '身体动起来': 'body_movement',
    '一直想做': 'long_delayed_wish',
    '关系连接': 'relationship_connection',
    'NPC传话': 'npc_message',
    '探店': 'shop_exploration',
    '城市观察': 'city_observation',
    '轻社交勇气': 'social_courage',
    '独处放松': 'solo_relaxation',
    '文化发现': 'culture_discovery',
    '微小善意': 'small_kindness',
  }
  return flashTaskCategories[(aliases[category] ?? normalized) as keyof typeof flashTaskCategories]
    ?? { label: category || '城市任务', accent: '#8B5CF6', text: '#5B34A8', tint: '#F5F0FF' }
}
