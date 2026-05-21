import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework'
import {
  MINISCRIPT_CATALOG,
  SURPRISE_ME_CARD,
  getStyleGradient,
  getGenreGradient,
  type MiniscriptStyleCard,
  type MiniscriptGenreCard,
} from '@shared/miniscriptCatalog'
import Button from '../../../components/ui/Button'

export type MiniScriptConfigModalProps = {
  open: boolean
  onClose: () => void
  initialStyle?: MiniScriptStyle
  initialGenres?: MiniScriptGenre[]
  isSubmitting: boolean
  onSubmit: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean }) => void
}

type PickerStage = 'style' | 'genre'

// Stagger delay per card index (ms) — Beta refined from 80ms to 60ms for tighter sequence
const STAGGER_MS = 60
const ENTRANCE_DURATION_MS = 300

export function MiniScriptConfigModal({
  open,
  onClose,
  initialStyle = 'modern_urban',
  initialGenres = [],
  isSubmitting,
  onSubmit,
}: MiniScriptConfigModalProps) {
  const [stage, setStage] = useState<PickerStage>('style')
  const [selectedStyle, setSelectedStyle] = useState<MiniScriptStyle | null>(null)
  const [selectedGenres, setSelectedGenres] = useState<MiniScriptGenre[]>(() => [...initialGenres])
  const [liteMode, setLiteMode] = useState(false)
  const [pressingKey, setPressingKey] = useState<string | null>(null)
  const [isEntering, setIsEntering] = useState(false)
  const [shuffleIndex, setShuffleIndex] = useState<number | null>(null)
  const [loadedThumbs, setLoadedThumbs] = useState<Set<string>>(new Set())
  const shuffleTimerRef = useRef<NodeJS.Timeout | null>(null)
  const styleCardsRef = useRef<(MiniscriptStyleCard | typeof SURPRISE_ME_CARD)[]>([])

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
      setPressingKey(null)
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

  const genreSet = useMemo(() => new Set(selectedGenres), [selectedGenres])

  const handlePressStart = (key: string) => {
    setPressingKey(key)
  }

  const handlePressEnd = () => {
    setPressingKey(null)
  }

  const handleSelectStyle = (key: string) => {
    if (key === SURPRISE_ME_CARD.key) {
      // Shuffle animation: rapid highlight 3 times
      let tick = 0
      const maxTicks = 3
      const styleCount = MINISCRIPT_CATALOG.styles.length

      const runShuffle = () => {
        const randomIdx = Math.floor(Math.random() * styleCount)
        setShuffleIndex(randomIdx)
        Taro.vibrateShort({ type: 'light' }).catch(() => {})
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

    setSelectedStyle(key as MiniScriptStyle)
    setStage('genre')
  }

  const handleToggleGenre = (key: MiniScriptGenre) => {
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

  const getCardModifier = (key: string, index: number) => {
    const mods: string[] = []
    if (isEntering) {
      mods.push(`ms-card--stagger-${Math.min(index, 7)}`)
    }
    if (pressingKey === key) {
      mods.push('ms-card--pressed')
    }
    if (shuffleIndex !== null && styleCards[shuffleIndex]?.key === key) {
      mods.push('ms-card--shuffling')
    }
    return mods.join(' ')
  }

  const getGenreModifier = (key: string) => {
    const mods: string[] = []
    if (pressingKey === key) {
      mods.push('ms-genre-card--pressed')
    }
    if (genreSet.has(key as MiniScriptGenre)) {
      mods.push('ms-genre-card--selected')
    }
    return mods.join(' ')
  }

  return (
    <View className='ms-modal'>
      <View className='ms-modal__backdrop' onClick={onClose} />
      <View className='ms-modal__sheet'>
        {/* Drag handle */}
        <View className='ms-modal__handle' />

        {/* Header */}
        <View className='ms-modal__header'>
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

        {/* Content */}
        <View className='ms-modal__content'>
          {/* Stage 1: Style Grid */}
          <View
            className={`ms-stage ms-stage--style${stage === 'genre' ? ' ms-stage--exited' : ''}`}
          >
            <View className='ms-grid ms-grid--style'>
              {styleCards.map((card, index) => {
                const isSurprise = card.key === SURPRISE_ME_CARD.key
                const gradient = isSurprise
                  ? `linear-gradient(135deg, ${SURPRISE_ME_CARD.gradientFrom}, ${SURPRISE_ME_CARD.gradientTo})`
                  : getStyleGradient(card as MiniscriptStyleCard)
                const _emoji = isSurprise ? SURPRISE_ME_CARD.emoji : (card as MiniscriptStyleCard).emoji
                const label = isSurprise ? SURPRISE_ME_CARD.label : card.label
                const mod = getCardModifier(card.key, index)

                const thumbLoaded = loadedThumbs.has(card.key)
                const thumbPath = !isSurprise ? (card as MiniscriptStyleCard).thumbnailPath : undefined

                return (
                  <View
                    key={card.key}
                    className={`ms-card ${mod}`}
                    onTouchStart={() => handlePressStart(card.key)}
                    onTouchEnd={() => {
                      handlePressEnd()
                      handleSelectStyle(card.key)
                    }}
                    onTouchCancel={handlePressEnd}
                  >
                    {/* Gradient background — fades out when thumbnail loads */}
                    <View
                      className={`ms-card__bg${thumbLoaded ? ' ms-card__bg--faded' : ''}`}
                      style={{ background: gradient }}
                    />
                    {/* Thumbnail image — fades in when loaded */}
                    {thumbPath && (
                      <Image
                        className={`ms-card__thumb${thumbLoaded ? ' ms-card__thumb--loaded' : ''}`}
                        src={thumbPath}
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
                  </View>
                )
              })}
            </View>
          </View>

          {/* Stage 2: Genre Grid */}
          <View
            className={`ms-stage ms-stage--genre${stage === 'genre' ? ' ms-stage--active' : ''}`}
          >
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
                    onTouchStart={() => handlePressStart(card.key)}
                    onTouchEnd={() => {
                      handlePressEnd()
                      handleToggleGenre(card.key as MiniScriptGenre)
                    }}
                    onTouchCancel={handlePressEnd}
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
                  </View>
                )
              })}
            </View>
          </View>
        </View>

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
  )
}
