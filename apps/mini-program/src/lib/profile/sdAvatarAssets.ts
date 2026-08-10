import sdAvatarManifest from '../../assets/sd-avatar/v1/sd-avatar-assets-v1.json'
import { cdnAsset, localAsset } from '../utils/cdnAssets'

/**
 * sdAvatarAssets — manifest resolver for the SD pixel avatar sprite family
 * (集结房间 / small-avatar roster slots).
 *
 * The SD family is a NEW parallel asset family: finished front-view chibi
 * sprites per archetype at the five frozen integer sizes 128 / 96 / 64 / 48 / 32px
 * (style guide T6 — docs/design/sd-pixel-avatar-style-guide.md). It does not
 * replace the V2 paper doll or the ArchetypeHead head crops.
 *
 * Assets are bundled locally (primary) and mirrored on the CDN (fallback),
 * exactly like the ArchetypeHead head assets.
 */

export const SD_AVATAR_SIZES = [32, 48, 64, 96, 128] as const
export type SdAvatarSize = (typeof SD_AVATAR_SIZES)[number]

export const SD_AVATAR_ARCHETYPE_IDS = [
  'corgi',
  'rooster',
  'hamster_praise',
  'fox',
  'dolphin_calm',
  'spider',
  'koala',
  'octopus',
  'owl',
  'elephant',
  'turtle',
  'cat',
] as const

export type SdAvatarArchetypeId = (typeof SD_AVATAR_ARCHETYPE_IDS)[number]

export interface SdAvatarAsset {
  /** Device-pixel bucket the resolver picked (32/48/64/96). */
  bucket: SdAvatarSize
  /** Root-relative bundled path for <Image> primary src. */
  localPath: string
  /** CDN URL used after a local load error. */
  cdnUrl: string
  /** True while the sprite is a synthesized placeholder (art pending). */
  placeholder: boolean
}

type RawArchetypeEntry = {
  [size: string]: unknown
  placeholder?: unknown
  needsHandCleanup?: unknown
}

interface RawSdAvatarManifest {
  version?: unknown
  renderer?: unknown
  archetypes?: Partial<Record<string, RawArchetypeEntry>>
}

const SAFE_ARCHETYPE_IDS = new Set<string>(SD_AVATAR_ARCHETYPE_IDS)
const RAW_MANIFEST = sdAvatarManifest as unknown as RawSdAvatarManifest
const MANIFEST_PATH_PREFIX = 'assets/sd-avatar/v1/'

function normalizeManifestPath(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().replace(/^\/+/, '')
  return normalized.startsWith(MANIFEST_PATH_PREFIX) && !normalized.includes('..')
    ? normalized
    : ''
}

/**
 * Pick the sprite bucket for a requested display size in rpx.
 *
 * We never want WeChat to upscale a pixel-art sprite: upscaling a 1px coloured
 * outline (style guide T2/T6) makes it blurry. So we pick the smallest bucket
 * whose source pixel count is >= the requested display rpx. This guarantees
 * WeChat downscales (or renders 1:1) at standard 1x; higher-DPR screens may
 * still see slight softening unless a 2x bucket exists, but upscaling is
 * avoided. Sizes above 128 fall back to the 128 bucket.
 */
export function pickSdAvatarBucket(requestedRpx: number): SdAvatarSize {
  const target = Number.isFinite(requestedRpx) ? Math.max(0, requestedRpx) : 0
  for (const bucket of SD_AVATAR_SIZES) {
    if (bucket >= target) return bucket
  }
  return SD_AVATAR_SIZES[SD_AVATAR_SIZES.length - 1]
}

/**
 * Resolve the SD avatar sprite for an archetype at a display size (rpx).
 * Returns null when the archetype is unknown or absent from the manifest
 * (e.g. art still pending with placeholder mode off) — callers fall back to
 * ArchetypeHead / initial rendering.
 */
export function getSdAvatarAsset(
  archetype?: string | null,
  requestedRpx = 80,
): SdAvatarAsset | null {
  if (!archetype || !SAFE_ARCHETYPE_IDS.has(archetype)) return null
  const entry = RAW_MANIFEST.archetypes?.[archetype]
  if (!entry) return null
  const bucket = pickSdAvatarBucket(requestedRpx)
  const manifestPath = normalizeManifestPath(entry[String(bucket)])
  if (!manifestPath) return null
  return {
    bucket,
    localPath: localAsset(`/${manifestPath}`),
    cdnUrl: cdnAsset(`/${manifestPath}`),
    placeholder: entry.placeholder === true,
  }
}

/** True when the manifest holds a sprite for this archetype (any provenance). */
export function hasSdAvatarAsset(archetype?: string | null): boolean {
  return getSdAvatarAsset(archetype) !== null
}
