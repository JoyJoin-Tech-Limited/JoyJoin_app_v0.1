import { View, Text, Image } from '@tarojs/components'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { ARCHETYPE_BY_ID, resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA, getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { normalizeMatchingCopy } from '@shared/features/matching-status'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import MissingArchetypePlaceholder from '../../components/mascot/MissingArchetypePlaceholder'
import ConnectionPointPill from '../../components/ConnectionPointPill'
import { haptics } from '../../lib/utils/haptics'
import { buildFaceDownCardAriaLabel, buildInterestHookText, stripConnectionPointParens } from './squadUnboxingViewModels'

export interface TeammateCardProps {
  member: PoolGroupMemberSummary
  viewerPair?: PairExplanation | null
  /** Flattened roster index (0-based) — drives the deal stagger + aria. */
  index: number
  focused: boolean
  isCurrentUser: boolean
  /** This tablemate is the viewer's highest-chemistryScore partner. */
  isBestPartner: boolean
  /** Card has been dealt into the fan (drives the entrance pose). */
  isDealt: boolean
  /**
   * Card shows its front. Derived solely from the controller-owned flip set
   * (single source of truth — REL-01); per-card local flip state is banned.
   */
  isFaceUp: boolean
  /** Flip transition delay (ms) — burst stagger; 0 for single flips. */
  flipDelayMs: number
  /** One-shot sheen across the freshly revealed front (live transitions only). */
  sheenActive: boolean
  sheenDelayMs: number
  /** Deal fully settled — clears the stagger delay so focus transitions snap. */
  emergeComplete: boolean
  emergeDelayMs: number
  /** "+N" overflow badge for hidden tablemates beyond the fan cap (last card only). */
  overflowBadge?: number
  reduceMotion: boolean
  isDegradation: boolean
  /**
   * Pocket-the-deck fold pose (2026-07-15): true while the card sits at the
   * pill vanish point. The transform-override class is applied only when
   * motion is allowed — reduced-motion/degradation tiers fold via the
   * opacity crossfade alone (AC-06).
   */
  pocketPose?: boolean
  /** Per-card fold/unfold transition delay (ms); null outside pocket windows. */
  pocketTransitionDelayMs?: number | null
  /** 最佳拍档 heartbeat glow pulse while this card folds (fires at its fold delay). */
  pocketGlowActive?: boolean
  onTap: () => void
  onLongPress: () => void
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
  // A3: strip wrapping full-width parens （） before the text reaches the
  // pill — a leading （ under 1-line ellipsis read as a severed fragment
  // (`（都偏内向…`). The pill stays 1-line nowrap+ellipsis (Chrome 143
  // serializes `display: -webkit-box` as flow-root — no 2-line clamp).
  if (pair.connectionPointsWithRarity && pair.connectionPointsWithRarity.length > 0) {
    return pair.connectionPointsWithRarity
      .slice(0, 1)
      .map((point) => ({ ...point, text: stripConnectionPointParens(point.text) }))
  }
  if (pair.connectionPoints && pair.connectionPoints.length > 0) {
    return pair.connectionPoints
      .slice(0, 1)
      .map((text) => ({ text: stripConnectionPointParens(text), rarity: 'common' as const }))
  }
  return []
}

function getArchetypeAssetUrl(archetype?: string | null): string | undefined {
  if (!archetype) return undefined
  // Server coalesce may yield an ID ('corgi') or a legacy nameCn ('社牛柯基');
  // normalize to the canonical ID before keying into the asset map.
  const id = resolveArchetype(archetype)?.id ?? archetype
  return ARCHETYPE_ASSET_MAP[id]?.webp
}

function getMemberName(member: PoolGroupMemberSummary): string {
  return member.displayName || '匿名'
}

function getArchetypeDisplayName(archetype?: string | null): string {
  if (!archetype) return ''
  return resolveArchetype(archetype)?.nameCn ?? ARCHETYPE_BY_ID[archetype]?.nameCn ?? '神秘伙伴'
}

function getGenderGlyph(gender?: string | null): string {
  // DB stores Chinese values ('男性'/'女性', sometimes '男'/'女'); accept the
  // legacy English pair too so older payloads still render.
  if (gender === 'male' || gender === '男性' || gender === '男') return '男'
  if (gender === 'female' || gender === '女性' || gender === '女') return '女'
  return ''
}

export default function TeammateCard({
  member,
  viewerPair,
  focused,
  isCurrentUser,
  isBestPartner,
  isDealt,
  isFaceUp,
  flipDelayMs,
  sheenActive,
  sheenDelayMs,
  emergeComplete,
  emergeDelayMs,
  overflowBadge = 0,
  reduceMotion,
  isDegradation,
  pocketPose = false,
  pocketTransitionDelayMs = null,
  pocketGlowActive = false,
  onTap,
  onLongPress,
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
  // Row-4 fallback hook (2026-07-16 PM "every card has a hook"): no viewer
  // connection point → the member's top interest, so every card deals a full
  // 4-row face. Visual contract: connection pill = filled rarity style,
  // interest pill = neutral outline (variance reads as semantics).
  const interestHook = useMemo(
    () => (connectionPoints.length > 0 ? '' : buildInterestHookText(member)),
    [connectionPoints, member],
  )

  // Privacy: hidden fields are silently omitted (no placeholders).
  const agePart = member.ageVisible === false ? '' : (member.ageLabel ?? '')
  const genderPart = getGenderGlyph(member.gender)
  // Round-3 (2026-07-13): the card meta line is age·gender only (`28·女`).
  // Industry moved off the card: on fan-covered cards the 48rpx safe inset
  // leaves ~126rpx of text width, so `28·女 · 互联网产品` truncated to a
  // broken-looking single character. Industry still reaches the user via the
  // aria-label below, the focused narration bubble (`在{industry}领域`), and
  // — since 2026-07-16 — the focused card's art-zone caption, where it
  // renders in full.
  const ageGender = [agePart, genderPart].filter(Boolean).join('·')
  const industry = member.industryVisible === false
    ? ''
    : (member.industryNicheLabel ?? member.industryCategoryLabel ?? '')
  const education = member.educationVisible === false ? '' : (member.educationLevel ?? '').trim()
  // Focused-card caption (2026-07-16 PM): the lifted card is fully visible,
  // so education · industry return at the moment of attention — rendered as
  // an art-zone overlay so the verified 4-row info grid stays untouched
  // (round-3 physics still banish them from covered cards).
  const focusCaption = [education, industry].filter(Boolean).join(' · ')
  const metaLine = ageGender

  const usingAvatar = Boolean(member.avatarUrl && !avatarFailed)
  const assetUrl = usingAvatar ? member.avatarUrl ?? undefined : getArchetypeAssetUrl(member.archetype)
  const showPlaceholder = !assetUrl || imageError

  const handleTap = useCallback(() => {
    if (!isDealt) return
    // Swallow exactly the first tap following a longpress (within 3s): the
    // flag is consumed by that first tap whether or not it is swallowed, so
    // the guard can never double-swallow, and the 3s max-age means a stale
    // flag cannot eat an unrelated future tap — an expired flag falls
    // through and the tap is processed normally. Flip/focus semantics are
    // owned by the parent — the face derives from the controller flip set.
    if (pendingTrailingTapRef.current) {
      pendingTrailingTapRef.current = false
      if (Date.now() - lastLongPressAtRef.current < TRAILING_TAP_MAX_AGE_MS) return
    }
    onTap()
  }, [isDealt, onTap])

  const handleLongPress = useCallback(() => {
    if (!isDealt) return
    lastLongPressAtRef.current = Date.now()
    pendingTrailingTapRef.current = true
    haptics('medium')
    onLongPress()
  }, [isDealt, onLongPress])

  // Fan pose + state transforms live in SCSS classes (inline `rpx`/`deg` is
  // not transformed by the Taro H5 build). The per-index rotation comes from
  // the row + :nth-child rules in index.scss; this component only toggles
  // state classes and sets unitless/ms/colour values inline (safe in both
  // runtimes).
  // - Not dealt: SCSS start pose (below, scaled down, transparent).
  // - Dealt: parent --dealt gates the per-index fan pose, landing face-DOWN.
  // - Face-up: --flipped (isDealt && isFaceUp) rotates the inner to the front.
  // - Focused: --focused-lift straightens + rises + scales; siblings preserve
  //   their original opaque fan pose so the layered deck stays legible (no
  //   dim — the tap-to-reveal revamp removed sibling dimming entirely).
  // - Pocketed: --pocketing folds the card toward the pill vanish point
  //   (motion tiers only); opacity is inline-driven so every tier can fade.
  const pocketTransitionActive = pocketTransitionDelayMs != null
  const opacity = pocketPose ? 0 : isDealt ? 1 : 0
  // z-index ascends left→right via the SCSS per-index rules; a focused card
  // jumps to the top. Undefined lets the SCSS value stand for non-focused.
  const zIndex = focused ? 50 : undefined

  // Pocket windows override the emerge/focus timing: the fold exit is 300ms
  // (mirrors FOLD_CARD_EXIT_MS); reduced-motion folds as a 150ms opacity
  // crossfade (AC-06); degradation snaps directly.
  const transitionDuration = pocketTransitionActive
    ? reduceMotion
      ? 150
      : isDegradation
        ? 0
        : FOCUS_TRANSITION_MS
    : reduceMotion
      ? 0
      : emergeComplete
        ? FOCUS_TRANSITION_MS
        : DEAL_ENTER_MS
  const transitionDelay = pocketTransitionActive
    ? pocketTransitionDelayMs
    : reduceMotion || emergeComplete
      ? 0
      : emergeDelayMs

  // Canonical archetype ID for color/asset lookups — the server payload may
  // carry an ID ('corgi') or a legacy nameCn ('社牛柯基') depending on which
  // column won the coalesce; resolveArchetype handles both.
  const archetypeId = useMemo(
    () => (member.archetype ? resolveArchetype(member.archetype)?.id ?? null : null),
    [member.archetype],
  )

  const accent = useMemo(() => {
    const hsl = getArchetypeHSL(archetypeId)
    return {
      borderColor: formatHSLAsRGBA(hsl, 0.55),
      shadow: formatHSLAsRGBA(hsl, 0.22),
      edgeHighlight: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 22) }, 0.6),
      artStart: formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 30) }, 0.5),
      artEnd: formatHSLAsRGBA(hsl, 0.16),
    }
  }, [archetypeId])

  const archetypeTextColor = useMemo(
    () => getContrastSafeArchetypeColor(archetypeId),
    [archetypeId],
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

  const ariaLabel = isFaceUp
    ? [
        name,
        archetypeName,
        agePart,
        industry,
        education,
        isCurrentUser ? '我' : '',
        isBestPartner ? '最佳拍档' : '',
      ].filter(Boolean).join('，')
    : buildFaceDownCardAriaLabel(name, isCurrentUser)

  return (
    <View
      className={[
        'squad-unboxing__deck-card',
        focused ? 'squad-unboxing__deck-card--focused' : '',
        focused ? ((reduceMotion || isDegradation) ? 'squad-unboxing__deck-card--focused-lift-deg' : 'squad-unboxing__deck-card--focused-lift') : '',
        isCurrentUser ? 'squad-unboxing__deck-card--current' : '',
        isBestPartner ? 'squad-unboxing__deck-card--best-partner' : '',
        // Flip is derived solely from the controller-owned flip set (single
        // source of truth — REL-01) and only ever renders once dealt: a dealt
        // face-down card shows the enriched back; --flipped reveals the front.
        // No per-card local flip state may be reintroduced.
        isDealt && isFaceUp ? 'squad-unboxing__deck-card--flipped' : '',
        // Pocket-the-deck fold transform: motion tiers only. Reduced-motion /
        // degradation fold via the inline opacity crossfade alone (AC-06).
        pocketPose && !reduceMotion && !isDegradation ? 'squad-unboxing__deck-card--pocketing' : '',
        // RM exception: marks the pocket fade so the SCSS can restore the
        // 150ms opacity-only crossfade past the blanket 0ms suppression.
        pocketPose && reduceMotion ? 'squad-unboxing__deck-card--pocket-fade' : '',
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
      aria-current={focused ? 'true' : undefined}
    >
      {/* 最佳拍档 heartbeat glow (AC-02): a single opacity-pulse overlay that
          fires as this card folds into the pill — the emotional full-stop of
          the cascade. animationDelay aligns the pulse with the card's fold
          delay; reduced-motion/degradation never receive pocketGlowActive. */}
      {pocketGlowActive ? (
        <View
          className='squad-unboxing__deck-card-pocket-glow squad-unboxing__deck-card-pocket-glow--active'
          style={{ animationDelay: `${pocketTransitionDelayMs ?? 0}ms` }}
          aria-hidden='true'
        />
      ) : null}
      <View
        className='squad-unboxing__deck-card-inner'
        style={{ transitionDelay: `${flipDelayMs}ms` }}
      >
        {/* Card back — the resting face of the tap-to-reveal game. Enriched
            CSS lattice (SCSS gradients only — no raster pattern asset), foil
            edge, logo mark. The logo is a bundled <Image> sized in SCSS:
            BrandLogo sizes via inline rpx, which the H5 postcss pass drops →
            the back logo collapsed to a broken-image glyph in H5 (A8). Backs
            are uniform except the best-partner gold tease; no identity text
            on any back. */}
        <View
          className={[
            'squad-unboxing__deck-card-face',
            'squad-unboxing__deck-card-face--back',
            isBestPartner ? 'squad-unboxing__deck-card-face--back-gold' : '',
          ].filter(Boolean).join(' ')}
        >
          <View className='squad-unboxing__deck-card-back-lattice' aria-hidden='true' />
          <View className='squad-unboxing__deck-card-back-foil' />
          <View className='squad-unboxing__deck-card-back-logo'>
            <Image
              className='squad-unboxing__deck-card-back-logo-img'
              src='/assets/joyjoin-logo-tab.png'
              mode='aspectFit'
              lazyLoad={false}
              aria-hidden='true'
            />
          </View>
          {overflowBadge > 0 ? (
            <View className='squad-unboxing__deck-card-meta-chip squad-unboxing__deck-card-meta-chip--overflow squad-unboxing__deck-card-back-overflow'>
              <Text className='squad-unboxing__deck-card-meta-chip-text'>+{overflowBadge}</Text>
            </View>
          ) : null}
        </View>

        {/* Card front — the rich collectible template. */}
        <View className='squad-unboxing__deck-card-face squad-unboxing__deck-card-face--front'>
          {/* Per-flip sheen — a transform-only band that plays once when the
              card flips face-up (tap / auto-me / reveal-all). Reuses the
              retired session holo's keyframe; never fires on all-up re-entry. */}
          <View
            className={[
              'squad-unboxing__deck-card-sheen',
              sheenActive ? 'squad-unboxing__deck-card-sheen--active' : '',
            ].filter(Boolean).join(' ')}
            style={{ animationDelay: `${sheenDelayMs}ms` }}
            aria-hidden='true'
          />
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
            {/* Focused-only caption (2026-07-16 PM): education · industry as
                an art-zone bottom overlay. Only the lifted card carries it —
                covered cards keep the round-3 minimal face. Opacity-fade
                entrance; privacy-gated fields silently omitted. */}
            {focused && focusCaption ? (
              <View className='squad-unboxing__deck-card-art-caption'>
                <Text className='squad-unboxing__deck-card-art-caption-text' numberOfLines={1}>
                  {focusCaption}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Info zone — strict 4-row grid (round-3 restructure): name,
              accent archetype, grey meta line (age·gender), one hook pill.
              Every row is one line, ellipsis-safe. The hook pill is the
              viewer's strongest connection point when one exists, else the
              member's top interest (2026-07-16 fallback — every card has a
              hook); the full industry + connection list feeds the focused
              narration bubble. */}
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
            ) : interestHook ? (
              <View className='squad-unboxing__deck-card-pills squad-unboxing__deck-card-pills--interest'>
                <ConnectionPointPill text={interestHook} rarity='common' />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  )
}
