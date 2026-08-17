import { View, Text, Image } from '@tarojs/components'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA, getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import {
  CHEMISTRY_TIER_EMOJI,
  buildInterestHookText,
  getPairChemistryTier,
  getPairChemistryWord,
  shortenConnectionPointForPill,
} from '../../lib/utils/pairChemistry'
import { haptics } from '../../lib/utils/haptics'
import MissingArchetypePlaceholder from '../mascot/MissingArchetypePlaceholder'
import ConnectionPointPill from '../ConnectionPointPill'
import JoyJoinIcon from '../ui/JoyJoinIcon'
// Styles are owned by consuming page SCSS (@use) so the card rules co-compile
// into each surface's page WXSS — a component-level import would additionally
// hoist a duplicate copy into main-package common.wxss (subpackage
// style-splitting + main package 2048KB source-size budget, 2026-08-16).

export interface TablemateCardProps {
  member: PoolGroupMemberSummary
  /** Viewer's pair explanation with THIS member — drives the connection pill
   *  and the pair-temperature chip. Null/undefined degrades to the member's
   *  top-interest hook pill with no temperature chip. */
  viewerPair?: PairExplanation | null
  isCurrentUser: boolean
  /**
   * Deal-in entrance: the card rests at the SCSS start pose (below, scaled
   * down, transparent) until `dealt` flips true; `entranceDelayMs` staggers
   * the transition. Pass `reduceMotion` to land instantly with no tilt/sheen.
   */
  dealt: boolean
  entranceDelayMs?: number
  reduceMotion: boolean
  /**
   * Deal-once cache key (2026-08-16 polish): cards re-mount when the user
   * swipe-backs into a page; without a session-level memory the whole hand
   * re-deals on every revisit. Parents pass a surface-scoped key
   * (`ms-<groupId>-<userId>` / `pgd-<groupId>-<userId>`); once a key has
   * dealt, later mounts land instantly with no tilt/sheen replay.
   */
  dealKey?: string
  onTap?: () => void
}

/** Session memory of dealt hands — module-level so page re-mounts skip the
 *  entrance replay. Bounded by the number of桌友 cards seen in a session. */
const dealtOnceKeys = new Set<string>()

/** Tap-haptic throttle: browsing the deck taps fast; a light buzz per tap is
 *  noise. One haptic per 250ms across ALL card instances is enough. */
let lastCardHapticAt = 0
const CARD_HAPTIC_INTERVAL_MS = 250

/**
 * Lightweight 桌友 portrait card (2026-08-15): the squad-unboxing deck card's
 * FRONT-face visual recipe (archetype-tinted foil frame, 52% art zone / 48%
 * info zone, connection pill + pair-temperature chip) without the flip/fan/
 * pocket machinery. Used by the matching-status matched carousels and the
 * pool-group-detail deck strip.
 *
 * Inline styles carry only colours/gradients/ms delays; all transforms and
 * rpx values live in SCSS (the H5 build drops inline rpx transforms).
 */
function TablemateCard({
  member,
  viewerPair,
  isCurrentUser,
  dealt,
  entranceDelayMs = 0,
  reduceMotion,
  dealKey,
  onTap,
}: TablemateCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  // Deal-in entrance: parents pass `dealt` as a constant true, so the mount
  // flip is owned here — the card renders one frame at the SCSS start pose,
  // then transitions into the dealt pose (staggered via entranceDelayMs).
  // A dealKey already in dealtOnceKeys lands instantly (no replay).
  const cacheKey = dealKey ?? member.userId
  const alreadyDealtRef = useRef(dealt && dealtOnceKeys.has(cacheKey))
  const [entered, setEntered] = useState(alreadyDealtRef.current)

  useEffect(() => {
    if (!dealt) return
    if (dealtOnceKeys.has(cacheKey)) {
      alreadyDealtRef.current = true
      setEntered(true)
      return
    }
    const timer = setTimeout(() => {
      dealtOnceKeys.add(cacheKey)
      setEntered(true)
    }, 30)
    return () => clearTimeout(timer)
  }, [dealt, cacheKey])
  const isDealt = dealt && entered

  useEffect(() => {
    setAvatarFailed(false)
    setImageError(false)
    setImageLoaded(false)
  }, [member.avatarUrl, member.archetype])

  const handleImageError = useCallback(() => {
    if (member.avatarUrl && !avatarFailed) {
      setAvatarFailed(true)
      setImageLoaded(false)
      return
    }
    setImageError(true)
  }, [member.avatarUrl, avatarFailed])
  const handleImageLoad = useCallback(() => setImageLoaded(true), [])

  const name = member.displayName || '匿名'

  // Canonical archetype ID — the server payload may carry an ID ('corgi') or
  // a legacy nameCn ('社牛柯基'); resolveArchetype handles both.
  const archetypeId = useMemo(
    () => (member.archetype ? resolveArchetype(member.archetype)?.id ?? null : null),
    [member.archetype],
  )
  const archetypeName = useMemo(() => {
    if (!member.archetype) return ''
    return resolveArchetype(member.archetype)?.nameCn ?? '神秘伙伴'
  }, [member.archetype])

  const connectionPoint = useMemo(() => {
    if (!viewerPair) return null
    const withRarity = viewerPair.connectionPointsWithRarity?.[0]
    if (withRarity?.text) {
      return { text: shortenConnectionPointForPill(withRarity.text), rarity: withRarity.rarity }
    }
    const plain = viewerPair.connectionPoints?.[0]
    if (plain) {
      return { text: shortenConnectionPointForPill(plain), rarity: 'common' as const }
    }
    return null
  }, [viewerPair])
  // Row-4 fallback hook: no viewer connection point → the member's top
  // interest, so every card deals a full 4-row face. When the member has no
  // interests either, a warm default pill keeps the row from collapsing.
  const interestHook = useMemo(
    () => (connectionPoint ? '' : buildInterestHookText(member)),
    [connectionPoint, member],
  )
  const fallbackHook = connectionPoint || interestHook ? '' : '打个招呼吧'
  const temperatureWord = useMemo(
    () => (viewerPair && typeof viewerPair.chemistryScore === 'number'
      ? getPairChemistryWord(viewerPair.chemistryScore)
      : ''),
    [viewerPair],
  )
  const temperatureTier = useMemo(
    () => getPairChemistryTier(viewerPair?.chemistryScore),
    [viewerPair],
  )
  const temperatureEmoji = temperatureTier ? CHEMISTRY_TIER_EMOJI[temperatureTier].emoji : ''

  // Privacy: hidden fields are silently omitted (no placeholders).
  const agePart = member.ageVisible === false ? '' : (member.ageLabel ?? '')
  const genderPart = (() => {
    const gender = member.gender
    if (gender === 'male' || gender === '男性' || gender === '男') return '男'
    if (gender === 'female' || gender === '女性' || gender === '女') return '女'
    return ''
  })()
  const metaLine = [agePart, genderPart].filter(Boolean).join('·')

  const usingAvatar = Boolean(member.avatarUrl && !avatarFailed)
  const assetUrl = usingAvatar
    ? member.avatarUrl ?? undefined
    : archetypeId
      ? ARCHETYPE_ASSET_MAP[archetypeId]?.webp
      : undefined
  const showPlaceholder = !assetUrl || imageError

  const accent = useMemo(() => {
    const hsl = getArchetypeHSL(archetypeId)
    return {
      borderColor: formatHSLAsRGBA(hsl, 0.55),
      shadow: formatHSLAsRGBA(hsl, 0.18),
      edgeHighlight: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 22) }, 0.6),
      artStart: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 30) }, 0.5),
      artEnd: formatHSLAsRGBA(hsl, 0.16),
      skeleton: formatHSLAsRGBA(hsl, 0.1),
    }
  }, [archetypeId])

  // H5-safe: only colours and CSS variables are set inline; rpx geometry
  // (shadow offsets, card size) lives in SCSS.
  const cardStyle = useMemo(
    () => ({
      transitionDelay: `${reduceMotion ? 0 : entranceDelayMs}ms`,
      borderColor: accent.borderColor,
      '--tablemate-card-shadow-color': accent.shadow,
      '--tablemate-card-edge-color': accent.edgeHighlight,
      '--tablemate-card-skeleton-color': accent.skeleton,
    } as CSSProperties),
    [accent.borderColor, accent.edgeHighlight, accent.shadow, accent.skeleton, entranceDelayMs, reduceMotion],
  )

  const archetypeTextColor = useMemo(
    () => getContrastSafeArchetypeColor(archetypeId),
    [archetypeId],
  )

  const handleTap = useCallback(() => {
    if (!onTap) return
    const now = Date.now()
    if (now - lastCardHapticAt >= CARD_HAPTIC_INTERVAL_MS) {
      lastCardHapticAt = now
      haptics('light')
    }
    onTap()
  }, [onTap])

  const ariaLabel = [
    name,
    archetypeName,
    agePart,
    temperatureWord ? `默契：${temperatureWord}` : '',
    isCurrentUser ? '我' : '',
  ]
    .filter(Boolean)
    .join('，')

  return (
    <View
      className={[
        'tablemate-card',
        isDealt ? 'tablemate-card--dealt' : '',
        reduceMotion ? 'tablemate-card--reduce-motion' : '',
      ].filter(Boolean).join(' ')}
      style={cardStyle}
      onClick={handleTap}
      hoverClass='tablemate-card--pressed'
      role='listitem'
      aria-label={ariaLabel}
    >
      {/* One-shot holo sheen across the freshly dealt front — skipped on
          cached re-deals so a swipe-back never replays the show. */}
      {isDealt && !reduceMotion && !alreadyDealtRef.current ? (
        <View
          className='tablemate-card__sheen tablemate-card__sheen--active'
          style={{ animationDelay: `${entranceDelayMs + 200}ms` }}
          aria-hidden='true'
        />
      ) : null}

      <View
        className='tablemate-card__art'
        style={{ background: `linear-gradient(160deg, ${accent.artStart} 0%, ${accent.artEnd} 100%)` }}
      >
        {/* Pair temperature as an art-zone corner badge — keeps the info
            zone to a calm 4-row stack. */}
        {temperatureWord ? (
          <View
            className={[
              'tablemate-card__temp-chip',
              temperatureTier ? `tablemate-card__temp-chip--${temperatureTier}` : '',
            ].filter(Boolean).join(' ')}
          >
            {temperatureTier ? (
              <JoyJoinIcon
                emoji={temperatureEmoji}
                tier='chemistry'
                size={16}
                className='tablemate-card__temp-chip-icon'
              />
            ) : null}
            <Text className='tablemate-card__temp-chip-text'>{temperatureWord}</Text>
          </View>
        ) : null}
        <View className='tablemate-card__art-frame'>
          {showPlaceholder ? (
            <MissingArchetypePlaceholder size={120} className='tablemate-card__placeholder' />
          ) : (
            <>
              {!imageLoaded ? <View className='tablemate-card__art-skeleton' /> : null}
              {assetUrl ? (
                <Image
                  className={[
                    'tablemate-card__art-img',
                    usingAvatar ? 'tablemate-card__art-img--avatar' : '',
                    imageLoaded ? 'tablemate-card__art-img--loaded' : '',
                  ].filter(Boolean).join(' ')}
                  src={assetUrl}
                  mode={usingAvatar ? 'aspectFill' : 'aspectFit'}
                  lazyLoad
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                  aria-hidden='true'
                />
              ) : null}
            </>
          )}
        </View>
      </View>

      {/* Info zone — strict 4-row stack: name (+ inline 我 chip), accent
          archetype, grey meta line (age·gender), one hook pill. */}
      <View className='tablemate-card__info'>
        <View className='tablemate-card__name-row'>
          <Text className='tablemate-card__name' numberOfLines={1}>{name}</Text>
          {isCurrentUser ? (
            <View className='tablemate-card__me-chip'>
              <Text className='tablemate-card__me-chip-text'>我</Text>
            </View>
          ) : null}
        </View>
        {archetypeName ? (
          <Text
            className='tablemate-card__archetype'
            style={{ color: archetypeTextColor }}
            numberOfLines={1}
          >
            {archetypeName}
          </Text>
        ) : null}
        {metaLine ? (
          <Text className='tablemate-card__meta' numberOfLines={1}>{metaLine}</Text>
        ) : null}
        <View
          className={[
            'tablemate-card__pills',
            !connectionPoint ? 'tablemate-card__pills--interest' : '',
          ].filter(Boolean).join(' ')}
        >
          {connectionPoint ? (
            <ConnectionPointPill text={connectionPoint.text} rarity={connectionPoint.rarity} />
          ) : (
            <ConnectionPointPill text={interestHook || fallbackHook} rarity='common' />
          )}
        </View>
      </View>
    </View>
  )
}

export default memo(TablemateCard)
