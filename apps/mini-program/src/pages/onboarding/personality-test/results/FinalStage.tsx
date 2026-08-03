import { Image, ScrollView, Text, View } from '@tarojs/components'
// Note: ScrollView is also used for detail sheet overflow on small screens
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPE_BY_ID, ARCHETYPE_CANONICAL_ORDER } from '@shared/personality/archetypeNames'
import { getContrastSafeArchetypeColor } from '@shared/archetypeColors'
import type { ArchetypeSkillSet } from '@shared/personality/archetypeSkills'
import type { AIGCMeta } from '@joyjoin/shared/api'
import Button from '../../../../components/ui/Button'
import Card from '../../../../components/ui/Card'
import type { ArchetypeVisual } from '../visuals'
import type { AnonymousAssessmentTopMatch } from '../../../../lib/auth/anonymousOnboarding'
import { haptics } from '../../../../lib/utils/haptics'
import { cdnAsset } from '../../../../lib/utils/cdnAssets'
import XiaoyueChatBubble from '../../../../components/mascot/XiaoyueChatBubble'
import { PERSONALITY_TEST_XIAOYUE_EXPRESSION } from '../../../../lib/mascot/xiaoyueExpressions'
import AIGCLabel from '../../../../components/ai-content/AIGCLabel'
import AIContentReportButton from '../../../../components/ai-content/AIContentReportButton'
import { useAIGCLabelsEnabled } from '../../../../hooks/useAIGCLabelsEnabled'
import { ONBOARDING_MASCOT_SIZE } from '../../../../lib/onboarding/onboardingRoutes'
import type { ArchetypeCardVariant } from '../archetypeVariants'
import { normalizeMatchScore, type TypicalityLabel } from './resultHelpers'

/** Warm cream gradient midpoint — shared between dynamic card backgrounds.
 *  Extracted from hardcoded hex literals for brand token discipline. */
const CARD_GRADIENT_MID = '#fff8ee'

interface FinalStageProps {
  displayArchetypeName: string
  displayArchetypeId: string
  displayAsset: string
  visual: ArchetypeVisual
  summary: string
  shareLine: string
  traitEntries: Array<{ key: string; label: string; value: number }>
  topMatches: AnonymousAssessmentTopMatch[]
  skillSet?: ArchetypeSkillSet
  typicalityLabel?: TypicalityLabel
  secondaryAccent?: string
  isGeneratingPoster: boolean
  sharePosterPath?: string
  generationPhase?: string
  energyLevel?: number
  archetypeRank?: number
  serialNumber?: string
  variants?: ArchetypeCardVariant[]
  selectedVariantIndex?: number
  onGeneratePoster: () => void
  continueButtonLabel: string
  onContinue: () => void
  onRestart: () => void
  authIsLoading: boolean
  isAuthenticated?: boolean
  isLoggingIn?: boolean
  isDecisive?: boolean
  /** Phase 3 (2026-08-01): rare-variant easter egg — highly typical match
   *  shows the 闪光 badge on the hero card. */
  isRareVariant?: boolean
  secondaryDisplayName?: string
  xiaoyueAnalysis?: {
    headline: string
    analysis: string
    socialRole: string
    bestScene: string
    microAction: string
    expressionTags: string[]
    whyThisFits: string
    blendLine: string
    meta?: { aigc?: AIGCMeta }
  } | null
  isLoadingAnalysis?: boolean
  personalityShareEnabled?: boolean
  shareAnimatedClipEnabled?: boolean
  isGeneratingClip?: boolean
  onGenerateClip?: () => void
  posterError?: boolean
}

export function hasReadableXiaoyueCopy(value?: string | null): boolean {
  return Boolean(value?.trim())
}

export function shouldShowXiaoyueUnavailableNotice({
  xiaoyueAnalysis,
  summary,
  hiddenStrength,
}: {
  xiaoyueAnalysis?: FinalStageProps['xiaoyueAnalysis']
  summary?: string | null
  hiddenStrength?: string | null
}): boolean {
  return !xiaoyueAnalysis && !hasReadableXiaoyueCopy(summary) && !hasReadableXiaoyueCopy(hiddenStrength)
}

export default function FinalStage({
  displayArchetypeName,
  displayArchetypeId,
  displayAsset,
  visual,
  summary,
  shareLine,
  traitEntries,
  topMatches,
  skillSet,
  typicalityLabel,
  secondaryAccent,
  isGeneratingPoster,
  sharePosterPath,
  generationPhase,
  energyLevel,
  archetypeRank,
  serialNumber,
  variants,
  selectedVariantIndex,
  onGeneratePoster,
  continueButtonLabel,
  onContinue,
  onRestart,
  authIsLoading,
  isAuthenticated,
  isLoggingIn,
  isDecisive,
  isRareVariant = false,
  secondaryDisplayName,
  xiaoyueAnalysis,
  isLoadingAnalysis,
  personalityShareEnabled = true,
  shareAnimatedClipEnabled = false,
  isGeneratingClip = false,
  onGenerateClip,
  posterError = false,
}: FinalStageProps) {
  const [heroImgError, setHeroImgError] = useState(false)
  const [pokemonImgError, setPokemonImgError] = useState(false)

  // Fallback chain: local bundle → CDN WebP → CDN PNG → mascot celebrate
  const heroSrc = heroImgError
    ? (visual.asset || displayAsset)
    : displayAsset
  const pokemonSrc = pokemonImgError
    ? (visual.asset || displayAsset)
    : displayAsset
  const [isTiltActive, setIsTiltActive] = useState(false)
  const [touchTilt, setTouchTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDetailClosing, setIsDetailClosing] = useState(false)
  const [isCardPressed, setIsCardPressed] = useState(false)
  const [badgesVisible, setBadgesVisible] = useState(false)
  const touchActiveRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const cardRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  const detailCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafPendingRef = useRef(false)
  const pendingTiltRef = useRef({ rotateX: 0, rotateY: 0 })
  const aigcLabelsEnabled = useAIGCLabelsEnabled()

  // Stagger badge entrance after mount
  useEffect(() => {
    const timer = setTimeout(() => setBadgesVisible(true), 300)
    return () => clearTimeout(timer)
  }, [])

  // Cleanup detail close timer on unmount to avoid setState after unmount
  useEffect(() => {
    return () => {
      if (detailCloseTimerRef.current) {
        clearTimeout(detailCloseTimerRef.current)
        detailCloseTimerRef.current = null
      }
    }
  }, [])

  // Measure card position once on mount (and on window resize)
  useEffect(() => {
    const measure = () => {
      const query = Taro.createSelectorQuery()
      query.select('.personality-results__pokemon-card').boundingClientRect()
      query.exec((res) => {
        if (res?.[0]) {
          cardRef.current = res[0]
        }
      })
    }
    // Delay slightly to ensure layout is settled
    const timer = setTimeout(measure, 300)
    return () => clearTimeout(timer)
  }, [displayArchetypeName, selectedVariantIndex])

  const handleCloseDetail = useCallback(() => {
    setIsDetailClosing(true)
    // Wait for close animation to finish before unmounting
    if (detailCloseTimerRef.current) {
      clearTimeout(detailCloseTimerRef.current)
    }
    detailCloseTimerRef.current = setTimeout(() => {
      setIsDetailOpen(false)
      setIsDetailClosing(false)
      detailCloseTimerRef.current = null
    }, 280)
  }, [])

  // Touch-driven tilt with gyro suppression
  const handleTouchStart = useCallback((e: any) => {
    const touch = e.touches?.[0]
    if (!touch) return
    touchActiveRef.current = true
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    setIsCardPressed(true)

    // Note: card position is measured once on mount (see useEffect above).
    // We do NOT call createSelectorQuery here to avoid jank during touch.
  }, [])

  const handleTouchMove = useCallback((e: any) => {
    const touch = e.touches?.[0]
    if (!touch || !cardRef.current) return

    // Detect primary scroll direction — if vertical, skip tilt and let ScrollView scroll
    const start = touchStartRef.current
    const moveDeltaX = Math.abs(touch.clientX - start.x)
    const moveDeltaY = Math.abs(touch.clientY - start.y)
    if (moveDeltaY > moveDeltaX * 1.5) {
      // User is scrolling vertically — release tilt and let parent ScrollView handle it
      touchActiveRef.current = false
      setTouchTilt({ rotateX: 0, rotateY: 0 })
      setIsCardPressed(false)
      return
    }

    const rect = cardRef.current
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = (touch.clientX - centerX) / (rect.width / 2)
    const deltaY = (touch.clientY - centerY) / (rect.height / 2)

    const maxTilt = 8
    const next = {
      rotateX: Math.max(-maxTilt, Math.min(maxTilt, deltaY * -6)),
      rotateY: Math.max(-maxTilt, Math.min(maxTilt, deltaX * 6)),
    }

    // Throttle state updates to the next animation frame to prevent
    // flooding React re-renders during fast swipes on low-end devices.
    pendingTiltRef.current = next
    if (!rafPendingRef.current) {
      rafPendingRef.current = true
      requestAnimationFrame(() => {
        rafPendingRef.current = false
        if (touchActiveRef.current) {
          setTouchTilt(pendingTiltRef.current)
          setIsTiltActive(true)
        }
      })
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchActiveRef.current = false
    pendingTiltRef.current = { rotateX: 0, rotateY: 0 }
    rafPendingRef.current = false
    setTouchTilt({ rotateX: 0, rotateY: 0 })
    setIsCardPressed(false)
  }, [])

  const effectiveRotateX = touchTilt.rotateX
  const effectiveRotateY = touchTilt.rotateY

  const handleCardTap = useCallback(() => {
    haptics('light')
    setIsDetailOpen(true)
  }, [])



  const handleSharePress = useCallback(() => {
    haptics('medium')
    onGeneratePoster()
  }, [onGeneratePoster])

  const handleRetryPoster = useCallback(() => {
    haptics('medium')
    onGeneratePoster()
  }, [onGeneratePoster])

  const handleClipPress = useCallback(() => {
    haptics('medium')
    onGenerateClip?.()
  }, [onGenerateClip])

  const activeVariant = variants?.[selectedVariantIndex ?? 0]
  const cardBackground = activeVariant
    ? `linear-gradient(160deg, ${activeVariant.accentSoft} 0%, ${CARD_GRADIENT_MID} 50%, rgba(255, 255, 255, 0.98) 100%)`
    : `linear-gradient(160deg, ${visual.accentSoft} 0%, ${CARD_GRADIENT_MID} 50%, rgba(255, 255, 255, 0.98) 100%)`
  const cardGlow = activeVariant ? activeVariant.accentGlow : visual.accentGlow

  // Collect-them-all: all archetypes with current one unlocked
  const allArchetypes = ARCHETYPE_CANONICAL_ORDER
  const unlockedCount = displayArchetypeId && allArchetypes.includes(displayArchetypeId) ? 1 : 0

  // Score-tier colors for partner chemistry. Kept as a named map so the
  // palette can be promoted to design-system tokens without scattering hex
  // literals through the render tree.
  const chemistryTierColors = useMemo(
    () => ({
      soul: '#ef4444',
      harmony: '#f97316',
      complement: '#8b5cf6',
      potential: '#64748b',
    }),
    [],
  )

  // Build partner data for detail sheet (memoized)
  const partnerData = useMemo(() => {
    return topMatches.slice(0, 3).map((match) => {
      const rawScore = Number(match.score)
      const displayScore = normalizeMatchScore(rawScore)
      const chemistryLabel = displayScore >= 85 ? '灵魂拍档' : displayScore >= 70 ? '默契搭档' : displayScore >= 55 ? '互补组合' : '潜力搭档'
      const chemistryColor =
        displayScore >= 85
          ? chemistryTierColors.soul
          : displayScore >= 70
            ? chemistryTierColors.harmony
            : displayScore >= 55
              ? chemistryTierColors.complement
              : chemistryTierColors.potential
      const accent = getContrastSafeArchetypeColor(match.archetype)
      return {
        ...match,
        score: displayScore,
        chemistryLabel,
        chemistryColor,
        accent,
      }
    })
  }, [topMatches, chemistryTierColors])

  // Identify the dominant trait for the "你最强" highlight in the trait list.
  const topTraitKey = useMemo(() => {
    if (!traitEntries.length) return null
    return traitEntries.reduce((best, t) => (t.value > best.value ? t : best), traitEntries[0]).key
  }, [traitEntries])

  // Compose the pull-quote body: whyThisFits + blendLine, merged to reduce
  // visual chunks. blendLine acts as a soft "footer" attribution line.
  const pullQuote = useMemo(() => {
    const why = xiaoyueAnalysis?.whyThisFits?.trim() ?? ''
    const blend = xiaoyueAnalysis?.blendLine?.trim() ?? ''
    if (why && blend) return `${why}`
    return why || blend
  }, [xiaoyueAnalysis])
  const pullQuoteFooter = useMemo(() => {
    const why = xiaoyueAnalysis?.whyThisFits?.trim() ?? ''
    const blend = xiaoyueAnalysis?.blendLine?.trim() ?? ''
    return why && blend ? blend : ''
  }, [xiaoyueAnalysis])
  const showXiaoyueUnavailableNotice = shouldShowXiaoyueUnavailableNotice({
    xiaoyueAnalysis,
    summary,
    hiddenStrength: visual.hiddenStrength,
  })

  return (
    <>
      <ScrollView className='personality-results__scroll' scrollY enhanced showScrollbar={false}>
        <View
          className='personality-results__hero-card personality-results__stagger--1'
          style={{
            background: visual.accentSurface,
            borderColor: visual.accentBorder,
            boxShadow: `0 22rpx 72rpx ${visual.accentGlow}`,
          }}
        >
          <View className='personality-results__hero-copy'>
            <Text className='personality-results__hero-eyebrow'>解锁成功</Text>
            <Text className='personality-results__hero-title'>你的氛围命格是</Text>
            <Text className='personality-results__hero-name' aria-label={displayArchetypeName}>
              {/* Slice 5 (2026-07-19): letter-by-letter reveal; suppressed under reduce-motion */}
              {[...displayArchetypeName].map((ch, i) => (
                <Text
                  key={`${ch}-${i}`}
                  className='personality-results__hero-name-char'
                  style={{ animationDelay: `${i * 90}ms` }}
                  aria-hidden='true'
                >
                  {ch}
                </Text>
              ))}
            </Text>
            <Text className='personality-results__hero-summary'>{summary}</Text>
          </View>

          <View className='personality-results__hero-art-shell'>
            <View className='personality-results__hero-art-bg' style={{ background: visual.accentSoft }} />
            <Image
              className='personality-results__hero-art'
              mode='aspectFit'
              src={heroSrc}
              ariaLabel={`你的氛围命格形象：${displayArchetypeName}`}
              onError={() => setHeroImgError(true)}
            />
            {/* No text overlay on archetype image — clean art only */}
          </View>

          <View className='personality-results__hero-badges'>
            {typicalityLabel ? (
              <Text
                className={`personality-results__hero-badge personality-results__hero-badge--typicality ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}
                aria-label={`${typicalityLabel.prefix}${typicalityLabel.name}`}
              >
                <Text aria-hidden='true'>{typicalityLabel.prefix}</Text>
                <Text style={{ color: typicalityLabel.accent }} aria-hidden='true'>{typicalityLabel.name}</Text>
              </Text>
            ) : null}
            {typeof visual.rarityPercentage === 'number' ? (
              <Text className={`personality-results__hero-badge personality-results__hero-badge--rarity ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}>稀有度 {Math.round(visual.rarityPercentage)}%</Text>
            ) : null}
            {isRareVariant ? (
              <Text
                className={`personality-results__hero-badge personality-results__hero-badge--rare ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}
                aria-label='闪光命定'
              >
                闪光命定
              </Text>
            ) : null}
            {visual.nickname ? (
              <Text className={`personality-results__hero-badge personality-results__hero-badge--nickname ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}>{visual.nickname}</Text>
            ) : null}
          </View>

          {isDecisive === false && secondaryDisplayName ? (
            <Text className='personality-results__hero-blend'>
              <Text>隐约有</Text>
              <Text style={{ color: secondaryAccent || visual.accentText }}>{secondaryDisplayName}</Text>
              <Text>的影子</Text>
            </Text>
          ) : null}

          {/* Xiaoyue short analysis — integrated into hero card */}
          <View className='personality-results__hero-xiaoyue'>
            {isLoadingAnalysis && !xiaoyueAnalysis ? (
              <View className='personality-results__xiaoyue-skeleton'>
                <View className='personality-results__xiaoyue-skeleton-avatar' />
                <View className='personality-results__xiaoyue-skeleton-bubble'>
                  <View className='personality-results__xiaoyue-skeleton-line personality-results__xiaoyue-skeleton-line--short' />
                  <View className='personality-results__xiaoyue-skeleton-line' />
                  <View className='personality-results__xiaoyue-skeleton-line' />
                </View>
              </View>
            ) : xiaoyueAnalysis ? (
              <>
                <View className='personality-results__xiaoyue-bubble-row'>
                  <Image
                    className='personality-results__xiaoyue-avatar'
                    mode='aspectFit'
                    src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
                  />
                  <View className='personality-results__xiaoyue-bubble'>
                    <View className='personality-results__xiaoyue-bubble-head'>
                      <Text className='personality-results__xiaoyue-bubble-headline'>
                        「{xiaoyueAnalysis.headline}」
                      </Text>
                      <AIGCLabel meta={xiaoyueAnalysis.meta?.aigc} />
                    </View>
                    <Text className='personality-results__xiaoyue-bubble-analysis'>
                      {xiaoyueAnalysis.analysis}
                    </Text>
                  </View>
                </View>
                {xiaoyueAnalysis.expressionTags?.length > 0 && (
                  <View className='personality-results__hero-xiaoyue-tags'>
                    {xiaoyueAnalysis.expressionTags.map((tag) => (
                      <View key={tag} className='personality-results__hero-xiaoyue-tag'>
                        <Text className='personality-results__hero-xiaoyue-tag-text'>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View
                  className='personality-results__hero-xiaoyue-cta'
                  style={{
                    background: visual.accentStrong,
                    boxShadow: `0 4rpx 16rpx ${visual.accentGlow}`,
                  }}
                  onClick={handleCardTap}
                  hoverClass='personality-results__hero-xiaoyue-cta--active'
                  role='button'
                  aria-label='查看悦仔完整解读'
                >
                  <Text className='personality-results__hero-xiaoyue-cta-text'>
                    查看悦仔完整解读
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View className='personality-results__xiaoyue-bubble-row'>
                  <Image
                    className='personality-results__xiaoyue-avatar'
                    mode='aspectFit'
                    src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
                  />
                  <View className='personality-results__xiaoyue-bubble'>
                    <Text className='personality-results__xiaoyue-bubble-headline'>这个命格为什么像你</Text>
                    <Text className='personality-results__xiaoyue-bubble-analysis'>{summary}</Text>
                    <Text className='personality-results__xiaoyue-bubble-analysis'>
                      {visual.hiddenStrength || '你的氛围感不是靠用力营业，而是靠稳定地把气氛带到对的位置。'}
                    </Text>
                  </View>
                </View>
                {showXiaoyueUnavailableNotice ? (
                  <View className='personality-results__xiaoyue-fallback-indicator'>
                    <Text className='personality-results__xiaoyue-fallback-indicator-text'>
                      悦仔的解读暂时不可用，先看看你的氛围卡吧
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>

        <View className='personality-results__bridge personality-results__stagger--2'>
          <Text className='personality-results__bridge-text'>你的专属氛围技能</Text>
        </View>

        <Card className='personality-results__section-card personality-results__stagger--3'>
          <Text className='personality-results__section-label'>你的氛围技能卡</Text>
          <View
            className={`personality-results__pokemon-card ${isTiltActive ? 'personality-results__pokemon-card--tilt' : ''} ${isCardPressed ? 'personality-results__pokemon-card--pressed' : ''}`}
            style={{
              background: cardBackground,
              boxShadow: `0 24rpx 72rpx ${cardGlow}`,
              transform: `perspective(1200rpx) rotateX(${effectiveRotateX}deg) rotateY(${effectiveRotateY}deg) scale(${isCardPressed ? 0.97 : 1})`,
              transformStyle: 'preserve-3d',
            }}
            role='button'
            aria-label='查看悦仔完整解读'
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Holographic shimmer overlay */}
            <View className='personality-results__pokemon-holo-shimmer' />
            {/* Corner shine */}
            <View className='personality-results__pokemon-corner-shine personality-results__pokemon-corner-shine--top-right' />
            <View className='personality-results__pokemon-corner-shine personality-results__pokemon-corner-shine--bottom-left' />

            <View className='personality-results__pokemon-card-top'>
              <Text className='personality-results__pokemon-chip personality-results__pokemon-chip--dark'>
                {typicalityLabel ? `${typicalityLabel.prefix}${typicalityLabel.name}` : '悦聚氛围卡'}
              </Text>
            </View>

            <View className='personality-results__pokemon-card-hero'>
              <View className='personality-results__pokemon-art-shell'>
                <Image
                  className='personality-results__pokemon-art'
                  mode='aspectFit'
                  src={pokemonSrc}
                  onError={() => setPokemonImgError(true)}
                />
              </View>
              <View className='personality-results__pokemon-copy'>
                <Text className='personality-results__pokemon-name'>{displayArchetypeName}</Text>
                <Text className='personality-results__pokemon-tagline'>{visual.tagline || visual.description}</Text>
              </View>
            </View>

            {/* Rank badges */}
            {(typeof archetypeRank === 'number' && serialNumber) ? (
              <View className='personality-results__pokemon-rank-row'>
                <Text className='personality-results__pokemon-rank-chip'>氛围编号 #{archetypeRank}</Text>
                <Text className='personality-results__pokemon-rank-chip personality-results__pokemon-rank-chip--gold'>{serialNumber}</Text>
              </View>
            ) : null}

            {/* Energy bar */}
            {typeof energyLevel === 'number' ? (
              <View className='personality-results__pokemon-energy'>
                <View className='personality-results__pokemon-energy-header'>
                  <Text className='personality-results__pokemon-energy-label'>社交续航力</Text>
                  <Text className='personality-results__pokemon-energy-value'>{Math.round(energyLevel)}%</Text>
                </View>
                <View className='personality-results__pokemon-energy-track'>
                  <View
                    className='personality-results__pokemon-energy-fill'
                    style={{ width: `${Math.min(energyLevel, 100)}%` }}
                  />
                </View>
                <Text className='personality-results__pokemon-energy-hint'>你在社交场合的持久活力</Text>
              </View>
            ) : null}

            <View className='personality-results__pokemon-skill-grid'>
              <View className='personality-results__pokemon-skill personality-results__pokemon-skill--warm'>
                <Text className='personality-results__pokemon-skill-label'>氛围技能</Text>
                <Text className='personality-results__pokemon-skill-name'>
                  {skillSet?.activeSkill.name ?? '瞬间点亮全场'}
                </Text>
                <Text className='personality-results__pokemon-skill-copy'>
                  {skillSet?.activeSkill.shortEffect ?? '三句话内让冷场变暖场。'}
                </Text>
              </View>
              <View className='personality-results__pokemon-skill personality-results__pokemon-skill--cool'>
                <Text className='personality-results__pokemon-skill-label'>氛围天赋</Text>
                <Text className='personality-results__pokemon-skill-name'>
                  {skillSet?.passiveSkill.name ?? '气场持续发光'}
                </Text>
                <Text className='personality-results__pokemon-skill-copy'>
                  {skillSet?.passiveSkill.shortEffect ?? '不用刻意表现，自然让人想靠近。'}
                </Text>
              </View>
            </View>

            {/* Collectible edition stamp */}
            <View className='personality-results__pokemon-holo-stamp'>
              <Text className='personality-results__pokemon-holo-stamp-text'>限量氛围版</Text>
            </View>

            <View className='personality-results__pokemon-actions'>
              {posterError && (
                <View className='personality-results__poster-error'>
                  <Text className='personality-results__poster-error-text'>卡片生成失败了，再试一次？</Text>
                  <Button
                    variant='secondary'
                    size='sm'
                    onClick={handleRetryPoster}
                    hoverClass='joy-button--active'
                  >
                    重试生成
                  </Button>
                </View>
              )}
              {personalityShareEnabled && !posterError && (
                <Button
                  onClick={handleSharePress}
                  disabled={isGeneratingPoster}
                  loading={isGeneratingPoster}
                  hoverClass='joy-button--active'
                >
                  {isGeneratingPoster
                    ? (generationPhase || '正在渲染卡面…')
                    : sharePosterPath
                      ? '分享卡片'
                      : '保存我的氛围卡'}
                </Button>
              )}
              {shareAnimatedClipEnabled && onGenerateClip && (
                <Button
                  variant='secondary'
                  onClick={handleClipPress}
                  disabled={isGeneratingClip}
                  loading={isGeneratingClip}
                  hoverClass='joy-button--active'
                >
                  {isGeneratingClip ? '正在合成动态短片…' : '生成动态分享短片'}
                </Button>
              )}
            </View>
          </View>
        </Card>

        {/* Collect-them-all teaser */}
        <Card className='personality-results__section-card personality-results__stagger--5'>
          <View className='personality-results__collect-header'>
            <Text className='personality-results__section-label'>命格图鉴</Text>
            <Text className='personality-results__collect-count'>
              已解锁 {unlockedCount}/12
            </Text>
          </View>
          <View className='personality-results__collect-grid'>
            {allArchetypes.map((archetype, idx) => {
              const isUnlocked = archetype === displayArchetypeId
              const archetypeNum = idx + 1
              return (
                <View
                  key={archetype}
                  className={`personality-results__collect-cell ${isUnlocked ? 'personality-results__collect-cell--unlocked' : ''}`}
                >
                  <Text className='personality-results__collect-number'>
                    {String(archetypeNum).padStart(2, '0')}
                  </Text>
                  <Text
                    className='personality-results__collect-name'
                    style={{ opacity: isUnlocked ? 1 : 0.35 }}
                  >
                    {isUnlocked ? (ARCHETYPE_BY_ID[archetype]?.nameCn ?? archetype) : '???'}
                  </Text>
                  {isUnlocked && (
                    <View className='personality-results__collect-glow' style={{ background: visual.accentSoft }} />
                  )}
                </View>
              )
            })}
          </View>
          <Text className='personality-results__collect-hint'>
            邀请朋友来测，一起解锁全部 12 种命格
          </Text>
        </Card>

        <View className='personality-results__stack-actions personality-results__stack-actions--spacious personality-results__stagger--6'>
          {/* Slice 6 (2026-07-19): next-horizon return hook — plants the pending thread.
              Copy is deliberately soft-truth: guests get the login-gated promise,
              authenticated users get the discover pointer (matching runs in pools). */}
          <Text className='personality-results__next-horizon'>
            {isAuthenticated
              ? '悦仔会在发现页为你留意同频的人——记得回来看看'
              : '登录后，悦仔就开始为你寻找同频的人'}
          </Text>
          <Button variant='wechat' onClick={() => void onContinue()} disabled={authIsLoading || isLoggingIn} loading={isLoggingIn}>
            {continueButtonLabel}
          </Button>
          <Button variant='secondary' onClick={onRestart}>重新测试一次</Button>
        </View>
      </ScrollView>

      {/* Detail Sheet Overlay */}
      {isDetailOpen && (
        <View className='personality-results__detail-overlay' onClick={handleCloseDetail}>
          <View
            className={`personality-results__detail-sheet ${isDetailClosing ? 'personality-results__detail-sheet--closing' : ''}`}
            onClick={(e) => { e.stopPropagation() }}
          >
            {/* Sheet handle */}
            <View className='personality-results__detail-handle' />

            <ScrollView
              className='personality-results__detail-scroll'
              scrollY
              showScrollbar={false}
            >
              {/* Sheet header */}
              <View className='personality-results__detail-header'>
                <Text className='personality-results__detail-title'>{displayArchetypeName}</Text>
                <Text className='personality-results__detail-subtitle'>{visual.tagline || visual.description}</Text>
              </View>

              {/* ── 悦仔的完整解读 — mascot reads aloud, sentence-staggered ── */}
              {xiaoyueAnalysis?.analysis && (
                <View className='personality-results__detail-section personality-results__detail-section--chat'>
                  <View className='personality-results__detail-section-label-row'>
                    <Text className='personality-results__detail-section-label'>悦仔的完整解读</Text>
                    <AIGCLabel meta={xiaoyueAnalysis.meta?.aigc} />
                  </View>
                  <XiaoyueChatBubble
                    content={xiaoyueAnalysis.analysis}
                    pose='casual'
                    expressionId={PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach}
                    horizontal
                    showGlow
                    staggerDelay={70}
                    avatarSize={ONBOARDING_MASCOT_SIZE}
                    className='personality-results__detail-chat'
                  />
                  {aigcLabelsEnabled && (
                    <AIContentReportButton
                      className='personality-results__detail-report'
                      options={{
                        reason: '举报“人格测试结果解读”AI 生成内容',
                      }}
                    />
                  )}
                </View>
              )}

              {/* ── 悦仔的关键洞察 — quiet pull-quote, no glow, different pose ── */}
              {pullQuote && (
                <View className='personality-results__detail-section personality-results__detail-section--chat'>
                  <View
                    className='personality-results__detail-quote'
                    style={{ borderLeftColor: visual.accent }}
                  >
                    <View className='personality-results__detail-quote-avatar'>
                      <Image
                        className='personality-results__detail-quote-avatar-img'
                        mode='aspectFit'
                        src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-thanks-feedback.webp')}
                      />
                    </View>
                    <View className='personality-results__detail-quote-body'>
                      <Text className='personality-results__detail-quote-text'>{pullQuote}</Text>
                      {pullQuoteFooter && (
                        <Text className='personality-results__detail-quote-footer'>{pullQuoteFooter}</Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* ── 氛围画像 — mascot intro + polished trait bars ── */}
              {traitEntries.length > 0 && (
                <View className='personality-results__detail-section'>
                  <View className='personality-results__detail-section-head'>
                    <View
                      className='personality-results__detail-section-avatar'
                      style={{ background: visual.accentSoft }}
                    >
                      <Image
                        className='personality-results__detail-section-avatar-img'
                        mode='aspectFit'
                        src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
                      />
                    </View>
                    <Text className='personality-results__detail-section-label'>氛围画像</Text>
                    <Text className='personality-results__detail-section-hint'>分数越高越突出</Text>
                  </View>
                  <View className='personality-results__trait-list'>
                    {traitEntries.map((trait) => {
                      const isTop = trait.key === topTraitKey
                      return (
                        <View
                          key={trait.key}
                          className={`personality-results__trait-row ${isTop ? 'personality-results__trait-row--top' : ''}`}
                        >
                          <View className='personality-results__trait-header'>
                            <View className='personality-results__trait-label-wrap'>
                              <Text className='personality-results__trait-label'>{trait.label}</Text>
                              {isTop && (
                                <View
                                  className='personality-results__trait-top-badge'
                                  style={{ background: visual.accentSoft, color: visual.accent }}
                                >
                                  <Text className='personality-results__trait-top-badge-text'>你最强</Text>
                                </View>
                              )}
                            </View>
                            <Text
                              className='personality-results__trait-value'
                              style={{ color: isTop ? visual.accent : undefined }}
                            >
                              {trait.value}
                            </Text>
                          </View>
                          <View
                            className='personality-results__trait-track'
                            style={{ color: visual.accent }}
                          >
                            {Array.from({ length: 10 }, (_, i) => {
                              const filled = (i + 1) * 10 <= trait.value
                              return (
                                <View
                                  key={i}
                                  className={`personality-results__trait-segment ${filled ? 'personality-results__trait-segment--filled' : 'personality-results__trait-segment--dim'}`}
                                  style={filled && isTop && i === Math.min(9, Math.floor((trait.value - 1) / 10))
                                    ? { boxShadow: `0 0 8rpx ${visual.accentGlow}` }
                                    : undefined}
                                />
                              )
                            })}
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* ── 默契搭档 — horizontal scroll of mini partner cards ── */}
              {partnerData.length > 0 && (
                <View className='personality-results__detail-section'>
                  <View className='personality-results__detail-section-head personality-results__detail-section-head--solo'>
                    <Text className='personality-results__detail-section-label'>默契搭档</Text>
                    <Text className='personality-results__detail-section-hint'>右滑看更多 →</Text>
                  </View>
                  <ScrollView
                    className='personality-results__detail-partner-scroll'
                    scrollX
                    enhanced
                    showScrollbar={false}
                  >
                    <View className='personality-results__detail-partner-row'>
                      {partnerData.map((partner) => (
                        <View
                          key={partner.archetype}
                          className='personality-results__detail-partner'
                          style={{ borderColor: `${partner.chemistryColor}33` }}
                        >
                          <View
                            className='personality-results__detail-partner-dot'
                            style={{ background: partner.chemistryColor }}
                          />
                          <Text
                            className='personality-results__detail-partner-name'
                            style={{ color: partner.accent }}
                          >
                            {ARCHETYPE_BY_ID[partner.archetype]?.nameCn ?? partner.archetype}
                          </Text>
                          <Text
                            className='personality-results__detail-partner-tag'
                            style={{ color: partner.chemistryColor }}
                          >
                            {partner.chemistryLabel}
                          </Text>
                          <Text className='personality-results__detail-partner-score'>
                            氛围契合{partner.score}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            {/* Close button */}
            <View
              className='personality-results__detail-close'
              onClick={handleCloseDetail}
              hoverClass='personality-results__detail-close--active'
            >
              <Text className='personality-results__detail-close-text'>收起</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}
