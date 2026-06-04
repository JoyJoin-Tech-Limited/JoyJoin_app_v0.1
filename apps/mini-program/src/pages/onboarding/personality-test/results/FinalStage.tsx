import { Image, ScrollView, Text, View } from '@tarojs/components'
// Note: ScrollView is also used for detail sheet overflow on small screens
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPE_BY_ID, ARCHETYPE_CANONICAL_ORDER, getArchetypeIndex } from '@shared/personality/archetypeNames'
import Button from '../../../../components/ui/Button'
import Card from '../../../../components/ui/Card'
import type { ArchetypeVisual } from '../visuals'
import type { AnonymousAssessmentTopMatch } from '../../../../lib/auth/anonymousOnboarding'
import type { ArchetypeSkillSet } from '@shared/personality/archetypeSkills'
import { haptics } from '../../../../lib/utils/haptics'
import { cdnAsset, localAsset } from '../../../../lib/utils/cdnAssets'
import XiaoyueChatBubble from '../../../../components/mascot/XiaoyueChatBubble'
import { PERSONALITY_TEST_XIAOYUE_EXPRESSION } from '../../../../lib/mascot/xiaoyueExpressions'
import type { ArchetypeCardVariant } from '../archetypeVariants'

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
  confidenceLabel?: string
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
  isLoggingIn?: boolean
  isDecisive?: boolean
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
  } | null
  isLoadingAnalysis?: boolean
  personalityShareEnabled?: boolean
  posterError?: boolean
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
  confidenceLabel,
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
  isLoggingIn,
  isDecisive,
  secondaryDisplayName,
  xiaoyueAnalysis,
  isLoadingAnalysis,
  personalityShareEnabled = true,
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

  // Stagger badge entrance after mount
  useEffect(() => {
    const timer = setTimeout(() => setBadgesVisible(true), 300)
    return () => clearTimeout(timer)
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
    setTimeout(() => {
      setIsDetailOpen(false)
      setIsDetailClosing(false)
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
    setTouchTilt({
      rotateX: Math.max(-maxTilt, Math.min(maxTilt, deltaY * -6)),
      rotateY: Math.max(-maxTilt, Math.min(maxTilt, deltaX * 6)),
    })
    setIsTiltActive(true)
  }, [])

  const handleTouchEnd = useCallback(() => {
    touchActiveRef.current = false
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

  const activeVariant = variants?.[selectedVariantIndex ?? 0]
  const cardBackground = activeVariant
    ? `linear-gradient(160deg, ${activeVariant.accentSoft} 0%, #fff8ee 50%, rgba(255, 255, 255, 0.98) 100%)`
    : `linear-gradient(160deg, ${visual.accentSoft} 0%, #fff8ee 50%, rgba(255, 255, 255, 0.98) 100%)`
  const cardGlow = activeVariant ? activeVariant.accentGlow : visual.accentGlow

  // Collect-them-all: all archetypes with current one unlocked
  const currentIndex = getArchetypeIndex(displayArchetypeId)
  const allArchetypes = ARCHETYPE_CANONICAL_ORDER

  // Build partner data for detail sheet (memoized)
  const partnerData = useMemo(() => {
    return topMatches.slice(0, 3).map((match) => {
      const score = Math.round(match.score)
      const chemistryLabel = score >= 85 ? '灵魂拍档' : score >= 70 ? '默契搭档' : score >= 55 ? '互补组合' : '潜力搭档'
      const chemistryColor = score >= 85 ? '#ef4444' : score >= 70 ? '#f97316' : score >= 55 ? '#8b5cf6' : '#64748b'
      return {
        ...match,
        chemistryLabel,
        chemistryColor,
      }
    })
  }, [topMatches])

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
            <Text className='personality-results__hero-name'>{displayArchetypeName}</Text>
            <Text className='personality-results__hero-summary'>{summary}</Text>

            <View className='personality-results__hero-badges'>
              {confidenceLabel ? (
                <Text className={`personality-results__hero-badge personality-results__hero-badge--chemistry ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}>{confidenceLabel}</Text>
              ) : null}
              {typeof visual.rarityPercentage === 'number' ? (
                <Text className={`personality-results__hero-badge personality-results__hero-badge--rarity ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}>稀有度 {Math.round(visual.rarityPercentage)}%</Text>
              ) : null}
              {visual.nickname ? (
                <Text className={`personality-results__hero-badge personality-results__hero-badge--nickname ${badgesVisible ? 'personality-results__hero-badge--visible' : ''}`}>{visual.nickname}</Text>
              ) : null}
            </View>

            {isDecisive === false && secondaryDisplayName ? (
              <Text className='personality-results__hero-blend'>
                {xiaoyueAnalysis?.blendLine || `隐约有${secondaryDisplayName}的影子`}
              </Text>
            ) : null}
          </View>

          <View className='personality-results__hero-art-shell'>
            <View className='personality-results__hero-art-bg' style={{ background: visual.accentSoft }} />
            <Image
              className='personality-results__hero-art'
              mode='aspectFit'
              src={heroSrc}
              onError={() => setHeroImgError(true)}
            />
            {/* No text overlay on archetype image — clean art only */}
          </View>

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
                    <Text className='personality-results__xiaoyue-bubble-headline'>
                      「{xiaoyueAnalysis.headline}」
                    </Text>
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
                    '--cta-shadow': visual.accentGlow,
                  } as React.CSSProperties}
                  onClick={handleCardTap}
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
                <View className='personality-results__xiaoyue-fallback-indicator'>
                  <Text className='personality-results__xiaoyue-fallback-indicator-text'>
                    悦仔的解读暂时不可用，先看看你的氛围卡吧
                  </Text>
                </View>
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
              <Text className='personality-results__pokemon-chip personality-results__pokemon-chip--dark'>{confidenceLabel || '悦聚氛围卡'}</Text>
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
            </View>
          </View>
        </Card>

        {/* Collect-them-all teaser */}
        <Card className='personality-results__section-card personality-results__stagger--5'>
          <View className='personality-results__collect-header'>
            <Text className='personality-results__section-label'>命格图鉴</Text>
            <Text className='personality-results__collect-count'>
              已解锁 {currentIndex ?? 0}/12
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
                  <XiaoyueChatBubble
                    content={xiaoyueAnalysis.analysis}
                    pose='casual'
                    expressionId={PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach}
                    horizontal
                    showGlow
                    staggerDelay={70}
                    className='personality-results__detail-chat'
                  />
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
                          <Text className='personality-results__detail-partner-name'>
                            {ARCHETYPE_BY_ID[partner.archetype]?.nameCn ?? partner.archetype}
                          </Text>
                          <Text
                            className='personality-results__detail-partner-tag'
                            style={{ color: partner.chemistryColor }}
                          >
                            {partner.chemistryLabel}
                          </Text>
                          <Text className='personality-results__detail-partner-score'>
                            契合 {Math.round(partner.score)}%
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
