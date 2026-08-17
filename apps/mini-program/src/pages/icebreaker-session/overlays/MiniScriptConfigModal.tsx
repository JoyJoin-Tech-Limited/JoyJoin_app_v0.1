import { useEffect, useMemo, useState } from 'react'
import { Image, RootPortal, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { MINI_SCRIPT_GENRES, type MiniScriptGenerationStatus, type MiniScriptGenre, type MiniScriptLibraryItem, type MiniScriptStyle } from '@shared/miniscriptStoryFramework'
import { MINISCRIPT_CATALOG, SURPRISE_ME_CARD, getGenreGradient, getStyleGradient, type MiniscriptStyleCard } from '@shared/miniscriptCatalog'
import { haptics } from '../../../lib/utils/haptics'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import Button from '../../../components/ui/Button'
import AiGenerationShell from '../../../components/ui/AiGenerationShell'

const GENERATION_STEPS = [
  { label: '构思故事背景', description: '根据风格与题材搭建世界观' },
  { label: '塑造角色与任务', description: '让每个人都有秘密与动机' },
  { label: '串联剧情与线索', description: '把角色和事件编织成可玩的剧本' },
  { label: '保存剧本', description: '完成后回到这份剧本列表' },
]

export type MiniScriptConfigModalProps = {
  open: boolean
  onClose: () => void
  initialGenres?: MiniScriptGenre[]
  isSubmitting: boolean
  generationStatus: MiniScriptGenerationStatus | null
  scripts: MiniScriptLibraryItem[]
  isLibraryLoading: boolean
  libraryError: string | null
  onLoadLibrary: (style: MiniScriptStyle) => Promise<void>
  onSelectScript: (scriptId: string) => Promise<boolean>
  onSubmit: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean; selectedLabel?: string }) => Promise<boolean>
}

type PickerStage = 'style' | 'library'

export function MiniScriptConfigModal({ open, onClose, initialGenres = [...MINI_SCRIPT_GENRES], isSubmitting, generationStatus, scripts, isLibraryLoading, libraryError, onLoadLibrary, onSelectScript, onSubmit }: MiniScriptConfigModalProps) {
  const [stage, setStage] = useState<PickerStage>('style')
  const [selectedStyle, setSelectedStyle] = useState<MiniScriptStyle | null>(null)
  const [selectedGenres, setSelectedGenres] = useState<MiniScriptGenre[]>(initialGenres)
  const [liteMode, setLiteMode] = useState(false)
  const [loadedThumbs, setLoadedThumbs] = useState<Set<string>>(new Set())
  const styleCards = useMemo(() => [...MINISCRIPT_CATALOG.styles, SURPRISE_ME_CARD as unknown as MiniscriptStyleCard], [])
  const selectedStyleCard = selectedStyle ? MINISCRIPT_CATALOG.styles.find((item) => item.key === selectedStyle) : null
  const genreSet = useMemo(() => new Set(selectedGenres), [selectedGenres])
  const reduceMotion = useMemo(() => {
    try { return !!(Taro.getSystemInfoSync() as { reduceMotion?: boolean }).reduceMotion } catch { return false }
  }, [])

  useEffect(() => {
    if (!open) return
    setStage('style')
    setSelectedStyle(null)
    setSelectedGenres([...initialGenres])
    setLiteMode(false)
  }, [open, initialGenres])

  useEffect(() => {
    if (open && selectedStyle && generationStatus?.stage === 'complete') void onLoadLibrary(selectedStyle)
  }, [generationStatus?.stage, onLoadLibrary, open, selectedStyle])

  useEffect(() => {
    if (!open || !selectedStyle) return
    const activeStages: MiniScriptGenerationStatus['stage'][] = ['queued', 'generating', 'validating', 'fallback', 'persisting']
    if (!generationStatus || !activeStages.includes(generationStatus.stage)) return
    const timer = setInterval(() => void onLoadLibrary(selectedStyle), 800)
    return () => clearInterval(timer)
  }, [generationStatus, onLoadLibrary, open, selectedStyle])

  const openLibrary = (style: MiniScriptStyle) => {
    haptics('light')
    setSelectedStyle(style)
    setStage('library')
    void onLoadLibrary(style)
  }
  const handleSelectStyle = (key: string) => {
    if (key === SURPRISE_ME_CARD.key) {
      openLibrary(MINISCRIPT_CATALOG.styles[Math.floor(Math.random() * MINISCRIPT_CATALOG.styles.length)]!.key as MiniScriptStyle)
    } else openLibrary(key as MiniScriptStyle)
  }
  const toggleGenre = (genre: MiniScriptGenre) => {
    haptics('light')
    setSelectedGenres((current) => current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre])
  }
  const handleGenerate = () => {
    if (!selectedStyle || selectedGenres.length === 0) return
    void onSubmit({ style: selectedStyle, genres: selectedGenres, lite: liteMode, selectedLabel: selectedStyleCard?.label })
  }

  if (!open) return null
  const showGeneration = isSubmitting || !!generationStatus && generationStatus.stage !== 'complete'

  return (
    <RootPortal>
      <View className='ms-modal'>
        <View className='ms-modal__sheet'>
          <View className='ms-modal__header'>
            <View className='ms-modal__header-main'>
              {stage === 'style' ? <><Text className='ms-modal__title'>选择剧本类型</Text><Text className='ms-modal__subtitle'>点进喜欢的世界，再从现成剧本里挑一份</Text></> : (
                <View className='ms-modal__hero-pill'>
                  <View className='ms-modal__hero-thumb' style={{ background: selectedStyleCard ? getStyleGradient(selectedStyleCard) : undefined }} />
                  <View className='ms-modal__hero-text'><Text className='ms-modal__hero-label'>{selectedStyleCard?.label}</Text><Text className='ms-modal__hero-hint'>已有剧本 · 也可现场创作</Text></View>
                  <View className='ms-modal__back-btn' role='button' onClick={() => setStage('style')}><Text>换类型</Text></View>
                </View>
              )}
            </View>
            <View className='ms-modal__close' hoverClass='ms-modal__close--pressed' role='button' aria-label='关闭' onClick={onClose} />
          </View>
          <ScrollView className='ms-modal__content' scrollY enhanced showScrollbar={false}>
            {stage === 'style' ? (
              <View className='ms-stage ms-stage--style'><View className='ms-grid ms-grid--style'>
                {styleCards.map((card, index) => {
                  const label = card.key === SURPRISE_ME_CARD.key ? SURPRISE_ME_CARD.label : card.label
                  const loaded = loadedThumbs.has(card.key)
                  const poster = card.posterPath ? cdnAsset(card.posterPath) : undefined
                  return <View key={card.key} className={`ms-card ms-card--stagger-${Math.min(index, 7)}`}>
                    <View className={`ms-card__bg${loaded ? ' ms-card__bg--faded' : ''}`} style={{ background: getStyleGradient(card) }} />
                    {poster ? <Image className={`ms-card__thumb${loaded ? ' ms-card__thumb--loaded' : ''}`} src={poster} mode='aspectFill' lazyLoad onLoad={() => setLoadedThumbs((current) => new Set(current).add(card.key))} /> : null}
                    <View className='ms-card__overlay' /><Text className='ms-card__label'>{label}</Text>
                    {card.key === SURPRISE_ME_CARD.key ? <Text className='ms-card__sublabel'>{SURPRISE_ME_CARD.subtitle}</Text> : null}
                    <View className='ms-card__hit-target' hoverClass='ms-card__hit-target--pressed' role='button' aria-label={`${label}，查看已有剧本`} onClick={() => handleSelectStyle(card.key)} />
                  </View>
                })}
              </View></View>
            ) : (
              <View className='ms-stage ms-stage--library'>
                <View className='ms-library__section-head'><Text className='ms-library__section-title'>已有剧本</Text><Text className='ms-library__section-hint'>选中后立即进入角色分配</Text></View>
                {isLibraryLoading && scripts.length === 0 && !generationStatus ? <View className='ms-library__state'><Text>正在翻找剧本库…</Text></View> : libraryError && scripts.length === 0 ? (
                  <View className='ms-library__state ms-library__state--error'><Text>{libraryError}</Text>{selectedStyle ? <Button variant='secondary' onClick={() => void onLoadLibrary(selectedStyle)}>重新加载</Button> : null}</View>
                ) : scripts.length ? <View className='ms-library__list'>{scripts.map((script) => (
                  <View key={script.id} className='ms-library-card'>
                    <View className='ms-library-card__copy'><View className='ms-library-card__meta'><Text>{script.source === 'session' ? '刚刚生成' : '精选现成'}</Text><Text>{script.playerCount}人可玩</Text></View><Text className='ms-library-card__title'>{script.title}</Text><Text className='ms-library-card__premise'>{script.premise}</Text></View>
                    <Button variant='primary' className='ms-library-card__choose' loading={isSubmitting} disabled={isSubmitting} onClick={async () => { if (await onSelectScript(script.id)) onClose() }}>选这个</Button>
                  </View>
                ))}</View> : <View className='ms-library__state'><Text className='ms-library__empty-title'>这个类型还没有现成剧本</Text><Text className='ms-library__empty-copy'>可以让悦仔现在创作，进度会留在这里</Text></View>}

                {showGeneration ? <View className='ms-library__generation'><Text className='ms-library__section-title'>正在创作</Text><AiGenerationShell visible mode='inline' phase={generationStatus?.stage === 'failed' ? 'error' : 'generating'} title='悦仔正在写新剧本' subtitle={`${selectedStyleCard?.label ?? '所选类型'} · 完成后可在上方选择`} steps={GENERATION_STEPS} progress={generationStatus?.progress ?? 5} progressLabel='剧本生成进度' estimatedTotalMs={generationStatus?.estimatedTotalMs ?? 32_000} onRetry={handleGenerate} reduceMotion={reduceMotion} mascotExpression='coachGuide' /></View> : null}

                <View className='ms-library__create'><Text className='ms-library__section-title'>现场创作一份</Text>
                  <View className='ms-library__genre-row'>{MINISCRIPT_CATALOG.genres.map((genre) => <View key={genre.key} className={`ms-library__genre${genreSet.has(genre.key as MiniScriptGenre) ? ' ms-library__genre--selected' : ''}`} style={{ background: getGenreGradient(genre) }} role='button' aria-label={`${genre.label}${genreSet.has(genre.key as MiniScriptGenre) ? '，已选择' : '，未选择'}`} aria-pressed={genreSet.has(genre.key as MiniScriptGenre)} onClick={() => toggleGenre(genre.key as MiniScriptGenre)}><Text>{genre.label}</Text></View>)}</View>
                  <View className='ms-library__mode-row' role='button' aria-label={liteMode ? '当前精简版，切换标准版' : '当前标准版，切换精简版'} aria-pressed={liteMode} onClick={() => { haptics('light'); setLiteMode((value) => !value) }}><Text>{liteMode ? '精简版 · 约25分钟' : '标准版 · 剧情更完整'}</Text><Text className='ms-library__mode-action'>{liteMode ? '切换标准版' : '切换精简版'}</Text></View>
                  <Button variant='primary' className='ms-modal__cta' loading={isSubmitting} disabled={isSubmitting || selectedGenres.length === 0} onClick={handleGenerate}>{isSubmitting ? '正在创作' : '生成新剧本'}</Button>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </RootPortal>
  )
}
