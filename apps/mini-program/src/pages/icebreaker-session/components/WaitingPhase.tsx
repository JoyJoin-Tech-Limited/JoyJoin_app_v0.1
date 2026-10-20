import { View, Text, Image } from '@tarojs/components'
import { useState } from 'react'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import { DEFAULT_EVENT_GROUP_SIZE } from '@shared/constants'
import type { VibeId } from '../../../lib/vibeMapping'
import { ICE_PHASE_MAP_ARROW, ICE_WAITING_FOR_HOST_LINE } from '@shared/copy/icebreakerSession'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import ArchetypeHead from '../../../components/mascot/ArchetypeHead'
import MissingArchetypePlaceholder from '../../../components/mascot/MissingArchetypePlaceholder'
import IcebreakerTierSelector from './IcebreakerTierSelector'
import WaitingBeat from './WaitingBeat'
import { GLANCE_L1_WORD_WAITING } from '../viewModels/glanceStackModel'
import { getApproxPhaseDurationLabel } from '../viewModels/phaseDurationModel'
import type { SessionParticipant } from '../phaseUtils'

export interface WaitingPhaseProps {
  playerCount: number
  hostName?: string
  isHost: boolean
  currentTier: TierMachineId
  currentVibe?: VibeId
  canChangeTier: boolean
  onChangeTier: () => void
  onAdvance: () => void
  /** S3 glance-stack pilot (flag-gated): L1 word「等人齐」+ sequenced 悦仔
   *  cameo; count/host line demotes to a hairline fragment. */
  glanceMode?: boolean
  /** Wave 2 (AC-13): roster for the table avatar strip. */
  participants?: SessionParticipant[]
  currentUserId?: string
  /** Wave 2 (AC-02/13): tonight's phase sequence preview (same data source
   *  as the shell's map/chip). */
  phaseMapItems?: Array<{ key: string; label: string; current: boolean }> | null
  /** Full-table seat count for the 满员 copy branch (defaults to the
   *  product-wide 6-seat table, DEFAULT_EVENT_GROUP_SIZE.max). */
  playerCapacity?: number
}

export default function WaitingPhase({
  playerCount,
  hostName,
  isHost,
  currentTier,
  currentVibe,
  canChangeTier,
  onChangeTier,
  onAdvance,
  glanceMode = false,
  participants = [],
  currentUserId,
  phaseMapItems = null,
  playerCapacity = DEFAULT_EVENT_GROUP_SIZE.max,
}: WaitingPhaseProps) {
  const [cameoFailed, setCameoFailed] = useState(false)
  // AC-13 满员分支: at a full table the legacy 「等待更多玩家加入…」 headline is
  // factually wrong — the wait is for the host's opening, not for more joins.
  const isFullTable = playerCount >= playerCapacity
  const waitingTitle = isFullTable
    ? isHost
      ? '人齐了，可以开场啦'
      : '人齐了，等主持人开场'
    : '等待更多玩家加入…'
  // S3 glance treatment (spec §1.1 row 1): one L1 word + the waiting cameo.
  // The tier selector (host tool) and start CTA (ACT) stay pinned (§4.2).
  if (glanceMode) {
    return (
      <View className='icebreaker__waiting'>
        <View className='icebreaker__waiting-l1'>
          <Image
            src={cameoFailed ? localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp') : getXiaoyueExpressionAsset('matchWaiting')}
            mode='aspectFit'
            lazyLoad
            className='icebreaker__waiting-cameo'
            onError={() => setCameoFailed(true)}
          />
          <Text className='icebreaker__waiting-l1-word'>{GLANCE_L1_WORD_WAITING}</Text>
          <Text className='icebreaker__waiting-l3'>
            {`当前 ${playerCount} 人已加入${hostName ? ` · 主持人：${hostName}` : ''}`}
          </Text>
        </View>
        <View className='icebreaker__waiting-tier'>
          <IcebreakerTierSelector
            currentTier={currentTier}
            currentVibe={currentVibe}
            isHost={isHost}
            canChange={canChangeTier}
            disabledHint='热身已开始，模式不可更换'
            onChangeRequest={onChangeTier}
          />
        </View>
        {isHost && (
          <Button variant='primary' className='icebreaker__start-btn' onClick={onAdvance}>
            开始破冰
          </Button>
        )}
      </View>
    )
  }

  return (
    <View className='icebreaker__waiting'>
      <Card className='icebreaker__waiting-card'>
        <WaitingBeat variant='join' />
        <Text className='icebreaker__waiting-title'>{waitingTitle}</Text>
        <Text className='icebreaker__waiting-count'>
          当前 {playerCount} 人已加入
        </Text>
        {hostName && (
          <Text className='icebreaker__waiting-host'>
            主持人：{hostName}
          </Text>
        )}

        {/* AC-13 — table roster strip: at a 6-seat table, seeing WHO is
            already seated is the strongest 安心 signal while waiting. */}
        {participants.length > 0 && (
          <View className='icebreaker__waiting-roster' aria-label='同桌伙伴'>
            {participants.map((participant) => {
              const isSelf = participant.userId === currentUserId
              return (
                <View
                  key={participant.userId}
                  className={`icebreaker__waiting-roster-item${
                    isSelf ? ' icebreaker__waiting-roster-item--self' : ''
                  }`}
                >
                  {participant.archetype ? (
                    <ArchetypeHead
                      archetype={participant.archetype}
                      size={64}
                      className='icebreaker__waiting-roster-avatar'
                    />
                  ) : (
                    <MissingArchetypePlaceholder
                      size={64}
                      className='icebreaker__waiting-roster-avatar'
                    />
                  )}
                  <Text className='icebreaker__waiting-roster-name'>
                    {isSelf ? '你' : participant.displayName ?? '伙伴'}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* AC-13 + AC-02 素材复用 — tonight's phase sequence preview. The
            shell strip carries the same data up top; the in-card chain is the
            reading-size version inside the waiting card.
            P2 #4 (2026-10-20): each phase name carries its 「约N分钟」
            expectation (compiled runPlan first, static sources as fallback;
            always approximate — never a countdown). */}
        {phaseMapItems && phaseMapItems.length > 0 && (
          <View className='icebreaker__waiting-phases' aria-label='今晚的环节顺序'>
            <Text className='icebreaker__waiting-phases-title'>今晚的环节</Text>
            <View className='icebreaker__waiting-phases-chain'>
              {phaseMapItems.map((item, index) => {
                // Snapshot-first (compiled runPlan); the tier prop is the
                // static fallback for standalone renders / pre-poll frames.
                const durationLabel = getApproxPhaseDurationLabel(item.key, {
                  eventTier: currentTier,
                })
                return (
                  <Text
                    key={item.key}
                    className={`icebreaker__waiting-phase${
                      item.current ? ' icebreaker__waiting-phase--current' : ''
                    }`}
                  >
                    {index > 0 ? (
                      <Text className='icebreaker__waiting-phase-arrow' aria-hidden='true'>
                        {` ${ICE_PHASE_MAP_ARROW} `}
                      </Text>
                    ) : null}
                    {item.label}
                    {durationLabel ? (
                      <Text className='icebreaker__waiting-phase-min'>{` ${durationLabel}`}</Text>
                    ) : null}
                  </Text>
                )
              })}
            </View>
          </View>
        )}

        {/* AC-13 — explicit 「等主持人开场」 line for players; the host already
            owns the start CTA below, so the hint is player-only. */}
        {!isHost && (
          <Text className='icebreaker__waiting-host-hint'>{ICE_WAITING_FOR_HOST_LINE}</Text>
        )}

        <View className='icebreaker__waiting-tier'>
          <IcebreakerTierSelector
            currentTier={currentTier}
            currentVibe={currentVibe}
            isHost={isHost}
            canChange={canChangeTier}
            disabledHint='热身已开始，模式不可更换'
            onChangeRequest={onChangeTier}
          />
        </View>
      </Card>
      {isHost && (
        <Button variant='primary' className='icebreaker__start-btn' onClick={onAdvance}>
          开始破冰
        </Button>
      )}
    </View>
  )
}
