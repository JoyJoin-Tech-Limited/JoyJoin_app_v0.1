import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { type SocialSessionState } from '@shared/socialIcebreaker'
import {
  computeMiniScriptVoteProgress,
  resolveMiniScriptTitle,
  type MiniScriptVoteInput,
} from '@shared/miniscriptStoryFramework'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { haptics } from '../../../lib/utils/haptics'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { CardFlip, ParticleBurst } from '../../../components/reveal'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { TOAST_DEFAULT_MS } from '../../../lib/utils/uiConstants'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

// ── Display-text hygiene ────────────────────────────────────────────────────
// Legacy LLM content embedded snake_case machine tokens (genre keys like
// absurd_comedy) into premise/title/beats. The server strips them for new
// content; strip defensively here so old sessions never render raw keys.
function sanitizeDisplayText(text: string): string {
  return text
    .replace(/[A-Za-z]+(?:_[A-Za-z0-9]+)+/g, '')
    .replace(/（\s*[、，,；;：:\s]*）/g, '')
    .replace(/\(\s*[、，,；;：:\s]*\)/g, '')
    .replace(/[、，；]\s*(?=[、，；。])/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Older server data self-numbered clue texts (「线索 1：…」); the client owns
 *  numbering via render index, so strip any embedded prefix defensively. */
function stripCluePrefix(text: string): string {
  return sanitizeDisplayText(text.replace(/^线索\s*\d+\s*[:：]\s*/, ''))
}

// ── One spoken instruction per screen (static client mapping — works for LLM
// and curated content alike, no framework fields required) ──────────────────
const ACT_INSTRUCTIONS: Record<number, string> = {
  1: '每人用一句话介绍自己：你是谁、你当时看到了什么。',
  2: '互相问一个问题，找出谁的话对不上。',
  3: '自由聊几分钟：你觉得是谁？为什么？',
}
const FALLBACK_ACT_INSTRUCTION = '继续聊：把线索拼在一起。'

type MiniScriptSubPhase = 'empty' | 'preview' | 'role' | 'act' | 'vote' | 'truth'

function ProgressStepper({ labels, currentStep }: { labels: string[]; currentStep: number }) {
  return (
    <View className='miniscript-hero__stepper'>
      {labels.map((label, idx) => {
        const isActive = idx === currentStep
        const isPast = idx < currentStep
        return (
          <View key={label} className='miniscript-hero__stepper-item'>
            <View
              className={`miniscript-hero__stepper-dot${isActive ? ' miniscript-hero__stepper-dot--active' : ''}${isPast ? ' miniscript-hero__stepper-dot--past' : ''}`}
            />
            <Text
              className={`miniscript-hero__stepper-label${isActive ? ' miniscript-hero__stepper-label--active' : ''}`}
            >
              {label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export function MiniScriptHeroView({
  session,
  currentUserId,
  isHost,
  playerCount,
  onAssignRoles,
  onRevealAct,
  onVote,
  onRevealSolution,
  onAdvance,
  onReady,
  isAssigningRoles,
  isRevealingAct,
  isVoting,
  isRevealingSolution,
  isAdvancing,
  isSettingReady,
}: {
  session: SocialSessionState
  currentUserId: string
  isHost: boolean
  playerCount: number
  onAssignRoles: () => void
  onRevealAct: (targetAct: number) => void
  onVote: (vote: MiniScriptVoteInput) => void
  /** Fires the reveal-solution action; optional onError receives the raw action
   *  error (the hook suppresses its default toast when a handler is given). */
  onRevealSolution: (onError?: (error: unknown) => void) => void
  onAdvance: () => void
  onReady?: (ready: boolean) => void
  isAssigningRoles: boolean
  isRevealingAct: boolean
  isVoting: boolean
  isRevealingSolution: boolean
  isAdvancing: boolean
  isSettingReady?: boolean
}) {
  const framework = session.miniScriptFramework
  const myRole = session.miniScriptPlayerRuntimeViews?.[currentUserId]
  const currentAct = session.miniScriptCurrentAct ?? 0
  const totalActs = framework?.act_flow.length ?? 0
  const solutionRevealed = session.miniScriptSolutionRevealed ?? false
  const revealedSolution = session.miniScriptRevealedSolution
  const myVote = session.miniScriptVotes?.find((v) => v.userId === currentUserId)
  const allVotes = session.miniScriptVotes ?? []
  const assignedPlayerIds = Object.keys(session.miniScriptRoleAssignments ?? {})
  const readyMap = session.miniScriptPlayerReady ?? {}
  const isReady = readyMap[currentUserId] ?? false
  const readyCount = Object.values(readyMap).filter(Boolean).length
  const deductionHints = session.miniScriptDeductionHints ?? []
  const revealedClues = session.miniScriptRevealedClues ?? []
  const allActsRevealed = totalActs > 0 && currentAct >= totalActs
  const currentActData = framework && currentAct > 0 ? framework.act_flow[currentAct - 1] : undefined
  const characters = useMemo(
    () => [...(framework?.characters ?? [])].sort((a, b) => a.slotIndex - b.slotIndex),
    [framework?.characters],
  )

  const premiseText = framework ? sanitizeDisplayText(framework.premise) : ''
  const scriptTitle = framework
    ? sanitizeDisplayText(resolveMiniScriptTitle(framework.title, premiseText))
    : ''
  const playMinutes = framework?.gameModeConfig?.targetPlayMinutes ?? 25
  const voteOptions = framework?.voteOptions

  // Vote progress is recomputed server-side on every poll (Wave-1). The shared
  // pure function is the exact fallback for older snapshots so quorum /
  // canReveal never fork between client and server.
  const voteProgress = session.miniScriptVoteProgress ?? computeMiniScriptVoteProgress({
    votes: allVotes,
    totalAssigned: assignedPlayerIds.length,
    voteOpenedAt: session.miniScriptVoteOpenedAt,
  })
  const votesRemaining = Math.max(0, voteProgress.quorum - voteProgress.votedCount)

  // ── Local UI state ──
  const [roleFlipped, setRoleFlipped] = useState(false)
  const [showFullScript, setShowFullScript] = useState(false)
  const [showPremise, setShowPremise] = useState(false)
  const [roleExpanded, setRoleExpanded] = useState(false)
  const [showBeats, setShowBeats] = useState(false)
  const [showAllClues, setShowAllClues] = useState(false)
  const [showDeductionHints, setShowDeductionHints] = useState(false)
  // Final act and the consensus vote are two screens client-side (the server
  // opens the vote when the last act lands): the act view gets its 自由聊 beat,
  // then 去投票 › moves everyone to the ballot. Local-only — no server state.
  const [finalActSubView, setFinalActSubView] = useState<'act' | 'vote'>('act')
  const [burstTrigger, setBurstTrigger] = useState(false)
  const [confessFlipped, setConfessFlipped] = useState(false)

  // Swipe-back safety: transient disclosure/reveal flags must not survive the
  // WeChat page-stack hide/show cycle, or the user re-enters with cards already
  // flipped and sections already expanded.
  useResetOnShow(
    setRoleFlipped,
    setConfessFlipped,
    setShowFullScript,
    setShowPremise,
    setRoleExpanded,
    setShowBeats,
    setShowAllClues,
    setShowDeductionHints,
  )
  useDidShow(() => setFinalActSubView('act'))

  // Vote form
  const [voteEditing, setVoteEditing] = useState(!myVote)
  const [suspectSlot, setSuspectSlot] = useState<number | null>(myVote?.suspectRoleSlot ?? null)
  const [voteWhat, setVoteWhat] = useState(myVote?.what ?? '')
  const [voteWhy, setVoteWhy] = useState(myVote?.why ?? '')
  const [voteReason, setVoteReason] = useState(myVote?.why ?? myVote?.what ?? '')
  const wasVotingRef = useRef(isVoting)
  const submitSigRef = useRef<string | null>(null)

  // 新线索 diff: the badge set is the delta between the previous and current
  // revealed-clue id lists. It persists for the whole act (no 3s timer) and is
  // replaced when the next act lands, so only this act's fresh clues badge.
  const [newClueIds, setNewClueIds] = useState<string[]>([])
  const seenClueIdsRef = useRef<Set<string>>(new Set())
  const clueDiffReadyRef = useRef(false)

  useEffect(() => {
    const ids = revealedClues.map((c) => c.clueId)
    if (ids.length === 0) {
      // Session reset (single-test / re-run) — start the diff over.
      seenClueIdsRef.current = new Set()
      clueDiffReadyRef.current = false
      setNewClueIds([])
      return
    }
    if (!clueDiffReadyRef.current) {
      // First paint (mount / rejoin mid-phase): everything already revealed is
      // old news — never badge the whole wall after a rejoin.
      seenClueIdsRef.current = new Set(ids)
      clueDiffReadyRef.current = true
      return
    }
    const fresh = ids.filter((id) => !seenClueIdsRef.current.has(id))
    if (fresh.length > 0) {
      seenClueIdsRef.current = new Set(ids)
      setNewClueIds(fresh)
    }
  }, [revealedClues])

  // A new act always re-enters on the act view (its instruction + fresh clues
  // come first; the ballot waits behind 去投票 › on the final act).
  const prevCurrentActRef = useRef(currentAct)
  useEffect(() => {
    if (currentAct !== prevCurrentActRef.current) {
      prevCurrentActRef.current = currentAct
      setFinalActSubView('act')
    }
  }, [currentAct])

  useEffect(() => {
    if (solutionRevealed) {
      setBurstTrigger(true)
    }
  }, [solutionRevealed])

  // Collapse the vote form only once the poll confirms the ballot we actually
  // submitted (a failed submit keeps the form open for a retry).
  useEffect(() => {
    if (wasVotingRef.current && !isVoting && myVote && submitSigRef.current) {
      const sig = JSON.stringify([myVote.suspectRoleSlot ?? null, myVote.what ?? '', myVote.why ?? ''])
      if (sig === submitSigRef.current) {
        setVoteEditing(false)
        submitSigRef.current = null
      }
    }
    wasVotingRef.current = isVoting
  }, [isVoting, myVote])

  // External vote changes (e.g. voted on another device) reseed an idle form.
  useEffect(() => {
    if (!voteEditing && myVote) {
      setSuspectSlot(myVote.suspectRoleSlot ?? null)
      setVoteWhat(myVote.what ?? '')
      setVoteWhy(myVote.why ?? '')
      setVoteReason(myVote.why ?? myVote.what ?? '')
    }
  }, [myVote, voteEditing])

  // ── Sub-phase model ──
  const subPhase: MiniScriptSubPhase = !framework
    ? 'empty'
    : assignedPlayerIds.length === 0
      ? 'preview'
      : solutionRevealed
        ? 'truth'
        : currentAct === 0
          ? 'role'
          : allActsRevealed && finalActSubView === 'vote'
            ? 'vote'
            : 'act'

  // Stepper truthfulness: labels follow the framework's real act count, and the
  // active dot is derived from the same sub-phase the card renders — assign →
  // 角色, act N → 幕N, ballot → 投票, revealed → 真相.
  const stepLabels = useMemo(
    () => ['角色', ...Array.from({ length: totalActs }, (_, i) => `幕${i + 1}`), '投票', '真相'],
    [totalActs],
  )
  const currentStep = subPhase === 'truth'
    ? totalActs + 2
    : subPhase === 'vote'
      ? totalActs + 1
      : subPhase === 'act'
        ? currentAct
        : subPhase === 'role'
          ? 0
          : -1

  const identityLine = isHost ? '你是本场主持人 · 大家跟你节奏' : '跟着主持人走 · 有任务会叫你'
  const instruction = (() => {
    switch (subPhase) {
      case 'preview':
        return isHost ? `你是主持人：给大家发角色，带他们演 ${totalActs} 幕，最后一起猜真相。` : null
      case 'role':
        return '记住你的角色和秘密——先别告诉任何人。'
      case 'act':
        return ACT_INSTRUCTIONS[currentAct] ?? FALLBACK_ACT_INSTRUCTION
      case 'vote':
        return '点一个你最怀疑的角色。'
      case 'truth':
        return isHost ? '真相大白——请每位玩家认领自己的小秘密。' : '真相大白——轮到你了，就认领自己的小秘密。'
      default:
        return null
    }
  })()

  // ── Ready soft gate (host 揭开第一幕): the server stays permissive; a tap
  // with stragglers confirms first. The host never self-readies (no ready
  // button on the host view), so they are excluded from the expected count.
  const expectedReadyIds = assignedPlayerIds.filter((id) => id !== currentUserId)
  const notReadyCount = isHost
    ? Math.max(0, expectedReadyIds.length - expectedReadyIds.filter((id) => readyMap[id]).length)
    : 0

  const handleRevealFirstAct = () => {
    if (notReadyCount > 0) {
      Taro.showModal({
        title: '仍要开演？',
        content: `还有 ${notReadyCount} 人没翻开角色卡。`,
        confirmText: '开演',
        cancelText: '再等等',
        success: (res) => {
          if (res.confirm) {
            haptics('medium')
            onRevealAct(1)
          }
        },
      })
      return
    }
    haptics('medium')
    onRevealAct(1)
  }

  const handleRevealSolutionConfirm = () => {
    Taro.showModal({
      title: '确认揭晓真相',
      content: '揭晓后游戏将进入回顾阶段，所有人将看到最终答案。确定要继续吗？',
      confirmText: '揭晓',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          haptics('heavy')
          onRevealSolution()
        }
      },
    })
  }

  // The server is the reveal authority (quorum OR vote open ≥ 90s). When the
  // poll says not yet, the tap still fires — a stale poll may lag a just-met
  // quorum; a real refusal (400 WAITING_FOR_VOTES) toasts the remaining count
  // instead of dead-ending.
  const handleRevealSolutionTap = () => {
    if (voteProgress.canReveal) {
      handleRevealSolutionConfirm()
      return
    }
    haptics('light')
    onRevealSolution((error) => {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('WAITING_FOR_VOTES')) {
        void Taro.showToast({
          title: `还差 ${votesRemaining} 票，稍等就能揭晓`,
          icon: 'none',
          duration: TOAST_DEFAULT_MS,
        })
      } else {
        void Taro.showToast({ title: '操作没成功，再试试', icon: 'none', duration: TOAST_DEFAULT_MS })
      }
    })
  }

  const handleSubmitVote = () => {
    if (suspectSlot === null) return
    haptics('success')
    const vote: MiniScriptVoteInput = { suspectRoleSlot: suspectSlot }
    if (voteOptions) {
      if (voteWhat) vote.what = voteWhat
      if (voteWhy) vote.why = voteWhy
    } else if (voteReason.trim()) {
      vote.why = voteReason.trim()
    }
    submitSigRef.current = JSON.stringify([vote.suspectRoleSlot ?? null, vote.what ?? '', vote.why ?? ''])
    onVote(vote)
  }

  // ── Hero card props per sub-phase ──
  const heroTitle = subPhase === 'empty'
    ? '剧本尚未生成'
    : subPhase === 'preview'
      ? scriptTitle
      : subPhase === 'role'
        ? '你的角色'
        : subPhase === 'act'
          ? currentActData
            ? `第 ${currentAct} 幕 · ${sanitizeDisplayText(currentActData.title)}`
            : `第 ${currentAct} 幕`
          : subPhase === 'vote'
            ? '投票时间'
            : '真相大白'

  const heroPrompt = subPhase === 'empty'
    ? (isHost ? '点击上方「迷你剧本杀」配置风格与题材，生成你们的剧本。' : '请等待主持人生成剧本…')
    : subPhase === 'preview' && !isHost
      ? '剧本已生成，等待主持人分配角色。'
      : undefined

  const heroStatusText = subPhase === 'preview'
    ? (isHost ? '分配角色后开演' : '等待主持人分配角色…')
    : subPhase === 'role'
      ? (isHost ? `${readyCount}/${playerCount} 人已准备` : '看完角色卡后点准备')
      : subPhase === 'vote'
        ? `${voteProgress.votedCount}/${voteProgress.totalAssigned} 已投票`
        : subPhase === 'truth'
          ? '游戏结束'
          : undefined

  const heroDoneCount = subPhase === 'role'
    ? readyCount
    : subPhase === 'vote'
      ? voteProgress.votedCount
      : subPhase === 'truth'
        ? playerCount
        : undefined
  const heroTotalCount = subPhase === 'role'
    ? playerCount
    : subPhase === 'vote'
      ? voteProgress.totalAssigned
      : subPhase === 'truth'
        ? playerCount
        : undefined

  const heroActions = (() => {
    switch (subPhase) {
      case 'preview':
        return isHost ? (
          <Button
            variant='primary'
            onClick={() => {
              haptics('cardReveal')
              onAssignRoles()
            }}
            disabled={isAssigningRoles}
            loading={isAssigningRoles}
          >
            {isAssigningRoles ? '分配中…' : '分配角色'}
          </Button>
        ) : undefined
      case 'role':
        return (
          <>
            {!isHost && onReady ? (
              <Button
                variant={isReady ? 'secondary' : 'primary'}
                onClick={() => {
                  haptics('light')
                  onReady(!isReady)
                }}
                disabled={isSettingReady}
                loading={isSettingReady}
              >
                {isReady ? '已准备' : '准备好了'}
              </Button>
            ) : null}
            {isHost ? (
              <>
                <Button
                  variant='primary'
                  onClick={handleRevealFirstAct}
                  disabled={isRevealingAct}
                  loading={isRevealingAct}
                >
                  {isRevealingAct ? '解锁中…' : '揭开第一幕'}
                </Button>
                {notReadyCount > 0 ? (
                  <Text className='miniscript-hero__cta-caption'>还有 {notReadyCount} 人没翻开角色卡</Text>
                ) : null}
              </>
            ) : null}
          </>
        )
      case 'act':
        if (isHost && !allActsRevealed) {
          return (
            <Button
              variant='primary'
              onClick={() => {
                haptics('medium')
                onRevealAct(currentAct + 1)
              }}
              disabled={isRevealingAct}
              loading={isRevealingAct}
            >
              {isRevealingAct ? '解锁中…' : `揭开第 ${currentAct + 1} 幕`}
            </Button>
          )
        }
        if (allActsRevealed) {
          return (
            <Button
              variant='primary'
              onClick={() => {
                haptics('light')
                setFinalActSubView('vote')
              }}
            >
              去投票 ›
            </Button>
          )
        }
        return undefined
      case 'vote':
        return isHost ? (
          <>
            <Button
              variant='primary'
              onClick={handleRevealSolutionTap}
              disabled={isRevealingSolution}
              loading={isRevealingSolution}
            >
              {isRevealingSolution ? '揭晓中…' : '揭晓真相'}
            </Button>
            {!voteProgress.canReveal ? (
              <Text className='miniscript-hero__cta-caption'>还差 {votesRemaining} 票 · 90 秒后可强制揭晓</Text>
            ) : null}
          </>
        ) : undefined
      case 'truth':
        return isHost ? (
          <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
            {isAdvancing ? '切换中…' : '进入回顾 ›'}
          </Button>
        ) : undefined
      default:
        return undefined
    }
  })()

  // ── Sub-phase content blocks ──

  const previewContent = useMemo(
    () =>
      framework ? (
        <>
          <Text className='miniscript-hero__preview-premise'>{premiseText}</Text>
          <View className='miniscript-hero__preview-meta'>
            <Text className='miniscript-hero__preview-meta-item'>{characters.length} 角色</Text>
            <Text className='miniscript-hero__preview-meta-item'>{totalActs} 幕</Text>
            <Text className='miniscript-hero__preview-meta-item'>约 {playMinutes} 分钟</Text>
          </View>
          <View className='miniscript-hero__chips'>
            {characters.map((role) => (
              <Text key={role.slotIndex} className='miniscript-hero__chip'>{role.roleLabel}</Text>
            ))}
          </View>
          <View className='miniscript-hero__flow'>
            {stepLabels.map((label, idx) => (
              <Fragment key={label}>
                {idx > 0 ? <Text className='miniscript-hero__flow-arrow'>→</Text> : null}
                <Text className='miniscript-hero__flow-step'>{label}</Text>
              </Fragment>
            ))}
          </View>
          <View className='miniscript-hero__section'>
            <View
              className='miniscript-hero__section-header'
              onClick={() => setShowFullScript((v) => !v)}
              role='button'
              aria-expanded={showFullScript}
              aria-label='查看完整剧本'
            >
              <Text className='miniscript-hero__section-title'>查看完整剧本</Text>
              <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showFullScript ? '▼' : '▶'}</Text>
            </View>
            {showFullScript ? (
              <>
                <Text className='miniscript-hero__beat'>{premiseText}</Text>
                {framework.act_flow.map((act) => (
                  <View key={act.actNumber} className='miniscript-hero__script-act'>
                    <Text className='miniscript-hero__script-act-title'>
                      第 {act.actNumber} 幕 · {sanitizeDisplayText(act.title)}
                    </Text>
                    {act.beats.map((beat, index) => (
                      <Text key={index} className='miniscript-hero__beat'>· {sanitizeDisplayText(beat)}</Text>
                    ))}
                  </View>
                ))}
                <Text className='miniscript-hero__beat'>结局：{sanitizeDisplayText(framework.ending.resolutionSummary)}</Text>
              </>
            ) : null}
          </View>
        </>
      ) : null,
    [framework, premiseText, characters, totalActs, playMinutes, stepLabels, showFullScript],
  )

  const waitingContent = useMemo(
    () => (
      <View className='miniscript-hero__waiting'>
        <Image
          className='miniscript-hero__waiting-mascot'
          src={localAsset('/assets/mascot/xiaoyue-waiting.webp')}
          mode='aspectFit'
        />
        <Text className='miniscript-hero__waiting-text'>剧本已就位，等主持人发牌就能开场</Text>
      </View>
    ),
    [],
  )

  const roleContent = useMemo(
    () => (
      <>
        <View className='miniscript-hero__role-flip'>
          <CardFlip
            flipped={roleFlipped}
            onFlip={() => setRoleFlipped((f) => !f)}
            front={
              <View className='miniscript-hero__role-front'>
                <JoyJoinIcon emoji='🎭' size={64} />
                <Text className='miniscript-hero__role-front-label'>你的角色是？</Text>
                <Text className='miniscript-hero__role-front-hint'>轻触卡片揭晓</Text>
              </View>
            }
            back={
              <View className='miniscript-hero__role-back'>
                {myRole ? (
                  <>
                    <Text className='miniscript-hero__role-back-title'>{myRole.roleLabel}</Text>
                    <Text className='miniscript-hero__role-back-line'>{myRole.sinHook}</Text>
                    <Text className='miniscript-hero__role-back-line'>表面：{myRole.alibi}</Text>
                    {myRole.secretAgenda ? (
                      <>
                        <Text className='miniscript-hero__role-back-label'>你的秘密 · 先别告诉别人</Text>
                        <Text className='miniscript-hero__role-back-line miniscript-hero__role-back-line--secret'>
                          {myRole.secretAgenda}
                        </Text>
                      </>
                    ) : null}
                  </>
                ) : (
                  <Text className='miniscript-hero__role-back-line'>你尚未被分配角色。</Text>
                )}
              </View>
            }
          />
        </View>
        <View className='miniscript-hero__section'>
          <View
            className='miniscript-hero__section-header'
            onClick={() => setShowPremise((v) => !v)}
            role='button'
            aria-expanded={showPremise}
            aria-label='故事背景'
          >
            <Text className='miniscript-hero__section-title'>故事背景</Text>
            <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showPremise ? '▼' : '▶'}</Text>
          </View>
          {showPremise ? <Text className='miniscript-hero__beat'>{premiseText}</Text> : null}
        </View>
      </>
    ),
    [roleFlipped, myRole, premiseText, showPremise],
  )

  const newClues = useMemo(
    () => revealedClues.filter((c) => newClueIds.includes(c.clueId)),
    [revealedClues, newClueIds],
  )

  const actContent = useMemo(
    () => (
      <>
        {newClues.length > 0 ? (
          <View className='miniscript-hero__section miniscript-hero__section--new-clues'>
            <Text className='miniscript-hero__section-title'>本幕新线索</Text>
            {newClues.map((clue) => (
              <View key={clue.clueId} className='miniscript-hero__clue-focus'>
                <Text className='miniscript-hero__clue-focus-text'>{stripCluePrefix(clue.text)}</Text>
                <Text className='miniscript-hero__clue-new'>新线索</Text>
              </View>
            ))}
          </View>
        ) : null}

        {revealedClues.length > 0 ? (
          <View className='miniscript-hero__section'>
            <View
              className='miniscript-hero__section-header'
              onClick={() => setShowAllClues((v) => !v)}
              role='button'
              aria-expanded={showAllClues}
              aria-label='全部线索'
            >
              <Text className='miniscript-hero__section-title'>全部线索（{revealedClues.length}）</Text>
              <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showAllClues ? '▼' : '▶'}</Text>
            </View>
            {showAllClues
              ? revealedClues.map((clue, idx) => (
                  <View key={clue.clueId} className='miniscript-hero__clue'>
                    <Text className='miniscript-hero__clue-index'>线索 {idx + 1}</Text>
                    <Text className='miniscript-hero__clue-text'>{stripCluePrefix(clue.text)}</Text>
                  </View>
                ))
              : null}
          </View>
        ) : null}

        {myRole ? (
          <View className='miniscript-hero__section'>
            <View
              className='miniscript-hero__section-header'
              onClick={() => setRoleExpanded((v) => !v)}
              role='button'
              aria-expanded={roleExpanded}
              aria-label='我的角色详情'
            >
              <Text className='miniscript-hero__section-title'>我的角色 · {myRole.roleLabel}</Text>
              <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{roleExpanded ? '▼' : '▶'}</Text>
            </View>
            {roleExpanded ? (
              <>
                <Text className='miniscript-hero__beat'>表面：{myRole.alibi}</Text>
                {myRole.secretAgenda ? (
                  <Text className='miniscript-hero__secret'>你的秘密：{myRole.secretAgenda}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {isHost && currentActData ? (
          <View className='miniscript-hero__section'>
            <View
              className='miniscript-hero__section-header'
              onClick={() => setShowBeats((v) => !v)}
              role='button'
              aria-expanded={showBeats}
              aria-label='主持人提词'
            >
              <Text className='miniscript-hero__section-title'>主持人提词</Text>
              <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showBeats ? '▼' : '▶'}</Text>
            </View>
            {showBeats
              ? currentActData.beats.map((beat, index) => (
                  <Text key={index} className='miniscript-hero__beat'>· {sanitizeDisplayText(beat)}</Text>
                ))
              : null}
          </View>
        ) : null}

        {deductionHints.length > 0 ? (
          <View className='miniscript-hero__section'>
            <View
              className='miniscript-hero__section-header'
              onClick={() => setShowDeductionHints(!showDeductionHints)}
              role='button'
              aria-expanded={showDeductionHints}
              aria-label='推理提示'
            >
              <Text className='miniscript-hero__section-title'>推理提示（{deductionHints.length}）</Text>
              <Text className='miniscript-hero__section-toggle' aria-hidden='true'>{showDeductionHints ? '▼' : '▶'}</Text>
            </View>
            {showDeductionHints && deductionHints.map((hint) => (
              <Text key={hint.stepNumber} className='miniscript-hero__beat'>
                步骤 {hint.stepNumber}：{hint.conclusion}
              </Text>
            ))}
          </View>
        ) : null}
      </>
    ),
    [
      newClues,
      revealedClues,
      myRole,
      roleExpanded,
      currentActData,
      isHost,
      deductionHints,
      showAllClues,
      showBeats,
      showDeductionHints,
    ],
  )

  const myVotedLabel = useMemo(
    () =>
      myVote
        ? (typeof myVote.suspectRoleSlot === 'number'
            ? characters.find((c) => c.slotIndex === myVote.suspectRoleSlot! - 1)?.roleLabel
            : undefined) ?? myVote.who ?? ''
        : '',
    [myVote, characters],
  )
  const waitingOnCount = useMemo(
    () => Math.max(0, voteProgress.totalAssigned - voteProgress.votedCount),
    [voteProgress.totalAssigned, voteProgress.votedCount],
  )

  const voteContent = useMemo(
    () => (
      <>
        {myVote && !voteEditing ? (
          <View className='miniscript-hero__vote-status'>
            <Text className='miniscript-hero__vote-status-text'>
              已投给 {myVotedLabel || '一位角色'}{waitingOnCount > 0 ? ` · 还在等 ${waitingOnCount} 位` : ''}
            </Text>
            <View
              className='miniscript-hero__vote-change'
              role='button'
              aria-label='改票'
              onClick={() => {
                haptics('light')
                setVoteEditing(true)
              }}
            >
              <Text>改票</Text>
            </View>
          </View>
        ) : (
          <>
            <View className='miniscript-hero__section'>
              <Text className='miniscript-hero__section-title'>你怀疑谁？</Text>
              <View className='miniscript-hero__vote-chips'>
                {characters.map((role) => {
                  const slot = role.slotIndex + 1
                  const selected = suspectSlot === slot
                  return (
                    <View
                      key={role.slotIndex}
                      className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                      role='button'
                      aria-label={`${role.roleLabel}${selected ? '，已选择' : '，未选择'}`}
                      aria-pressed={selected}
                      onClick={() => {
                        haptics('light')
                        setSuspectSlot(slot)
                      }}
                    >
                      <Text>{role.roleLabel}</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            {voteOptions ? (
              <>
                <View className='miniscript-hero__section'>
                  <Text className='miniscript-hero__section-title'>具体做了什么？</Text>
                  <View className='miniscript-hero__vote-chips'>
                    {voteOptions.what.map((option) => {
                      const selected = voteWhat === option
                      return (
                        <View
                          key={option}
                          className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                          role='button'
                          aria-pressed={selected}
                          aria-label={option}
                          onClick={() => {
                            haptics('light')
                            setVoteWhat(selected ? '' : option)
                          }}
                        >
                          <Text>{option}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
                <View className='miniscript-hero__section'>
                  <Text className='miniscript-hero__section-title'>为什么？</Text>
                  <View className='miniscript-hero__vote-chips'>
                    {voteOptions.why.map((option) => {
                      const selected = voteWhy === option
                      return (
                        <View
                          key={option}
                          className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                          role='button'
                          aria-pressed={selected}
                          aria-label={option}
                          onClick={() => {
                            haptics('light')
                            setVoteWhy(selected ? '' : option)
                          }}
                        >
                          <Text>{option}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </>
            ) : (
              <View className='miniscript-hero__section'>
                <Text className='miniscript-hero__section-title'>还有想说的吗？</Text>
                <Input
                  className='miniscript-hero__vote-input'
                  value={voteReason}
                  onInput={(e) => setVoteReason(e.detail.value)}
                  placeholder='说说你的推理（可跳过）'
                  maxlength={200}
                />
              </View>
            )}

            <Button
              variant='primary'
              onClick={handleSubmitVote}
              disabled={isVoting || suspectSlot === null}
              loading={isVoting}
            >
              {isVoting ? '提交中…' : '提交投票'}
            </Button>
          </>
        )}
        <View
          className='miniscript-hero__link'
          role='button'
          aria-label={`返回第 ${totalActs} 幕`}
          onClick={() => {
            haptics('light')
            setFinalActSubView('act')
          }}
        >
          <Text>‹ 返回第 {totalActs} 幕</Text>
        </View>
      </>
    ),
    [
      myVote,
      voteEditing,
      myVotedLabel,
      waitingOnCount,
      characters,
      suspectSlot,
      voteOptions,
      voteWhat,
      voteWhy,
      voteReason,
      isVoting,
      totalActs,
      handleSubmitVote,
    ],
  )

  const culpritCharacter = useMemo(() => {
    if (!revealedSolution) return undefined
    if (typeof revealedSolution.whoSlot === 'number') {
      return characters.find((c) => c.slotIndex + 1 === revealedSolution.whoSlot)
    }
    return characters.find((c) => c.roleLabel === revealedSolution.who)
  }, [revealedSolution, characters])
  const guessedCount = culpritCharacter
    ? voteProgress.tally.find((t) => t.roleSlot === culpritCharacter.slotIndex + 1)?.count ?? 0
    : undefined
  // Slot-based tally (Wave-1) with a legacy free-text fallback for sessions
  // whose votes predate suspectRoleSlot.
  const tallyRows = useMemo(
    () =>
      voteProgress.tally.length > 0
        ? voteProgress.tally.map((t) => ({
            key: `slot-${t.roleSlot}`,
            label: characters.find((c) => c.slotIndex === t.roleSlot - 1)?.roleLabel ?? `角色 ${t.roleSlot}`,
            count: t.count,
          }))
        : (() => {
            const counts = new Map<string, number>()
            allVotes.forEach((v) => {
              const key = v.who ?? '未指明'
              counts.set(key, (counts.get(key) ?? 0) + 1)
            })
            return Array.from(counts.entries())
              .map(([label, count]) => ({ key: label, label, count }))
              .sort((a, b) => b.count - a.count)
          })(),
    [voteProgress.tally, characters, allVotes],
  )

  const truthContent = useMemo(
    () =>
      framework ? (
        <>
          <View className='miniscript-hero__section miniscript-hero__section--truth'>
            {revealedSolution ? (
              <>
                <Text className='miniscript-hero__truth-label'>真相人物</Text>
                <Text className='miniscript-hero__truth-who'>{culpritCharacter?.roleLabel ?? revealedSolution.who}</Text>
                <Text className='miniscript-hero__truth-label'>发生了什么</Text>
                <Text className='miniscript-hero__beat'>{revealedSolution.what}</Text>
                <Text className='miniscript-hero__truth-label'>背后原因</Text>
                <Text className='miniscript-hero__beat'>{revealedSolution.why}</Text>
                {guessedCount !== undefined ? (
                  <Text className='miniscript-hero__truth-guessed'>{guessedCount} 人猜中了！</Text>
                ) : null}
              </>
            ) : (
              <Text className='miniscript-hero__beat'>真相正在同步，请稍候。</Text>
            )}
          </View>

          <View className='miniscript-hero__section'>
            <Text className='miniscript-hero__section-title'>认领小秘密</Text>
            <Text className='miniscript-hero__confession'>{sanitizeDisplayText(framework.ending.confessionMechanic)}</Text>
            {characters.map((role) => {
              const isMine = myRole?.slotIndex === role.slotIndex
              if (isMine && myRole?.secretAgenda) {
                return (
                  <View key={role.slotIndex} className='miniscript-hero__confess-card'>
                    <CardFlip
                      flipped={confessFlipped}
                      onFlip={() => setConfessFlipped((f) => !f)}
                      front={
                        <View className='miniscript-hero__confess-front'>
                          <Text className='miniscript-hero__confess-role'>{role.roleLabel}</Text>
                          <Text className='miniscript-hero__confess-hint'>你的秘密 · 轻触亮相</Text>
                        </View>
                      }
                      back={
                        <View className='miniscript-hero__confess-back'>
                          <Text className='miniscript-hero__confess-role'>{role.roleLabel}</Text>
                          <Text className='miniscript-hero__confess-secret'>你的秘密：{myRole.secretAgenda}</Text>
                        </View>
                      }
                    />
                  </View>
                )
              }
              return (
                <View key={role.slotIndex} className='miniscript-hero__confess-card'>
                  <Text className='miniscript-hero__confess-role'>{role.roleLabel}</Text>
                  <Text className='miniscript-hero__confess-hint'>
                    {isHost ? '请 TA 大声说出自己的秘密' : '等 TA 亲口说出秘密'}
                  </Text>
                </View>
              )
            })}
          </View>

          {tallyRows.length > 0 ? (
            <View className='miniscript-hero__section'>
              <Text className='miniscript-hero__section-title'>投票结果</Text>
              {tallyRows.map((row) => (
                <View key={row.key} className='miniscript-hero__vote-row'>
                  <Text className='miniscript-hero__beat'>{row.label}</Text>
                  <Text className='miniscript-hero__vote-count'>{row.count} 票</Text>
                </View>
              ))}
              <Text className='miniscript-hero__vote-total'>共 {voteProgress.votedCount} 人参与投票</Text>
            </View>
          ) : null}

          <View className='miniscript-hero__still'>
            <Text className='miniscript-hero__still-label'>今晚剧照</Text>
            <Text className='miniscript-hero__still-title'>{scriptTitle}</Text>
            <View className='miniscript-hero__still-roles'>
              {characters.map((role) => (
                <Text key={role.slotIndex} className='miniscript-hero__still-role'>{role.roleLabel}</Text>
              ))}
            </View>
            <Text className='miniscript-hero__still-outcome'>{sanitizeDisplayText(framework.ending.resolutionSummary)}</Text>
          </View>
        </>
      ) : null,
    [
      framework,
      revealedSolution,
      culpritCharacter,
      guessedCount,
      characters,
      myRole,
      confessFlipped,
      tallyRows,
      voteProgress.votedCount,
      scriptTitle,
    ],
  )

  // ── Stable shell: ONE outer card across all sub-phases (H). Only the keyed
  // inner content swaps — the card (and its entrance animation) mounts once,
  // and act-to-act transitions ride the same 240ms content fade (B: the old
  // full-card CurtainRise overlay is gone).
  return (
    <View className='miniscript-hero'>
      {solutionRevealed && (
        <View className='miniscript-hero__burst'>
          <ParticleBurst trigger={burstTrigger} type='confetti' count={40} />
        </View>
      )}

      {currentStep >= 0 && <ProgressStepper labels={stepLabels} currentStep={currentStep} />}

      <PhaseHeroCard
        phase='mini_script'
        title={heroTitle}
        prompt={heroPrompt}
        statusText={heroStatusText}
        doneCount={heroDoneCount}
        totalCount={heroTotalCount}
        actions={heroActions}
      >
        <View key={`${subPhase}:${currentAct}`} className='miniscript-hero__content'>
          {subPhase !== 'empty' ? <Text className='miniscript-hero__identity'>{identityLine}</Text> : null}
          {instruction ? (
            <View className='miniscript-hero__instruction'>
              {subPhase === 'act' ? (
                <Text className='miniscript-hero__instruction-label'>本幕任务</Text>
              ) : null}
              <Text className='miniscript-hero__instruction-text'>{instruction}</Text>
            </View>
          ) : null}

          {subPhase === 'preview' && isHost ? previewContent : null}
          {subPhase === 'preview' && !isHost ? waitingContent : null}
          {subPhase === 'role' ? roleContent : null}
          {subPhase === 'act' ? actContent : null}
          {subPhase === 'vote' ? voteContent : null}
          {subPhase === 'truth' ? truthContent : null}

          {subPhase === 'act' || subPhase === 'vote' || subPhase === 'truth' ? (
            <PhaseAigcRow meta={session.miniScriptFrameworkMeta} reason='AI 生成剧本内容' />
          ) : null}
        </View>
      </PhaseHeroCard>
    </View>
  )
}
