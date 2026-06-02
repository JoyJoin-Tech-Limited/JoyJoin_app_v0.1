import { View, Text, Input, Image } from '@tarojs/components'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import type { SessionParticipant } from '../phaseUtils'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import CardFlip from '../../../components/reveal/CardFlip'
import IdentityReveal from '../../../components/reveal/IdentityReveal'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import './AuctionPhaseView.scss'

export interface AuctionBidRecordLocal {
  userId: string
  displayName: string
  amount: number
  at: number
}

interface AuctionPhaseViewProps {
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
}

const LOT_DURATION_SECONDS = 30

/**
 * Map lot title keywords to category emojis for visual presentation (D9 fallback).
 */
function lotEmoji(lot: { emoji?: string; title?: string }): string {
  if (lot.emoji) return lot.emoji
  const title = lot.title ?? ''
  if (title.includes('社死') || title.includes('尴尬') || title.includes('糗')) return '😅'
  if (title.includes('旅行') || title.includes('游') || title.includes('出发')) return '✈️'
  if (title.includes('秘密') || title.includes('爆料') || title.includes('习惯')) return '🤫'
  if (title.includes('歌') || title.includes('唱') || title.includes('音乐')) return '🎤'
  if (title.includes('舞') || title.includes('跳')) return '💃'
  if (title.includes('表演') || title.includes('演')) return '🎭'
  if (title.includes('吃') || title.includes('美食') || title.includes('喝')) return '🍜'
  if (title.includes('运动') || title.includes('跑') || title.includes('健身')) return '💪'
  if (title.includes('游戏') || title.includes('玩')) return '🎮'
  if (title.includes('电影') || title.includes('剧')) return '🎬'
  if (title.includes('书') || title.includes('读')) return '📚'
  if (title.includes('画') || title.includes('艺术')) return '🎨'
  return '🔮'
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
}: AuctionPhaseViewProps) {
  const [bidText, setBidText] = useState('10')
  const [bidError, setBidError] = useState('')
  const [showSold, setShowSold] = useState(false)
  const [showLotSold, setShowLotSold] = useState(false)
  const [showWinBurst, setShowWinBurst] = useState(false)
  const [timeLeft, setTimeLeft] = useState(LOT_DURATION_SECONDS)
  const [outbidNotice, setOutbidNotice] = useState('')

  const lots = session.auctionLots ?? []
  const idx = session.auctionCurrentLotIndex ?? 0
  const currentLot = lots[idx]
  const high = session.auctionHighBid
  const balance = session.auctionBalances?.[currentUserId] ?? 0
  const allClosed = session.auctionAllLotsClosed ?? false
  const lotStartedAt = session.auctionLotStartedAt

  const prevAllClosedRef = useRef(false)
  const prevIdxRef = useRef(idx)
  const prevHighRef = useRef(session.auctionHighBid)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const outbidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wonLotRef = useRef(false)

  const nameOf = useCallback(
    (uid: string) =>
      session.joinedParticipants?.find((p) => p.userId === uid)?.displayName ?? '匿名',
    [session.joinedParticipants],
  )

  // ── Server-synced timer (D3) ─────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (!lotStartedAt) {
        setTimeLeft(LOT_DURATION_SECONDS)
        return
      }
      const elapsed = Math.floor((Date.now() - lotStartedAt) / 1000)
      const remaining = Math.max(0, LOT_DURATION_SECONDS - elapsed)
      setTimeLeft(remaining)
    }

    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [lotStartedAt])

  // ── Lot change detection ─────────────────────────────────────
  useEffect(() => {
    if (idx > prevIdxRef.current && prevIdxRef.current >= 0) {
      const prevHigh = prevHighRef.current
      wonLotRef.current = prevHigh ? prevHigh.userId === currentUserId : false
      setShowLotSold(true)
      setBidText('10')
      setBidError('')
    }
    prevIdxRef.current = idx
  }, [idx, currentUserId])

  // ── All-closed detection ─────────────────────────────────────
  useEffect(() => {
    if (allClosed && !prevAllClosedRef.current) {
      setShowSold(true)
    }
    prevAllClosedRef.current = allClosed
  }, [allClosed])

  // ── Outbid notification (D4) ─────────────────────────────────
  useEffect(() => {
    const prev = prevHighRef.current
    const curr = session.auctionHighBid
    if (prev && curr && prev.userId === currentUserId && curr.userId !== currentUserId) {
      setOutbidNotice(`被 ${nameOf(curr.userId)} 以 ${curr.amount} 币超价！`)
      if (outbidTimerRef.current) clearTimeout(outbidTimerRef.current)
      outbidTimerRef.current = setTimeout(() => setOutbidNotice(''), 3000)
    }
    prevHighRef.current = curr
    return () => {
      if (outbidTimerRef.current) {
        clearTimeout(outbidTimerRef.current)
        outbidTimerRef.current = null
      }
    }
  }, [session.auctionHighBid, currentUserId, nameOf])

  // ── Win burst when current user is high bidder at lot close ──
  useEffect(() => {
    if (wonLotRef.current) {
      wonLotRef.current = false
      setShowWinBurst(true)
      const t = setTimeout(() => setShowWinBurst(false), 2000)
      return () => clearTimeout(t)
    }
  }, [idx])

  // ── Bid history from server (D5) ─────────────────────────────
  const bidHistory: AuctionBidRecordLocal[] = useMemo(() => {
    const history = session.auctionBidHistory || []
    return history
      .filter((b) => b.lotIndex === idx)
      .map((b) => ({
        userId: b.userId,
        displayName: nameOf(b.userId),
        amount: b.amount,
        at: b.at,
      }))
      .reverse()
  }, [session.auctionBidHistory, idx, nameOf])

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

  // ── CardFlip lot reveal ──────────────────────────────────────
  const [lotFlipped, setLotFlipped] = useState(false)
  const lotFlipTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setLotFlipped(false)
    if (lotFlipTimerRef.current) clearTimeout(lotFlipTimerRef.current)
    lotFlipTimerRef.current = setTimeout(() => setLotFlipped(true), 200)
    return () => {
      if (lotFlipTimerRef.current) {
        clearTimeout(lotFlipTimerRef.current)
        lotFlipTimerRef.current = undefined
      }
    }
  }, [idx])

  const LotFront = useCallback(
    () => (
      <View className='auction-lot-front'>
        <View className='auction-lot-front__icon'>
          <PhaseHeaderIcon phase='auction' size={72} />
        </View>
        <Text className='auction-lot-front__label'>第 {idx + 1} / {lots.length} 标</Text>
        <Text className='auction-lot-front__sub'>即将揭晓…</Text>
      </View>
    ),
    [idx, lots.length],
  )

  const LotBack = useCallback(
    () => (
      <View className='auction-lot-back'>
        <View className='auction-lot-back__header'>
          <Text className='auction-lot-back__emoji'>{currentLot ? lotEmoji(currentLot) : '🔮'}</Text>
          <Text className='auction-lot-back__index'>{idx + 1} / {lots.length}</Text>
        </View>
        <Text className='auction-lot-back__title'>{currentLot?.title ?? ''}</Text>
        {currentLot?.teaser ? (
          <Text className='auction-lot-back__teaser'>{currentLot.teaser}</Text>
        ) : null}
      </View>
    ),
    [currentLot, idx, lots.length],
  )

  if (lots.length === 0) {
    return (
      <View className='icebreaker__auction'>
        <Card className='icebreaker__auction-intro'>
          <View className='icebreaker__auction-intro-icon'>
            <PhaseHeaderIcon phase='auction' size={80} />
          </View>
          <Text className='icebreaker__auction-intro-title'>脑洞拍卖会</Text>
          <Text className='icebreaker__auction-intro-desc'>
            虚拟币竞拍，仅供娱乐。主持人生成竞拍条目后，大家按轮出价。
          </Text>
        </Card>

        {isGeneratingLots && (
          <View className='icebreaker__skeleton-card' style={{ marginTop: '16rpx' }}>
            <View className='icebreaker__skeleton-circle' />
            <View className='icebreaker__skeleton-line icebreaker__skeleton-line--medium' />
            <View className='icebreaker__skeleton-line icebreaker__skeleton-line--long' />
            <View className='icebreaker__skeleton-line icebreaker__skeleton-line--short' />
          </View>
        )}

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
      <View className='icebreaker__auction'>
        <CelebrationOverlay
          visible={showSold}
          frameKey='auction_sold'
          title='拍卖圆满结束'
          subtitle='所有竞拍条目均已成交'
          autoDismissMs={3000}
          onDismiss={() => setShowSold(false)}
        />
        <Card className='icebreaker__auction-intro'>
          <View className='icebreaker__auction-intro-icon'>
            <PhaseHeaderIcon phase='auction' size={80} />
          </View>
          <Text className='icebreaker__auction-intro-title'>拍卖结束</Text>
          <Text className='icebreaker__auction-intro-desc'>全部竞拍已完成。</Text>
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

  return (
    <View className='icebreaker__auction'>
      {/* Win celebration burst */}
      {showWinBurst && (
        <View className='icebreaker__auction-burst'>
          <ParticleBurst trigger={showWinBurst} type='coins' count={45} />
        </View>
      )}

      {/* Outbid toast */}
      {outbidNotice ? (
        <View className='icebreaker__auction-outbid'>
          <Text className='icebreaker__auction-outbid-text'>{outbidNotice}</Text>
        </View>
      ) : null}

      {/* Lot sold overlay */}
      <CelebrationOverlay
        visible={showLotSold}
        frameKey='auction_sold'
        title='成交！'
        subtitle={
          high
            ? `${nameOf(high.userId)} 以 ${high.amount} 币拍下`
            : '本标无人出价'
        }
        autoDismissMs={2000}
        onDismiss={() => setShowLotSold(false)}
      />

      {/* Lot card with CardFlip */}
      <View className='icebreaker__auction-lot-wrap'>
        <CardFlip front={<LotFront />} back={<LotBack />} flipped={lotFlipped} duration={500} />
      </View>

      {/* Timer */}
      <View
        className={`icebreaker__auction-timer${timerUrgent ? ' icebreaker__auction-timer--urgent' : ''}${timerExpired ? ' icebreaker__auction-timer--expired' : ''}`}
      >
        <Text className='icebreaker__auction-timer-value'>
          {timerExpired ? '时间到' : `00:${timeLeft.toString().padStart(2, '0')}`}
        </Text>
      </View>

      {/* Current high bid + balance */}
      <View className='icebreaker__auction-stats'>
        <View className='icebreaker__auction-stat'>
          <Image
            src={cdnAsset('/assets/lovart/icebreaker/icons/icon-coin-single.png')}
            mode='aspectFit'
            className='icebreaker__auction-stat-icon'
            style={{ width: '28rpx', height: '28rpx' }}
          />
          <Text className='icebreaker__auction-stat-label'>当前最高</Text>
          <Text className='icebreaker__auction-stat-value'>{high ? `${high.amount}` : '暂无'}</Text>
        </View>
        <View className='icebreaker__auction-stat'>
          <Image
            src={cdnAsset('/assets/lovart/icebreaker/icons/icon-coin-stack.png')}
            mode='aspectFit'
            className='icebreaker__auction-stat-icon'
            style={{ width: '28rpx', height: '28rpx' }}
          />
          <Text className='icebreaker__auction-stat-label'>余额</Text>
          <Text className='icebreaker__auction-stat-value'>{balance}</Text>
        </View>
      </View>

      {/* High bidder identity reveal */}
      {high && (
        <View className='icebreaker__auction-high-bidder'>
          <IdentityReveal
            revealed={true}
            identity={`${nameOf(high.userId)} · ${high.amount}币`}
            label='当前领先'
            spotlightColor='#FBBF24'
          />
        </View>
      )}

      {/* Bid history from server (D5) */}
      {bidHistory.length > 0 && (
        <View className='icebreaker__auction-history'>
          <Text className='icebreaker__auction-history-title'>出价记录</Text>
          {bidHistory.slice(0, 6).map((bid, i) => (
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
                <View className='icebreaker__auction-error-row'>
                  <Image
                    src={cdnAsset('/assets/lovart/icebreaker/icons/icon-coin-empty.png')}
                    mode='aspectFit'
                    style={{ width: '32rpx', height: '32rpx' }}
                  />
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
