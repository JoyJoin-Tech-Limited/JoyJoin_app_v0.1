import { cdnAsset } from './cdnAssets'

const LOVART_BASE = '/assets/lovart'

export const MATCHING_PUZZLE_ASSETS = {
  tableTexture: {
    webp: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.webp`),
    png: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.png`),
    local: `${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.webp`,
  },
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

export type PuzzleParticleColor = keyof typeof MATCHING_PUZZLE_ASSETS.particles

export function getParticleSrc(
  color: PuzzleParticleColor,
  attempt: 'cdn' | 'png' | 'local'
): string {
  const asset = MATCHING_PUZZLE_ASSETS.particles[color]
  if (attempt === 'cdn') return asset.webp
  if (attempt === 'png') return asset.png
  return asset.local
}

export function getTableTextureSrc(attempt: 'cdn' | 'png' | 'local'): string {
  const asset = MATCHING_PUZZLE_ASSETS.tableTexture
  if (attempt === 'cdn') return asset.webp
  if (attempt === 'png') return asset.png
  return asset.local
}
