import Taro, { useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import {
  FLASH_V2_PILOT_UNIT_IDS,
  getFlashStoryUnitDefinition,
  isFlashStoryUnitId,
  type FlashStoryInteractionKind,
  type FlashStoryUnitId,
} from '@shared/alang/flashStorySeason'
import { shouldShowStreetBlindBoxEntry } from '../../../lib/alang/alangAccess'
import { useFlashStoryArchive } from '../../../lib/alang/useFlash'
import { resolveFlashNpcTheme } from '../../../lib/alang/flashNpcAssets'
import type { FlashStoryArchiveView } from '../../../lib/alang/flashTypes'
import { flashStoryAnalytics } from '../../../lib/analytics/flashStoryAnalytics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { MINI_PROGRAM_ROUTES } from '../../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../../lib/utils/haptics'
import { FlashButton, FlashFeatureClosed, FlashPageState } from '../../../components/alang/FlashUi'
import '../flash.scss'
import './index.scss'

/**
 * 谜案档案台 MVP（AC-05）：已解锁碎片 + 当前幕共同经历印记 + 未解线索。
 * 只渲染服务端 DTO 字段（DTO 已在服务端去标识）。归档仪式 20–30 秒、零失败、
 * 只推进一次；phase_synthesis_completed 恰好发送一次（ref + 本地归档标记）。
 */

/** 归档仪式的平静动画时长（20–30 秒区间）；减少动态效果时缩短为静态过渡。 */
const ARCHIVE_CEREMONY_MS = 24_000
const ARCHIVE_CEREMONY_REDUCED_MS = 4_000

/** 仪式开始多久后允许跳过（减少动态效果时按半程取更小值）。 */
const ARCHIVE_CEREMONY_SKIP_AFTER_MS = 8_000

const TEMPLATE_IMPRINT_LABELS: Record<FlashStoryInteractionKind, string> = {
  spacing: '一起摆好了距离',
  pairing: '一起配回了物件',
  path: '一起走完了那段路',
  overlay: '一起对齐了纸页',
  privacy: '一起守住了边界',
}

function formatSettledDay(settledAt: string): string {
  const date = new Date(settledAt)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

function archiveSynthesisStorageKey(seasonCode: string | undefined): string {
  return `joyjoin:flash:archive-synthesis:${seasonCode ?? 'season'}`
}

function readSynthesisDone(key: string): boolean {
  try {
    return Taro.getStorageSync(key) === 'done'
  } catch {
    return false
  }
}

/** 埋点必须挂在一个合法幕 id 上（服务端枚举校验）：取最近一枚印记所属的幕。 */
function anchorUnitId(archive: FlashStoryArchiveView | undefined): FlashStoryUnitId | null {
  const candidates = [
    archive?.imprints[archive.imprints.length - 1]?.unitId,
    archive?.completedUnitIds?.[archive.completedUnitIds.length - 1],
    FLASH_V2_PILOT_UNIT_IDS[0],
  ]
  for (const candidate of candidates) {
    if (candidate && isFlashStoryUnitId(candidate)) return candidate
  }
  return null
}

function pilotImprintsComplete(archive: FlashStoryArchiveView | undefined): boolean {
  if (!archive) return false
  return FLASH_V2_PILOT_UNIT_IDS.every((unitId) => archive.imprints.some((imprint) => imprint.unitId === unitId))
}

export default function FlashStoryArchivePage() {
  const enabled = shouldShowStreetBlindBoxEntry()
  const { shouldReduceMotion } = useMiniRevealMotion()
  const { data, isLoading, isError, refetch } = useFlashStoryArchive(enabled)
  const archiveOpenedRef = useRef(false)
  const synthesisFiredRef = useRef(false)
  const ceremonyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ceremonyRunningRef = useRef(false)
  const synthesisKey = archiveSynthesisStorageKey(data?.season?.code)
  const [ceremony, setCeremony] = useState<'idle' | 'running' | 'done'>('idle')
  const [skipAvailable, setSkipAvailable] = useState(false)

  useEffect(() => {
    void Taro.setNavigationBarTitle({ title: '谜案档案台' })
  }, [])

  // archive_opened：每次进入档案台记一次（fail-open，枚举化）。
  useDidShow(() => {
    if (!enabled || archiveOpenedRef.current) return
    const anchor = anchorUnitId(data)
    if (!anchor) return
    archiveOpenedRef.current = true
    flashStoryAnalytics.track(anchor, 'archive_opened')
  })

  useEffect(() => {
    if (data && readSynthesisDone(archiveSynthesisStorageKey(data.season?.code))) {
      setCeremony('done')
    }
  }, [data])

  useEffect(() => () => {
    if (ceremonyTimerRef.current) clearTimeout(ceremonyTimerRef.current)
    if (skipTimerRef.current) clearTimeout(skipTimerRef.current)
  }, [])

  // 收尾路径唯一：自然计时结束与跳过按钮共用，合成事件靠 ref 恰好一次。
  const finishCeremony = () => {
    if (!ceremonyRunningRef.current) return
    ceremonyRunningRef.current = false
    if (ceremonyTimerRef.current) { clearTimeout(ceremonyTimerRef.current); ceremonyTimerRef.current = null }
    if (skipTimerRef.current) { clearTimeout(skipTimerRef.current); skipTimerRef.current = null }
    setSkipAvailable(false)
    setCeremony('done')
    haptics('success')
    try { Taro.setStorageSync(synthesisKey, 'done') } catch { /* fail-open */ }
    // phase_synthesis_completed：恰好一次（ref 防双击/重入，storage 防跨次重复）。
    const anchor = anchorUnitId(data)
    if (!synthesisFiredRef.current && anchor) {
      synthesisFiredRef.current = true
      flashStoryAnalytics.track(anchor, 'phase_synthesis_completed')
    }
  }

  const startCeremony = () => {
    if (ceremony !== 'idle') return
    haptics('medium')
    ceremonyRunningRef.current = true
    setCeremony('running')
    const duration = shouldReduceMotion ? ARCHIVE_CEREMONY_REDUCED_MS : ARCHIVE_CEREMONY_MS
    ceremonyTimerRef.current = setTimeout(() => {
      ceremonyTimerRef.current = null
      finishCeremony()
    }, duration)
    const skipDelay = Math.min(ARCHIVE_CEREMONY_SKIP_AFTER_MS, duration / 2)
    skipTimerRef.current = setTimeout(() => {
      skipTimerRef.current = null
      setSkipAvailable(true)
    }, skipDelay)
  }

  const goBack = () => {
    haptics('light')
    void Taro.navigateBack().catch(() => Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.alangEvent }))
  }

  if (!enabled) return <FlashFeatureClosed />

  if (isError) {
    return (
      <View className='flash-archive__state-shell'>
        <FlashPageState
          tone='error'
          title='档案台暂时没有翻开'
          description='已经收好的碎片和印记都不会丢，重新打开就好。'
          action={() => { void refetch() }}
          actionLabel='重新打开'
        />
      </View>
    )
  }

  if (isLoading || !data) {
    return (
      <View className='flash-archive__state-shell'>
        <FlashPageState title='正在翻开档案台…' description='收好的碎片和印记都会在这里等你。' />
      </View>
    )
  }

  const imprintsComplete = pilotImprintsComplete(data)
  const showCeremonyCard = imprintsComplete && ceremony !== 'done'

  return (
    <View className='flash-archive'>
      <ScrollView className='flash-archive__scroll' scrollY>
        <View className='flash-archive__content'>
          <View className='flash-archive__header'>
            <Text className='flash-archive__eyebrow'>REVIEWED ARCHIVE</Text>
            <Text className='flash-archive__title'>谜案档案台</Text>
            <Text className='flash-archive__lead'>
              {data.season ? `《${data.season.title}》收好的碎片、一起留下的印记，和还没解开的线索，都放在这里。` : '收好的碎片和印记，都放在这里。'}
            </Text>
          </View>

          <View className='flash-archive__section' data-testid='flash-archive-imprints'>
            <View className='flash-page__section-head'>
              <Text className='flash-page__section-title'>共同经历印记</Text>
              <Text className='flash-page__section-meta'>{data.imprints.length} 枚</Text>
            </View>
            {data.imprints.length ? (
              <View className='flash-archive__imprint-list'>
                {data.imprints.map((imprint) => {
                  const unit = getFlashStoryUnitDefinition(imprint.unitId)
                  const npcName = unit ? resolveFlashNpcTheme(unit.npcSlug).name : ''
                  return (
                    <View key={`${imprint.unitId}:${imprint.resultId}`} className='flash-archive__imprint' data-testid='flash-archive-imprint'>
                      <Text className='flash-archive__imprint-meta'>
                        {unit ? `第 ${unit.phase} 幕` : '这一季'}{npcName ? ` · 和${npcName}` : ''}
                      </Text>
                      <Text className='flash-archive__imprint-title'>{TEMPLATE_IMPRINT_LABELS[imprint.template]}</Text>
                      {formatSettledDay(imprint.settledAt) ? (
                        <Text className='flash-archive__imprint-date'>{formatSettledDay(imprint.settledAt)} 收好</Text>
                      ) : null}
                    </View>
                  )
                })}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Text className='flash-empty-card__title'>还没有一起留下的印记</Text>
                <Text className='flash-empty-card__copy'>和角色一起完成一次小小的整理，就会留下第一枚印记。</Text>
              </View>
            )}
          </View>

          {showCeremonyCard ? (
            <View className='flash-archive-ceremony' data-testid='flash-archive-ceremony'>
              {ceremony === 'idle' ? (
                <>
                  <Text className='flash-archive-ceremony__title'>两条线的印记都到齐了</Text>
                  <Text className='flash-archive-ceremony__copy'>把这一阶段的线索慢慢收进档案。不用赶时间，也不会收坏。</Text>
                  <FlashButton onClick={startCeremony} ariaLabel='收好这一阶段的线索'>收好这一阶段的线索</FlashButton>
                </>
              ) : (
                <View className={`flash-archive-ceremony__running${shouldReduceMotion ? ' flash-archive-ceremony__running--reduced' : ''}`} aria-live='polite'>
                  <View className='flash-archive-ceremony__paper flash-archive-ceremony__paper--one' aria-hidden='true' />
                  <View className='flash-archive-ceremony__paper flash-archive-ceremony__paper--two' aria-hidden='true' />
                  <View className='flash-archive-ceremony__paper flash-archive-ceremony__paper--three' aria-hidden='true' />
                  <Text className='flash-archive-ceremony__running-copy'>正在把这一阶段的线索收进档案…</Text>
                  {skipAvailable ? (
                    <View
                      className='flash-archive-ceremony__skip'
                      hoverClass='flash-archive-ceremony__skip--pressed'
                      role='button'
                      aria-label='不用等了，直接收好这一阶段的线索'
                      onClick={() => { haptics('light'); finishCeremony() }}
                    >
                      <Text className='flash-archive-ceremony__skip-text'>不用等了，直接收好</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}

          {imprintsComplete && ceremony === 'done' ? (
            <View className='flash-archive-ceremony flash-archive-ceremony--done' data-testid='flash-archive-ceremony-done' role='status'>
              <Text className='flash-archive-ceremony__title'>这一阶段的线索已经收进档案</Text>
              <Text className='flash-archive-ceremony__copy'>下一幕开启时，新的线索会接着放进来。</Text>
            </View>
          ) : null}

          <View className='flash-archive__section' data-testid='flash-archive-fragments'>
            <View className='flash-page__section-head'>
              <Text className='flash-page__section-title'>已解锁碎片</Text>
              <Text className='flash-page__section-meta'>{data.fragments.length} 块</Text>
            </View>
            {data.fragments.length ? (
              <View className='flash-archive__fragment-grid'>
                {data.fragments.map((fragment) => (
                  <View key={fragment.id} className={`flash-story-fragment-card flash-story-fragment-card--${fragment.category}`}>
                    <Text className='flash-story-fragment-card__meta'>{fragment.npcName} · {fragment.episodeTitle}</Text>
                    <Text className='flash-story-fragment-card__title'>{fragment.title}</Text>
                    <Text className='flash-story-fragment-card__fact'>{fragment.fact}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View className='flash-empty-card'>
                <Text className='flash-empty-card__title'>故事还没有翻开</Text>
                <Text className='flash-empty-card__copy'>找到一位在线角色，完成一次相遇，就会收下一块属于他的故事碎片。</Text>
              </View>
            )}
          </View>

          {data.hookHint ? (
            <View className='flash-archive__section' data-testid='flash-archive-hook'>
              <View className='flash-page__section-head'>
                <Text className='flash-page__section-title'>未解线索</Text>
              </View>
              <View className='flash-dialogue__next-hint'>
                <Text className='flash-dialogue__next-hint-label'>还有一件事没有答案</Text>
                <Text className='flash-dialogue__next-hint-copy'>{data.hookHint}</Text>
              </View>
            </View>
          ) : null}

          <View className='flash-archive__footer'>
            <FlashButton variant='quiet' onClick={goBack} ariaLabel='返回街头盲盒'>返回街头盲盒</FlashButton>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
