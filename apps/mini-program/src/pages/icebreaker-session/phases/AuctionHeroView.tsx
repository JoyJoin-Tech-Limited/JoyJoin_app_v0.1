import { View, Text, Input } from '@tarojs/components'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { haptics } from '../../../lib/utils/haptics'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import CardFlip from '../../../components/reveal/CardFlip'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseHeaderIcon } from '../phaseUtils'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import {
  resolveAuctionRoleControls,
  type AuctionPreviewRole,
} from '../viewModels/phaseProgressionModels'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

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
  isSingleTest?: boolean
  lotsMeta?: AIResponseMeta
}

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
  isSingleTest = false,
  lotsMeta,
}: AuctionHeroViewProps) {
  const [bidText, setBidText] = useState('10')
  const [bidError, setBidError] = useState('')
  const [showWinBurst, setShowWinBurst] = useState(false)
  const [outbidNotice, setOutbidNotice] = useState('')
  const [previewRole, setPreviewRole] = useState<AuctionPreviewRole>('host')

  const lots = session.auctionLots ?? []
  const idx = session.auctionCurrentLotIndex ?? 0
  const currentLot = lots[idx]
  const high = session.auctionHighBid
  const balance = session.auctionBalances?.[currentUserId] ?? 0
  const allClosed = session.auctionAllLotsClosed ?? false

  const prevAllClosedRef = useRef(false)
  const prevIdxRef = useRef(idx)
  const prevHighRef = useRef(session.auctionHighBid)
  const outbidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const winnerBurstTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const nameOf = useCallback(
    (uid: string) =>
      session.joinedParticipants?.find((p) => p.userId === uid)?.displayName ?? '匿名',
    [session.joinedParticipants],
  )

  const fireWinnerBurst = useCallback(() => {
    setShowWinBurst(true)
    if (winnerBurstTimerRef.current) clearTimeout(winnerBurstTimerRef.current)
    winnerBurstTimerRef.current = setTimeout(() => {
      setShowWinBurst(false)
      winnerBurstTimerRef.current = undefined
    }, 900)
  }, [])

  useEffect(() => () => {
    if (winnerBurstTimerRef.current) clearTimeout(winnerBurstTimerRef.current)
  }, [])

  // A lot closes only when the host acts. Show one short firework and remove
  // its canvas wrapper immediately afterwards.
  useEffect(() => {
    if (idx > prevIdxRef.current && prevIdxRef.current >= 0) {
      const prevHigh = prevHighRef.current
      if (prevHigh?.userId === currentUserId) fireWinnerBurst()
      setBidText('10')
      setBidError('')
    }
    prevIdxRef.current = idx
  }, [idx, currentUserId, fireWinnerBurst])

  // ── All-closed detection: the final lot's stamp fires here (no idx change) ──
  useEffect(() => {
    if (allClosed && !prevAllClosedRef.current) {
      const prevHigh = prevHighRef.current
      if (prevHigh?.userId === currentUserId) fireWinnerBurst()
    }
    prevAllClosedRef.current = allClosed
  }, [allClosed, currentUserId, fireWinnerBurst])

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

  const minBid = (high?.amount ?? 0) + 1
  const roleControls = resolveAuctionRoleControls({ isHost, isSingleTest, previewRole })
  const showBidControls = roleControls.canBid
  const canBid = balance >= minBid

  const roleSwitcher = isHost && isSingleTest ? (
    <View className='auction-hero__role-switch' aria-label='单人测试角色'>
      <Text className='auction-hero__role-label'>测试视角</Text>
      <View className='auction-hero__role-actions'>
        <Button
          variant={previewRole === 'host' ? 'primary' : 'secondary'}
          onClick={() => setPreviewRole('host')}
        >
          主持人
        </Button>
        <Button
          variant={previewRole === 'guest' ? 'primary' : 'secondary'}
          onClick={() => setPreviewRole('guest')}
        >
          参与者
        </Button>
      </View>
      <Text className='auction-hero__role-help'>
        {previewRole === 'host' ? '主持人负责生成拍品与落槌' : '参与者使用 100 枚虚拟币出价'}
      </Text>
    </View>
  ) : null

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
        {roleSwitcher}
        <PhaseHeroCard
          phase='auction'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-auction.webp')}
          title='脑洞拍卖会'
          prompt='虚拟币竞拍，仅供娱乐。主持人生成竞拍条目后，大家按轮出价。'
          statusText={roleControls.canHostControl ? '生成竞拍条目后开拍' : '等待主持人生成竞拍条目…'}
          actions={
            roleControls.canHostControl ? (
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
        {roleSwitcher}
        {showWinBurst ? (
          <View className='auction-hero__burst'>
            <ParticleBurst trigger type='confetti' count={24} />
          </View>
        ) : null}
        <PhaseHeroCard
          phase='auction'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-auction.webp')}
          title='拍卖结束'
          prompt='全部竞拍已完成。'
          statusText='本环节已完成'
          doneCount={lots.length}
          totalCount={lots.length}
          actions={
            roleControls.canHostControl ? (
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
      {roleSwitcher}
      {showWinBurst && (
        <View className='auction-hero__burst'>
          <ParticleBurst trigger type='confetti' count={24} />
        </View>
      )}

      {outbidNotice ? (
        <View className='auction-hero__outbid'>
          <Text className='auction-hero__outbid-text'>{outbidNotice}</Text>
        </View>
      ) : null}

      <PhaseHeroCard
        phase='auction'
        artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-auction.webp')}
        title={currentLot?.title ?? '竞拍中'}
        statusChip={`第 ${idx + 1} / ${lots.length} 标`}
        statusText={
          high
            ? `当前最高 ${high.amount} 币 · 你的余额 ${balance} 币`
            : `暂无出价 · 你的余额 ${balance} 币`
        }
        actions={
          <>
            {showBidControls ? (
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
                    全押
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
                  disabled={isPlacingBid}
                  loading={isPlacingBid}
                >
                  {isPlacingBid ? '提交中…' : '出价'}
                </Button>
              </View>
            ) : null}
            {roleControls.canHostControl ? (
              <Button
                variant='secondary'
                onClick={onCloseLot}
                disabled={isClosingLot}
                loading={isClosingLot}
              >
                {isClosingLot ? '处理中…' : '关闭本标（落槌）'}
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
            <Text className='auction-hero__high-bidder-label'>当前领先</Text>
            <Text className='auction-hero__high-bidder-value'>
              {nameOf(high.userId)} · {high.amount} 币
            </Text>
          </View>
        )}

        <PhaseAigcRow meta={lotsMeta} reason='AI 生成竞拍条目' />

        {bidHistory.length > 0 && (
          <View className='auction-hero__history'>
            <Text className='auction-hero__history-title'>出价记录</Text>
            {bidHistory.slice(0, 6).map((bid, i) => (
              <View key={`${bid.userId}-${bid.amount}-${i}`} className='auction-hero__history-row'>
                <Text className='auction-hero__history-name'>{bid.displayName}</Text>
                <Text className='auction-hero__history-amount'><Text className='auction-hero__numeral'>{bid.amount}</Text> 币</Text>
              </View>
            ))}
          </View>
        )}
      </PhaseHeroCard>
    </View>
  )
}
