import { useCallback, useEffect, useState } from 'react'
import { cdnAsset, localAsset } from '../utils/cdnAssets'

export const ALANG_ASSET_MANIFEST = {
  eventHero: {
    assetId: 'alang-event-card-hero-v1',
    screenState: 'discover / event / event-detail',
    visualReference: 'ACTIVE 03 on Discover; existing repository UI on event/detail',
    referenceStatus: 'mixed-active-and-existing-ui',
    ratio: '16:9',
    targetSize: '750x422',
    characterVersion: 'Alang Character Bible v1',
    safeArea: 'left copy zone; keep the character and event focal point on the right',
    allowedVariations: 'city background, weather, subtle pose',
    forbiddenVariations: 'species, core outfit, main palette, embedded UI copy',
    exportSpec: 'WebP quality 82; max 220 KB',
    approver: 'product + visual owner',
    approvalStatus: 'awaiting-approved-art',
    cdnPath: '/assets/alang/alang-event-card-hero.webp',
    fallbackPath: '/pages/alang/assets/candidates/alang-event-card-candidate.png',
  },
  foundScene: {
    assetId: 'alang-found-scene-v1',
    screenState: 'dialogue / found_scene',
    visualReference: 'ACTIVE 05 found-state panel',
    referenceStatus: 'active',
    ratio: '5:6',
    targetSize: '750x900',
    characterVersion: 'Alang Character Bible v1',
    safeArea: 'bottom 28% reserved for narration',
    allowedVariations: 'city background, weather, subtle pose',
    forbiddenVariations: 'species, core outfit, main palette, embedded UI copy',
    exportSpec: 'WebP quality 82; max 280 KB',
    approver: 'product + visual owner',
    approvalStatus: 'awaiting-approved-art',
    cdnPath: '/assets/alang/alang-found-scene.webp',
    fallbackPath: '/pages/alang/assets/candidates/alang-found-scene-candidate.png',
  },
  companionAtmosphere: {
    assetId: 'alang-companion-atmosphere-v1',
    screenState: 'companion',
    visualReference: 'No ACTIVE mockup; existing companion UI + PRD section 13',
    referenceStatus: 'existing-ui-only',
    ratio: '9:16',
    targetSize: '750x1334',
    characterVersion: 'Alang Character Bible v1',
    safeArea: 'center kept quiet for route status and companion lines',
    allowedVariations: 'road, bridge, lamp, convenience-store setting',
    forbiddenVariations: 'species, core outfit, main palette, route or destination disclosure',
    exportSpec: 'WebP quality 80; max 320 KB',
    approver: 'product + visual owner',
    approvalStatus: 'awaiting-approved-art',
    cdnPath: '/assets/alang/alang-companion-bg.webp',
    fallbackPath: '/pages/alang/assets/candidates/alang-companion-atmosphere-candidate.png',
  },
  resultHero: {
    assetId: 'alang-result-hero-v1',
    screenState: 'result / story archive',
    visualReference: 'No ACTIVE result mockup; ACTIVE 07 applies only in story archive',
    referenceStatus: 'existing-ui-with-active-archive',
    ratio: '15:8',
    targetSize: '750x400',
    characterVersion: 'Alang Character Bible v1',
    safeArea: 'large calm text-safe area',
    allowedVariations: 'city background, weather, subtle pose',
    forbiddenVariations: 'species, core outfit, main palette, score or rating UI',
    exportSpec: 'WebP quality 82; max 220 KB',
    approver: 'product + visual owner',
    approvalStatus: 'awaiting-approved-art',
    cdnPath: '/assets/alang/alang-result-hero.webp',
    fallbackPath: '/pages/alang/assets/candidates/alang-result-candidate.png',
  },
} as const

export type AlangAssetId = keyof typeof ALANG_ASSET_MANIFEST

/**
 * Approved art becomes CDN-first. Until design approval, screens deliberately
 * render the labelled bundled placeholder and never pretend a planned CDN path
 * is a finished asset.
 */
export function useAlangAssetSource(assetId: AlangAssetId) {
  const asset = ALANG_ASSET_MANIFEST[assetId]
  const hasApprovedArt = (
    asset.approvalStatus as 'approved' | 'awaiting-approved-art'
  ) === 'approved'
  const [usingFallback, setUsingFallback] = useState(!hasApprovedArt)

  useEffect(() => {
    setUsingFallback(!hasApprovedArt)
  }, [assetId, hasApprovedArt])

  const onError = useCallback(() => {
    setUsingFallback(true)
  }, [])

  return {
    src: usingFallback ? localAsset(asset.fallbackPath) : cdnAsset(asset.cdnPath),
    onError,
    usingFallback,
    asset,
  }
}
