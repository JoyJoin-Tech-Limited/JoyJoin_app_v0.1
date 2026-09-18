import { View, Text } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import Button from '../../../components/ui/Button'
import CardFlip from '../../../components/reveal/CardFlip'
import TapRhythm from '../../../components/gesture/TapRhythm'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import { haptics } from '../../../lib/utils/haptics'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { PhaseHeaderIcon } from '../phaseUtils'
import {
  buildAuctionBill,
  computeAuctionAwards,
  readAuctionLotResults,
  type AuctionAward,
  type AuctionAwardKind,
} from '../viewModels/auctionV2Model'
import {
  AUCTION_V2_FINALE_APPLAUSE_HINT,
  AUCTION_V2_FINALE_BILL_TITLE,
  AUCTION_V2_FINALE_ME_SUFFIX,
  AUCTION_V2_FINALE_NO_WINS,
  AUCTION_V2_FINALE_REVEAL_ALL,
  AUCTION_V2_FINALE_SUBTITLE,
  AUCTION_V2_FINALE_TAP_TO_REVEAL,
  AUCTION_V2_FINALE_TITLE,
  auctionV2FinaleRemainingCoins,
} from '../../../lib/copy/auctionV2'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

export interface AuctionFinaleViewProps {
  session: SocialSessionState
  currentUserId: string
  /** Host (or single-test host preview) drives the award-reveal ceremony and
   *  the advance button; participants are view-only + local applause. */
  canHostControl: boolean
  onAdvance: () => void
  isAdvancing: boolean
}

/**
 * AuctionFinaleView — Wave 2 (D4) two-act settlement that replaces the
 * static 「拍卖结束」 card when the session's `auctionV2Enabled` snapshot is
 * ON and `auctionAllLotsClosed` is true.
 *
 * Act 1: award cards (今晚最敢花 / 捡漏王 / 全场最热 / 最稳的手 — computed
 * deterministically in the view-model, zero LLM). The host taps to reveal
 * each card via the IdentityReveal idiom (CardFlip flip; reduced-motion →
 * instant fade). Reveal state is deliberately host-local: there is no server
 * channel for it, so participant clients render the cards revealed and stay
 * view-only (plus an optional local-only TapRhythm applause).
 *
 * Act 2: the per-player bill — session-ephemeral, sorted in-room, NEVER
 * persisted to any profile.
 *
 * Advance out of the phase stays host-only behind the unchanged
 * `auctionAllLotsClosed` server guard (same wiring as V1).
 */
export function AuctionFinaleView({
  session,
  currentUserId,
  canHostControl,
  onAdvance,
  isAdvancing,
}: AuctionFinaleViewProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const results = useMemo(() => readAuctionLotResults(session), [session])
  const balances = session.auctionBalances ?? {}
  // Bidders = roster minus host (hosts never bid — resolveAuctionRoleControls
  // canon); drives 最稳的手 and the bill.
  const bidders = useMemo(
    () =>
      (session.joinedParticipants ?? [])
        .filter((p) => p.userId !== session.hostUserId)
        .map((p) => ({ userId: p.userId, displayName: p.displayName })),
    [session.joinedParticipants, session.hostUserId],
  )
  const awards = useMemo(
    () => computeAuctionAwards({ results, bidders, balances }),
    [results, bidders, balances],
  )
  const bill = useMemo(
    () => buildAuctionBill({ results, bidders, balances }),
    [results, bidders, balances],
  )

  const [revealedByHost, setRevealedByHost] = useState<readonly AuctionAwardKind[]>([])
  const finaleTrackedRef = useRef(false)

  // AC-14: one impression per finale entry.
  useEffect(() => {
    if (finaleTrackedRef.current) return
    finaleTrackedRef.current = true
    socialIcebreakerAnalytics.track(
      'auction_finale_viewed',
      session.socialSessionId,
      session.icebreakerSessionId,
      'auction',
      {
        lotCount: results.length,
        soldCount: results.filter((r) => r.winnerUserId !== null).length,
      },
    )
  }, [session.socialSessionId, session.icebreakerSessionId, results])

  const revealAward = (kind: AuctionAwardKind) => {
    if (!canHostControl || revealedByHost.includes(kind)) return
    haptics('medium')
    setRevealedByHost((prev) => [...prev, kind])
    socialIcebreakerAnalytics.track(
      'auction_award_revealed',
      session.socialSessionId,
      session.icebreakerSessionId,
      'auction',
      { award: kind },
    )
  }

  // Host shortcut: flip every remaining card in one tap (spec R-F guard —
  // the ceremony can never stretch the phase past its time budget).
  const revealAllAwards = () => {
    if (!canHostControl) return
    haptics('medium')
    const remaining = awards.filter((a) => !revealedByHost.includes(a.kind))
    setRevealedByHost(awards.map((a) => a.kind))
    for (const award of remaining) {
      socialIcebreakerAnalytics.track(
        'auction_award_revealed',
        session.socialSessionId,
        session.icebreakerSessionId,
        'auction',
        { award: award.kind },
      )
    }
  }

  // Participants render every card revealed (view-only); the tap-to-reveal
  // ceremony is the host's local pacing aid.
  const isRevealed = (kind: AuctionAwardKind) => !canHostControl || revealedByHost.includes(kind)
  const allRevealed = awards.length > 0 && awards.every((a) => isRevealed(a.kind))

  const renderAwardFront = (award: AuctionAward) => (
    <View className='auction-finale__award-front'>
      <JoyJoinIcon emoji='🎁' tier='achievement' size={40} />
      <Text className='auction-finale__award-front-title'>{award.title}</Text>
      <Text className='auction-finale__award-front-hint'>{AUCTION_V2_FINALE_TAP_TO_REVEAL}</Text>
    </View>
  )

  const renderAwardBack = (award: AuctionAward) => (
    <View className='auction-finale__award-back'>
      <Text className='auction-finale__award-title'>{award.title}</Text>
      <Text className='auction-finale__award-headline'>{award.headline}</Text>
      <Text className='auction-finale__award-detail'>{award.detail}</Text>
    </View>
  )

  return (
    <View className='auction-finale'>
      <View className='auction-finale__hero'>
        <View className='auction-finale__hero-icon'>
          <PhaseHeaderIcon phase='auction' size={64} />
        </View>
        <Text className='auction-finale__hero-title'>{AUCTION_V2_FINALE_TITLE}</Text>
        <Text className='auction-finale__hero-sub'>{AUCTION_V2_FINALE_SUBTITLE}</Text>
      </View>

      {awards.length > 0 ? (
        <View className='auction-finale__awards'>
          {awards.map((award) => (
            <View key={award.kind} className='auction-finale__award'>
              <CardFlip
                front={renderAwardFront(award)}
                back={renderAwardBack(award)}
                flipped={isRevealed(award.kind)}
                onFlip={() => revealAward(award.kind)}
                duration={400}
                reducedMotion={shouldReduceMotion}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View className='auction-finale__bill'>
        <Text className='auction-finale__bill-title'>{AUCTION_V2_FINALE_BILL_TITLE}</Text>
        {bill.map((row) => (
          <View key={row.userId} className='auction-finale__bill-row'>
            <Text className='auction-finale__bill-name'>
              {row.displayName}
              {row.userId === currentUserId ? AUCTION_V2_FINALE_ME_SUFFIX : ''}
            </Text>
            <Text className='auction-finale__bill-lots'>
              {row.wonTitles.length > 0 ? row.wonTitles.join('、') : AUCTION_V2_FINALE_NO_WINS}
            </Text>
            <Text className='auction-finale__bill-coins'>
              {auctionV2FinaleRemainingCoins(row.remainingCoins)}
            </Text>
          </View>
        ))}
      </View>

      {canHostControl ? (
        <View className='auction-finale__actions'>
          {awards.length > 0 && !allRevealed ? (
            <Button variant='secondary' onClick={revealAllAwards}>
              {AUCTION_V2_FINALE_REVEAL_ALL}
            </Button>
          ) : null}
          <Button
            variant='primary'
            onClick={onAdvance}
            disabled={isAdvancing}
            loading={isAdvancing}
          >
            {isAdvancing ? '切换中…' : '进入下一阶段 ›'}
          </Button>
        </View>
      ) : (
        <View className='auction-finale__applause'>
          <TapRhythm emoji='👏' tier='achievement' onTap={() => haptics('light')} />
          <Text className='auction-finale__applause-hint'>{AUCTION_V2_FINALE_APPLAUSE_HINT}</Text>
        </View>
      )}
    </View>
  )
}
