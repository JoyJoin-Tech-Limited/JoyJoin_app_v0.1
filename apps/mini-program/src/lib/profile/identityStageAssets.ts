import stageManifest from '../../assets/profile-pixel/v2/stage-assets-v1.json'
import { cdnAsset } from '../utils/cdnAssets'

/**
 * HD-2D Identity Stage art manifest (sprint hd2d-identity-stage).
 *
 * Asset URLs come only from this bundled manifest (SEC-01: no remote-controlled
 * URLs). The stage art does not exist yet — missing or failed layers are a
 * normal fallback path handled by `IdentityStageScene`, never an error state.
 */

export const IDENTITY_STAGE_LAYER_IDS = ['farBg', 'midBg'] as const

export type IdentityStageLayerId = (typeof IDENTITY_STAGE_LAYER_IDS)[number]

interface RawStageLayer {
  path?: unknown
}

interface RawStageManifest {
  layers?: Partial<Record<IdentityStageLayerId, RawStageLayer>>
}

const RAW_MANIFEST = stageManifest as unknown as RawStageManifest

const SAFE_STAGE_PATH_PREFIX = 'assets/profile-pixel/v2/stage/'

function normalizeStagePath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().replace(/^\/+/, '')
  if (!normalized.startsWith(SAFE_STAGE_PATH_PREFIX) || normalized.includes('..')) {
    return null
  }
  return normalized
}

/**
 * CDN URL for a stage layer, or null when the manifest does not declare a
 * safe path for it. Art files are CDN-only: zero main-package asset growth.
 */
export function getIdentityStageLayerUrl(layerId: IdentityStageLayerId): string | null {
  const manifestPath = normalizeStagePath(RAW_MANIFEST.layers?.[layerId]?.path)
  return manifestPath ? cdnAsset(`/${manifestPath}`) : null
}
