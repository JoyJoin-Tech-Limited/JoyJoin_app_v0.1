import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { Button, Text, View } from '@tarojs/components'
import { getDeepContrastArchetypeColor } from '@shared/archetypeColors'
import { FLOW_SHELL_COPY, getIdentityChipLabel } from '@shared/copy/flowAnimationCopy'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { useMiniRevealMotion } from '../../hooks/useMiniRevealMotion'
import { isFlowCompanionArchetype, type FlowCompanionArchetype } from '../../lib/utils/flowBannerAssets'
import { haptics } from '../../lib/utils/haptics'
import { FLOW_ANIMATION_TIMING } from './flowAnimation.config'
import BrandLogo from '../ui/BrandLogo'

export { resolveFlowArchetypeBackgrounds } from '../../lib/utils/flowBannerAssets'
export type { FlowArchetypeBackgrounds } from '../../lib/utils/flowBannerAssets'

interface FlowShellProps extends PropsWithChildren {
  title: string
  /** When false, the header title text is not rendered (e.g. Flow 1's title
   *  duplicates the H1 below it). Default true. */
  showTitle?: boolean
  showGameBackground?: boolean
  archetypeId?: string | null
  /** 'box' (default) plays the packed-box entrance beat; 'cut' skips it — used
   *  by Flow 1, which always follows the UnboxingCeremony's own box moment. */
  entranceMode?: 'box' | 'cut'
  onSkip: () => void
  actionLabel: string
  actionVisible: boolean
  onAction: () => void
  /** Called once when the Flow 1 packed-box beat resolves into the settle phase. */
  onEntranceResolve?: () => void
}

export default function FlowShell({
  title,
  showTitle = true,
  showGameBackground = false,
  archetypeId,
  entranceMode = 'box',
  onSkip,
  actionLabel,
  actionVisible,
  onAction,
  onEntranceResolve,
  children,
}: FlowShellProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const personalizedArchetype = isFlowCompanionArchetype(archetypeId) ? archetypeId : null

  const shouldPlayEntrance = showGameBackground && !shouldReduceMotion && entranceMode !== 'cut'
  const [entrancePhase, setEntrancePhase] = useState<'box' | 'settle' | 'done'>(
    shouldPlayEntrance ? 'box' : 'done',
  )
  const resolvedRef = useRef(!shouldPlayEntrance)

  const fireResolve = useCallback(() => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    onEntranceResolve?.()
  }, [onEntranceResolve])

  // entranceMode='cut' starts resolved (resolvedRef is already true, so
  // fireResolve would no-op) but the parent still gates useFlowProgress on
  // this signal — fire it exactly once on mount.
  const cutResolveFiredRef = useRef(false)
  useEffect(() => {
    if (entranceMode !== 'cut' || cutResolveFiredRef.current) return
    cutResolveFiredRef.current = true
    onEntranceResolve?.()
  }, [entranceMode, onEntranceResolve])

  const skipEntrance = useCallback(() => {
    haptics('light')
    fireResolve()
    setEntrancePhase('done')
  }, [fireResolve])

  useEffect(() => {
    if (entrancePhase !== 'box') return
    const apexTimer = setTimeout(() => haptics('light'), FLOW_ANIMATION_TIMING.boxApexMs)
    const settleTimer = setTimeout(() => {
      fireResolve()
      setEntrancePhase('settle')
    }, FLOW_ANIMATION_TIMING.boxBeatMs)
    const doneTimer = setTimeout(() => setEntrancePhase('done'), FLOW_ANIMATION_TIMING.entranceTotalMs)
    return () => {
      clearTimeout(apexTimer)
      clearTimeout(settleTimer)
      clearTimeout(doneTimer)
    }
  }, [entrancePhase, fireResolve])

  const shellClass = useMemo(
    () =>
      [
        'flow-shell',
        showGameBackground && personalizedArchetype ? `flow-shell--personalized flow-shell--${personalizedArchetype}` : '',
        `flow-shell--entrance-${entrancePhase}`,
        // Cut mode keeps the shell chrome stagger (see the --entrance-cut CSS
        // block); reduced motion skips it so nothing is stuck at opacity 0.
        entranceMode === 'cut' && !shouldReduceMotion ? 'flow-shell--entrance-cut' : '',
      ]
        .filter(Boolean)
        .join(' '),
    [entranceMode, entrancePhase, personalizedArchetype, shouldReduceMotion, showGameBackground],
  )

  return (
    <View
      className={shellClass}
      ariaLabel={title}
    >
      {showGameBackground && personalizedArchetype && <View className={`flow-shell__game-bg flow-shell__game-bg--${personalizedArchetype}`}>
        <View className='flow-shell__route flow-shell__route--one' />
        <View className='flow-shell__route flow-shell__route--two' />
        <View className='flow-shell__map-node flow-shell__map-node--one' />
        <View className='flow-shell__map-node flow-shell__map-node--two' />
        <View className='flow-shell__map-node flow-shell__map-node--three' />
        <View className='flow-shell__mystery-tile'>
          <View className='flow-shell__mystery-lid' />
          <View className='flow-shell__mystery-ribbon' />
          <Text className='flow-shell__mystery-mark'>?</Text>
        </View>
        <View className='flow-shell__collectible flow-shell__collectible--one' />
        <View className='flow-shell__collectible flow-shell__collectible--two' />
        <View className='flow-shell__city'>
          <View className='flow-shell__building flow-shell__building--one' />
          <View className='flow-shell__building flow-shell__building--two' />
          <View className='flow-shell__building flow-shell__building--three' />
          <View className='flow-shell__building flow-shell__building--four' />
        </View>
      </View>}

      {entrancePhase === 'box' ? (
        <View
          className='flow-shell__entrance'
          onClick={skipEntrance}
          role='button'
          ariaLabel='点击跳过开场动画'
        >
          <View className='flow-shell__entrance-bloom' aria-hidden='true' />
          <View className='flow-shell__entrance-box' aria-hidden='true'>
            <View className='flow-shell__entrance-lid' />
            <View className='flow-shell__entrance-ribbon' />
            <Text className='flow-shell__entrance-mark'>?</Text>
          </View>
          <Text className='flow-shell__entrance-hint'>轻触屏幕继续</Text>
        </View>
      ) : null}

      <View className='flow-shell__header' aria-hidden={entrancePhase === 'box'}>
        <View className='flow-shell__identity'>
          <BrandLogo
            width={96}
            height={96}
            className='flow-shell__logo'
          />
          <Text className='flow-shell__brand'>JoyJoin</Text>
          {showTitle ? <Text className='flow-shell__title'>{title}</Text> : null}
          {personalizedArchetype ? (
            <View
              className='flow-shell__identity-chip'
              style={{ color: getDeepContrastArchetypeColor(personalizedArchetype) }}
            >
              {getIdentityChipLabel(ARCHETYPE_BY_ID[personalizedArchetype]?.nameCn)}
            </View>
          ) : null}
        </View>
        <Button
          className='flow-shell__skip'
          hoverClass='flow-shell__skip--pressed'
          onClick={onSkip}
          ariaLabel='跳过流程介绍'
        >
          {FLOW_SHELL_COPY.skip}
        </Button>
      </View>

      <View className='flow-shell__canvas' aria-hidden={entrancePhase === 'box'}>
        {children}
      </View>

      <View className={`flow-shell__action ${actionVisible ? 'flow-shell__action--visible' : ''}`} aria-hidden={entrancePhase === 'box'}>
        <Button
          className='flow-shell__primary'
          hoverClass='flow-shell__primary--pressed'
          disabled={!actionVisible}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </View>
    </View>
  )
}
