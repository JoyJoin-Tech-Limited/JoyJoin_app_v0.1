import { View, Text } from '@tarojs/components'
import { useCallback, useMemo, useState } from 'react'
import type { MiniScriptPresentedEvidence } from '@shared/socialIcebreaker'
import type {
  MiniScriptCharacterPublic,
  MiniScriptEvidencePublic,
  MiniScriptStoryFrameworkPublic,
} from '@shared/miniscriptStoryFramework'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { haptics } from '../../../lib/utils/haptics'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { usePullToDismiss } from '../../../hooks/usePullToDismiss'
import {
  buildPresentedComboSet,
  countMyPresentsInAct,
  isReactionRevealed,
  pendingReactionEntries,
  presentedComboKey,
  resolveEvidenceIconEmoji,
  resolveRevealedEvidence,
} from './miniScriptV2Model'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

/** Per-act present budget (mirrors the server's PRESENT_BUDGET_EXCEEDED copy
 *  「每人每幕最多出示 2 次」 — keep in sync). */
const ACT_PRESENT_BUDGET = 2

/**
 * MiniScriptEvidenceTray (V2 P2, contract AC-08) — act sub-phase evidence
 * area. Renders only evidence from acts 1..currentAct; the parent hides the
 * whole tray when the framework has no evidence[] or the flag snapshot is
 * off. Present flow: tap evidence → pick a target role → POST
 * present-evidence → the presenter sees the reaction immediately with the
 * 「大声读出来！」 guidance; other members see it via polling once the
 * SERVER releases it (sanitizeStateForClient omits reactionText until the
 * server-side 8s window elapses or readConfirmedAt lands — V2 P3 contract;
 * the field's presence is the only reveal signal, never a device clock).
 * Presented combos are greyed out (server is idempotent on repeats).
 */
export function MiniScriptEvidenceTray({
  framework,
  currentAct,
  characters,
  presentedEvidence,
  currentUserId,
  isPresenting,
  presentingClosed,
  onPresent,
  onConfirmRead,
}: {
  framework: MiniScriptStoryFrameworkPublic
  currentAct: number
  characters: MiniScriptCharacterPublic[]
  presentedEvidence: MiniScriptPresentedEvidence[]
  currentUserId: string
  isPresenting: boolean
  /** True once the vote has opened (final act revealed): presenting is
   *  server-rejected with WRONG_SUB_PHASE from that point on, so the cards
   *  become review-only instead of offering a tap that always fails. */
  presentingClosed: boolean
  /** Returns the reaction text on success (presenter-immediate reveal). */
  onPresent: (evidenceId: string, targetRoleSlot: number) => Promise<string | null>
  /** V2 P3: presenter's 已读完 early release — POSTs confirm-read so every
   *  other member's next poll carries the reaction. Fire-and-forget; the
   *  action hook owns the error toast. */
  onConfirmRead?: (evidenceId: string, targetRoleSlot: number) => void
}) {
  const revealedItems = useMemo(
    () => resolveRevealedEvidence(framework, currentAct),
    [framework, currentAct],
  )
  const presentedCombos = useMemo(() => buildPresentedComboSet(presentedEvidence), [presentedEvidence])
  const myActPresentCount = useMemo(
    () => countMyPresentsInAct(presentedEvidence, currentUserId, currentAct),
    [presentedEvidence, currentUserId, currentAct],
  )
  // N4: at full budget the cards become review-only — a tap would otherwise
  // open the picker into a guaranteed PRESENT_BUDGET_EXCEEDED failure.
  const budgetExhausted = !presentingClosed && myActPresentCount >= ACT_PRESENT_BUDGET

  // ── Present flow state ──
  const [pendingEvidence, setPendingEvidence] = useState<MiniScriptEvidencePublic | null>(null)
  const [targetSlot, setTargetSlot] = useState<number | null>(null)
  const [activeReaction, setActiveReaction] = useState<{
    evidenceId: string
    targetRoleSlot: number
    reactionText: string
  } | null>(null)

  // Swipe-down-to-dismiss on the picker's non-scroll chrome (drag handle +
  // title) — the shared info-overlay-family gesture (N1).
  const closePicker = useCallback(() => setPendingEvidence(null), [])
  const pullToDismiss = usePullToDismiss(closePicker)

  // Swipe-back safety: the picker/reaction card must not survive the WeChat
  // page-stack hide/show cycle (REL-04).
  useResetOnShow((v: boolean) => {
    if (!v) {
      setPendingEvidence(null)
      setTargetSlot(null)
      setActiveReaction(null)
    }
  })

  // Server-gated visibility (V2 P3): the payload itself tells us which
  // reactions are revealed — entries whose reactionText is still omitted sit
  // behind the server gate and surface as one subtle pending line. No
  // client-side timer: polling + the server contract is sufficient.
  const visibleReactions = useMemo(
    () => presentedEvidence.filter(isReactionRevealed),
    [presentedEvidence],
  )
  const hasPendingReactions = useMemo(
    () => pendingReactionEntries(presentedEvidence).length > 0,
    [presentedEvidence],
  )

  const handleConfirmPresent = async () => {
    if (!pendingEvidence || targetSlot === null || isPresenting) return
    haptics('medium')
    const reactionText = await onPresent(pendingEvidence.id, targetSlot)
    if (reactionText) {
      setActiveReaction({
        evidenceId: pendingEvidence.id,
        targetRoleSlot: targetSlot,
        reactionText,
      })
      setPendingEvidence(null)
      setTargetSlot(null)
      haptics('success')
    }
    // Failure toasts are owned by the action hook (mapped per error code);
    // keep the picker open so the player can retry or pick another target.
  }

  const reactionTargetLabel = activeReaction
    ? characters.find((c) => c.slotIndex + 1 === activeReaction.targetRoleSlot)?.roleLabel ?? 'TA'
    : ''

  return (
    <View className='miniscript-evidence'>
      <View className='miniscript-hero__section'>
        <Text className='miniscript-hero__section-title'>本幕证物</Text>
        <Text className='miniscript-evidence__budget'>
          {presentingClosed
            ? '投票已开始，证物仅供回顾'
            : budgetExhausted
              ? '本幕出示次数已用完'
              : `你本幕已出示 ${myActPresentCount}/${ACT_PRESENT_BUDGET} 次`}
        </Text>

        {revealedItems.length === 0 ? (
          <Text className='miniscript-evidence__empty'>这一幕没有证物，继续聊聊线索吧。</Text>
        ) : (
          <View className='miniscript-evidence__list'>
            {revealedItems.map(({ evidence }) => (
              <View
                key={evidence.id}
                className={`miniscript-evidence__card${presentingClosed ? ' miniscript-evidence__card--closed' : ''}${budgetExhausted ? ' miniscript-evidence__card--exhausted' : ''}`}
                role={presentingClosed || budgetExhausted ? undefined : 'button'}
                aria-label={
                  presentingClosed || budgetExhausted
                    ? `证物：${evidence.name}${budgetExhausted ? '，本幕出示次数已用完' : ''}`
                    : `出示证物：${evidence.name}`
                }
                onClick={() => {
                  if (presentingClosed || budgetExhausted) return
                  haptics('light')
                  setPendingEvidence(evidence)
                  setTargetSlot(null)
                }}
              >
                <View className='miniscript-evidence__card-icon'>
                  <JoyJoinIcon emoji={resolveEvidenceIconEmoji(evidence.iconKey)} size={40} />
                </View>
                <View className='miniscript-evidence__card-body'>
                  <Text className='miniscript-evidence__card-name'>{evidence.name}</Text>
                  <Text className='miniscript-evidence__card-desc'>{evidence.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {visibleReactions.length > 0 ? (
          <View className='miniscript-evidence__reactions'>
            {visibleReactions.map((entry) => {
              const targetLabel =
                characters.find((c) => c.slotIndex + 1 === entry.targetRoleSlot)?.roleLabel ?? '一位角色'
              return (
                <View
                  key={`${entry.evidenceId}:${entry.targetRoleSlot}:${entry.presentedAt}`}
                  className='miniscript-evidence__reaction'
                >
                  <Text className='miniscript-evidence__reaction-target'>{targetLabel} 的反应</Text>
                  <Text className='miniscript-evidence__reaction-text'>「{entry.reactionText}」</Text>
                </View>
              )
            })}
          </View>
        ) : null}

        {hasPendingReactions ? (
          <View role='status' aria-live='polite'>
            <Text className='miniscript-evidence__pending'>有人正在出示证物…</Text>
          </View>
        ) : null}
      </View>

      {pendingEvidence ? (
        <View className='miniscript-evidence__picker-mask' catchMove onClick={closePicker}>
          <View
            className='miniscript-evidence__picker'
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <View
              className='miniscript-evidence__picker-handle'
              aria-hidden='true'
              onTouchStart={pullToDismiss.onTouchStart}
              onTouchEnd={pullToDismiss.onTouchEnd}
            />
            <View
              className='miniscript-evidence__picker-title-row'
              onTouchStart={pullToDismiss.onTouchStart}
              onTouchEnd={pullToDismiss.onTouchEnd}
            >
              <Text className='miniscript-evidence__picker-title'>把「{pendingEvidence.name}」出示给谁？</Text>
            </View>
            <View className='miniscript-hero__vote-chips'>
              {characters.map((role) => {
                const slot = role.slotIndex + 1
                const comboTaken = presentedCombos.has(presentedComboKey(pendingEvidence.id, slot))
                const selected = targetSlot === slot
                return (
                  <View
                    key={role.slotIndex}
                    className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}${comboTaken ? ' miniscript-evidence__chip--taken' : ''}`}
                    role='button'
                    aria-label={`${role.roleLabel}${comboTaken ? '，已出示过' : ''}`}
                    aria-pressed={selected}
                    aria-disabled={comboTaken}
                    onClick={() => {
                      if (comboTaken) return
                      haptics('light')
                      setTargetSlot(slot)
                    }}
                  >
                    <Text>{role.roleLabel}</Text>
                  </View>
                )
              })}
            </View>
            <Button
              variant='primary'
              onClick={() => void handleConfirmPresent()}
              disabled={isPresenting || targetSlot === null}
              loading={isPresenting}
            >
              {isPresenting ? '出示中…' : '出示给 TA'}
            </Button>
          </View>
        </View>
      ) : null}

      {activeReaction ? (
        <View className='miniscript-evidence__reveal-mask' catchMove>
          <View className='miniscript-evidence__reveal'>
            <Text className='miniscript-evidence__reveal-target'>{reactionTargetLabel} 的反应</Text>
            <Text className='miniscript-evidence__reveal-text'>「{activeReaction.reactionText}」</Text>
            <Text className='miniscript-evidence__reveal-guide'>大声读出来！大家都在听。</Text>
            <Button
              variant='primary'
              onClick={() => {
                haptics('light')
                // Early release: the confirm-read POST lands readConfirmedAt
                // server-side, so every other member's next poll carries the
                // reaction without waiting out the server-side 8s gate.
                onConfirmRead?.(activeReaction.evidenceId, activeReaction.targetRoleSlot)
                setActiveReaction(null)
              }}
            >
              已读完
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  )
}
