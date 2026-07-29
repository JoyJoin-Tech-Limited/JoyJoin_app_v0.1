import avatarAssetsManifest from '../../assets/profile-pixel/v2/avatar-assets-v2.json'
import { cdnAsset } from '../utils/cdnAssets'

export const PIXEL_AVATAR_ARCHETYPE_IDS = [
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

export const PIXEL_AVATAR_FRAME_IDS = [
  'left-far',
  'left-near',
  'front',
  'right-near',
  'right-far',
] as const

export const PIXEL_AVATAR_EQUIPMENT_SLOTS = [
  'bottom',
  'shoes',
  'top',
  'accessory',
] as const

export type PixelAvatarArchetypeId = (typeof PIXEL_AVATAR_ARCHETYPE_IDS)[number]
export type PixelAvatarFrameId = (typeof PIXEL_AVATAR_FRAME_IDS)[number]
export type PixelAvatarEquipmentSlot = (typeof PIXEL_AVATAR_EQUIPMENT_SLOTS)[number]

export interface PixelEquipmentPlacement {
  /** X coordinate on the canonical 512 x 768 body canvas. */
  left: number
  /** Y coordinate on the canonical 512 x 768 body canvas. */
  top: number
  /** Cropped layer width on the canonical 512 x 768 body canvas. */
  width: number
  /** Cropped layer height on the canonical 512 x 768 body canvas. */
  height: number
}

export interface PixelEquipmentAsset {
  url: string
  thumb?: string
  slot: PixelAvatarEquipmentSlot
  placement: PixelEquipmentPlacement
  /** Normalized visual depth used for restrained paper-doll parallax. */
  depth: number
}

export interface PixelAvatarScenePose {
  frameId: PixelAvatarFrameId
  frameIndex: number
  /** -1 (left) through 1 (right). This is a visual tilt, not a real camera yaw. */
  yaw: number
  scaleX: number
  translateXPercent: number
}

interface RawEquipmentAsset {
  layer?: unknown
  thumb?: unknown
  placement?: unknown
  depth?: unknown
}

interface RawRegisteredEquipmentAsset extends RawEquipmentAsset {
  slot?: unknown
  placements?: Partial<Record<PixelAvatarArchetypeId, unknown>>
}

interface RawArchetypeAssets {
  body?: unknown
  /** Approved fully dressed starter look (atlas full-dress cell, 512x768). */
  fullStarter?: unknown
  starter?: Partial<Record<PixelAvatarEquipmentSlot, RawEquipmentAsset>>
}

interface RawAvatarAssetsManifest {
  archetypes?: Partial<Record<PixelAvatarArchetypeId, RawArchetypeAssets>>
  /** Generic asset-key registry: future clothes add art + anchors without new outfit renders. */
  items?: Record<string, RawRegisteredEquipmentAsset>
}

const SAFE_ARCHETYPE_IDS = new Set<string>(PIXEL_AVATAR_ARCHETYPE_IDS)
const SAFE_EQUIPMENT_SLOTS = new Set<string>(PIXEL_AVATAR_EQUIPMENT_SLOTS)
const RAW_MANIFEST = avatarAssetsManifest as unknown as RawAvatarAssetsManifest

const BODY_CANVAS_WIDTH = 512
const BODY_CANVAS_HEIGHT = 768

const DEFAULT_PLACEMENTS: Record<PixelAvatarEquipmentSlot, PixelEquipmentPlacement> = {
  top: { left: 72, top: 224, width: 368, height: 280 },
  bottom: { left: 82, top: 424, width: 348, height: 192 },
  shoes: { left: 64, top: 574, width: 384, height: 168 },
  accessory: { left: 80, top: 48, width: 352, height: 288 },
}

const DEFAULT_DEPTHS: Record<PixelAvatarEquipmentSlot, number> = {
  bottom: 0.35,
  shoes: 0.25,
  top: 0.55,
  accessory: 0.85,
}

const SCENE_POSES: Record<PixelAvatarFrameId, PixelAvatarScenePose> = {
  'left-far': {
    frameId: 'left-far',
    frameIndex: 0,
    yaw: -1,
    scaleX: 0.9,
    translateXPercent: -2.8,
  },
  'left-near': {
    frameId: 'left-near',
    frameIndex: 1,
    yaw: -0.5,
    scaleX: 0.96,
    translateXPercent: -1.4,
  },
  front: {
    frameId: 'front',
    frameIndex: 2,
    yaw: 0,
    scaleX: 1,
    translateXPercent: 0,
  },
  'right-near': {
    frameId: 'right-near',
    frameIndex: 3,
    yaw: 0.5,
    scaleX: 0.96,
    translateXPercent: 1.4,
  },
  'right-far': {
    frameId: 'right-far',
    frameIndex: 4,
    yaw: 1,
    scaleX: 0.9,
    translateXPercent: 2.8,
  },
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizePlacement(
  value: unknown,
  slot: PixelAvatarEquipmentSlot,
): PixelEquipmentPlacement {
  if (!value || typeof value !== 'object') return DEFAULT_PLACEMENTS[slot]

  const candidate = value as Partial<PixelEquipmentPlacement>
  if (
    !isFiniteNumber(candidate.left)
    || !isFiniteNumber(candidate.top)
    || !isFiniteNumber(candidate.width)
    || !isFiniteNumber(candidate.height)
    || candidate.width <= 0
    || candidate.height <= 0
  ) {
    return DEFAULT_PLACEMENTS[slot]
  }

  const left = clamp(candidate.left, 0, BODY_CANVAS_WIDTH - 1)
  const top = clamp(candidate.top, 0, BODY_CANVAS_HEIGHT - 1)
  return {
    left,
    top,
    width: clamp(candidate.width, 1, BODY_CANVAS_WIDTH - left),
    height: clamp(candidate.height, 1, BODY_CANVAS_HEIGHT - top),
  }
}

function normalizeDepth(value: unknown, slot: PixelAvatarEquipmentSlot): number {
  return isFiniteNumber(value) ? clamp(value, 0, 1) : DEFAULT_DEPTHS[slot]
}

function normalizeManifestPath(value: unknown, fallbackPath: string): string {
  if (typeof value !== 'string') return fallbackPath
  const normalized = value.trim().replace(/^\/+/, '')
  return normalized.startsWith('assets/profile-pixel/v2/') && !normalized.includes('..')
    ? normalized
    : fallbackPath
}

export function normalizePixelArchetypeId(value?: string | null): PixelAvatarArchetypeId {
  return value && SAFE_ARCHETYPE_IDS.has(value)
    ? value as PixelAvatarArchetypeId
    : 'cat'
}

export function isPixelAvatarFrameId(value: string): value is PixelAvatarFrameId {
  return (PIXEL_AVATAR_FRAME_IDS as readonly string[]).includes(value)
}

export function normalizePixelAvatarFrameId(value?: string | null): PixelAvatarFrameId {
  return value && isPixelAvatarFrameId(value) ? value : 'front'
}

export function getPixelAvatarScenePose(
  frameId?: PixelAvatarFrameId | string | null,
): PixelAvatarScenePose {
  return SCENE_POSES[normalizePixelAvatarFrameId(frameId)]
}

export function getPixelAvatarBodyUrl(archetypeId?: string | null): string {
  const safeId = normalizePixelArchetypeId(archetypeId)
  const rawBody = RAW_MANIFEST.archetypes?.[safeId]?.body
  const manifestBody = typeof rawBody === 'string'
    ? rawBody
    : rawBody && typeof rawBody === 'object'
      ? (rawBody as { front?: unknown }).front
      : undefined
  const manifestPath = normalizeManifestPath(manifestBody, '')
  const safePath = manifestPath || `assets/profile-pixel/archetypes/${safeId}/base-v1.webp`
  return cdnAsset(`/${safePath}`)
}

/**
 * Compatibility alias used by the existing profile surfaces while they migrate to V2.
 * The V2 body always keeps a fitted vest and safety shorts, independent of equipment slots.
 */
export function getPixelAvatarBaseUrl(archetypeId?: string | null): string {
  return getPixelAvatarBodyUrl(archetypeId)
}

/**
 * Approved, fully dressed 2D reference art, used when the complete matching
 * starter set is equipped (partial outfits continue to use independent
 * layers). Every archetype's full-starter look is derived from the approved
 * full-dress cell of its atlas by the V2 pipeline (2026-07-21), so the default
 * outfit always renders exactly the approved pose-aware illustration. Spider
 * keeps its byte-approved V1 art (the original raised-hand fix).
 */
export function getPixelAvatarApprovedStarterLookUrl(
  archetypeId?: string | null,
): string | null {
  const safeId = normalizePixelArchetypeId(archetypeId)
  if (safeId === 'spider') {
    return cdnAsset(`/assets/profile-pixel/archetypes/${safeId}/base-v1.webp`)
  }
  const fullStarterPath = normalizeManifestPath(RAW_MANIFEST.archetypes?.[safeId]?.fullStarter, '')
  return fullStarterPath ? cdnAsset(`/${fullStarterPath}`) : null
}

/**
 * The five pseudo-3D stops reuse one approved front body asset. Scene transforms create the
 * restrained paper-doll tilt; this function intentionally does not imply real side views.
 */
export function getPixelAvatarBodyFrameUrl(
  archetypeId?: string | null,
  _frameId: PixelAvatarFrameId = 'front',
): string {
  return getPixelAvatarBodyUrl(archetypeId)
}

export function normalizePixelEquipmentAssetKey(assetKey: string): string {
  const safeSegments = assetKey
    .split('/')
    .map((segment) => segment.trim().replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
  return safeSegments.length > 0
    ? safeSegments.join('/')
    : 'equipment/missing/v1'
}

export function parseStarterPixelEquipmentAssetKey(assetKey: string): {
  archetypeId: PixelAvatarArchetypeId
  slot: PixelAvatarEquipmentSlot
} | null {
  const segments = normalizePixelEquipmentAssetKey(assetKey).split('/')
  if (
    segments.length !== 5
    || segments[0] !== 'equipment'
    || segments[1] !== 'starter'
    || !SAFE_ARCHETYPE_IDS.has(segments[2])
    || !SAFE_EQUIPMENT_SLOTS.has(segments[3])
    || segments[4] !== 'v1'
  ) {
    return null
  }

  return {
    archetypeId: segments[2] as PixelAvatarArchetypeId,
    slot: segments[3] as PixelAvatarEquipmentSlot,
  }
}

export function getPixelEquipmentAsset(
  assetKey: string,
  archetypeId?: string | null,
  _frameId: PixelAvatarFrameId = 'front',
): PixelEquipmentAsset | null {
  const safeId = normalizePixelArchetypeId(archetypeId)
  const trimmedKey = assetKey.trim().replace(/^\/+/, '')
  const normalizedKey = normalizePixelEquipmentAssetKey(assetKey)
  if (trimmedKey.includes('..') || trimmedKey !== normalizedKey) return null

  const registeredAsset = RAW_MANIFEST.items?.[normalizedKey]
  if (registeredAsset && typeof registeredAsset.slot === 'string' && SAFE_EQUIPMENT_SLOTS.has(registeredAsset.slot)) {
    const slot = registeredAsset.slot as PixelAvatarEquipmentSlot
    const placement = registeredAsset.placements?.[safeId]
    if (!placement || typeof registeredAsset.layer !== 'string') return null
    const layerPath = normalizeManifestPath(registeredAsset.layer, '')
    const thumbPath = typeof registeredAsset.thumb === 'string'
      ? normalizeManifestPath(registeredAsset.thumb, '')
      : ''
    if (!layerPath) return null
    return {
      url: cdnAsset(`/${layerPath}`),
      thumb: thumbPath ? cdnAsset(`/${thumbPath}`) : undefined,
      slot,
      placement: normalizePlacement(placement, slot),
      depth: normalizeDepth(registeredAsset.depth, slot),
    }
  }

  const parsed = parseStarterPixelEquipmentAssetKey(assetKey)
  if (!parsed || parsed.archetypeId !== safeId) return null

  const { slot } = parsed
  const manifestAsset = RAW_MANIFEST.archetypes?.[safeId]?.starter?.[slot]
  const layerPath = normalizeManifestPath(manifestAsset?.layer, '')
  const thumbPath = typeof manifestAsset?.thumb === 'string'
    ? normalizeManifestPath(manifestAsset.thumb, '')
    : ''
  if (!layerPath) return null

  return {
    url: cdnAsset(`/${layerPath}`),
    thumb: thumbPath ? cdnAsset(`/${thumbPath}`) : undefined,
    slot,
    placement: normalizePlacement(manifestAsset?.placement, slot),
    depth: normalizeDepth(manifestAsset?.depth, slot),
  }
}

export function getPixelEquipmentLayerUrl(
  assetKey: string,
  archetypeId?: string | null,
  frameId: PixelAvatarFrameId = 'front',
): string | null {
  return getPixelEquipmentAsset(assetKey, archetypeId, frameId)?.url ?? null
}

/** Square garment-only thumbnail for equipment slot art (e.g. Profile tab).
 * Falls back to the full layer URL when no dedicated thumbnail exists. */
export function getPixelEquipmentThumbnailUrl(
  assetKey: string,
  archetypeId?: string | null,
): string | null {
  return getPixelEquipmentAsset(assetKey, archetypeId)?.thumb
    ?? getPixelEquipmentAsset(assetKey, archetypeId)?.url
    ?? null
}
