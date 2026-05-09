import { View, Text, Input, Image } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import type { SessionParticipant } from '../phaseUtils'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import type { SocialSessionState } from '@shared/socialIcebreaker'

export interface AuctionBidRecord {
  userId: string
  displayName: string
  amount: number
  at: number
}

export function AuctionPhaseView({
  session,
  currentUserId,
  isHost,
  onGenerateLots,
  onPlaceBid,
  onCloseLot,
  onAdvance,
  isAdvancing,
  isGeneratingLots,
  isPlacingBid,
  isClosingLot,
}: {
  session: SocialSessionState
  currentUserId: string
  isHost: boolean
  onGenerateLots: () => void
  onPlaceBid: (amount: number) => void
  onCloseLot: () => void
  onAdvance: () => void
  isAdvancing: boolean
  isGeneratingLots: boolean
  isPlacingBid: boolean
  isClosingLot: boolean
}) {
  const [bidText, setBidText] = useState('10')
  const [bidError, setBidError] = useState('')
  const [showSold, setShowSold] = useState(false)
  const [showLotSold, setShowLotSold] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [bidHistory, setBidHistory] = useState<AuctionBidRecord[]>([])
  const lots = session.auctionLots ?? []
  const idx = session.auctionCurrentLotIndex ?? 0
  const currentLot = lots[idx]
  const high = session.auctionHighBid
  const balance = session.auctionBalances?.[currentUserId] ?? 0
  const allClosed = session.auctionAllLotsClosed ?? false
  const prevAllClosedRef = useRef(false)
  const prevIdxRef = useRef(idx)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const nameOf = (uid: string) =>
    session.joinedParticipants?.find((p) => p.userId === uid)?.displayName ?? '匿名'

  // Countdown timer: 30s per lot
  useEffect(() => {
    setTimeLeft(30)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [idx])

  useEffect(() => {
    setBidText('10')
    setBidError('')
    // Detect lot change (host closed previous lot)
    if (idx > prevIdxRef.current && prevIdxRef.current >= 0) {
      setShowLotSold(true)
      setBidHistory([])
    }
    prevIdxRef.current = idx
  }, [idx])

  useEffect(() => {
    if (allClosed && !prevAllClosedRef.current) {
      setShowSold(true)
    }
    prevAllClosedRef.current = allClosed
  }, [allClosed])

  // Sync bid history from server high bid
  useEffect(() => {
    if (!high) return
    setBidHistory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1]
        if (last.amount === high.amount && last.userId === high.userId) {
          return prev
        }
      }
      return [
        ...prev,
        { userId: high.userId, displayName: nameOf(high.userId), amount: high.amount, at: Date.now() },
      ]
    })
  }, [high?.amount, high?.userId])

  if (lots.length === 0) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--auction icebreaker__challenge-card--has-bg'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="auction" size={80} /></View>
          <Text className='icebreaker__challenge-title'>脑洞拍卖会</Text>
          <Text className='icebreaker__challenge-desc'>
            虚拟币竞拍，仅供娱乐。主持人生成竞拍条目后，大家按轮出价。
          </Text>
        </Card>
        {isHost ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onGenerateLots}
            disabled={isGeneratingLots}
            loading={isGeneratingLots}
          >
            {isGeneratingLots ? '生成中…' : '生成竞拍条目'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>等待主持人生成竞拍条目…</Text>
        )}
      </View>
    )
  }

  if (allClosed) {
    return (
      <View className='icebreaker__challenge'>
        <CelebrationOverlay
          visible={showSold}
          frameKey='auction_sold'
          title='拍卖圆满结束'
          subtitle='所有竞拍条目均已成交'
          autoDismissMs={3000}
          onDismiss={() => setShowSold(false)}
        />
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--auction icebreaker__challenge-card--has-bg'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="auction" size={80} /></View>
          <Text className='icebreaker__challenge-title'>拍卖结束</Text>
          <Text className='icebreaker__challenge-desc'>全部竞拍已完成。</Text>
        </Card>
        {isHost ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onAdvance}
            disabled={isAdvancing}
            loading={isAdvancing}
          >
            {isAdvancing ? '切换中…' : '进入下一阶段'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>等待主持人进入下一阶段…</Text>
        )}
      </View>
    )
  }

  const timerUrgent = timeLeft <= 10 && timeLeft > 0
  const timerExpired = timeLeft <= 0
  const minBid = (high?.amount ?? 0) + 1
  const canBid = !isHost && !timerExpired && balance >= minBid

  const handleQuickBid = (amount: number) => {
    if (amount <= (high?.amount ?? 0)) {
      setBidError('出价须高于当前最高')
      return
    }
    if (amount > balance) {
      setBidError('余额不足')
      return
    }
    setBidError('')
    onPlaceBid(amount)
  }

  return (
    <View className='icebreaker__challenge'>
      <CelebrationOverlay
        visible={showLotSold}
        frameKey='auction_sold'
        title='成交！'
        subtitle={high ? `${nameOf(high.userId)} 以 ${high.amount} 币拍下` : '本标无人出价'}
        autoDismissMs={2000}
        onDismiss={() => setShowLotSold(false)}
      />

      <Card className='icebreaker__challenge-card icebreaker__challenge-card--auction icebreaker__challenge-card--has-bg'>
        <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="auction" size={80} /></View>
        <Text className='icebreaker__challenge-title'>第 {idx + 1} / {lots.length} 标</Text>
        <Text className='icebreaker__challenge-desc'>{currentLot?.title ?? ''}</Text>
        {currentLot?.teaser ? (
          <Text className='icebreaker__challenge-hint'>{currentLot.teaser}</Text>
        ) : null}

        {/* Timer */}
        <View className={`icebreaker__auction-timer${timerUrgent ? ' icebreaker__auction-timer--urgent' : ''}${timerExpired ? ' icebreaker__auction-timer--expired' : ''}`}>
          <Text className='icebreaker__auction-timer-value'>
            {timerExpired ? '时间到' : `00:${timeLeft.toString().padStart(2, '0')}`}
          </Text>
        </View>

        <View className='icebreaker__challenge-meta'>
          <Text className='icebreaker__challenge-duration'>
            <Image src='/assets/lovart/icebreaker/icons/icon-coin-single.png' mode='aspectFit' style={{ width: '28rpx', height: '28rpx', marginRight: '6rpx', verticalAlign: 'middle' }} />
            当前最高：{high ? `${high.amount}` : '暂无'}
          </Text>
          <Text className='icebreaker__challenge-completed'>
            <Image src='/assets/lovart/icebreaker/icons/icon-coin-stack.png' mode='aspectFit' style={{ width: '28rpx', height: '28rpx', marginRight: '6rpx', verticalAlign: 'middle' }} />
            余额：{balance}
          </Text>
        </View>
      </Card>

      {/* Bid history */}
      {bidHistory.length > 0 && (
        <View className='icebreaker__auction-history'>
          <Text className='icebreaker__auction-history-title'>出价记录</Text>
          {bidHistory.slice(-5).map((bid, i) => (
            <View key={`${bid.userId}-${bid.amount}-${i}`} className='icebreaker__auction-history-row'>
              <Text className='icebreaker__auction-history-name'>{bid.displayName}</Text>
              <Text className='icebreaker__auction-history-amount'>{bid.amount} 币</Text>
            </View>
          ))}
        </View>
      )}

      {!isHost ? (
        <View className='icebreaker__action-stack'>
          {timerExpired ? (
            <Text className='icebreaker__helper-text'>时间到，等待主持人落槌…</Text>
          ) : (
            <>
              <Text className='icebreaker__helper-text'>选择快捷出价或自定义金额</Text>

              {/* Quick-bid buttons */}
              <View className='icebreaker__auction-quick-bids'>
                <Button
                  variant='secondary'
                  className='icebreaker__auction-quick-btn'
                  onClick={() => handleQuickBid((high?.amount ?? 0) + 5)}
                  disabled={!canBid || isPlacingBid || balance < ((high?.amount ?? 0) + 5)}
                >
                  +5
                </Button>
                <Button
                  variant='secondary'
                  className='icebreaker__auction-quick-btn'
                  onClick={() => handleQuickBid((high?.amount ?? 0) + 10)}
                  disabled={!canBid || isPlacingBid || balance < ((high?.amount ?? 0) + 10)}
                >
                  +10
                </Button>
                <Button
                  variant='secondary'
                  className='icebreaker__auction-quick-btn'
                  onClick={() => handleQuickBid(balance)}
                  disabled={!canBid || isPlacingBid || balance <= (high?.amount ?? 0)}
                >
                  ALL IN
                </Button>
              </View>

              <Input
                type='number'
                className='icebreaker__input'
                value={bidText}
                onInput={(e) => setBidText(e.detail.value)}
                placeholder={`最低出价 ${minBid}`}
              />
              {bidError ? (
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx', marginBottom: '8rpx' }}>
                  <Image src='/assets/lovart/icebreaker/icons/icon-coin-empty.png' mode='aspectFit' style={{ width: '32rpx', height: '32rpx' }} />
                  <Text className='icebreaker__error'>{bidError}</Text>
                </View>
              ) : null}
              <Button
                variant='primary'
                className='icebreaker__action-btn'
                onClick={() => {
                  const n = Number.parseInt(bidText, 10)
                  if (!Number.isFinite(n) || n <= 0) {
                    setBidError('出价须为正整数')
                    return
                  }
                  if (high && n <= high.amount) {
                    setBidError(`出价须高于当前最高 ${high.amount} 币`)
                    return
                  }
                  if (n > balance) {
                    setBidError(`余额不足，当前余额 ${balance} 币`)
                    return
                  }
                  setBidError('')
                  onPlaceBid(n)
                }}
                disabled={isPlacingBid || timerExpired}
                loading={isPlacingBid}
              >
                {isPlacingBid ? '提交中…' : '出价'}
              </Button>
            </>
          )}
        </View>
      ) : null}

      {isHost ? (
        <Button
          variant='secondary'
          className='icebreaker__action-btn'
          onClick={onCloseLot}
          disabled={isClosingLot}
          loading={isClosingLot}
        >
          {isClosingLot ? '处理中…' : timerExpired ? '时间到，落槌' : '关闭本标（落槌）'}
        </Button>
      ) : null}
    </View>
  )
}
