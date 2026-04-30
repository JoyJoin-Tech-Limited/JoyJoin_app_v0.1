import { z } from 'zod';
import type { MiniScriptGenre, MiniScriptStyle } from './miniscriptStoryFramework';

// ═══════════════════════════════════════════════════════════════════════════════
// Mini Script Card Catalog — Style & Genre Picker Metadata
// ═══════════════════════════════════════════════════════════════════════════════
// This is the bundled manifest for the mini-program style/genre picker.
// Product-owned static data. CI validates that every MINI_SCRIPT_STYLES entry
// has a matching catalog entry.
//
// NOTE(design): Proprietary gradient thumbnails will be added in a future design pass. Tracked in design backlog.
// Lovart-generated illustrations once assets are ready. Each style should
// have a 120×180 WebP thumbnail (≤4KB) in the mini-program asset bundle.
// ═══════════════════════════════════════════════════════════════════════════════

export const catalogSchemaVersion = '1.0.0' as const;

export const miniscriptStyleCardSchema = z.object({
  key: z.string(),
  label: z.string(),
  emoji: z.string(),
  // Gradient tokens for CSS fallback when thumbnail is not yet available
  gradientFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  gradientTo: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  gradientAngle: z.number().min(0).max(360).default(135),
  // Asset path (relative to mini-program src/assets/)
  // When null/undefined, the card renders with CSS gradient + emoji only.
  thumbnailPath: z.string().optional(),
  // CDN URL for full-resolution decorative hero (600×900px WebP)
  heroCdnUrl: z.string().url().optional(),
});

export const miniscriptGenreCardSchema = z.object({
  key: z.string(),
  label: z.string(),
  emoji: z.string(),
  // Mood gradient for the genre card background (pure CSS, no image)
  gradientFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  gradientTo: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  gradientAngle: z.number().min(0).max(360).default(135),
  // Accent color for selection glow and icons
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const miniscriptCatalogSchema = z.object({
  schemaVersion: z.literal(catalogSchemaVersion),
  styles: z.array(miniscriptStyleCardSchema).min(1),
  genres: z.array(miniscriptGenreCardSchema).min(1),
});

export type MiniscriptStyleCard = z.infer<typeof miniscriptStyleCardSchema>;
export type MiniscriptGenreCard = z.infer<typeof miniscriptGenreCardSchema>;
export type MiniscriptCatalog = z.infer<typeof miniscriptCatalogSchema>;

// ─── Canonical Catalog ────────────────────────────────────────────────────────

export const MINISCRIPT_CATALOG: MiniscriptCatalog = {
  schemaVersion: catalogSchemaVersion,
  styles: [
    {
      key: 'western_court',
      label: '西欧宫廷',
      emoji: '👑',
      gradientFrom: '#2D1B4E',
      gradientTo: '#8B5CF6',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/western-court-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/western-court-hero.webp',
    },
    {
      key: 'medieval',
      label: '中世纪',
      emoji: '⚔️',
      gradientFrom: '#1F2937',
      gradientTo: '#4B5563',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/medieval-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/medieval-hero.webp',
    },
    {
      key: 'ancient_chinese',
      label: '古风',
      emoji: '🏮',
      gradientFrom: '#7C2D12',
      gradientTo: '#DC2626',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/ancient-chinese-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/ancient-chinese-hero.webp',
    },
    {
      key: 'xianxia',
      label: '仙侠',
      emoji: '🗡️',
      gradientFrom: '#0C4A6E',
      gradientTo: '#38BDF8',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/xianxia-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/xianxia-hero.webp',
    },
    {
      key: 'future_tech',
      label: '未来科技',
      emoji: '🤖',
      gradientFrom: '#0F172A',
      gradientTo: '#06B6D4',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/future-tech-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/future-tech-hero.webp',
    },
    {
      key: 'modern_urban',
      label: '现代都市',
      emoji: '🏙️',
      gradientFrom: '#312E81',
      gradientTo: '#6366F1',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/modern-urban-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/modern-urban-hero.webp',
    },
    {
      key: 'republican_era',
      label: '民国',
      emoji: '🎞️',
      gradientFrom: '#451A03',
      gradientTo: '#B45309',
      gradientAngle: 135,
      thumbnailPath: '/assets/miniscript/republican-era-thumb.webp',
      heroCdnUrl: 'https://joyjoinapp.com/static/assets/miniscript/republican-era-hero.webp',
    },
  ],
  genres: [
    {
      key: 'light_reasoning',
      label: '轻推理',
      emoji: '🔍',
      gradientFrom: '#FEF3C7',
      gradientTo: '#FDBA74',
      gradientAngle: 135,
      accentColor: '#F59E0B',
    },
    {
      key: 'thriller_mystery',
      label: '惊悚悬疑',
      emoji: '🌑',
      gradientFrom: '#1E1B4B',
      gradientTo: '#4338CA',
      gradientAngle: 135,
      accentColor: '#6366F1',
    },
    {
      key: 'romance',
      label: '浪漫爱情',
      emoji: '💕',
      gradientFrom: '#FCE7F3',
      gradientTo: '#F472B6',
      gradientAngle: 135,
      accentColor: '#EC4899',
    },
    {
      key: 'absurd_comedy',
      label: '荒诞喜剧',
      emoji: '🎭',
      gradientFrom: '#ECFCCB',
      gradientTo: '#A3E635',
      gradientAngle: 135,
      accentColor: '#84CC16',
    },
  ],
};

// Validate at module load in development
if (process.env.NODE_ENV !== 'production') {
  const result = miniscriptCatalogSchema.safeParse(MINISCRIPT_CATALOG);
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('[miniscriptCatalog] Catalog validation failed:', result.error.flatten());
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getStyleCard(key: MiniScriptStyle): MiniscriptStyleCard | undefined {
  return MINISCRIPT_CATALOG.styles.find((s) => s.key === key);
}

export function getGenreCard(key: MiniScriptGenre): MiniscriptGenreCard | undefined {
  return MINISCRIPT_CATALOG.genres.find((g) => g.key === key);
}

export function getStyleGradient(style: MiniscriptStyleCard): string {
  return `linear-gradient(${style.gradientAngle}deg, ${style.gradientFrom}, ${style.gradientTo})`;
}

export function getGenreGradient(genre: MiniscriptGenreCard): string {
  return `linear-gradient(${genre.gradientAngle}deg, ${genre.gradientFrom}, ${genre.gradientTo})`;
}

// Surprise Me — special slot filler
export const SURPRISE_ME_CARD = {
  key: '__surprise_me__',
  label: '随机惊喜',
  subtitle: '交给小悦决定',
  emoji: '🎲',
  gradientFrom: '#F5F0FF',
  gradientTo: '#EDE9FE',
  gradientAngle: 135,
  accentColor: '#8B5CF6',
} as const;
