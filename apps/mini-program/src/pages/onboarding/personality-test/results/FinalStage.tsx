import { Image, Input, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ARCHETYPE_CANONICAL_ORDER, getArchetypeIndex } from '@shared/personality/archetypeNames'
import Button from '../../../../components/ui/Button'
import Card from '../../../../components/ui/Card'
import { COLOR_PRIMARY } from '../../../../lib/utils/uiConstants'
import type { ArchetypeVisual } from '../visuals'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'
import type { AnonymousAssessmentTopMatch } from '../../../../lib/auth/anonymousOnboarding'
import type { ArchetypeSkillSet } from '@shared/personality/archetypeSkills'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { haptics } from '../../../../lib/utils/haptics'
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
  nickname?: string
  onGeneratePoster: () => void
  onGenerateSquarePoster?: () => void
  onInviteFriend: () => void
  onNicknameChange?: (nickname: string) => void
  onVariantSelect?: (index: number) => void
  continueButtonLabel: string
  onContinue: () => void
  onRestart: () => void
  authIsLoading: boolean
}

/**
 * Convert accelerometer data to card tilt angles.
 * Returns stable values clamped to a pleasant range.
 */
function computeTiltFromAccelerometer(x: number, y: number): { rotateX: number; rotateY: number } {
  // x: left(-) / right(+), y: front(-) / back(+)
  // We map these to rotateX (front-back tilt) and rotateY (left-right tilt)
  const maxTilt = 10
  const rotateX = Math.max(-maxTilt, Math.min(maxTilt, y * 12))
  const rotateY = Math.max(-maxTilt, Math.min(maxTilt, -x * 12))
  return { rotateX, rotateY }
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
  nickname: controlledNickname,
  onGeneratePoster,
  onGenerateSquarePoster,
  onInviteFriend,
  onNicknameChange,
  onVariantSelect,
  continueButtonLabel,
  onContinue,
  onRestart,
  authIsLoading,
}: FinalStageProps) {
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [isTiltActive, setIsTiltActive] = useState(false)
  const [touchTilt, setTouchTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [localNickname, setLocalNickname] = useState(controlledNickname || '')
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isCardPressed, setIsCardPressed] = useState(false)
  const touchActiveRef = useRef(false)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const cardRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null)
  const cardMeasuredRef = useRef(false)

  // Gyroscope-driven tilt (suppressed while touch is active)
  useEffect(() => {
    let mounted = true
    const canUseAccelerometer = Taro.canIUse('startAccelerometer') && Taro.canIUse('onAccelerometerChange')
    if (!canUseAccelerometer) return

    try {
      Taro.startAccelerometer({ interval: 'game' })
      Taro.onAccelerometerChange((res) => {
        if (!mounted || touchActiveRef.current) return
        const next = computeTiltFromAccelerometer(res.x, res.y)
        setTilt(next)
        setIsTiltActive(true)
      })
    } catch {
      // Silently fail if accelerometer is unavailable
    }

    return () => {
      mounted = false
      try {
        Taro.stopAccelerometer()
        Taro.offAccelerometerChange()
      } catch {
        // ignore
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
          cardMeasuredRef.current = true
        }
      })
    }
    // Delay slightly to ensure layout is settled
    const timer = setTimeout(measure, 300)
    return () => clearTimeout(timer)
  }, [displayArchetypeName, selectedVariantIndex])

  // Touch-driven tilt with gyro suppression
  const handleTouchStart = useCallback((e: any) => {
    const touch = e.touches?.[0]
    if (!touch) return
    touchActiveRef.current = true
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    setIsCardPressed(true)

    // Lazy-measure if first touch and not yet measured
    if (!cardMeasuredRef.current) {
      const query = Taro.createSelectorQuery()
      query.select('.personality-results__pokemon-card').boundingClientRect()
      query.exec((res) => {
        if (res?.[0]) {
          cardRef.current = res[0]
          cardMeasuredRef.current = true
        }
      })
    }
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
    // Gyroscope will naturally resume on next accelerometer event
  }, [])

  const effectiveRotateX = touchTilt.rotateX !== 0 ? touchTilt.rotateX : tilt.rotateX
  const effectiveRotateY = touchTilt.rotateY !== 0 ? touchTilt.rotateY : tilt.rotateY

  const handleCardTap = useCallback(() => {
    haptics('light')
    setIsDetailOpen(true)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false)
  }, [])

  const handleSharePress = useCallback(() => {
    haptics('medium')
    onGeneratePoster()
  }, [onGeneratePoster])

  const handleMoreShareOptions = useCallback(async () => {
    haptics('light')
    const taroWithShareImageMenu = Taro as typeof Taro & {
      showShareImageMenu?: (options: { path: string }) => Promise<unknown>
    }
    const hasNativeShareMenu = typeof taroWithShareImageMenu.showShareImageMenu === 'function'

    let tapIndex: number
    try {
      const res = await Taro.showActionSheet({
        itemList: hasNativeShareMenu && sharePosterPath
          ? ['分享到朋友圈', '邀请朋友来测', '预览卡片']
          : ['分享到朋友圈', '邀请朋友来测'],
      })
      tapIndex = res.tapIndex
    } catch {
      return
    }

    if (tapIndex === 0) {
      onGenerateSquarePoster?.()
    } else if (tapIndex === 1) {
      onInviteFriend()
    } else if (tapIndex === 2 && sharePosterPath && hasNativeShareMenu) {
      await taroWithShareImageMenu.showShareImageMenu!({ path: sharePosterPath })
    }
  }, [onGenerateSquarePoster, onInviteFriend, sharePosterPath])

  const handleNicknameInput = useCallback((value: string) => {
    setLocalNickname(value)
    onNicknameChange?.(value)
  }, [onNicknameChange])

  const handleVariantSelect = useCallback((index: number) => {
    haptics('light')
    onVariantSelect?.(index)
  }, [onVariantSelect])

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
            <Text className='personality-results__hero-eyebrow'>命定结果已揭晓</Text>
            <Text className='personality-results__hero-title'>你的社交命格是</Text>
            <Text className='personality-results__hero-name'>{displayArchetypeName}</Text>
            <Text className='personality-results__hero-summary'>{summary}</Text>

            <View className='personality-results__hero-badges'>
              {confidenceLabel ? (
                <Text className='personality-results__hero-badge'>{confidenceLabel}</Text>
              ) : null}
              {typeof visual.rarityPercentage === 'number' ? (
                <Text className='personality-results__hero-badge'>稀有度 {Math.round(visual.rarityPercentage)}%</Text>
              ) : null}
              {visual.nickname ? (
                <Text className='personality-results__hero-badge'>{visual.nickname}</Text>
              ) : null}
            </View>
          </View>

          <View className='personality-results__hero-art-shell'>
            <View className='personality-results__hero-art-bg' style={{ background: visual.accentSoft }} />
            <Image className='personality-results__hero-art' mode='aspectFit' src={displayAsset} />
          </View>
        </View>

        <Card className='personality-results__section-card personality-results__stagger--2'>
          <Text className='personality-results__section-label'>命格卡分享</Text>
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
            onClick={handleCardTap}
          >
            {/* Holographic shimmer overlay */}
            <View className='personality-results__pokemon-holo-shimmer' />
            {/* Corner shine */}
            <View className='personality-results__pokemon-corner-shine personality-results__pokemon-corner-shine--top-right' />
            <View className='personality-results__pokemon-corner-shine personality-results__pokemon-corner-shine--bottom-left' />

            {/* Tap hint */}
            <View className='personality-results__pokemon-tap-hint'>
              <Text className='personality-results__pokemon-tap-hint-text'>点击查看详情</Text>
            </View>

            <View className='personality-results__pokemon-card-top'>
              <Text className='personality-results__pokemon-chip personality-results__pokemon-chip--dark'>悦聚命格卡</Text>
              <Text className='personality-results__pokemon-chip'>{confidenceLabel || '悦聚命格卡'}</Text>
            </View>

            <View className='personality-results__pokemon-card-hero'>
              <View className='personality-results__pokemon-art-shell'>
                <Image className='personality-results__pokemon-art' mode='aspectFit' src={displayAsset} />
              </View>
              <View className='personality-results__pokemon-copy'>
                <Text className='personality-results__pokemon-name'>{displayArchetypeName}</Text>
                <Text className='personality-results__pokemon-tagline'>{visual.tagline || visual.description}</Text>
                <Text className='personality-results__pokemon-share-line'>{shareLine}</Text>
              </View>
            </View>

            {/* Rank badges */}
            {(typeof archetypeRank === 'number' && serialNumber) ? (
              <View className='personality-results__pokemon-rank-row'>
                <Text className='personality-results__pokemon-rank-chip'>命格编号 No.{archetypeRank}</Text>
                <Text className='personality-results__pokemon-rank-chip personality-results__pokemon-rank-chip--gold'>{serialNumber}</Text>
              </View>
            ) : null}

            {topMatches.length > 0 ? (
              <View className='personality-results__pokemon-match-row'>
                {topMatches.slice(0, 3).map((match) => (
                  <Text key={match.archetype} className='personality-results__pokemon-match-chip'>
                    {match.archetype} 缘分{Math.round(match.score)}%
                  </Text>
                ))}
              </View>
            ) : null}

            {/* Compact trait bars (top 3) — Pokémon card stats feel */}
            {traitEntries.length > 0 && (
              <View className='personality-results__pokemon-compact-traits'>
                {traitEntries
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 3)
                  .map((trait) => (
                    <View key={trait.key} className='personality-results__pokemon-compact-trait'>
                      <Text className='personality-results__pokemon-compact-trait-label'>{trait.label}</Text>
                      <View className='personality-results__pokemon-compact-trait-track'>
                        <View
                          className='personality-results__pokemon-compact-trait-fill'
                          style={{
                            width: `${trait.value}%`,
                            background: visual.accent || COLOR_PRIMARY,
                          }}
                        />
                      </View>
                      <Text className='personality-results__pokemon-compact-trait-value'>{trait.value}</Text>
                    </View>
                  ))}
              </View>
            )}

            {/* Energy bar */}
            {typeof energyLevel === 'number' ? (
              <View className='personality-results__pokemon-energy'>
                <View className='personality-results__pokemon-energy-header'>
                  <Text className='personality-results__pokemon-energy-label'>社交能量</Text>
                  <Text className='personality-results__pokemon-energy-value'>{Math.round(energyLevel)}%</Text>
                </View>
                <View className='personality-results__pokemon-energy-track'>
                  <View
                    className='personality-results__pokemon-energy-fill'
                    style={{ width: `${Math.min(energyLevel, 100)}%` }}
                  />
                </View>
              </View>
            ) : null}

            {/* Compact skill badges — quick preview before full cards */}
            {skillSet ? (
              <View className='personality-results__pokemon-skill-badges'>
                <View className='personality-results__pokemon-skill-badge personality-results__pokemon-skill-badge--warm'>
                  <Text className='personality-results__pokemon-skill-badge-text'>{skillSet.activeSkill.name}</Text>
                </View>
                <View className='personality-results__pokemon-skill-badge personality-results__pokemon-skill-badge--cool'>
                  <Text className='personality-results__pokemon-skill-badge-text'>{skillSet.passiveSkill.name}</Text>
                </View>
              </View>
            ) : null}

            <View className='personality-results__pokemon-skill-grid'>
              <View className='personality-results__pokemon-skill personality-results__pokemon-skill--warm'>
                <Text className='personality-results__pokemon-skill-label'>主动技</Text>
                <Text className='personality-results__pokemon-skill-name'>
                  {skillSet?.activeSkill.name ?? '瞬间点亮全场'}
                </Text>
                <Text className='personality-results__pokemon-skill-copy'>
                  {skillSet?.activeSkill.shortEffect ?? '把陌生局迅速带到更舒服的节奏。'}
                </Text>
              </View>
              <View className='personality-results__pokemon-skill personality-results__pokemon-skill--cool'>
                <Text className='personality-results__pokemon-skill-label'>被动技</Text>
                <Text className='personality-results__pokemon-skill-name'>
                  {skillSet?.passiveSkill.name ?? '气场持续发光'}
                </Text>
                <Text className='personality-results__pokemon-skill-copy'>
                  {skillSet?.passiveSkill.shortEffect ?? '不用刻意用力，也会让人想靠近你。'}
                </Text>
              </View>
            </View>

            {/* Holographic edition stamp */}
            <View className='personality-results__pokemon-holo-stamp'>
              <Text className='personality-results__pokemon-holo-stamp-text'>HOLOGRAPHIC EDITION</Text>
            </View>

            {/* Nickname input */}
            <View className='personality-results__pokemon-nickname'>
              <Text className='personality-results__pokemon-nickname-label'>给你的卡片起个名字</Text>
              <Input
                className='personality-results__pokemon-nickname-input'
                type='text'
                placeholder='输入昵称，显示在卡片上'
                value={localNickname}
                onInput={(e) => handleNicknameInput(e.detail.value)}
                maxlength={12}
              />
            </View>

            {/* Color variant selector */}
            {variants && variants.length > 1 ? (
              <View className='personality-results__pokemon-variants'>
                <Text className='personality-results__pokemon-variants-label'>卡片配色</Text>
                <View className='personality-results__pokemon-variants-row'>
                  {variants.map((variant, index) => (
                    <View
                      key={variant.name}
                      className={`personality-results__pokemon-variant-swatch ${index === (selectedVariantIndex ?? 0) ? 'personality-results__pokemon-variant-swatch--active' : ''}`}
                      style={{ background: variant.accentColor }}
                      onClick={() => handleVariantSelect(index)}
                    >
                      <Text className='personality-results__pokemon-variant-swatch-label'>{variant.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View className='personality-results__pokemon-actions'>
              <Button onClick={handleSharePress} disabled={isGeneratingPoster} loading={isGeneratingPoster}>
                {isGeneratingPoster
                  ? (generationPhase || '正在渲染卡面…')
                  : sharePosterPath
                    ? '分享卡片'
                    : '生成卡片'}
              </Button>
              <Button variant='secondary' onClick={handleMoreShareOptions}>
                更多分享方式
              </Button>
            </View>
          </View>
        </Card>

        <Card className='personality-results__section-card personality-results__stagger--3'>
          <View className='personality-results__coach-card'>
            <Image
              className='personality-results__coach-image'
              mode='aspectFit'
              src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach)}
            />
            <View className='personality-results__coach-copy'>
              <Text className='personality-results__section-label'>{`${DEFAULT_MASCOT_DISPLAY_NAME}的解读`}</Text>
              <Text className='personality-results__coach-title'>这个命格为什么像你</Text>
              <Text className='personality-results__coach-text'>{summary}</Text>
              <Text className='personality-results__coach-text'>
                {visual.hiddenStrength || '你的社交存在感不是靠用力营业，而是靠稳定地把气氛带到对的位置。'}
              </Text>
            </View>
          </View>
        </Card>

        <Card className='personality-results__section-card personality-results__stagger--4'>
          <Text className='personality-results__section-label'>你的社交雷达</Text>
          <View className='personality-results__trait-list'>
            {traitEntries.map((trait) => (
              <View key={trait.key} className='personality-results__trait-row'>
                <View className='personality-results__trait-header'>
                  <Text className='personality-results__trait-label'>{trait.label}</Text>
                  <Text className='personality-results__trait-value'>{trait.value}</Text>
                </View>
                <View className='personality-results__trait-track'>
                  <View className='personality-results__trait-fill' style={{ width: `${trait.value}%`, background: visual.accent || COLOR_PRIMARY }} />
                </View>
              </View>
            ))}
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
                    {isUnlocked ? archetype : '???'}
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
          <Button onClick={() => void onContinue()} disabled={authIsLoading}>
            {continueButtonLabel}
          </Button>
          <Button variant='secondary' onClick={onRestart}>重新测试一次</Button>
        </View>
      </ScrollView>

      {/* Detail Sheet Overlay */}
      {isDetailOpen && (
        <View className='personality-results__detail-overlay' onClick={handleCloseDetail}>
          <View
            className='personality-results__detail-sheet'
            onClick={(e) => { e.stopPropagation() }}
          >
            {/* Sheet handle */}
            <View className='personality-results__detail-handle' />

            {/* Sheet header */}
            <View className='personality-results__detail-header'>
              <Text className='personality-results__detail-title'>{displayArchetypeName}</Text>
              <Text className='personality-results__detail-subtitle'>{visual.tagline || visual.description}</Text>
            </View>

            {/* Trait radar in detail */}
            <View className='personality-results__detail-section'>
              <Text className='personality-results__detail-section-label'>社交雷达</Text>
              <View className='personality-results__trait-list'>
                {traitEntries.map((trait) => (
                  <View key={trait.key} className='personality-results__trait-row'>
                    <View className='personality-results__trait-header'>
                      <Text className='personality-results__trait-label'>{trait.label}</Text>
                      <Text className='personality-results__trait-value'>{trait.value}</Text>
                    </View>
                    <View className='personality-results__trait-track'>
                      <View className='personality-results__trait-fill' style={{ width: `${trait.value}%`, background: visual.accent || COLOR_PRIMARY }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Best partners in detail */}
            {partnerData.length > 0 && (
              <View className='personality-results__detail-section'>
                <Text className='personality-results__detail-section-label'>默契搭档</Text>
                <View className='personality-results__detail-partners'>
                  {partnerData.map((partner) => (
                    <View key={partner.archetype} className='personality-results__detail-partner'>
                      <View
                        className='personality-results__detail-partner-dot'
                        style={{ background: partner.chemistryColor }}
                      />
                      <View className='personality-results__detail-partner-info'>
                        <Text className='personality-results__detail-partner-name'>
                          {partner.archetype}
                        </Text>
                        <Text className='personality-results__detail-partner-meta'>
                          {partner.chemistryLabel} · 匹配 {Math.round(partner.score)}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Quick actions in detail */}
            <View className='personality-results__detail-actions'>
              <Button onClick={() => { handleCloseDetail(); handleSharePress(); }}>
                生成命格海报
              </Button>
              <Button variant='secondary' onClick={() => { handleCloseDetail(); onInviteFriend(); }}>
                @朋友来测
              </Button>
            </View>

            {/* Close button */}
            <View className='personality-results__detail-close' onClick={handleCloseDetail}>
              <Text className='personality-results__detail-close-text'>收起</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}
