import { cdnAsset, localAsset } from './cdnAssets'

const LOVART_BASE = '/assets/lovart'
const PUZZLE_DIR = `${LOVART_BASE}/puzzle`

export const PUZZLE_PIECE_COUNT = 6

export const MATCHING_PUZZLE_ASSETS = {
  tableTexture: {
    webp: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.webp`),
    png: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.png`),
    local: `${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.webp`,
  },
  pieces: Array.from({ length: PUZZLE_PIECE_COUNT }, (_, index) => {
    const id = index + 1
    const base = `${PUZZLE_DIR}/lovart-puzzle-piece-${String(id).padStart(2, '0')}-20260701-v1`
    return {
      id,
      webp: cdnAsset(`${base}.webp`),
      png: cdnAsset(`${base}.png`),
      local: `${base}.webp`,
    }
  }),
  particles: {
    purple: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-purple-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-purple-20260701-v1.png`),
      local: `${LOVART_BASE}/lovart-particle-purple-20260701-v1.webp`,
    },
    coral: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-coral-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-coral-20260701-v1.png`),
      local: `${LOVART_BASE}/lovart-particle-coral-20260701-v1.webp`,
    },
    blue: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-blue-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-blue-20260701-v1.png`),
      local: `${LOVART_BASE}/lovart-particle-blue-20260701-v1.webp`,
    },
    green: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-green-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-green-20260701-v1.png`),
      local: `${LOVART_BASE}/lovart-particle-green-20260701-v1.webp`,
    },
  },
} as const

export type PuzzlePieceAsset = (typeof MATCHING_PUZZLE_ASSETS.pieces)[number]
export type PuzzleParticleColor = keyof typeof MATCHING_PUZZLE_ASSETS.particles

export function getPuzzlePieceSrc(
  pieceId: number,
  attempt: 'cdn' | 'png' | 'local'
): string {
  const asset = MATCHING_PUZZLE_ASSETS.pieces[pieceId - 1]
  if (!asset) return ''
  if (attempt === 'cdn') return asset.webp
  if (attempt === 'png') return asset.png
  return localAsset(asset.local)
}

/** Preloads the entire 6-piece puzzle set. Returns the CDN webp paths. */
export function getPuzzlePiecePreloadUrls(): string[] {
  return MATCHING_PUZZLE_ASSETS.pieces.map((p) => p.webp)
}

export function getParticleSrc(
  color: PuzzleParticleColor,
  attempt: 'cdn' | 'png' | 'local'
): string {
  const asset = MATCHING_PUZZLE_ASSETS.particles[color]
  if (attempt === 'cdn') return asset.webp
  if (attempt === 'png') return asset.png
  return localAsset(asset.local)
}

export function getTableTextureSrc(attempt: 'cdn' | 'png' | 'local'): string {
  const asset = MATCHING_PUZZLE_ASSETS.tableTexture
  if (attempt === 'cdn') return asset.webp
  if (attempt === 'png') return asset.png
  return localAsset(asset.local)
}
