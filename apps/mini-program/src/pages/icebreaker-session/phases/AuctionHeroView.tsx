import { View, Text, Input, Image } from '@tarojs/components'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { haptics } from '../../../lib/utils/haptics'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import CardFlip from '../../../components/reveal/CardFlip'
import IdentityReveal from '../../../components/reveal/IdentityReveal'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseHeaderIcon } from '../phaseUtils'
import { PHASE_ACCENTS } from './phaseAccents'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import './AuctionHeroView.scss'

export interface AuctionBidRecordLocal {
  userId: string
  displayName: string
  amount: number
  at: number
}

interface AuctionHeroViewProps {
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
  lotsMeta?: AIResponseMeta
}

const LOT_DURATION_SECONDS = 30

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

export function AuctionHeroView({
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
  lotsMeta,
}: AuctionHeroViewProps) {
  const [bidText, setBidText] = useState('10')
  const [bidError, setBidError] = useState('')
  const [showSold, setShowSold] = useState(false)
  const [showLotSold, setShowLotSold] = useState(false)
  const [lastLotResult, setLastLotResult] = useState<{ name: string; amount: number } | null>(null)
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

  // ── Server-synced timer ──
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

  // ── Lot change detection (hammer stamp fires via CelebrationOverlay) ──
  useEffect(() => {
    if (idx > prevIdxRef.current && prevIdxRef.current >= 0) {
      const prevHigh = prevHighRef.current
      wonLotRef.current = prevHigh ? prevHigh.userId === currentUserId : false
      // M1: capture the closed lot's winner before the server nulls auctionHighBid
      setLastLotResult(prevHigh ? { name: nameOf(prevHigh.userId), amount: prevHigh.amount } : null)
      setShowLotSold(true)
      setBidText('10')
      setBidError('')
    }
    prevIdxRef.current = idx
  }, [idx, currentUserId, nameOf])

  // ── All-closed detection: the final lot's stamp fires here (no idx change) ──
  useEffect(() => {
    if (allClosed && !prevAllClosedRef.current) {
      const prevHigh = prevHighRef.current
      wonLotRef.current = prevHigh ? prevHigh.userId === currentUserId : false
      setLastLotResult(prevHigh ? { name: nameOf(prevHigh.userId), amount: prevHigh.amount } : null)
      setShowLotSold(true)
      setShowSold(true)
    }
    prevAllClosedRef.current = allClosed
  }, [allClosed, currentUserId, nameOf])

  // ── Outbid notification ──
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
    haptics('medium')
    onPlaceBid(amount)
  }

  // ── CardFlip lot reveal ──
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
      <View className='auction-hero__lot-front'>
        <View className='auction-hero__lot-front-icon'>
          <PhaseHeaderIcon phase='auction' size={72} />
        </View>
        <Text className='auction-hero__lot-front-label'>第 {idx + 1} / {lots.length} 标</Text>
        <Text className='auction-hero__lot-front-sub'>即将揭晓…</Text>
      </View>
    ),
    [idx, lots.length],
  )

  const LotBack = useCallback(
    () => (
      <View className='auction-hero__lot-back'>
        <View className='auction-hero__lot-back-header'>
          <JoyJoinIcon emoji={currentLot ? lotEmoji(currentLot) : '🔮'} size={48} />
          <Text className='auction-hero__lot-back-index'>{idx + 1} / {lots.length}</Text>
        </View>
        <Text className='auction-hero__lot-back-title'>{currentLot?.title ?? ''}</Text>
        {currentLot?.teaser ? (
          <Text className='auction-hero__lot-back-teaser'>{currentLot.teaser}</Text>
        ) : null}
      </View>
    ),
    [currentLot, idx, lots.length],
  )

  // ── Intro / generate ──
  if (lots.length === 0) {
    return (
      <View className='auction-hero'>
        <PhaseHeroCard
          phase='auction'
          title='脑洞拍卖会'
          prompt='虚拟币竞拍，仅供娱乐。主持人生成竞拍条目后，大家按轮出价。'
          statusText={isHost ? '生成竞拍条目后开拍' : '等待主持人生成竞拍条目…'}
          actions={
            isHost ? (
              <Button
                variant='primary'
                onClick={onGenerateLots}
                disabled={isGeneratingLots}
                loading={isGeneratingLots}
              >
                {isGeneratingLots ? '生成中…' : '生成竞拍条目'}
              </Button>
            ) : undefined
          }
        />
      </View>
    )
  }

  // ── All closed ──
  if (allClosed) {
    return (
      <View className='auction-hero'>
        <CelebrationOverlay
          visible={showSold}
          frameKey='auction_sold'
          title='拍卖圆满结束'
          subtitle='所有竞拍条目均已成交'
          autoDismissMs={3000}
          onDismiss={() => setShowSold(false)}
        />
        <PhaseHeroCard
          phase='auction'
          title='拍卖结束'
          prompt='全部竞拍已完成。'
          statusText='本环节已完成'
          doneCount={lots.length}
          totalCount={lots.length}
          actions={
            isHost ? (
              <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
                {isAdvancing ? '切换中…' : '进入下一阶段 ›'}
              </Button>
            ) : undefined
          }
        />
      </View>
    )
  }

  return (
    <View className='auction-hero'>
      {showWinBurst && (
        <View className='auction-hero__burst'>
          <ParticleBurst trigger={showWinBurst} type='coins' count={45} />
        </View>
      )}

      {outbidNotice ? (
        <View className='auction-hero__outbid'>
          <Text className='auction-hero__outbid-text'>{outbidNotice}</Text>
        </View>
      ) : null}

      {/* Signature wow: hammer stamp on lot close */}
      <CelebrationOverlay
        visible={showLotSold}
        frameKey='auction_sold'
        title='成交！'
        subtitle={lastLotResult ? `${lastLotResult.name} 以 ${lastLotResult.amount} 币拍下` : '本标无人出价'}
        autoDismissMs={2000}
        onDismiss={() => setShowLotSold(false)}
      />

      <PhaseHeroCard
        phase='auction'
        title={currentLot?.title ?? '竞拍中'}
        statusChip={`第 ${idx + 1} / ${lots.length} 标`}
        statusText={
          timerExpired
            ? isHost
              ? '时间到，可以落槌了'
              : '时间到，等待主持人落槌…'
            : high
              ? `当前最高 ${high.amount} 币 · 你的余额 ${balance} 币`
              : `暂无出价 · 你的余额 ${balance} 币`
        }
        countdownText={timerExpired ? undefined : `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`}
        countdownUrgent={timerUrgent}
        actions={
          <>
            {!isHost && !timerExpired ? (
              <View className='auction-hero__bid-zone'>
                <View className='auction-hero__quick-bids'>
                  <Button
                    variant='secondary'
                    onClick={() => handleQuickBid((high?.amount ?? 0) + 5)}
                    disabled={!canBid || isPlacingBid || balance < (high?.amount ?? 0) + 5}
                  >
                    +5
                  </Button>
                  <Button
                    variant='secondary'
                    onClick={() => handleQuickBid((high?.amount ?? 0) + 10)}
                    disabled={!canBid || isPlacingBid || balance < (high?.amount ?? 0) + 10}
                  >
                    +10
                  </Button>
                  <Button
                    variant='secondary'
                    onClick={() => handleQuickBid(balance)}
                    disabled={!canBid || isPlacingBid || balance <= (high?.amount ?? 0)}
                  >
                    ALL IN
                  </Button>
                </View>
                <Input
                  type='number'
                  className='auction-hero__input'
                  value={bidText}
                  onInput={(e) => setBidText(e.detail.value)}
                  placeholder={`最低出价 ${minBid}`}
                />
                {bidError ? <Text className='auction-hero__error'>{bidError}</Text> : null}
                <Button
                  variant='primary'
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
                    haptics('medium')
                    onPlaceBid(n)
                  }}
                  disabled={isPlacingBid || timerExpired}
                  loading={isPlacingBid}
                >
                  {isPlacingBid ? '提交中…' : '出价'}
                </Button>
              </View>
            ) : null}
            {isHost ? (
              <Button
                variant='secondary'
                onClick={onCloseLot}
                disabled={isClosingLot}
                loading={isClosingLot}
              >
                {isClosingLot ? '处理中…' : timerExpired ? '时间到，落槌' : '关闭本标（落槌）'}
              </Button>
            ) : null}
          </>
        }
      >
        {/* Lot flip reveal */}
        <View className='auction-hero__lot-wrap'>
          <CardFlip front={<LotFront />} back={<LotBack />} flipped={lotFlipped} duration={500} />
        </View>

        {high && (
          <View className='auction-hero__high-bidder'>
            <IdentityReveal
              revealed
              identity={`${nameOf(high.userId)} · ${high.amount}币`}
              label='当前领先'
              spotlightColor={PHASE_ACCENTS.auction?.accentDeep ?? '#8A651A'}
              tone='warm'
              warmAccent='rgba(201, 154, 60, 0.45)'
            />
          </View>
        )}

        <PhaseAigcRow meta={lotsMeta} reason='AI 生成竞拍条目' />

        {bidHistory.length > 0 && (
          <View className='auction-hero__history'>
            <Text className='auction-hero__history-title'>出价记录</Text>
            {bidHistory.slice(0, 6).map((bid, i) => (
              <View key={`${bid.userId}-${bid.amount}-${i}`} className='auction-hero__history-row'>
                <Text className='auction-hero__history-name'>{bid.displayName}</Text>
                <Text className='auction-hero__history-amount'>{bid.amount} 币</Text>
              </View>
            ))}
          </View>
        )}
      </PhaseHeroCard>
    </View>
  )
}
