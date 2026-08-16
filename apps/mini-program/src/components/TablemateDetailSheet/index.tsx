import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolveArchetype } from '@shared/personality/archetypeNames'
import { getArchetypeHSL, formatHSLAsRGBA, getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import type { PoolGroupMemberSummary } from '@shared/api'
import type { PairExplanation } from '@shared/types/groupAnalysis'
import { ARCHETYPE_ASSET_MAP } from '../../lib/utils/archetypeAssets'
import {
  CHEMISTRY_TIER_EMOJI,
  getPairChemistryTier,
  getPairChemistryWord,
  stripConnectionPointParens,
} from '../../lib/utils/pairChemistry'
import { haptics } from '../../lib/utils/haptics'
import MissingArchetypePlaceholder from '../mascot/MissingArchetypePlaceholder'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import Button from '../ui/Button'
import './index.scss'

export interface TablemateDetailSheetProps {
  visible: boolean
  member: PoolGroupMemberSummary | null
  /** Viewer's pair explanation with THIS member — full (untruncated)
   *  connection points + the pair-temperature word. */
  viewerPair?: PairExplanation | null
  isCurrentUser?: boolean
  reduceMotion?: boolean
  onClose: () => void
}

const MAX_CONNECTION_POINTS = 3
const MAX_INTEREST_TAGS = 6

/**
 * TablemateDetailSheet (2026-08-16 polish) — bottom-sheet member profile
 * opened by tapping a 桌友卡. The card face carries a 1-line truncated
 * connection pill; this sheet is where the full governed copy lands, plus
 * the member's industry line and complete interest tags.
 *
 * Info-type overlay → bottom sheet (same family as DuoInfoSheet /
 * PersonaSnapshotSheet); never a centred dialog.
 */
function TablemateDetailSheet({
  visible,
  member,
  viewerPair,
  isCurrentUser = false,
  reduceMotion = false,
  onClose,
}: TablemateDetailSheetProps) {
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Reset the fallback chain whenever a different member is shown.
  useEffect(() => {
    setAvatarFailed(false)
    setImageError(false)
    setImageLoaded(false)
  }, [member?.userId, member?.avatarUrl, member?.archetype])

  const archetypeId = useMemo(
    () => (member?.archetype ? resolveArchetype(member.archetype)?.id ?? null : null),
    [member?.archetype],
  )
  const archetypeName = useMemo(() => {
    if (!member?.archetype) return ''
    return resolveArchetype(member.archetype)?.nameCn ?? '神秘伙伴'
  }, [member?.archetype])
  const archetypeTextColor = useMemo(
    () => getContrastSafeArchetypeColor(archetypeId),
    [archetypeId],
  )
  const heroBackground = useMemo(() => {
    const hsl = getArchetypeHSL(archetypeId)
    return `linear-gradient(160deg, ${formatHSLAsRGBA({ ...hsl, l: Math.min(100, hsl.l + 30) }, 0.5)} 0%, ${formatHSLAsRGBA(hsl, 0.16)} 100%)`
  }, [archetypeId])

  // Full-length connection points (pill on the card is display-shortened;
  // the sheet keeps the governed copy, only stripping wrapping parens) and
  // carries the rarity tier through for the coloured dots.
  const connectionPoints = useMemo(() => {
    if (!viewerPair) return [] as { text: string; rarity: 'common' | 'rare' | 'epic' }[]
    const withRarity = viewerPair.connectionPointsWithRarity
    const raw: { text: string; rarity: 'common' | 'rare' | 'epic' }[] = withRarity && withRarity.length > 0
      ? withRarity.map((point) => ({ text: point.text, rarity: point.rarity }))
      : (viewerPair.connectionPoints ?? []).map((text) => ({ text, rarity: 'common' as const }))
    return raw
      .map((point) => ({ ...point, text: stripConnectionPointParens(point.text ?? '') }))
      .filter((point) => point.text)
      .slice(0, MAX_CONNECTION_POINTS)
  }, [viewerPair])

  const chemistryScore = viewerPair && typeof viewerPair.chemistryScore === 'number'
    ? viewerPair.chemistryScore
    : null
  const temperatureWord = chemistryScore != null ? getPairChemistryWord(chemistryScore) : ''
  const temperatureTier = getPairChemistryTier(chemistryScore)
  const temperatureEmoji = temperatureTier ? CHEMISTRY_TIER_EMOJI[temperatureTier].emoji : ''

  const interestTags = useMemo(
    () => (member?.topInterests ?? [])
      .map((interest) => (interest ?? '').trim())
      .filter(Boolean)
      .slice(0, MAX_INTEREST_TAGS),
    [member?.topInterests],
  )

  const handleClose = useCallback(() => {
    haptics('light')
    onClose()
  }, [onClose])

  // Swipe-down-to-close on the NON-scroll chrome (handle + hero) only —
  // attaching it to the ScrollView body would fight normal scrolling.
  const pullStartYRef = useRef<number | null>(null)
  const handlePullStart = useCallback((event: any) => {
    pullStartYRef.current = event.touches?.[0]?.clientY ?? null
  }, [])
  const handlePullEnd = useCallback((event: any) => {
    const startY = pullStartYRef.current
    pullStartYRef.current = null
    if (startY == null) return
    const endY = event.changedTouches?.[0]?.clientY
    if (typeof endY === 'number' && endY - startY > 60) {
      handleClose()
    }
  }, [handleClose])

  // Avatar fallback chain — computed before the visibility early-return so
  // every hook stays above it (rules-of-hooks).
  const usingAvatar = Boolean(member?.avatarUrl && !avatarFailed)
  const assetUrl = usingAvatar
    ? member?.avatarUrl ?? undefined
    : archetypeId
      ? ARCHETYPE_ASSET_MAP[archetypeId]?.webp
      : undefined
  const showPlaceholder = !assetUrl || imageError

  const handleImageError = useCallback(() => {
    if (member?.avatarUrl && !avatarFailed) {
      setAvatarFailed(true)
      setImageLoaded(false)
      return
    }
    setImageError(true)
  }, [member?.avatarUrl, avatarFailed])
  const handleImageLoad = useCallback(() => setImageLoaded(true), [])

  // Tap the hero avatar to inspect it full-screen (only for real avatars).
  const handlePreviewAvatar = useCallback(() => {
    if (!usingAvatar || !member?.avatarUrl) return
    haptics('light')
    Taro.previewImage({ urls: [member.avatarUrl], current: member.avatarUrl })
  }, [usingAvatar, member?.avatarUrl])

  if (!visible || !member) return null

  const name = member.displayName || '匿名'
  const agePart = member.ageVisible === false ? '' : (member.ageLabel ?? '')
  const genderPart = (() => {
    const gender = member.gender
    if (gender === 'male' || gender === '男性' || gender === '男') return '男'
    if (gender === 'female' || gender === '女性' || gender === '女') return '女'
    return ''
  })()
  const metaLine = [agePart, genderPart].filter(Boolean).join(' · ')

  return (
    <View className='tablemate-sheet' catchMove onClick={handleClose}>
      <View className='tablemate-sheet__backdrop' />
      <View
        className={
          reduceMotion
            ? 'tablemate-sheet__surface tablemate-sheet__surface--static'
            : 'tablemate-sheet__surface'
        }
        role='dialog'
        aria-modal='true'
        aria-label={`成员详情：${name}`}
        onClick={(event) => event.stopPropagation()}
      >
        <View
          className='tablemate-sheet__handle'
          onTouchStart={handlePullStart}
          onTouchEnd={handlePullEnd}
        />

        <View
          className='tablemate-sheet__hero'
          style={{ background: heroBackground }}
          onTouchStart={handlePullStart}
          onTouchEnd={handlePullEnd}
        >
          <View
            className={[
              'tablemate-sheet__hero-avatar',
              usingAvatar ? 'tablemate-sheet__hero-avatar--tappable' : '',
            ].filter(Boolean).join(' ')}
            onClick={handlePreviewAvatar}
          >
            {showPlaceholder ? (
              <MissingArchetypePlaceholder size={144} className='tablemate-sheet__hero-placeholder' />
            ) : (
              <Image
                className={[
                  'tablemate-sheet__hero-img',
                  usingAvatar ? 'tablemate-sheet__hero-img--avatar' : '',
                  imageLoaded ? 'tablemate-sheet__hero-img--loaded' : '',
                ].filter(Boolean).join(' ')}
                src={assetUrl}
                mode={usingAvatar ? 'aspectFill' : 'aspectFit'}
                lazyLoad
                onError={handleImageError}
                onLoad={handleImageLoad}
                aria-hidden='true'
              />
            )}
          </View>
          {temperatureWord ? (
            <View
              className={[
                'tablemate-sheet__temp-chip',
                temperatureTier ? `tablemate-sheet__temp-chip--${temperatureTier}` : '',
              ].filter(Boolean).join(' ')}
            >
              {temperatureTier ? (
                <JoyJoinIcon
                  emoji={temperatureEmoji}
                  tier='chemistry'
                  size={20}
                  className='tablemate-sheet__temp-chip-icon'
                />
              ) : null}
              <Text className='tablemate-sheet__temp-chip-text'>默契 · {temperatureWord}</Text>
            </View>
          ) : null}
        </View>

        <View className='tablemate-sheet__name-row'>
          <Text className='tablemate-sheet__name' numberOfLines={1}>{name}</Text>
          {isCurrentUser ? (
            <View className='tablemate-sheet__me-chip'>
              <Text className='tablemate-sheet__me-chip-text'>我</Text>
            </View>
          ) : null}
        </View>

        {archetypeName ? (
          <Text className='tablemate-sheet__archetype' style={{ color: archetypeTextColor }} numberOfLines={1}>
            {archetypeName}
          </Text>
        ) : null}
        {metaLine ? (
          <Text className='tablemate-sheet__meta' numberOfLines={1}>{metaLine}</Text>
        ) : null}
        {member.industryNicheLabel ? (
          <Text className='tablemate-sheet__industry' numberOfLines={1}>{member.industryNicheLabel}</Text>
        ) : null}

        <ScrollView className='tablemate-sheet__scroll' scrollY enhanced showScrollbar={false}>
          {connectionPoints.length > 0 ? (
            <View className='tablemate-sheet__section'>
              <Text className='tablemate-sheet__section-title'>
                你们的连接点{chemistryScore != null ? ` · 默契 ${chemistryScore}` : ''}
              </Text>
              <View className='tablemate-sheet__points' role='list'>
                {connectionPoints.map((point) => (
                  <View key={point.text} className='tablemate-sheet__point-item' role='listitem'>
                    <Text className={`tablemate-sheet__point-dot tablemate-sheet__point-dot--${point.rarity}`}>·</Text>
                    <Text className='tablemate-sheet__point-text'>「{point.text}」</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {interestTags.length > 0 ? (
            <View className='tablemate-sheet__section'>
              <Text className='tablemate-sheet__section-title'>TA 的兴趣</Text>
              <View className='tablemate-sheet__tags'>
                {interestTags.map((interest) => (
                  <Text key={interest} className='tablemate-sheet__tag' numberOfLines={1}>
                    {interest}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          {connectionPoints.length === 0 && interestTags.length === 0 ? (
            <View className='tablemate-sheet__section'>
              <Text className='tablemate-sheet__empty'>
                悦仔还没读到你们的交集，这正是现场聊天的理由。
              </Text>
            </View>
          ) : null}

          <View className='tablemate-sheet__cta'>
            <Button variant='primary' onClick={handleClose}>
              现场见
            </Button>
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

export default memo(TablemateDetailSheet)
