import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Image, ScrollView, RootPortal } from '@tarojs/components'
import { haptics } from '../../../lib/utils/haptics'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import {
  MINI_SCRIPT_GENRES,
  type MiniScriptGenerationStatus,
  type MiniScriptGenre,
  type MiniScriptStyle,
} from '@shared/miniscriptStoryFramework'
import {
  MINISCRIPT_CATALOG,
  SURPRISE_ME_CARD,
  getStyleGradient,
  getGenreGradient,
  type MiniscriptStyleCard,
} from '@shared/miniscriptCatalog'
import Button from '../../../components/ui/Button'

export type MiniScriptConfigModalProps = {
  open: boolean
  onClose: () => void
  initialStyle?: MiniScriptStyle
  initialGenres?: MiniScriptGenre[]
  isSubmitting: boolean
  generationStatus: MiniScriptGenerationStatus | null
  onSubmit: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean }) => void
}

type PickerStage = 'style' | 'genre'


export function MiniScriptConfigModal({
  open,
  onClose,
  initialStyle = 'modern_urban',
  initialGenres = [...MINI_SCRIPT_GENRES],
  isSubmitting,
  generationStatus,
  onSubmit,
}: MiniScriptConfigModalProps) {
  const [stage, setStage] = useState<PickerStage>('style')
  const [selectedStyle, setSelectedStyle] = useState<MiniScriptStyle | null>(null)
  const [selectedGenres, setSelectedGenres] = useState<MiniScriptGenre[]>(() => [...initialGenres])
  const [liteMode, setLiteMode] = useState(false)
  const [isEntering, setIsEntering] = useState(false)
  const [shuffleIndex, setShuffleIndex] = useState<number | null>(null)
  const [loadedThumbs, setLoadedThumbs] = useState<Set<string>>(new Set())
  const [clockNow, setClockNow] = useState(Date.now())
  const shuffleTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Build style cards: 7 styles + 1 Surprise Me
  const styleCards = useMemo(() => {
    const cards = [...MINISCRIPT_CATALOG.styles]
    cards.push(SURPRISE_ME_CARD as unknown as MiniscriptStyleCard)
    return cards
  }, [])

  const genreCards = useMemo(() => MINISCRIPT_CATALOG.genres, [])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStage('style')
      setSelectedStyle(null)
      setSelectedGenres([...initialGenres])
      setLiteMode(false)
      setShuffleIndex(null)
      // Trigger staggered entrance after mount
      requestAnimationFrame(() => {
        setIsEntering(true)
      })
    } else {
      setIsEntering(false)
    }
  }, [open, initialGenres])

  // Cleanup shuffle timer
  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isSubmitting) return
    setClockNow(Date.now())
    const timer = setInterval(() => setClockNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [isSubmitting])

  const genreSet = useMemo(() => new Set(selectedGenres), [selectedGenres])

  const handleSelectStyle = (key: string) => {
    if (key === SURPRISE_ME_CARD.key) {
      // Shuffle animation: rapid highlight 3 times
      let tick = 0
      const maxTicks = 3
      const styleCount = MINISCRIPT_CATALOG.styles.length

      const runShuffle = () => {
        const randomIdx = Math.floor(Math.random() * styleCount)
        setShuffleIndex(randomIdx)
        haptics('light')
        tick++
        if (tick < maxTicks) {
          shuffleTimerRef.current = setTimeout(runShuffle, 120)
        } else {
          // Final selection
          shuffleTimerRef.current = setTimeout(() => {
            const finalIdx = Math.floor(Math.random() * styleCount)
            const finalStyle = MINISCRIPT_CATALOG.styles[finalIdx]!.key as MiniScriptStyle
            setShuffleIndex(null)
            setSelectedStyle(finalStyle)
            setStage('genre')
          }, 200)
        }
      }
      runShuffle()
      return
    }

    haptics('light')
    setSelectedStyle(key as MiniScriptStyle)
    setStage('genre')
  }

  const handleToggleGenre = (key: MiniScriptGenre) => {
    haptics('light')
    setSelectedGenres((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return Array.from(next)
    })
  }

  const handleBackToStyle = () => {
    setStage('style')
    setSelectedGenres([...initialGenres])
  }

  const handleSubmit = () => {
    if (!selectedStyle || selectedGenres.length === 0) {
      return
    }
    onSubmit({ style: selectedStyle, genres: selectedGenres, lite: liteMode })
  }

  const selectedStyleCard = selectedStyle
    ? MINISCRIPT_CATALOG.styles.find((s) => s.key === selectedStyle)
    : null

  if (!open) {
    return null
  }

  if (isSubmitting) {
    const progress = Math.max(0, Math.min(100, generationStatus?.progress ?? 5))
    const startedAt = generationStatus?.startedAt ?? clockNow
    const elapsedSeconds = Math.max(0, Math.floor((clockNow - startedAt) / 1000))
    const remainingSeconds = Math.max(
      0,
      Math.ceil(((generationStatus?.estimatedTotalMs ?? 32_000) - (clockNow - startedAt)) / 1000),
    )
    const stageCopy = {
      queued: '正在整理你选择的世界设定',
      generating: '正在编织人物关系与故事线',
      validating: '正在检查线索是否完整可玩',
      fallback: '正在启用备用故事，马上完成',
      persisting: '正在封存角色秘密与线索',
      complete: '剧本准备好了',
      failed: '生成遇到问题',
    }[generationStatus?.stage ?? 'queued']

    return (
      <RootPortal>
        <View className='ms-generation'>
          <View className='ms-generation__card'>
            <Image
              className='ms-generation__mascot'
              src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
              mode='aspectFit'
            />
            <Text className='ms-generation__eyebrow'>悦仔正在创作</Text>
            <Text className='ms-generation__title'>迷你剧本生成中</Text>
            <Text className='ms-generation__stage'>{stageCopy}</Text>
            <View
              className='ms-generation__track'
              role='progressbar'
              aria-label='剧本生成进度'
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <View
                className='ms-generation__fill'
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </View>
            <View className='ms-generation__metrics'>
              <Text className='ms-generation__percent'>{progress}%</Text>
              <Text className='ms-generation__time'>
                {generationStatus?.stage === 'complete'
                  ? `完成 · 用时 ${elapsedSeconds} 秒`
                  : `已等待 ${elapsedSeconds} 秒 · 预计还需约 ${remainingSeconds} 秒`}
              </Text>
            </View>
            <Text className='ms-generation__hint'>请保持页面开启，完成后会自动进入剧本</Text>
          </View>
        </View>
      </RootPortal>
    )
  }

  const getCardModifier = (key: string, index: number) => {
    const mods: string[] = []
    if (isEntering) {
      mods.push(`ms-card--stagger-${Math.min(index, 7)}`)
    }
    if (shuffleIndex !== null && styleCards[shuffleIndex]?.key === key) {
      mods.push('ms-card--shuffling')
    }
    return mods.join(' ')
  }

  const getGenreModifier = (key: string) => {
    const mods: string[] = []
    if (genreSet.has(key as MiniScriptGenre)) {
      mods.push('ms-genre-card--selected')
    }
    return mods.join(' ')
  }

  return (
    <RootPortal>
      <View className='ms-modal'>
      <View className='ms-modal__backdrop' onClick={onClose} />
      <View className='ms-modal__sheet'>
        {/* Drag handle */}
        <View className='ms-modal__handle' />

        {/* Header */}
        <View className='ms-modal__header'>
          <View className='ms-modal__header-main'>
            {stage === 'style' ? (
              <>
                <Text className='ms-modal__title'>选择剧本风格</Text>
                <Text className='ms-modal__subtitle'>今晚，你们想走进哪个世界？</Text>
              </>
            ) : (
              <View className='ms-modal__hero-pill'>
                {selectedStyleCard && (
                  <>
                    <View
                      className='ms-modal__hero-thumb'
                      style={{ background: getStyleGradient(selectedStyleCard) }}
                    >
                      <View className='ms-modal__hero-icon' />
                    </View>
                    <View className='ms-modal__hero-text'>
                      <Text className='ms-modal__hero-label'>{selectedStyleCard.label}</Text>
                      <Text className='ms-modal__hero-hint'>再选一种或多种题材</Text>
                    </View>
                  </>
                )}
                <View className='ms-modal__back-btn' onClick={handleBackToStyle}>
                  <Text>重选</Text>
                </View>
              </View>
            )}
          </View>
          <View
            className='ms-modal__close'
            hoverClass='ms-modal__close--pressed'
            hoverStartTime={0}
            hoverStayTime={120}
            role='button'
            aria-label='关闭'
            onClick={() => {
              haptics('light')
              onClose()
            }}
          />
        </View>

        {/* Content */}
        <ScrollView className='ms-modal__content' scrollY enhanced showScrollbar={false}>
          {/* Stage 1: Style Grid */}
          {stage === 'style' && <View className='ms-stage ms-stage--style'>
            <View className='ms-grid ms-grid--style'>
              {styleCards.map((card, index) => {
                const isSurprise = card.key === SURPRISE_ME_CARD.key
                const gradient = isSurprise
                  ? `linear-gradient(135deg, ${SURPRISE_ME_CARD.gradientFrom}, ${SURPRISE_ME_CARD.gradientTo})`
                  : getStyleGradient(card as MiniscriptStyleCard)
                const label = isSurprise ? SURPRISE_ME_CARD.label : card.label
                const mod = getCardModifier(card.key, index)

                const thumbLoaded = loadedThumbs.has(card.key)
                const posterPath = card.posterPath ? cdnAsset(card.posterPath) : undefined

                return (
                  <View
                    key={card.key}
                    className={`ms-card ${mod}`}
                  >
                    {/* Gradient background — fades out when thumbnail loads */}
                    <View
                      className={`ms-card__bg${thumbLoaded ? ' ms-card__bg--faded' : ''}`}
                      style={{ background: gradient }}
                    />
                    {/* Thumbnail image — fades in when loaded */}
                    {posterPath && (
                      <Image
                        className={`ms-card__thumb${thumbLoaded ? ' ms-card__thumb--loaded' : ''}`}
                        src={posterPath}
                        mode='aspectFill'
                        lazyLoad
                        onLoad={() => {
                          setLoadedThumbs((prev) => new Set(prev).add(card.key))
                        }}
                      />
                    )}
                    {/* Dark gradient overlay for text readability */}
                    <View className='ms-card__overlay' />
                    {/* Style icon removed — gradient + label sufficient */}
                    {/* Label */}
                    <Text className='ms-card__label'>{label}</Text>
                    {/* Surprise Me subtitle */}
                    {isSurprise && (
                      <Text className='ms-card__sublabel'>{SURPRISE_ME_CARD.subtitle}</Text>
                    )}
                    {/* Selection glow ring (child element, not box-shadow) */}
                    <View className='ms-card__glow' />
                    {/* Native Image can swallow bubbling taps in RootPortal + ScrollView.
                        Keep one explicit top-layer target as the event authority. */}
                    <View
                      className='ms-card__hit-target'
                      hoverClass='ms-card__hit-target--pressed'
                      hoverStartTime={0}
                      hoverStayTime={120}
                      role='button'
                      aria-label={`${label}，选择此剧本风格`}
                      onClick={() => handleSelectStyle(card.key)}
                    />
                  </View>
                )
              })}
            </View>
          </View>}

          {/* Stage 2: Genre Grid */}
          {stage === 'genre' && <View className='ms-stage ms-stage--genre'>
            <View className='ms-genre-header'>
              <Text className='ms-genre-header__title'>选择题材</Text>
              <Text className='ms-genre-header__hint'>可多选，为剧本注入情绪基调</Text>
            </View>
            <View className='ms-grid ms-grid--genre'>
              {genreCards.map((card) => {
                const gradient = getGenreGradient(card)
                const mod = getGenreModifier(card.key)
                const isSelected = genreSet.has(card.key as MiniScriptGenre)

                return (
                  <View
                    key={card.key}
                    className={`ms-genre-card ${mod}`}
                  >
                    <View
                      className='ms-genre-card__bg'
                      style={{ background: gradient }}
                    />
                    <View className='ms-genre-card__overlay' />
                    {/* Genre icon removed — gradient + label sufficient */}
                    <Text className='ms-genre-card__label'>{card.label}</Text>
                    {/* Checkmark for selected state */}
                    {isSelected && (
                      <View className='ms-genre-card__check'>
                        <Text className='ms-genre-card__check-icon'>✓</Text>
                      </View>
                    )}
                    {/* Glow ring */}
                    <View
                      className='ms-genre-card__glow'
                      style={{ borderColor: card.accentColor }}
                    />
                    <View
                      className='ms-genre-card__hit-target'
                      hoverClass='ms-genre-card__hit-target--pressed'
                      hoverStartTime={0}
                      hoverStayTime={120}
                      role='button'
                      aria-label={`${card.label}${isSelected ? '，已选择' : '，未选择'}`}
                      onClick={() => handleToggleGenre(card.key as MiniScriptGenre)}
                    />
                  </View>
                )
              })}
            </View>
          </View>}
        </ScrollView>

        {/* Footer CTA */}
        <View className='ms-modal__footer'>
          {stage === 'genre' ? (
            <>
              <Button
                variant={liteMode ? 'primary' : 'secondary'}
                className='ms-modal__lite-toggle'
                onClick={() => setLiteMode((v) => !v)}
              >
                {liteMode ? '精简模式：2幕 · 25分钟' : '标准模式：点击切换精简版'}
              </Button>
              <Button
                variant='primary'
                className='ms-modal__cta'
                loading={isSubmitting}
                disabled={isSubmitting || selectedGenres.length === 0}
                onClick={handleSubmit}
              >
                {selectedGenres.length > 0
                  ? `生成剧本（${selectedGenres.length}种题材）`
                  : '请至少选择一种题材'}
              </Button>
            </>
          ) : (
            <Text className='ms-modal__footer-hint'>先选择一种风格，再挑选题材</Text>
          )}
        </View>
      </View>
      </View>
    </RootPortal>
  )
}
