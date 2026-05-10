import { useState, useCallback } from 'react'
import { View, Text, Switch } from '@tarojs/components'
import { CardFlip, IdentityReveal, ParticleBurst } from '../../../components/reveal'
import { SwipeCard, TapRhythm, TapReaction } from '../../../components/gesture'
import Button from '../../../components/ui/Button'
import './index.scss'

/**
 * Wow-Demo — DevTools inspection page for Phase 1 Shared Infrastructure.
 *
 * Shows all 6 Reveal Engine + Gesture Kit components in isolation.
 * NOT registered in app.config.ts — for local verification only.
 */
export default function WowDemoPage() {
  const [reducedMotion, setReducedMotion] = useState(false)

  // CardFlip state
  const [flipped, setFlipped] = useState(false)

  // IdentityReveal state
  const [identityRevealed, setIdentityRevealed] = useState(false)

  // ParticleBurst state
  const [burstTrigger, setBurstTrigger] = useState(false)
  const [burstType, setBurstType] = useState<'confetti' | 'coins' | 'roses'>('confetti')

  // SwipeCard state
  const [swipeLog, setSwipeLog] = useState<string>('')

  // TapRhythm state
  const [tapCount, setTapCount] = useState(0)

  // TapReaction state
  const [selectedReaction, setSelectedReaction] = useState<number | undefined>(undefined)

  const triggerBurst = useCallback(() => {
    setBurstTrigger((prev) => !prev)
  }, [])

  const handleSwipeLeft = useCallback(() => {
    setSwipeLog('Swiped LEFT ✕')
    setTimeout(() => setSwipeLog(''), 1200)
  }, [])

  const handleSwipeRight = useCallback(() => {
    setSwipeLog('Swiped RIGHT ✓')
    setTimeout(() => setSwipeLog(''), 1200)
  }, [])

  const handleTap = useCallback(() => {
    setTapCount((c) => c + 1)
  }, [])

  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index)
  }, [])

  const reactionItems = [
    { emoji: '🌹', label: '玫瑰', count: 12 },
    { emoji: '🍅', label: '番茄', count: 3 },
    { emoji: '🪙', label: '金币', count: 8 },
    { emoji: '❤️', label: '爱心', count: 24 },
  ]

  return (
    <View className='wow-demo'>
      <View className='wow-demo__header'>
        <Text className='wow-demo__title'>Phase 1 Shared Infrastructure</Text>
        <Text className='wow-demo__subtitle'>Reveal Engine + Gesture Kit</Text>
      </View>

      {/* Reduced Motion Toggle */}
      <View className='wow-demo__row wow-demo__row--toggle'>
        <Text className='wow-demo__label'>Reduced Motion</Text>
        <Switch
          checked={reducedMotion}
          onChange={(e) => setReducedMotion(e.detail.value)}
          color='#8B5CF6'
        />
      </View>

      {/* ─── Reveal Engine ─── */}
      <View className='wow-demo__section'>
        <Text className='wow-demo__section-title'>Reveal Engine</Text>

        {/* CardFlip */}
        <View className='wow-demo__demo-block'>
          <Text className='wow-demo__demo-label'>CardFlip</Text>
          <View className='wow-demo__card-flip-wrap'>
            <CardFlip
              front={
                <View className='wow-demo__card-face wow-demo__card-face--front'>
                  <Text className='wow-demo__card-text'>?</Text>
                </View>
              }
              back={
                <View className='wow-demo__card-face wow-demo__card-face--back'>
                  <Text className='wow-demo__card-text'>🎭</Text>
                </View>
              }
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
              reducedMotion={reducedMotion}
            />
          </View>
          <Button variant='secondary' onClick={() => setFlipped((f) => !f)}>
            Toggle Flip
          </Button>
        </View>

        {/* IdentityReveal */}
        <View className='wow-demo__demo-block'>
          <Text className='wow-demo__demo-label'>IdentityReveal</Text>
          <IdentityReveal
            identity='卧底'
            label='你的身份是'
            revealed={identityRevealed}
            spotlightColor='#FF6B9D'
            reducedMotion={reducedMotion}
          />
          <Button variant='secondary' onClick={() => setIdentityRevealed((r) => !r)}>
            Toggle Reveal
          </Button>
        </View>

        {/* ParticleBurst */}
        <View className='wow-demo__demo-block'>
          <Text className='wow-demo__demo-label'>ParticleBurst</Text>
          <View className='wow-demo__burst-controls'>
            {(['confetti', 'coins', 'roses'] as const).map((t) => (
              <View
                key={t}
                className={`wow-demo__burst-chip${burstType === t ? ' wow-demo__burst-chip--active' : ''}`}
                onClick={() => setBurstType(t)}
              >
                <Text className='wow-demo__burst-chip-text'>
                  {t === 'confetti' ? '🎊' : t === 'coins' ? '🪙' : '🌹'} {t}
                </Text>
              </View>
            ))}
          </View>
          <View className='wow-demo__burst-stage'>
            <ParticleBurst
              trigger={burstTrigger}
              type={burstType}
              count={40}
              reducedMotion={reducedMotion}
            />
          </View>
          <Button variant='primary' onClick={triggerBurst}>
            Trigger Burst
          </Button>
        </View>
      </View>

      {/* ─── Gesture Kit ─── */}
      <View className='wow-demo__section'>
        <Text className='wow-demo__section-title'>Gesture Kit</Text>

        {/* SwipeCard */}
        <View className='wow-demo__demo-block'>
          <Text className='wow-demo__demo-label'>SwipeCard</Text>
          <SwipeCard
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            reducedMotion={reducedMotion}
          >
            <View className='wow-demo__swipe-card'>
              <Text className='wow-demo__swipe-text'>Swipe me left or right</Text>
            </View>
          </SwipeCard>
          {swipeLog && (
            <Text className='wow-demo__swipe-log'>{swipeLog}</Text>
          )}
        </View>

        {/* TapRhythm */}
        <View className='wow-demo__demo-block'>
          <Text className='wow-demo__demo-label'>TapRhythm</Text>
          <TapRhythm
            onTap={handleTap}
            tapCount={tapCount}
            targetCount={10}
            emoji='👏'
            reducedMotion={reducedMotion}
          />
          <Button variant='secondary' onClick={() => setTapCount(0)}>
            Reset
          </Button>
        </View>

        {/* TapReaction */}
        <View className='wow-demo__demo-block'>
          <Text className='wow-demo__demo-label'>TapReaction</Text>
          <TapReaction
            reactions={reactionItems}
            onReact={handleReact}
            selectedIndex={selectedReaction}
            reducedMotion={reducedMotion}
          />
          {selectedReaction !== undefined && (
            <Text className='wow-demo__reaction-log'>
              You chose: {reactionItems[selectedReaction].label}
            </Text>
          )}
        </View>
      </View>

      <View className='wow-demo__footer'>
        <Text className='wow-demo__footer-text'>Not registered in app.config.ts</Text>
      </View>
    </View>
  )
}
