import { useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework'
import Button from '../../components/Button'
import {
  DEFAULT_MINI_SCRIPT_GENRES,
  MINI_SCRIPT_GENRE_OPTIONS,
  MINI_SCRIPT_STYLE_OPTIONS,
} from './miniscriptLabels'

export type MiniScriptConfigModalProps = {
  open: boolean
  onClose: () => void
  initialStyle?: MiniScriptStyle
  initialGenres?: MiniScriptGenre[]
  isSubmitting: boolean
  onSubmit: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[] }) => void
}

export function MiniScriptConfigModal({
  open,
  onClose,
  initialStyle = 'modern_urban',
  initialGenres = DEFAULT_MINI_SCRIPT_GENRES,
  isSubmitting,
  onSubmit,
}: MiniScriptConfigModalProps) {
  const [style, setStyle] = useState<MiniScriptStyle>(initialStyle)
  const [genres, setGenres] = useState<MiniScriptGenre[]>(() => [...initialGenres])

  const genreSet = useMemo(() => new Set(genres), [genres])

  if (!open) {
    return null
  }

  const toggleGenre = (value: MiniScriptGenre) => {
    setGenres((current) => {
      const next = new Set(current)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      const arr = MINI_SCRIPT_GENRE_OPTIONS.map((g) => g.value).filter((g) => next.has(g))
      return arr.length > 0 ? arr : current
    })
  }

  const handleSubmit = () => {
    if (genres.length === 0) {
      return
    }
    onSubmit({ style, genres })
  }

  return (
    <View className='icebreaker-ms-modal'>
      <View className='icebreaker-ms-modal__backdrop' onClick={onClose} />
      <View className='icebreaker-ms-modal__sheet'>
        <View className='icebreaker-ms-modal__handle' />
        <Text className='icebreaker-ms-modal__title'>迷你剧本杀</Text>
        <Text className='icebreaker-ms-modal__hint'>选择风格与题材，生成你们的轻量剧本（低冲突、无暴力）。</Text>

        <ScrollView scrollY className='icebreaker-ms-modal__scroll' showScrollbar={false}>
          <Text className='icebreaker-ms-modal__section'>风格（单选）</Text>
          <View className='icebreaker-ms-modal__chips'>
            {MINI_SCRIPT_STYLE_OPTIONS.map((option) => {
              const selected = option.value === style
              return (
                <View
                  key={option.value}
                  className={`icebreaker-ms-modal__chip${selected ? ' icebreaker-ms-modal__chip--on' : ''}`}
                  onClick={() => setStyle(option.value)}
                >
                  <Text className='icebreaker-ms-modal__chip-text'>{option.label}</Text>
                </View>
              )
            })}
          </View>

          <Text className='icebreaker-ms-modal__section'>题材（多选）</Text>
          <View className='icebreaker-ms-modal__chips'>
            {MINI_SCRIPT_GENRE_OPTIONS.map((option) => {
              const selected = genreSet.has(option.value)
              return (
                <View
                  key={option.value}
                  className={`icebreaker-ms-modal__chip${selected ? ' icebreaker-ms-modal__chip--on' : ''}`}
                  onClick={() => toggleGenre(option.value)}
                >
                  <Text className='icebreaker-ms-modal__chip-text'>{option.label}</Text>
                </View>
              )
            })}
          </View>
        </ScrollView>

        <View className='icebreaker-ms-modal__footer'>
          <Button
            variant='primary'
            className='icebreaker-ms-modal__cta'
            loading={isSubmitting}
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            生成我们的剧本
          </Button>
        </View>
      </View>
    </View>
  )
}
