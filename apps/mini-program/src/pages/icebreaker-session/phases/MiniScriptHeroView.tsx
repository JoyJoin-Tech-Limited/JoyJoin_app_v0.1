import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  type MiniScriptPlayerResult,
  type MiniScriptPresentedEvidence,
  type MiniScriptVote,
  type SocialSessionState,
} from '@shared/socialIcebreaker'
import {
  computeMiniScriptVoteProgress,
  resolveMiniScriptTitle,
  type MiniScriptVoteInput,
} from '@shared/miniscriptStoryFramework'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { haptics } from '../../../lib/utils/haptics'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { useResetOnShow } from '../../../hooks/useResetOnShow'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { CardFlip, ParticleBurst } from '../../../components/reveal'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { TOAST_DEFAULT_MS } from '../../../lib/utils/uiConstants'
import type { SessionParticipant } from '../phaseUtils'
import {
  MINISCRIPT_EVIDENCE_HINT_STORAGE_KEY,
  MINISCRIPT_MOTIVE_HINT_STORAGE_KEY,
} from '../sessionShellLogic'
import { MiniScriptEvidenceTray } from './MiniScriptEvidenceTray'
import { MiniScriptClueDrawer } from './MiniScriptClueDrawer'
import {
  frameworkHasAnyEvidence,
  resolveHasMotiveRound,
  roundOneVotes,
  roundTwoVotes,
} from './miniScriptV2Model'
import {
  TRUTH_CEREMONY_CONTINUE_HINT,
  TRUTH_CEREMONY_HOST_NEXT_CTA,
  TRUTH_CEREMONY_STAGE_HAPTIC,
  TRUTH_CEREMONY_STAGE_TITLE,
  TRUTH_CEREMONY_WAITING_HOST_HINT,
  planTruthCeremony,
} from './miniScriptTruthCeremonyModel'
import { useTruthCeremonyStage } from './useTruthCeremonyStage'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

// Module-level empty fallbacks — a `?? []` inline allocates a fresh array on
// every render, which busts every downstream useMemo keyed on the value
// (perf-audit memo hygiene). Typed once, frozen by usage.
const EMPTY_VOTES: MiniScriptVote[] = []
const EMPTY_PRESENTED_EVIDENCE: MiniScriptPresentedEvidence[] = []
const EMPTY_PLAYER_RESULTS: MiniScriptPlayerResult[] = []
const EMPTY_REVEALED_CLUES: Array<{ clueId: string; text: string; revealedInAct?: number }> = []
const EMPTY_DEDUCTION_HINTS: Array<{ stepNumber: number; conclusion: string }> = []
const EMPTY_MOTIVE_OPTIONS: string[] = []

/** Best-effort storage read for one-time hints (mirrors the coachmark
 *  precedent in the session page — persistence failure still shows the hint). */
function readHintSeen(key: string): boolean {
  try {
    return Taro.getStorageSync(key) === '1'
  } catch {
    return false
  }
}

function persistHintSeen(key: string): void {
  try {
    Taro.setStorageSync(key, '1')
  } catch {
    // Storage full / unavailable — hint may re-show next session; acceptable.
  }
}

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

/** V2 P3: shared 本桌名侦探 honor-card markup — ceremony stage D and the
 *  steady-state truth view render the same cards (the staggered pop-in lives
 *  in CSS; the reduced-motion media query flattens it). `privateLine` is the
 *  viewer's own result — it stays on their device only. */
function HonorCardList({ honorNames, privateLine }: { honorNames: string[]; privateLine: string | null }) {
  return (
    <View className='miniscript-hero__honor-cards'>
      {honorNames.length > 0 ? (
        honorNames.map((name, index) => (
          <View key={`${name}-${index}`} className='miniscript-hero__honor-card'>
            <JoyJoinIcon emoji='🔍' size={32} />
            <Text className='miniscript-hero__honor-name'>{name}</Text>
          </View>
        ))
      ) : (
        <Text className='miniscript-hero__honor-empty'>今晚的真相藏得真好，没有人两步全中</Text>
      )}
      {privateLine ? <Text className='miniscript-hero__honor-private'>{privateLine}</Text> : null}
    </View>
  )
}

export function MiniScriptHeroView({
  session,
  currentUserId,
  isHost,
  playerCount,
  participants = [],
  onAssignRoles,
  onRevealAct,
  onVote,
  onPresentEvidence,
  onConfirmRead,
  onAdvanceCeremony,
  onOpenMotiveVote,
  onRevealSolution,
  onAdvance,
  onReady,
  isAssigningRoles,
  isRevealingAct,
  isVoting,
  isPresentingEvidence = false,
  isAdvancingCeremony = false,
  isOpeningMotiveVote = false,
  isRevealingSolution,
  isAdvancing,
  isSettingReady,
}: {
  session: SocialSessionState
  currentUserId: string
  isHost: boolean
  playerCount: number
  participants?: SessionParticipant[]
  onAssignRoles: () => void
  onRevealAct: (targetAct: number) => void
  onVote: (vote: MiniScriptVoteInput) => void
  /** V2 P2: present evidence to a role; resolves the reaction text on success. */
  onPresentEvidence?: (evidenceId: string, targetRoleSlot: number) => Promise<string | null>
  /** V2 P3: presenter's 已读完 early release (POST confirm-read, idempotent). */
  onConfirmRead?: (evidenceId: string, targetRoleSlot: number) => void
  /** V2 P3 (host): advance the truth-ceremony beat (culprit → honor). */
  onAdvanceCeremony?: () => void
  /** V2 P2 (host): open round 2 (motive vote). */
  onOpenMotiveVote?: () => void
  /** Fires the reveal-solution action; optional onError receives the raw action
   *  error (the hook suppresses its default toast when a handler is given). */
  onRevealSolution: (onError?: (error: unknown) => void) => void
  onAdvance: () => void
  onReady?: (ready: boolean) => void
  isAssigningRoles: boolean
  isRevealingAct: boolean
  isVoting: boolean
  isPresentingEvidence?: boolean
  isAdvancingCeremony?: boolean
  isOpeningMotiveVote?: boolean
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
  // ── V2 P2: flag snapshot + two-round vote derivation (contract AC-05/10/13) ──
  const v2Enabled = session.miniScriptV2Enabled === true
  const motiveOptions = framework?.motiveOptions
  const hasMotiveRound = resolveHasMotiveRound(v2Enabled, motiveOptions)
  const voteRound: 1 | 2 = hasMotiveRound && session.miniScriptVoteRound === 2 ? 2 : 1
  // Per-round ballot filters — semantics mirror sanitizeStateForClient exactly
  // (round-less ballots are legacy round 1). `myVote` stays the round-1 ballot
  // so the existing suspect form is untouched; round 2 gets its own.
  const allVotes = session.miniScriptVotes ?? EMPTY_VOTES
  const suspectVotes = useMemo(() => roundOneVotes(allVotes), [allVotes])
  const motiveVotes = useMemo(() => roundTwoVotes(allVotes), [allVotes])
  const myVote = suspectVotes.find((v) => v.userId === currentUserId)
  const myMotiveVote = motiveVotes.find((v) => v.userId === currentUserId)
  const assignedPlayerIds = Object.keys(session.miniScriptRoleAssignments ?? {})
  const readyMap = session.miniScriptPlayerReady ?? {}
  const isReady = readyMap[currentUserId] ?? false
  const readyCount = Object.values(readyMap).filter(Boolean).length
  const deductionHints = session.miniScriptDeductionHints ?? EMPTY_DEDUCTION_HINTS
  const revealedClues = session.miniScriptRevealedClues ?? EMPTY_REVEALED_CLUES
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
  // canReveal never fork between client and server. V2 P2 (AC-13 client half):
  // each round's fallback filters ballots by round, mirroring the server.
  const voteProgress = session.miniScriptVoteProgress ?? computeMiniScriptVoteProgress({
    votes: suspectVotes,
    totalAssigned: assignedPlayerIds.length,
    voteOpenedAt: session.miniScriptVoteOpenedAt,
  })
  const motiveVoteProgress = session.miniScriptMotiveVoteProgress ?? computeMiniScriptVoteProgress({
    votes: motiveVotes,
    totalAssigned: assignedPlayerIds.length,
    voteOpenedAt: session.miniScriptMotiveVoteOpenedAt,
  })
  const activeVoteProgress = voteRound === 2 ? motiveVoteProgress : voteProgress
  // Round-1 reveal authority stays on voteProgress.canReveal (the exact
  // server-recomputed quorum/90s signal the privacy contract locks); round 2
  // mirrors it through the independent motive progress.
  const activeCanReveal = voteRound === 2 ? motiveVoteProgress.canReveal : voteProgress.canReveal
  const votesRemaining = Math.max(0, activeVoteProgress.quorum - activeVoteProgress.votedCount)

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

  // Round-2 (motive) vote form — only live when hasMotiveRound && voteRound
  // === 2; mirrors the round-1 form's confirm-then-collapse lifecycle.
  const [motiveEditing, setMotiveEditing] = useState(true)
  const [motiveChoice, setMotiveChoice] = useState<number | null>(null)
  const motiveSigRef = useRef<string | null>(null)
  const wasVotingRef2 = useRef(isVoting)

  // One-time Xiaoyue hints (contract AC-10): evidence presenting + round 2.
  const [evidenceHintSeen, setEvidenceHintSeen] = useState(() =>
    readHintSeen(MINISCRIPT_EVIDENCE_HINT_STORAGE_KEY),
  )
  const [motiveHintSeen, setMotiveHintSeen] = useState(() =>
    readHintSeen(MINISCRIPT_MOTIVE_HINT_STORAGE_KEY),
  )

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

  // Entering round 2 (host opened the motive vote) reseeds the motive form
  // from the polled ballot — a rejoin mid-round-2 lands on the same state.
  const prevVoteRoundRef = useRef(voteRound)
  useEffect(() => {
    if (voteRound !== prevVoteRoundRef.current) {
      prevVoteRoundRef.current = voteRound
      setMotiveChoice(myMotiveVote?.motiveChoice ?? null)
      setMotiveEditing(!myMotiveVote)
    }
  }, [voteRound, myMotiveVote])

  // Collapse the motive form only once the poll confirms the ballot we
  // actually submitted (same contract as the round-1 form).
  useEffect(() => {
    if (wasVotingRef2.current && !isVoting && myMotiveVote && motiveSigRef.current) {
      if (String(myMotiveVote.motiveChoice ?? -1) === motiveSigRef.current) {
        setMotiveEditing(false)
        motiveSigRef.current = null
      }
    }
    wasVotingRef2.current = isVoting
  }, [isVoting, myMotiveVote])

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
        return voteRound === 2 ? '再选一个你觉得最像的动机。' : '点一个你最怀疑的角色。'
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
    if (activeCanReveal) {
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

  const handleSubmitVote = useCallback(() => {
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
  }, [suspectSlot, voteOptions, voteWhat, voteWhy, voteReason, onVote])

  const handleSubmitMotiveVote = useCallback(() => {
    if (motiveChoice === null) return
    haptics('success')
    motiveSigRef.current = String(motiveChoice)
    onVote({ voteRound: 2, motiveChoice })
  }, [motiveChoice, onVote])

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
        ? `${activeVoteProgress.votedCount}/${activeVoteProgress.totalAssigned} 已投票`
        : subPhase === 'truth'
          ? '游戏结束'
          : undefined

  const heroDoneCount = subPhase === 'role'
    ? readyCount
    : subPhase === 'vote'
      ? activeVoteProgress.votedCount
      : subPhase === 'truth'
        ? playerCount
        : undefined
  const heroTotalCount = subPhase === 'role'
    ? playerCount
    : subPhase === 'vote'
      ? activeVoteProgress.totalAssigned
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
            {voteRound === 1 && hasMotiveRound && onOpenMotiveVote ? (
              <Button
                variant='primary'
                onClick={() => {
                  haptics('medium')
                  onOpenMotiveVote()
                }}
                disabled={isOpeningMotiveVote}
                loading={isOpeningMotiveVote}
              >
                {isOpeningMotiveVote ? '开启中…' : '进入动机投票'}
              </Button>
            ) : null}
            <Button
              variant={voteRound === 1 && hasMotiveRound ? 'secondary' : 'primary'}
              onClick={handleRevealSolutionTap}
              disabled={isRevealingSolution}
              loading={isRevealingSolution}
            >
              {isRevealingSolution ? '揭晓中…' : '揭晓真相'}
            </Button>
            {!activeCanReveal ? (
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

  const roleNeedsScroll = Boolean(
    myRole && [myRole.sinHook, myRole.alibi, myRole.secretAgenda].join('').length > 64,
  )

  const roleContent = useMemo(
    () => (
      <>
        <View className='miniscript-hero__role-flip'>
          <CardFlip
            flipped={roleFlipped}
            onFlip={() => {
              if (!roleFlipped) setRoleFlipped(true)
            }}
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
                    <ScrollView
                      className='miniscript-hero__role-back-scroll'
                      scrollY
                      enhanced
                      showScrollbar={false}
                      aria-label='角色详情，可上下滑动'
                    >
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
                    </ScrollView>
                    {roleNeedsScroll ? (
                      <Text className='miniscript-hero__role-back-scroll-hint'>向上滑动查看更多</Text>
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
    [roleFlipped, myRole, premiseText, roleNeedsScroll, showPremise],
  )

  const newClues = useMemo(
    () => revealedClues.filter((c) => newClueIds.includes(c.clueId)),
    [revealedClues, newClueIds],
  )

  // V2 P2 surfaces: evidence tray (AC-08) + clue drawer (AC-09) hide entirely
  // when the flag snapshot is off or the framework has no evidence — the exact
  // legacy UI remains for old scripts.
  const showEvidenceTray =
    v2Enabled && framework !== undefined && frameworkHasAnyEvidence(framework) && onPresentEvidence !== undefined
  const showClueDrawer = v2Enabled && framework !== undefined
  const showEvidenceHint = showEvidenceTray && !evidenceHintSeen

  const dismissEvidenceHint = () => {
    haptics('light')
    setEvidenceHintSeen(true)
    persistHintSeen(MINISCRIPT_EVIDENCE_HINT_STORAGE_KEY)
  }
  const dismissMotiveHint = () => {
    haptics('light')
    setMotiveHintSeen(true)
    persistHintSeen(MINISCRIPT_MOTIVE_HINT_STORAGE_KEY)
  }

  const actContent = useMemo(
    () => (
      <>
        {showClueDrawer && framework ? (
          <MiniScriptClueDrawer
            framework={framework}
            revealedClues={revealedClues}
            currentAct={currentAct}
          />
        ) : null}

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

        {showEvidenceHint ? (
          <View className='miniscript-hero__hint' role='note'>
            <Image
              className='miniscript-hero__hint-mascot'
              src={localAsset('/assets/mascot/xiaoyue-coach.webp')}
              mode='aspectFit'
            />
            <Text className='miniscript-hero__hint-text'>把证物出示给想试探的人，听听 TA 怎么说</Text>
            <View
              className='miniscript-hero__hint-dismiss'
              role='button'
              aria-label='知道了'
              onClick={dismissEvidenceHint}
            >
              <Text className='miniscript-hero__hint-dismiss-text'>知道了</Text>
            </View>
          </View>
        ) : null}

        {showEvidenceTray && framework ? (
          <MiniScriptEvidenceTray
            framework={framework}
            currentAct={currentAct}
            characters={characters}
            presentedEvidence={session.miniScriptPresentedEvidence ?? EMPTY_PRESENTED_EVIDENCE}
            currentUserId={currentUserId}
            isPresenting={isPresentingEvidence}
            presentingClosed={session.miniScriptVoteOpenedAt !== undefined}
            onPresent={onPresentEvidence!}
            onConfirmRead={onConfirmRead}
          />
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
      showEvidenceTray,
      showEvidenceHint,
      showClueDrawer,
      framework,
      currentAct,
      characters,
      session.miniScriptPresentedEvidence,
      session.miniScriptVoteOpenedAt,
      currentUserId,
      isPresentingEvidence,
      onPresentEvidence,
      onConfirmRead,
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
  // V2 P3: once round 1 can close (server canReveal authority) and a motive
  // round exists, the player ballot no longer says 还在等 N 位 — the next
  // step is the HOST opening round 2, so say that explicitly.
  const waitingForMotiveOpen = !isHost && hasMotiveRound && voteRound === 1 && voteProgress.canReveal

  const voteContent = useMemo(
    () => (
      <>
        {myVote && !voteEditing ? (
          <View className='miniscript-hero__vote-status'>
            <Text className='miniscript-hero__vote-status-text'>
              已投给 {myVotedLabel || '一位角色'}
              {waitingForMotiveOpen ? ' · 等待主持人开启动机投票' : waitingOnCount > 0 ? ` · 还在等 ${waitingOnCount} 位` : ''}
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
                  <Text className='miniscript-hero__section-title'>随口聊聊你的推理</Text>
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
      waitingForMotiveOpen,
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

  // ── Round 2 (motive) ballot — only rendered when voteRound === 2, which
  // itself requires hasMotiveRound (flag snapshot on + motiveOptions[]). ──
  const myMotiveLabel = myMotiveVote && typeof myMotiveVote.motiveChoice === 'number'
    ? motiveOptions?.[myMotiveVote.motiveChoice] ?? ''
    : ''
  const motiveWaitingCount = Math.max(0, motiveVoteProgress.totalAssigned - motiveVoteProgress.votedCount)
  const showMotiveHint = voteRound === 2 && !motiveHintSeen

  const motiveVoteContent = useMemo(
    () => (
      <>
        {showMotiveHint ? (
          <View className='miniscript-hero__hint' role='note'>
            <Image
              className='miniscript-hero__hint-mascot'
              src={localAsset('/assets/mascot/xiaoyue-coach.webp')}
              mode='aspectFit'
            />
            <Text className='miniscript-hero__hint-text'>还没完——再猜猜 TA 为什么这么做</Text>
            <View
              className='miniscript-hero__hint-dismiss'
              role='button'
              aria-label='知道了'
              onClick={dismissMotiveHint}
            >
              <Text className='miniscript-hero__hint-dismiss-text'>知道了</Text>
            </View>
          </View>
        ) : null}

        {myMotiveVote && !motiveEditing ? (
          <View className='miniscript-hero__vote-status'>
            <Text className='miniscript-hero__vote-status-text'>
              动机已投给「{myMotiveLabel || '一个选项'}」{motiveWaitingCount > 0 ? ` · 还在等 ${motiveWaitingCount} 位` : ''}
            </Text>
            <View
              className='miniscript-hero__vote-change'
              role='button'
              aria-label='改票'
              onClick={() => {
                haptics('light')
                setMotiveEditing(true)
              }}
            >
              <Text>改票</Text>
            </View>
          </View>
        ) : (
          <>
            <View className='miniscript-hero__section'>
              <Text className='miniscript-hero__section-title'>TA 为什么这么做？</Text>
              <View className='miniscript-hero__vote-chips'>
                {(motiveOptions ?? EMPTY_MOTIVE_OPTIONS).map((option, index) => {
                  const selected = motiveChoice === index
                  return (
                    <View
                      key={option}
                      className={`miniscript-hero__vote-chip${selected ? ' miniscript-hero__vote-chip--selected' : ''}`}
                      role='button'
                      aria-label={`${option}${selected ? '，已选择' : '，未选择'}`}
                      aria-pressed={selected}
                      onClick={() => {
                        haptics('light')
                        setMotiveChoice(index)
                      }}
                    >
                      <Text>{option}</Text>
                    </View>
                  )
                })}
              </View>
            </View>

            <Button
              variant='primary'
              onClick={handleSubmitMotiveVote}
              disabled={isVoting || motiveChoice === null}
              loading={isVoting}
            >
              {isVoting ? '提交中…' : '提交动机'}
            </Button>
          </>
        )}
      </>
    ),
    [
      showMotiveHint,
      myMotiveVote,
      motiveEditing,
      myMotiveLabel,
      motiveWaitingCount,
      motiveOptions,
      motiveChoice,
      isVoting,
      handleSubmitMotiveVote,
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

  // V2 P2 two-step results (contract AC-10): the public honor list shows ONLY
  // dual-correct players (两步全对); wrong players see gentle private
  // feedback on their own device only — nobody is named publicly for a miss.
  const playerResults = session.miniScriptRevealedPlayerResults ?? EMPTY_PLAYER_RESULTS
  const showTwoStepResults = hasMotiveRound && playerResults.some((r) => r.round2Correct !== undefined)
  // honorNames feeds two large content memos (truthContent / ceremonyContent);
  // the raw playerResults/participants arrays are fresh objects on every 3s
  // poll, so key the memo on a scalar content signature instead — an
  // unchanged re-poll keeps the array identity and the memos hold.
  const honorSignature = showTwoStepResults
    ? `${playerResults.map((r) => `${r.userId}:${r.round1Correct}:${r.round2Correct}`).join('|')}#${participants.map((p) => `${p.userId}:${p.displayName ?? ''}`).join('|')}`
    : ''
  const honorNames = useMemo(
    () =>
      showTwoStepResults
        ? playerResults
            .filter((r) => r.round1Correct === true && r.round2Correct === true)
            .map((r) => participants.find((p) => p.userId === r.userId)?.displayName ?? '一位玩家')
        : [],
    // honorSignature captures the exact playerResults + participants content
    // this derivation reads; the raw arrays would bust the memo every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showTwoStepResults, honorSignature],
  )
  const myResult = playerResults.find((r) => r.userId === currentUserId)
  const myDualCorrect = myResult?.round1Correct === true && myResult?.round2Correct === true
  // V2 P3: the viewer's own two-step outcome, shared by the ceremony honor
  // stage and the steady-state truth view — gentle, private, never public.
  const honorPrivateLine = myDualCorrect
    ? '你两步全对，名侦探就是你'
    : myResult && revealedSolution
      ? `差一点点——当事人其实是 ${culpritCharacter?.roleLabel ?? revealedSolution.who}，真动机是「${revealedSolution.why}」`
      : null
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
            suspectVotes.forEach((v) => {
              const key = v.who ?? '未指明'
              counts.set(key, (counts.get(key) ?? 0) + 1)
            })
            return Array.from(counts.entries())
              .map(([label, count]) => ({ key: label, label, count }))
              .sort((a, b) => b.count - a.count)
          })(),
    [voteProgress.tally, characters, suspectVotes],
  )

  // ── V2 P3: staged truth-reveal ceremony ──
  // planTruthCeremony is pure; the hook is the SOLE owner of stage timing
  // (AnalyzingAnimation precedent) and owns rejoin/swipe-back completion.
  // Deps stay scalar so a re-polled but unchanged plan keeps its identity —
  // a new plan object every 3s poll would starve the stage auto-advance.
  const { shouldReduceMotion } = useMiniRevealMotion()
  const hasMotiveText = Boolean(revealedSolution?.why)
  const hasTallyRows = tallyRows.length > 0
  const ceremonyPlan = useMemo(
    () =>
      planTruthCeremony({
        solutionRevealed,
        v2Enabled,
        showTwoStepResults,
        hasMotiveText,
        hasTallyRows,
        reduceMotion: shouldReduceMotion,
      }),
    [solutionRevealed, v2Enabled, showTwoStepResults, hasMotiveText, hasTallyRows, shouldReduceMotion],
  )
  // V2 P3 Q14: host-paced beats — culprit content waits for server beat ≥ 1,
  // honor for beat ≥ 2 (advanced by the host's 下一段 CTA via
  // POST /api/miniscript/advance-ceremony; arrives on the regular poll).
  const ceremonyBeat = session.miniScriptCeremonyBeat ?? 0
  const ceremony = useTruthCeremonyStage(ceremonyPlan, solutionRevealed, ceremonyBeat)
  const showCeremony = ceremonyPlan.mode === 'staged' && !ceremony.isComplete && revealedSolution !== undefined

  // Stage-entry haptics ride the stage machine (heavy on the culprit land,
  // success on the honor reveal); the map keeps silent stages silent. Gated
  // on stageRevealed so a host-paced beat fires when the server's beat
  // actually lands — not when the stage machine parks on the hold.
  const ceremonyStage = ceremony.stage
  const ceremonyStageRevealed = ceremony.stageRevealed
  useEffect(() => {
    if (!ceremonyStage || !ceremonyStageRevealed) return
    const haptic = TRUTH_CEREMONY_STAGE_HAPTIC[ceremonyStage]
    if (haptic) haptics(haptic)
  }, [ceremonyStage, ceremonyStageRevealed])

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
                {showTwoStepResults ? (
                  <View className='miniscript-hero__honor'>
                    <Text className='miniscript-hero__honor-title'>本桌名侦探</Text>
                    <HonorCardList honorNames={honorNames} privateLine={honorPrivateLine} />
                  </View>
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
      showTwoStepResults,
      honorNames,
      honorPrivateLine,
      characters,
      myRole,
      confessFlipped,
      tallyRows,
      voteProgress.votedCount,
      scriptTitle,
    ],
  )

  // ── V2 P3: ceremony stage content — one focused beat per stage, keyed so
  // each stage swap re-runs its entrance animation. Tapping anywhere advances
  // (user skip); the hook owns the auto-advance timers. Host-paced beats
  // (culprit / honor) park on a hold view until the server's
  // miniScriptCeremonyBeat advances — the host gets a 下一段 CTA, everyone
  // else a waiting hint, and tap-through is disabled while held. Once the
  // ceremony completes, the steady-state truthContent above renders in full.
  const ceremonyContent = useMemo(() => {
    const stage = ceremony.stage
    if (!stage || !revealedSolution) return null
    const revealed = ceremony.stageRevealed
    return (
      <View
        className='miniscript-hero__ceremony'
        role={revealed ? 'button' : undefined}
        aria-label={revealed ? TRUTH_CEREMONY_CONTINUE_HINT : undefined}
        onClick={
          revealed
            ? () => {
                haptics('light')
                ceremony.advance()
              }
            : undefined
        }
      >
        <View className='miniscript-hero__ceremony-dots' aria-hidden='true'>
          {ceremonyPlan.stages.map((dotStage, dotIndex) => (
            <View
              key={dotStage}
              className={`miniscript-hero__ceremony-dot${dotIndex === ceremony.stageIndex ? ' miniscript-hero__ceremony-dot--active' : ''}${dotIndex < ceremony.stageIndex ? ' miniscript-hero__ceremony-dot--past' : ''}`}
            />
          ))}
        </View>
        <View key={stage} className='miniscript-hero__ceremony-stage'>
          <Text className='miniscript-hero__ceremony-title'>{TRUTH_CEREMONY_STAGE_TITLE[stage]}</Text>
          {revealed && stage === 'tally' ? (
            <View className='miniscript-hero__ceremony-panel'>
              {tallyRows.map((row) => (
                <View key={row.key} className='miniscript-hero__vote-row'>
                  <Text className='miniscript-hero__beat'>{row.label}</Text>
                  <Text className='miniscript-hero__vote-count'>{row.count} 票</Text>
                </View>
              ))}
              <Text className='miniscript-hero__vote-total'>共 {voteProgress.votedCount} 人参与投票</Text>
            </View>
          ) : null}
          {revealed && stage === 'culprit' ? (
            <View className='miniscript-hero__culprit-card'>
              <Text className='miniscript-hero__culprit-label'>真相人物</Text>
              <Text className='miniscript-hero__culprit-name'>{culpritCharacter?.roleLabel ?? revealedSolution.who}</Text>
              <Text className='miniscript-hero__culprit-what'>{revealedSolution.what}</Text>
              {guessedCount !== undefined ? (
                <Text className='miniscript-hero__truth-guessed'>{guessedCount} 人猜中了！</Text>
              ) : null}
            </View>
          ) : null}
          {revealed && stage === 'motive' ? (
            <View className='miniscript-hero__motive-card'>
              <Text className='miniscript-hero__motive-label'>真动机</Text>
              <Text className='miniscript-hero__motive-text'>{revealedSolution.why}</Text>
            </View>
          ) : null}
          {revealed && stage === 'honor' ? (
            <HonorCardList honorNames={honorNames} privateLine={honorPrivateLine} />
          ) : null}
        </View>
        {/* N8: the hold block is a SIBLING of the tap-to-continue stage, not
            nested inside it — on held beats the container carries no button
            role, so the host 下一段 CTA is the only button on the beat. */}
        {!revealed ? (
          <View className='miniscript-hero__ceremony-hold'>
            {isHost && onAdvanceCeremony ? (
              <View
                className='miniscript-hero__ceremony-next'
                role='button'
                aria-label={TRUTH_CEREMONY_HOST_NEXT_CTA}
                aria-disabled={isAdvancingCeremony}
                onClick={() => {
                  if (isAdvancingCeremony) return
                  haptics('medium')
                  onAdvanceCeremony()
                }}
              >
                <Text className='miniscript-hero__ceremony-next-text'>
                  {isAdvancingCeremony ? '揭晓中…' : TRUTH_CEREMONY_HOST_NEXT_CTA}
                </Text>
              </View>
            ) : (
              <View role='status' aria-live='polite'>
                <Text className='miniscript-hero__ceremony-waiting'>{TRUTH_CEREMONY_WAITING_HOST_HINT}</Text>
              </View>
            )}
          </View>
        ) : null}
        {revealed ? (
          <Text className='miniscript-hero__ceremony-hint'>{TRUTH_CEREMONY_CONTINUE_HINT}</Text>
        ) : null}
      </View>
    )
  }, [
    ceremony.stage,
    ceremony.stageIndex,
    ceremony.stageRevealed,
    ceremony.advance,
    ceremonyPlan.stages,
    revealedSolution,
    isHost,
    onAdvanceCeremony,
    isAdvancingCeremony,
    tallyRows,
    voteProgress.votedCount,
    culpritCharacter,
    guessedCount,
    honorNames,
    honorPrivateLine,
  ])

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
          {!showCeremony && instruction ? (
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
          {/* N5: the clue bar sits at the SAME relative position in both
              act and vote views — top of the sub-phase content, directly
              below the primary instruction (act view mounts it as the first
              actContent child). */}
          {subPhase === 'vote' && showClueDrawer && framework ? (
            <MiniScriptClueDrawer
              framework={framework}
              revealedClues={revealedClues}
              currentAct={currentAct}
            />
          ) : null}
          {subPhase === 'vote' ? (voteRound === 2 ? motiveVoteContent : voteContent) : null}
          {subPhase === 'truth' ? (showCeremony ? ceremonyContent : truthContent) : null}

          {subPhase === 'act' || subPhase === 'vote' || subPhase === 'truth' ? (
            <PhaseAigcRow meta={session.miniScriptFrameworkMeta} reason='AI 生成剧本内容' />
          ) : null}
        </View>
      </PhaseHeroCard>
    </View>
  )
}
