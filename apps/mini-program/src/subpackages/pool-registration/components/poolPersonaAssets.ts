import { cdnAsset } from '../../../lib/utils/cdnAssets'

const LOVART_BASE = '/assets/lovart'
const SUBPACKAGE_BASE = '/subpackages/pool-registration/assets/pool-persona'

export const POOL_PERSONA_ASSETS = {
  base: {
    webp: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-base-20260701-v1.webp`),
    png: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-base-20260701-v1.png`),
    subpackage: `${SUBPACKAGE_BASE}/lovart-pool-persona-base-20260701-v1.webp`,
  },
  clusterTexture: {
    webp: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.webp`),
    png: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.png`),
    subpackage: `${SUBPACKAGE_BASE}/lovart-pool-persona-cluster-texture-20260701-v1.webp`,
  },
  pawNudge: {
    webp: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-paw-nudge-20260701-v1.webp`),
    png: cdnAsset(`${LOVART_BASE}/lovart-pool-persona-paw-nudge-20260701-v1.png`),
    subpackage: `${SUBPACKAGE_BASE}/lovart-pool-persona-paw-nudge-20260701-v1.webp`,
  },
  particles: {
    purple: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-purple-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-purple-20260701-v1.png`),
      subpackage: `${SUBPACKAGE_BASE}/lovart-particle-purple-20260701-v1.webp`,
    },
    coral: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-coral-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-coral-20260701-v1.png`),
      subpackage: `${SUBPACKAGE_BASE}/lovart-particle-coral-20260701-v1.webp`,
    },
    blue: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-blue-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-blue-20260701-v1.png`),
      subpackage: `${SUBPACKAGE_BASE}/lovart-particle-blue-20260701-v1.webp`,
    },
    green: {
      webp: cdnAsset(`${LOVART_BASE}/lovart-particle-green-20260701-v1.webp`),
      png: cdnAsset(`${LOVART_BASE}/lovart-particle-green-20260701-v1.png`),
      subpackage: `${SUBPACKAGE_BASE}/lovart-particle-green-20260701-v1.webp`,
    },
  },
} as const

export type PoolPersonaParticleKey = keyof typeof POOL_PERSONA_ASSETS.particles

export function getParticleSrc(key: PoolPersonaParticleKey, attempt: 'cdn' | 'subpackage'): string {
  return attempt === 'cdn'
    ? POOL_PERSONA_ASSETS.particles[key].webp
    : POOL_PERSONA_ASSETS.particles[key].subpackage
}
