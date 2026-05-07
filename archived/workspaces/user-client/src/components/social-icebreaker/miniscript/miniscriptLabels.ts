import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';

export const MINI_SCRIPT_STYLE_OPTIONS: Array<{ value: MiniScriptStyle; label: string }> = [
  { value: 'western_court', label: '西欧宫廷' },
  { value: 'medieval', label: '中世纪' },
  { value: 'ancient_chinese', label: '古风' },
  { value: 'xianxia', label: '仙侠' },
  { value: 'future_tech', label: '未来科技' },
  { value: 'modern_urban', label: '现代都市' },
  { value: 'republican_era', label: '民国' },
];

export const MINI_SCRIPT_GENRE_OPTIONS: Array<{ value: MiniScriptGenre; label: string }> = [
  { value: 'light_reasoning', label: '轻推理' },
  { value: 'thriller_mystery', label: '惊悚悬疑' },
  { value: 'romance', label: '浪漫爱情' },
  { value: 'absurd_comedy', label: '荒诞喜剧' },
];

export const DEFAULT_MINI_SCRIPT_GENRES: MiniScriptGenre[] = MINI_SCRIPT_GENRE_OPTIONS.map((g) => g.value);
