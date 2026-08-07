import { View, Text } from '@tarojs/components'
import type { DuoCardState } from '../../../lib/duo/duoState'
import Button from '../../../components/ui/Button'
import './PoolRegistrationDuoCard.scss'

interface PoolRegistrationDuoCardProps {
  state: DuoCardState
  /** Local segmented selection — drives thumb position even before the server confirms. */
  mode: 'solo' | 'duo'
  /** POST /duo-invites in flight — segmented stays put but ignores taps. */
  isCreatingInvite: boolean
  /** Bound partner name (server `friendDisplayName`, falling back to inviter lookup). */
  partnerName?: string
  reduceMotion: boolean
  onSelectMode: (mode: 'solo' | 'duo') => void
  onOpenInfo: () => void
  onRetry: () => void
}

/**
 * PoolRegistrationDuoCard — 双人成行 entry on pool-registration Step 0.
 *
 * 附录 H progressive disclosure: the default state is a single collapsed row
 * (≤104rpx); everything else only appears after the user picks 2人. Flat tint
 * surface only — no border, no shadow, no icon next to the title (小信 is the
 * visual anchor of this step; this card deliberately stays one volume lower).
 */
export default function PoolRegistrationDuoCard({
  state,
  mode,
  isCreatingInvite,
  partnerName,
  reduceMotion,
  onSelectMode,
  onOpenInfo,
  onRetry,
}: PoolRegistrationDuoCardProps) {
  // Segmented is locked on 2人 once the invite has been sent (waiting) — the
  // code lives on the server; switching back locally would be a lie.
  const segmentedLocked = state === 'waiting'
  const thumbDuo = mode === 'duo' || state === 'waiting'

  const handleSelect = (nextMode: 'solo' | 'duo') => {
    if (segmentedLocked || isCreatingInvite || nextMode === mode) return
    onSelectMode(nextMode)
  }

  const expandedClass = reduceMotion
    ? 'pool-reg-duo__expand pool-reg-duo__expand--static'
    : 'pool-reg-duo__expand'

  const renderSegmented = (disabled: boolean) => (
    <View
      className={`pool-reg-duo__segmented${disabled ? ' pool-reg-duo__segmented--locked' : ''}`}
      role='radiogroup'
      aria-label='同行人数'
    >
      <View
        className={`pool-reg-duo__segmented-thumb${thumbDuo ? ' pool-reg-duo__segmented-thumb--duo' : ''}${reduceMotion ? ' pool-reg-duo__segmented-thumb--static' : ''}`}
        aria-hidden='true'
      />
      <View
        className={`pool-reg-duo__segment${!thumbDuo ? ' pool-reg-duo__segment--active' : ''}`}
        role='radio'
        aria-checked={!thumbDuo}
        aria-label='1人'
        onClick={() => handleSelect('solo')}
      >
        <Text className='pool-reg-duo__segment-text'>1人</Text>
      </View>
      <View
        className={`pool-reg-duo__segment${thumbDuo ? ' pool-reg-duo__segment--active' : ''}`}
        role='radio'
        aria-checked={thumbDuo}
        aria-label='2人'
        onClick={() => handleSelect('duo')}
      >
        <Text className='pool-reg-duo__segment-text'>2人</Text>
      </View>
    </View>
  )

  const renderHeaderRow = (locked: boolean) => (
    <View className='pool-reg-duo__row'>
      <View className='pool-reg-duo__title-wrap'>
        <Text className='pool-reg-duo__title'>双人成行</Text>
        <View
          className='pool-reg-duo__info-hit'
          hoverClass='pool-reg-duo__info-hit--active'
          onClick={onOpenInfo}
          aria-role='button'
          aria-label='玩法说明'
        >
          <View className='pool-reg-duo__info-glyph' aria-hidden='true'>
            <Text className='pool-reg-duo__info-glyph-text'>?</Text>
          </View>
        </View>
      </View>
      {renderSegmented(locked)}
    </View>
  )

  if (state === 'loading') {
    return (
      <View className='pool-reg-duo' aria-busy='true' aria-label='正在加载双人成行状态'>
        <View className='pool-reg-duo__skeleton'>
          <View className='pool-reg-duo__skeleton-line pool-reg-duo__skeleton-line--medium' />
          <View className='pool-reg-duo__skeleton-line pool-reg-duo__skeleton-line--short' />
        </View>
      </View>
    )
  }

  if (state === 'error') {
    // Non-blocking local error: the card keeps a usable 1人 segmented and the
    // registration flow is never affected (spec §E 不阻断原则).
    return (
      <View className='pool-reg-duo'>
        {renderHeaderRow(false)}
        <View
          className='pool-reg-duo__error'
          hoverClass='pool-reg-duo__error--active'
          onClick={onRetry}
          aria-role='button'
        >
          <Text className='pool-reg-duo__error-text'>双人状态没刷出来，点我重试</Text>
        </View>
      </View>
    )
  }

  if (state === 'bound') {
    return (
      <View className='pool-reg-duo pool-reg-duo--bound'>
        <View className='pool-reg-duo__row pool-reg-duo__row--bound'>
          <View
            className={`pool-reg-duo__check${reduceMotion ? ' pool-reg-duo__check--static' : ''}`}
            aria-hidden='true'
          />
          <Text className='pool-reg-duo__bound-text'>
            {partnerName ?? '朋友'} 已报名，同桌安排上了
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className='pool-reg-duo'>
      {renderHeaderRow(segmentedLocked)}

      {state === 'expanded' ? (
        <View className={expandedClass}>
          <Button
            variant='primary'
            size='sm'
            className='pool-reg-duo__share-btn'
            openType='share'
            loading={isCreatingInvite}
          >
            喊朋友一起来
          </Button>
        </View>
      ) : null}

      {state === 'waiting' ? (
        <View className={expandedClass}>
          {/* 待入队态保持静止（附录 H · A'-9）：等待不是成就，不配动画。 */}
          <View className='pool-reg-duo__waiting-row'>
            <Text className='pool-reg-duo__waiting-text'>已发给朋友，等 TA 报名</Text>
            <Button
              variant='secondary'
              size='sm'
              className='pool-reg-duo__again-btn'
              openType='share'
            >
              再喊一次
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  )
}
