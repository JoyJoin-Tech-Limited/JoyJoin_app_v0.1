import { RootPortal, View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { haptics, socialHaptics } from '../../../lib/utils/haptics'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import Button from '../../../components/ui/Button'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import ParticleBurst from '../../../components/reveal/ParticleBurst'
import CardFlip from '../../../components/reveal/CardFlip'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import WaitingBeat from '../components/WaitingBeat'
import { PhaseHeaderIcon } from '../phaseUtils'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import {
  resolveAuctionRoleControls,
  type AuctionPreviewRole,
} from '../viewModels/phaseProgressionModels'
import { useGeneratingLiveCopy } from '../hooks/useGeneratingLiveCopy'
import { AuctionFinaleView } from './AuctionFinaleView'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import {
  AUCTION_V2_ALL_IN_LABEL,
  AUCTION_V2_LOW_BALANCE_HINT,
  auctionV2CollectionHint,
  auctionV2HostAllInHint,
  auctionV2OutbidToast,
} from '../../../lib/copy/auctionV2'
import {
  ICE_AUCTION_CLOSE_LOT,
  formatIceAuctionLotPosition,
} from '@shared/copy/icebreakerSession'
import {
  AUCTION_COLLECTION_HINT_THRESHOLD,
  AuctionAllInOneShot,
  AuctionV2BeatCoordinator,
  buildAllInEventKey,
  buildOutbidEventKey,
  computeAuctionLadder,
  countLotsWonBy,
  readAuctionLotResults,
  resolveAllInCeremonyEffects,
  resolveAuctionBidInputMode,
  subscribeAuctionV2Beats,
  wasLastHighBidMine,
  type AuctionBidClientMeta,
} from '../viewModels/auctionV2Model'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

export interface AuctionBidRecordLocal {
  userId: string
  displayName: string
  amount: number
  at: number
  isAllIn?: boolean
}

interface AuctionHeroViewProps {
  session: SocialSessionState
  currentUserId: string
  isHost: boolean
  onGenerateLots: () => void
  onPlaceBid: (amount: number, meta?: AuctionBidClientMeta) => void
  onCloseLot: () => void
  onAdvance: () => void
  isAdvancing: boolean
  isGeneratingLots: boolean
  isPlacingBid: boolean
  isClosingLot: boolean
  isSingleTest?: boolean
  lotsMeta?: AIResponseMeta
  /** S1 haptic grammar flag — gates every V2 social-pattern firing. */
  hapticGrammarEnabled?: boolean
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
  hapticGrammarEnabled = false,
}: AuctionHeroViewProps) {
  const [bidText, setBidText] = useState('10')
  const [bidError, setBidError] = useState('')
  // P0 ② (2026-10-20): in-flight ladder echo — which tier this device just
  // tapped, so the ladder can spin that one tier and the card can show a
  // pending pill until the synced state lands. Cleared on settle.
  const [tappedTier, setTappedTier] = useState<{ tier: string; amount: number } | null>(null)
  const [showWinBurst, setShowWinBurst] = useState(false)
  const [outbidNotice, setOutbidNotice] = useState('')
  const [previewRole, setPreviewRole] = useState<AuctionPreviewRole>('host')
  // Wave 3 (AC-09): 落槌脉冲 — one shared victory pulse on the lot frame when
  // a hammer falls (lot advances OR the final lot closes), table-wide (the
  // winner-only ParticleBurst already covers the personal moment).
  const [hammerPulse, setHammerPulse] = useState(false)
  const hammerPulseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const lots = session.auctionLots ?? []
  const idx = session.auctionCurrentLotIndex ?? 0
  const currentLot = lots[idx]
  const high = session.auctionHighBid
  const balance = session.auctionBalances?.[currentUserId] ?? 0
  const allClosed = session.auctionAllLotsClosed ?? false

  // Wave 3 (AC-07): live 「悦仔正在准备拍品…」 copy while the server reports
  // the lots as generating (`auctionContentStatus`, flag-gated; absent →
  // null → the pre-Wave-3 static waiting copy renders unchanged).
  const generatingLiveCopy = useGeneratingLiveCopy('auction', session.auctionContentStatus)

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

  // Hammer pulse: table-wide, fires for everyone (winner burst stays
  // personal). 500ms matches the pulse ceiling, then the class lifts so the
  // next hammer can re-run the animation.
  const fireHammerPulse = useCallback(() => {
    setHammerPulse(true)
    if (hammerPulseTimerRef.current) clearTimeout(hammerPulseTimerRef.current)
    hammerPulseTimerRef.current = setTimeout(() => {
      setHammerPulse(false)
      hammerPulseTimerRef.current = undefined
    }, 500)
  }, [])

  useEffect(() => () => {
    if (winnerBurstTimerRef.current) clearTimeout(winnerBurstTimerRef.current)
    if (hammerPulseTimerRef.current) clearTimeout(hammerPulseTimerRef.current)
  }, [])

  // P0 ②: clear the tapped-tier echo when the bid settles — success is
  // already visible in the synced high-bid state; failure surfaces via the
  // existing error toast + immediate refetch (useSocialActions V2 path).
  const prevIsPlacingBidRef = useRef(isPlacingBid)
  useEffect(() => {
    if (prevIsPlacingBidRef.current && !isPlacingBid) {
      setTappedTier(null)
    }
    prevIsPlacingBidRef.current = isPlacingBid
  }, [isPlacingBid])

  // A lot closes only when the host acts. Show one short firework and remove
  // its canvas wrapper immediately afterwards.
  useEffect(() => {
    if (idx > prevIdxRef.current && prevIdxRef.current >= 0) {
      const prevHigh = prevHighRef.current
      if (prevHigh?.userId === currentUserId) fireWinnerBurst()
      fireHammerPulse()
      setBidText('10')
      setBidError('')
    }
    prevIdxRef.current = idx
  }, [idx, currentUserId, fireWinnerBurst, fireHammerPulse])

  // ── All-closed detection: the final lot's stamp fires here (no idx change) ──
  useEffect(() => {
    if (allClosed && !prevAllClosedRef.current) {
      const prevHigh = prevHighRef.current
      if (prevHigh?.userId === currentUserId) fireWinnerBurst()
      fireHammerPulse()
    }
    prevAllClosedRef.current = allClosed
  }, [allClosed, currentUserId, fireWinnerBurst, fireHammerPulse])

  // ── Auction V2 (Wave 2): snapshot-gated branch ─────────────────────────
  // When the server snapshotted `auctionV2Enabled` OFF/absent at auction
  // phase entry, `v2Enabled` is false and every branch below falls through
  // to today's V1 UI byte-for-byte.
  const v2Enabled = resolveAuctionBidInputMode(session) === 'ladder'
  const { shouldReduceMotion } = useMiniRevealMotion()
  const queryClient = useQueryClient()
  const lotResults = useMemo(() => readAuctionLotResults(session), [session])
  // Shared `AuctionHighBid.isAllIn` (contract AC-03) — undefined on V1 states.
  const highV2 = session.auctionHighBid
  const [showAllInBurst, setShowAllInBurst] = useState(false)
  const allInBurstTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionIdRef = useRef(session.socialSessionId)
  sessionIdRef.current = session.socialSessionId
  const icebreakerSessionIdRef = useRef(session.icebreakerSessionId)
  icebreakerSessionIdRef.current = session.icebreakerSessionId
  // Last-known high bid — the state-free self-check target for beat arrivals
  // ("was the last-known high bid mine?"; beats carry no targetUserId).
  const lastKnownHighRef = useRef(session.auctionHighBid)
  lastKnownHighRef.current = session.auctionHighBid
  const announcedOutbidKeyRef = useRef<string | null>(null)
  const allInOneShotRef = useRef<AuctionAllInOneShot | null>(null)
  if (allInOneShotRef.current === null) allInOneShotRef.current = new AuctionAllInOneShot()
  const beatCoordinatorRef = useRef<AuctionV2BeatCoordinator | null>(null)
  if (beatCoordinatorRef.current === null) {
    beatCoordinatorRef.current = new AuctionV2BeatCoordinator({
      onRefresh: () => {
        const sid = sessionIdRef.current
        if (sid) {
          void queryClient.invalidateQueries({
            queryKey: ['mini-program', 'social-icebreaker-session', sid],
          })
        }
      },
    })
  }

  // V2: react to rerouted auction beats (nudge = outbid, reveal = all-in).
  // The page's GroupBeatTracker already deduped nonces + owns the 6500ms
  // suppression window; this subscription only wires the view's reaction.
  useEffect(() => {
    if (!v2Enabled) return
    return subscribeAuctionV2Beats((pattern) => {
      const coordinator = beatCoordinatorRef.current
      if (!coordinator) return
      if (pattern === 'nudge') {
        const buzzNow = coordinator.handleOutbidBeat(
          wasLastHighBidMine(lastKnownHighRef.current, currentUserId),
        )
        if (buzzNow && hapticGrammarEnabled) socialHaptics('socialNudge')
      } else {
        const buzzNow = coordinator.handleAllInBeat()
        if (buzzNow && hapticGrammarEnabled) socialHaptics('socialReveal')
      }
    })
  }, [v2Enabled, currentUserId, hapticGrammarEnabled])

  // V2: coordinator + one-shot lifecycles (session rebind gets a fresh slate).
  useEffect(
    () => () => {
      beatCoordinatorRef.current?.dispose()
      if (allInBurstTimerRef.current) clearTimeout(allInBurstTimerRef.current)
    },
    [],
  )
  useEffect(() => {
    beatCoordinatorRef.current?.reset()
    allInOneShotRef.current?.reset()
    announcedOutbidKeyRef.current = null
  }, [session.socialSessionId])

  const fireAllInBurst = useCallback(() => {
    setShowAllInBurst(true)
    if (allInBurstTimerRef.current) clearTimeout(allInBurstTimerRef.current)
    allInBurstTimerRef.current = setTimeout(() => {
      setShowAllInBurst(false)
      allInBurstTimerRef.current = undefined
    }, 900)
  }, [])

  // V2: all-in ceremony — one-shot per all-in event (lotIndex+bidder+amount),
  // never re-fired by poll re-renders carrying the same state. RM → the
  // static seal badge renders anyway; zero particles.
  useEffect(() => {
    if (!v2Enabled || !highV2?.isAllIn) return
    const key = buildAllInEventKey({ lotIndex: idx, userId: highV2.userId, amount: highV2.amount })
    if (!allInOneShotRef.current?.consume(key)) return
    const fx = resolveAllInCeremonyEffects({
      reducedMotion: shouldReduceMotion,
      hapticGrammarEnabled,
      beatAlreadyBuzzed: beatCoordinatorRef.current?.consumeAllInBeatBuzzed() ?? false,
    })
    if (fx.fireHaptic) socialHaptics('socialReveal')
    if (fx.fireBurst) fireAllInBurst()
    socialIcebreakerAnalytics.track(
      'auction_all_in_fired',
      sessionIdRef.current || undefined,
      icebreakerSessionIdRef.current || undefined,
      'auction',
      { lotIndex: idx, amount: highV2.amount },
    )
  }, [v2Enabled, highV2?.isAllIn, highV2?.userId, highV2?.amount, idx, shouldReduceMotion, hapticGrammarEnabled, fireAllInBurst])

  // V2: bid ladder (D1) — pure view-model math; total-price labels.
  const ladder = useMemo(
    () =>
      v2Enabled
        ? computeAuctionLadder({
            high: high?.amount ?? 0,
            balance,
            ownEscrowedBid: high?.userId === currentUserId ? high.amount : 0,
          })
        : null,
    [v2Enabled, high?.amount, high?.userId, balance, currentUserId],
  )
  // V2: soft endgame hint (D5) — pure UI, never blocks bidding.
  const lotsWonByMe = useMemo(
    () => (v2Enabled ? countLotsWonBy(lotResults, currentUserId) : 0),
    [v2Enabled, lotResults, currentUserId],
  )

  // ── Outbid notification ──
  useEffect(() => {
    const prev = prevHighRef.current
    const curr = session.auctionHighBid
    if (prev && curr && prev.userId === currentUserId && curr.userId !== currentUserId) {
      if (v2Enabled) {
        // V2: exactly one announcement per outbid event across the two
        // channels (beat = acceleration, poll = truth). The beat path buzzed
        // at beat time; the poll path buzzes here.
        const key = buildOutbidEventKey({ lotIndex: idx, userId: curr.userId, amount: curr.amount })
        if (announcedOutbidKeyRef.current !== key) {
          announcedOutbidKeyRef.current = key
          const channel = beatCoordinatorRef.current?.consumeOutbidChannel() ?? 'poll'
          setOutbidNotice(auctionV2OutbidToast(nameOf(curr.userId), curr.amount))
          if (outbidTimerRef.current) clearTimeout(outbidTimerRef.current)
          outbidTimerRef.current = setTimeout(() => setOutbidNotice(''), 3000)
          if (channel === 'poll' && hapticGrammarEnabled) socialHaptics('socialNudge')
          socialIcebreakerAnalytics.track(
            'auction_outbid_notified',
            sessionIdRef.current || undefined,
            icebreakerSessionIdRef.current || undefined,
            'auction',
            { channel, lotIndex: idx },
          )
        }
      } else {
        setOutbidNotice(`被 ${nameOf(curr.userId)} 以 ${curr.amount} 币超价！`)
        if (outbidTimerRef.current) clearTimeout(outbidTimerRef.current)
        outbidTimerRef.current = setTimeout(() => setOutbidNotice(''), 3000)
      }
    }
    prevHighRef.current = curr
    return () => {
      if (outbidTimerRef.current) {
        clearTimeout(outbidTimerRef.current)
        outbidTimerRef.current = null
      }
    }
  }, [session.auctionHighBid, currentUserId, nameOf, v2Enabled, hapticGrammarEnabled, idx])

  const bidHistory: AuctionBidRecordLocal[] = useMemo(() => {
    const history = session.auctionBidHistory || []
    return history
      .filter((b) => b.lotIndex === idx)
      .map((b) => ({
        userId: b.userId,
        displayName: nameOf(b.userId),
        amount: b.amount,
        at: b.at,
        isAllIn: b.isAllIn === true,
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
        <Text className='auction-hero__lot-front-label'>{formatIceAuctionLotPosition(idx, lots.length)}</Text>
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
          statusText={generatingLiveCopy ?? (roleControls.canHostControl ? '生成竞拍条目后开拍' : '等待主持人生成竞拍条目…')}
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
        >
          {!roleControls.canHostControl ? <WaitingBeat variant='host' /> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── All closed ──
  if (allClosed) {
    // V2: two-act finale (awards reveal + table bill) replaces the static
    // 「拍卖结束」 card. Flag-OFF keeps today's card byte-for-byte below.
    if (v2Enabled) {
      return (
        <View className='auction-hero'>
          {roleSwitcher}
          {showWinBurst ? (
            <View className='auction-hero__burst'>
              <ParticleBurst trigger type='confetti' count={24} />
            </View>
          ) : null}
          <AuctionFinaleView
            session={session}
            currentUserId={currentUserId}
            canHostControl={roleControls.canHostControl}
            onAdvance={onAdvance}
            isAdvancing={isAdvancing}
          />
        </View>
      )
    }
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

  // 2026-10-19 Class A fix (auction bid dock): the bid controls are the
  // phase's page-level primary action, so they leave the card's action zone
  // for a RootPortal bottom dock (warmup dock precedent + dice AC-12
  // portal pattern). In-card placement let the CardFlip frame + art band push
  // the ladder below the first viewport on short screens.
  const hasBidDock = showBidControls || roleControls.canHostControl
  // Content reserve must match the dock's rendered height: the full dock
  // carries the ladder (or V1 controls) + host close; a host who cannot bid
  // gets the close button alone (close-only tier).
  const dockModifier = !hasBidDock
    ? ''
    : showBidControls
      ? ' auction-hero--bid-dock'
      : ' auction-hero--bid-dock-close-only'

  return (
    <View className={`auction-hero${dockModifier}`}>
      {roleSwitcher}
      {showWinBurst && (
        <View className='auction-hero__burst'>
          <ParticleBurst trigger type='confetti' count={24} />
        </View>
      )}
      {showAllInBurst && (
        <View className='auction-hero__burst'>
          <ParticleBurst trigger type='coins' count={24} />
        </View>
      )}

      {outbidNotice ? (
        <View className='auction-hero__outbid'>
          <Text className='auction-hero__outbid-text'>{outbidNotice}</Text>
        </View>
      ) : null}

      {/* Wave 3 (AC-09): the hammer pulse wraps the lot card — one shared
          victory pulse when a lot closes (class lifts after 500ms so the
          next hammer re-runs the animation). */}
      <View
        className={`auction-hero__pulse-frame${hammerPulse ? ' auction-hero__pulse-frame--go' : ''}`}
      >
      <PhaseHeroCard
        phase='auction'
        artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-auction.webp')}
        title={currentLot?.title ?? '竞拍中'}
        statusChip={formatIceAuctionLotPosition(idx, lots.length)}
        statusText={
          high
            ? `当前最高 ${high.amount} 币 · 你的余额 ${balance} 币`
            : `暂无出价 · 你的余额 ${balance} 币`
        }
      >
        {/* Lot flip reveal */}
        <View className='auction-hero__lot-wrap'>
          <CardFlip front={<LotFront />} back={<LotBack />} flipped={lotFlipped} duration={500} />
        </View>

        {high && (
          <View className='auction-hero__high-bidder'>
            <Text className='auction-hero__high-bidder-label'>当前领先</Text>
            {v2Enabled && highV2?.isAllIn ? (
              <View className='auction-hero__high-bidder-row'>
                <Text className='auction-hero__high-bidder-value'>
                  {nameOf(high.userId)} · {high.amount} 币
                </Text>
                <View className='auction-hero__allin-badge'>
                  <JoyJoinIcon emoji='🔥' tier='reaction' size={24} />
                  <Text className='auction-hero__allin-badge-text'>{AUCTION_V2_ALL_IN_LABEL}</Text>
                </View>
              </View>
            ) : (
              <Text className='auction-hero__high-bidder-value'>
                {nameOf(high.userId)} · {high.amount} 币
              </Text>
            )}
          </View>
        )}

        {/* P0 ②: in-flight echo under the leader line — replaced by the real
            high-bid state on success, removed on failure (toast + refetch
            already own that surface). */}
        {isPlacingBid && tappedTier ? (
          <View className='auction-hero__bid-pending'>
            <Text className='auction-hero__bid-pending-text'>我的 {tappedTier.amount} 币 · 出价中…</Text>
          </View>
        ) : null}

        <PhaseAigcRow meta={lotsMeta} reason='AI 生成竞拍条目' />

        {bidHistory.length > 0 && (
          <View className='auction-hero__history'>
            <Text className='auction-hero__history-title'>出价记录</Text>
            {bidHistory.slice(0, 6).map((bid, i) => (
              <View key={`${bid.userId}-${bid.amount}-${i}`} className='auction-hero__history-row'>
                <Text className='auction-hero__history-name'>{bid.displayName}</Text>
                <Text className='auction-hero__history-amount'><Text className='auction-hero__numeral'>{bid.amount}</Text> 币</Text>
                {v2Enabled && bid.isAllIn ? (
                  <Text className='auction-hero__history-allin'>{AUCTION_V2_ALL_IN_LABEL}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </PhaseHeroCard>
      </View>

      {/* Page-level bid dock (2026-10-19 Class A fix): the bid controls are
          the auction phase's primary action — they pin to the viewport bottom
          through RootPortal (the phase shell's entrance transform hijacks
          fixed descendants' containing block on device; dice AC-12 pattern).
          The card keeps the lot/leaderboard/history; the dock owns bidding. */}
      {hasBidDock ? (
        <RootPortal>
          <View className='auction-hero__bid-dock'>
            {showBidControls ? (
              v2Enabled && ladder ? (
                <View className='auction-hero__bid-zone'>
                  <View className='auction-hero__ladder'>
                    {ladder.tiers.map((tierState) => (
                      <Button
                        key={tierState.tier}
                        variant={tierState.tier === 'all_in' ? 'primary' : 'secondary'}
                        onClick={() => {
                          if (tierState.disabled || isPlacingBid) return
                          const placeBid = () => {
                            haptics('medium')
                            setTappedTier({ tier: tierState.tier, amount: tierState.amount })
                            onPlaceBid(tierState.amount, {
                              tier: tierState.tier,
                              lotIndex: idx,
                              isAllIn: tierState.tier === 'all_in',
                            })
                          }
                          // P0 补7 (2026-10-20): all-in is irreversible —
                          // confirm before the bid leaves the device. Every
                          // other tier stays one-tap.
                          if (tierState.tier === 'all_in') {
                            void Taro.showModal({
                              title: '全押确认',
                              content: `全押 ${tierState.amount} 币，不可撤回`,
                              confirmText: '全押',
                              cancelText: '再想想',
                            }).then((res) => {
                              if (res.confirm) placeBid()
                            })
                            return
                          }
                          placeBid()
                        }}
                        disabled={tierState.disabled || isPlacingBid}
                        loading={isPlacingBid && tappedTier?.tier === tierState.tier}
                      >
                        <View className='auction-hero__ladder-btn'>
                          <Text className='auction-hero__ladder-name'>{tierState.name}</Text>
                          <Text className='auction-hero__ladder-amount'>{tierState.label}</Text>
                        </View>
                      </Button>
                    ))}
                  </View>
                  {ladder.allTiersDisabled ? (
                    <Text className='auction-hero__ladder-low'>{AUCTION_V2_LOW_BALANCE_HINT}</Text>
                  ) : null}
                  {lotsWonByMe >= AUCTION_COLLECTION_HINT_THRESHOLD ? (
                    <Text className='auction-hero__ladder-hint'>
                      {auctionV2CollectionHint(lotsWonByMe)}
                    </Text>
                  ) : null}
                </View>
              ) : (
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
              )
            ) : null}
            {roleControls.canHostControl ? (
              <>
              <Button
                variant='secondary'
                onClick={onCloseLot}
                disabled={isClosingLot}
                loading={isClosingLot}
              >
                {isClosingLot ? '处理中…' : ICE_AUCTION_CLOSE_LOT}
              </Button>
              {v2Enabled && highV2?.isAllIn ? (
                <Text className='auction-hero__host-allin-hint'>
                  {auctionV2HostAllInHint(nameOf(highV2.userId))}
                </Text>
              ) : null}
              </>
            ) : null}
          </View>
        </RootPortal>
      ) : null}
    </View>
  )
}
