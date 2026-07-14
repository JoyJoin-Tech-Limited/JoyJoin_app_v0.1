import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA, getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { normalizeMatchingCopy } from '@shared/features/matching-status'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import MissingArchetypePlaceholder from '../../components/mascot/MissingArchetypePlaceholder'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import BrandLogo from '../../components/ui/BrandLogo'
import { haptics } from '../../lib/utils/haptics'

export interface TeammateCardProps {
  member: PoolGroupMemberSummary
  viewerPair?: PairExplanation | null
  /** Flattened roster index (0-based) — drives the deal stagger + aria. */
  index: number
  focused: boolean
  isCurrentUser: boolean
  /** This tablemate is the viewer's highest-chemistryScore partner. */
  isBestPartner: boolean
  /** One-shot auto-peek: the centre card lifts briefly after the deal settles. */
  isPeek: boolean
  /** Card has been dealt (face-up in the fan). Drives the flip + entrance. */
  isRevealed: boolean
  /** Deal fully settled — clears the stagger delay so focus transitions snap. */
  emergeComplete: boolean
  emergeDelayMs: number
  /** "+N" overflow badge for hidden tablemates beyond the fan cap (last card only). */
  overflowBadge?: number
  reduceMotion: boolean
  isDegradation: boolean
  onFocus: () => void
}

/** Entrance duration for a single dealt card — mirrors DEAL_CARD_ENTER_MS in
 *  SquadDeckStage so the stagger budget stays honest. */
const DEAL_ENTER_MS = 260
/** Post-deal focus/lift transition. */
const FOCUS_TRANSITION_MS = 300

/**
 * Max age of the trailing-tap flag: a tap within 3s of a longpress is the
 * release-tap WeChat fires after `longpress` and is swallowed; a later tap is
 * a genuinely new intentional tap. The bound stops a stale flag from eating
 * an unrelated future tap.
 */
const TRAILING_TAP_MAX_AGE_MS = 3000

function getConnectionPoints(pair?: PairExplanation | null) {
  if (!pair) return []
  if (pair.connectionPointsWithRarity && pair.connectionPointsWithRarity.length > 0) {
    return pair.connectionPointsWithRarity.slice(0, 1)
  }
  if (pair.connectionPoints && pair.connectionPoints.length > 0) {
    return pair.connectionPoints.slice(0, 1).map((text) => ({ text, rarity: 'common' as const }))
  }
  return []
}

function getArchetypeAssetUrl(archetype?: string | null): string | undefined {
  if (!archetype) return undefined
  return ARCHETYPE_ASSET_MAP[archetype]?.webp
}

function getMemberName(member: PoolGroupMemberSummary): string {
  return member.displayName || '匿名'
}

function getArchetypeDisplayName(archetype?: string | null): string {
  if (!archetype) return ''
  return ARCHETYPE_BY_ID[archetype]?.nameCn || '神秘伙伴'
}

function getGenderGlyph(gender?: string | null): string {
  if (gender === 'male') return '男'
  if (gender === 'female') return '女'
  return ''
}

export default function TeammateCard({
  member,
  viewerPair,
  focused,
  isCurrentUser,
  isBestPartner,
  isPeek,
  isRevealed,
  emergeComplete,
  emergeDelayMs,
  overflowBadge = 0,
  reduceMotion,
  isDegradation,
  onFocus,
}: TeammateCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    setAvatarFailed(false)
    setImageError(false)
    setImageLoaded(false)
  }, [member.avatarUrl, member.archetype])
  // WeChat fires `tap` on release after `longpress`. `pendingTrailingTapRef`
  // marks the next tap as that trailing release-tap; handleTap consumes the
  // flag exactly once, so a long-press cannot immediately toggle focus back
  // off and the guard can never double-swallow.
  const lastLongPressAtRef = useRef(0)
  const pendingTrailingTapRef = useRef(false)

  const handleImageError = useCallback(() => {
    if (member.avatarUrl && !avatarFailed) {
      setAvatarFailed(true)
      setImageLoaded(false)
      return
    }
    setImageError(true)
  }, [member.avatarUrl, avatarFailed])
  const handleImageLoad = useCallback(() => setImageLoaded(true), [])

  const name = getMemberName(member)
  const archetypeName = getArchetypeDisplayName(member.archetype)
  const connectionPoints = useMemo(() => getConnectionPoints(viewerPair), [viewerPair])

  // Privacy: hidden fields are silently omitted (no placeholders).
  const agePart = member.ageVisible === false ? '' : (member.ageLabel ?? '')
  const genderPart = getGenderGlyph(member.gender)
  // Round-3 (2026-07-13): the card meta line is age·gender only (`28·女`).
  // Industry moved off the card: on fan-covered cards the 48rpx safe inset
  // leaves ~126rpx of text width, so `28·女 · 互联网产品` truncated to a
  // broken-looking single character. Industry still reaches the user via the
  // aria-label below and the focus detail panel (`age · industry`), where it
  // renders in full.
  const ageGender = [agePart, genderPart].filter(Boolean).join('·')
  const industry = member.industryVisible === false
    ? ''
    : (member.industryNicheLabel ?? member.industryCategoryLabel ?? '')
  const metaLine = ageGender

  const usingAvatar = Boolean(member.avatarUrl && !avatarFailed)
  const assetUrl = usingAvatar ? member.avatarUrl ?? undefined : getArchetypeAssetUrl(member.archetype)
  const showPlaceholder = !assetUrl || imageError

  const handleTap = useCallback(() => {
    if (!isRevealed) return
    // Swallow exactly the first tap following a longpress (within 3s): the
    // flag is consumed by that first tap whether or not it is swallowed, so
    // the guard can never double-swallow, and the 3s max-age means a stale
    // flag cannot eat an unrelated future tap — an expired flag falls
    // through and the tap is processed normally. Focus (and the per-tap
    // haptic) is owned by the parent — flip is derived from `isRevealed`,
    // lift from `focused`.
    if (pendingTrailingTapRef.current) {
      pendingTrailingTapRef.current = false
      if (Date.now() - lastLongPressAtRef.current < TRAILING_TAP_MAX_AGE_MS) return
    }
    onFocus()
  }, [isRevealed, onFocus])

  const handleLongPress = useCallback(() => {
    if (!isRevealed) return
    lastLongPressAtRef.current = Date.now()
    pendingTrailingTapRef.current = true
    haptics('medium')
    onFocus()
  }, [isRevealed, onFocus])

  // Fan pose + state transforms live in SCSS classes (inline `rpx`/`deg` is
  // not transformed by the Taro H5 build). The per-index rotation comes from
  // the row + :nth-child rules in index.scss; this component only toggles
  // state classes and sets unitless/ms/colour values inline (safe in both
  // runtimes).
  // - Not dealt: SCSS start pose (below, scaled down, transparent).
  // - Dealt: parent --dealt gates the per-index fan pose; --flipped shows front.
  // - Focused: --focused-lift straightens + rises + scales; siblings preserve
  //   their original opaque fan pose so the layered deck stays legible.
  // - Peek: --peek lifts the centre card once after settle.
  const opacity = isRevealed ? 1 : 0
  // z-index ascends left→right via the SCSS per-index rules; a focused card
  // jumps to the top. Undefined lets the SCSS value stand for non-focused.
  const zIndex = focused ? 50 : undefined

  const transitionDuration = reduceMotion ? 0 : emergeComplete ? FOCUS_TRANSITION_MS : DEAL_ENTER_MS
  const transitionDelay = reduceMotion || emergeComplete ? 0 : emergeDelayMs

  const accent = useMemo(() => {
    const hsl = getArchetypeHSL(member.archetype)
    return {
      borderColor: formatHSLAsRGBA(hsl, 0.55),
      shadow: formatHSLAsRGBA(hsl, 0.22),
      edgeHighlight: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 22) }, 0.6),
      artStart: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 30) }, 0.5),
      artEnd: formatHSLAsRGBA(hsl, 0.16),
    }
  }, [member.archetype])

  const archetypeTextColor = useMemo(
    () => getContrastSafeArchetypeColor(member.archetype),
    [member.archetype],
  )

  const artZoneStyle = useMemo(
    () => ({
      background: `linear-gradient(160deg, ${accent.artStart} 0%, ${accent.artEnd} 100%)`,
    }),
    [accent],
  )

  // Foil frame: archetype-tinted border + inset foil line + tinted soft shadow.
  // A focused card gets a larger lift shadow. Shadow offsets use rpx (the
  // platform unit, native in WeChat). In the H5 preview build inline rpx is not
  // transformed, so the shadow is cosmetically dropped there — the rgba border
  // tint still carries the archetype frame, and WeChat (launch-primary) renders
  // the full foil. Transforms (layout-critical) stay in SCSS per the H5 rule.
  const frameBoxShadow = focused
    ? `0 28rpx 64rpx ${accent.shadow}, inset 0 0 0 1rpx ${accent.edgeHighlight}`
    : `0 12rpx 32rpx ${accent.shadow}, inset 0 0 0 1rpx ${accent.edgeHighlight}`

  const ariaLabel = [
    name,
    archetypeName,
    agePart,
    industry,
    isCurrentUser ? '我' : '',
    isBestPartner ? '最佳拍档' : '',
  ].filter(Boolean).join('，')

  return (
    <View
      className={[
        'squad-unboxing__deck-card',
        focused ? 'squad-unboxing__deck-card--focused' : '',
        focused ? ((reduceMotion || isDegradation) ? 'squad-unboxing__deck-card--focused-lift-deg' : 'squad-unboxing__deck-card--focused-lift') : '',
        isPeek ? 'squad-unboxing__deck-card--peek' : '',
        isCurrentUser ? 'squad-unboxing__deck-card--current' : '',
        isBestPartner ? 'squad-unboxing__deck-card--best-partner' : '',
        // Flip is derived solely from `isRevealed` (dealt): a dealt card shows
        // its front; a not-yet-dealt card sits in the SCSS start pose — no
        // per-card local flip state, single source of truth in the parent.
        isRevealed ? 'squad-unboxing__deck-card--flipped' : '',
        reduceMotion ? 'squad-unboxing__deck-card--reduce-motion' : '',
        isDegradation ? 'squad-unboxing__deck-card--degradation' : '',
      ].filter(Boolean).join(' ')}
      style={{
        opacity,
        zIndex,
        transitionDuration: `${transitionDuration}ms`,
        transitionDelay: `${transitionDelay}ms`,
        borderColor: accent.borderColor,
        boxShadow: frameBoxShadow,
      }}
      onClick={handleTap}
      onLongPress={handleLongPress}
      hoverClass='squad-unboxing__deck-card--pressed'
      role='listitem'
      aria-label={ariaLabel}
    >
      <View
        className='squad-unboxing__deck-card-inner'
        style={{ transitionDelay: `${transitionDelay}ms` }}
      >
        {/* Card back — shown face-down during the deal flight. Premium card-back
            design: brand gradient, foil edge, logo mark. */}
        <View className='squad-unboxing__deck-card-face squad-unboxing__deck-card-face--back'>
          <View className='squad-unboxing__deck-card-back-foil' />
          <View className='squad-unboxing__deck-card-back-logo'>
            <BrandLogo size='sm' ariaLabel='' />
          </View>
          {isCurrentUser ? (
            <View className='squad-unboxing__deck-card-me-badge'>
              <Text className='squad-unboxing__deck-card-me-badge-text'>我</Text>
            </View>
          ) : null}
        </View>

        {/* Card front — the rich collectible template. */}
        <View className='squad-unboxing__deck-card-face squad-unboxing__deck-card-face--front'>
          <View className='squad-unboxing__deck-card-art' style={artZoneStyle}>
            {/* Top-left badge row: 我 marker + +N overflow chip. Top-left is
                the one corner never covered by a neighbour in the fan, so
                these stay legible on every card. Gender·age moved to the info
                zone meta line in the round-3 restructure. */}
            {isCurrentUser || overflowBadge > 0 ? (
              <View className='squad-unboxing__deck-card-badges'>
                {isCurrentUser ? (
                  <View className='squad-unboxing__deck-card-me-badge squad-unboxing__deck-card-me-badge--in-row'>
                    <Text className='squad-unboxing__deck-card-me-badge-text'>我</Text>
                  </View>
                ) : null}
                {overflowBadge > 0 ? (
                  <View className='squad-unboxing__deck-card-meta-chip squad-unboxing__deck-card-meta-chip--overflow'>
                    <Text className='squad-unboxing__deck-card-meta-chip-text'>+{overflowBadge}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {isBestPartner ? (
              <View className='squad-unboxing__deck-card-stamp' aria-hidden='true'>
                <Text className='squad-unboxing__deck-card-stamp-text'>最佳拍档</Text>
              </View>
            ) : null}
            <View className='squad-unboxing__deck-card-art-frame'>
              {showPlaceholder ? (
                <MissingArchetypePlaceholder size={150} className='squad-unboxing__deck-card-placeholder' />
              ) : (
                <>
                  {!imageLoaded ? (
                    <View className='squad-unboxing__deck-card-art-skeleton' />
                  ) : null}
                  {assetUrl ? (
                    <Image
                      className={[
                        'squad-unboxing__deck-card-art-img',
                        usingAvatar ? 'squad-unboxing__deck-card-art-img--avatar' : '',
                      ].filter(Boolean).join(' ')}
                      src={assetUrl}
                      mode={usingAvatar ? 'aspectFill' : 'aspectFit'}
                      lazyLoad={false}
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                      aria-hidden='true'
                    />
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* Info zone — strict 4-row grid (round-3 restructure): name,
              accent archetype, grey meta line (age·gender), one
              connection-point pill. Every row is one line, ellipsis-safe; the
              full industry + connection list lives in the detail panel. */}
          <View className='squad-unboxing__deck-card-info'>
            <Text className='squad-unboxing__deck-card-name' numberOfLines={1}>{name}</Text>
            {archetypeName ? (
              <Text
                className='squad-unboxing__deck-card-archetype'
                style={{ color: archetypeTextColor }}
                numberOfLines={1}
              >
                {archetypeName}
              </Text>
            ) : null}
            {metaLine ? (
              <Text className='squad-unboxing__deck-card-meta' numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}
            {connectionPoints.length > 0 ? (
              <View className='squad-unboxing__deck-card-pills'>
                {connectionPoints.map((point) => (
                  <ConnectionPointPill key={point.text} text={point.text} rarity={point.rarity} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}
